//! the assistant: the shared AI pipeline used by every input channel (UI, voice, WhatsApp).
//! Builds a system instruction from the active list's knowledge + a task snapshot,
//! runs Gemini function-calling against the DB, then produces a natural-language
//! reply (streamed to the UI when `stream_to_ui` is set).

pub mod enhance;
pub mod gemini;
pub mod tools;
pub mod voice;

use serde_json::{json, Value};
use tauri::{Emitter, Manager};

use crate::db::now;
use crate::error::{AppError, AppResult};
use crate::secrets;
use crate::state::AppState;

const MAX_TOOL_ROUNDS: usize = 5;

/// Build the system instruction + initial `contents` array for a turn, and
/// persist the incoming user message. Returns (system, contents).
fn prepare_context(
    app: &tauri::AppHandle,
    list_id: Option<&str>,
    user_text: &str,
    source: &str,
) -> AppResult<(String, Value)> {
    let state = app.state::<AppState>();
    let conn = state.db.lock().unwrap();

    let language: Option<String> = conn
        .query_row("SELECT output_language FROM profile LIMIT 1", [], |r| r.get(0))
        .unwrap_or(None);

    let mut sys = String::new();
    sys.push_str(
        "You are a concise, friendly task assistant inside the Daylattice task manager. \
         You help the user manage their tasks. Use the provided tools to make changes; \
         after acting, confirm briefly in natural language. Prefer doing over asking when intent is clear.\n",
    );
    match &language {
        Some(lang) if !lang.is_empty() => {
            sys.push_str(&format!("Always reply in {lang}.\n"));
        }
        _ => sys.push_str("Reply in the same language the user wrote in.\n"),
    }

    // Channel-aware response style: WhatsApp has no screen, the app shows the board.
    match source {
        "whatsapp" => sys.push_str(
            "The user is on WhatsApp and cannot see the app screen. Make every reply \
             self-contained: include the relevant task titles, the list's contents, or \
             a clear summary of exactly what changed. Format it neatly for a chat \
             message (short lines, simple bullets like •).\n",
        ),
        _ => sys.push_str(
            "The user can see the board update live in the app, so keep replies short \
             and conversational; confirm what you did without re-listing everything \
             unless they ask.\n",
        ),
    }

    // Overview of every list so the assistant can switch between them or target another.
    {
        let mut stmt = conn.prepare(
            "SELECT name, (SELECT COUNT(*) FROM tasks t WHERE t.list_id = lists.id)
             FROM lists ORDER BY position, created_at",
        )?;
        let rows: Vec<(String, i64)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<Result<_, _>>()?;
        if !rows.is_empty() {
            sys.push_str(
                "\nThe user has these lists (use switch_list to change the active one, \
                 or pass a 'list' name to target another in a single action):\n",
            );
            for (n, c) in rows {
                sys.push_str(&format!("- {n} ({c} tasks)\n"));
            }
        }
    }

    if let Some(list_id) = list_id {
        if let Ok((name, knowledge)) = conn.query_row(
            "SELECT name, knowledge FROM lists WHERE id = ?1",
            rusqlite::params![list_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
        ) {
            sys.push_str(&format!("\nActive list: \"{name}\".\n"));
            if !knowledge.trim().is_empty() {
                sys.push_str(&format!("List knowledge / context:\n{knowledge}\n"));
            }
        }
        // Compact snapshot of sections + tasks.
        sys.push_str("\nCurrent board snapshot:\n");
        let mut sect_stmt = conn.prepare(
            "SELECT id, name FROM sections WHERE list_id = ?1 ORDER BY position",
        )?;
        let sections: Vec<(String, String)> = sect_stmt
            .query_map(rusqlite::params![list_id], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<Result<_, _>>()?;
        for (sid, sname) in &sections {
            sys.push_str(&format!("- Column \"{sname}\":\n"));
            let mut t_stmt = conn.prepare(
                "SELECT title, priority FROM tasks WHERE section_id = ?1 ORDER BY position LIMIT 50",
            )?;
            let tasks: Vec<(String, String)> = t_stmt
                .query_map(rusqlite::params![sid], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<Result<_, _>>()?;
            if tasks.is_empty() {
                sys.push_str("    (empty)\n");
            }
            for (title, prio) in tasks {
                sys.push_str(&format!("    • {title} [{prio}]\n"));
            }
        }
    }

    // Recent history for this scope (oldest first).
    let mut contents: Vec<Value> = Vec::new();
    {
        let mut h_stmt = conn.prepare(
            "SELECT role, content FROM sam_messages
             WHERE (?1 IS NULL AND list_id IS NULL) OR list_id = ?1
             ORDER BY created_at DESC LIMIT 10",
        )?;
        let mut rows: Vec<(String, String)> = h_stmt
            .query_map(rusqlite::params![list_id], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<Result<_, _>>()?;
        rows.reverse();
        for (role, content) in rows {
            let g_role = if role == "sam" { "model" } else { "user" };
            contents.push(json!({ "role": g_role, "parts": [{ "text": content }] }));
        }
    }

    // Persist + append the new user message.
    conn.execute(
        "INSERT INTO sam_messages (id, list_id, role, content, source, created_at)
         VALUES (?1, ?2, 'user', ?3, ?4, ?5)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), list_id, user_text, source, now()],
    )?;
    contents.push(json!({ "role": "user", "parts": [{ "text": user_text }] }));

    Ok((sys, Value::Array(contents)))
}

/// Persist the assistant's final reply.
fn persist_reply(app: &tauri::AppHandle, list_id: Option<&str>, text: &str, source: &str) {
    let state = app.state::<AppState>();
    let conn = state.db.lock().unwrap();
    let _ = conn.execute(
        "INSERT INTO sam_messages (id, list_id, role, content, source, created_at)
         VALUES (?1, ?2, 'sam', ?3, ?4, ?5)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), list_id, text, source, now()],
    );
}

/// Run a full the assistant turn. Returns the final reply text.
pub async fn run_sam(
    app: tauri::AppHandle,
    list_id: Option<String>,
    user_text: String,
    source: String,
    stream_to_ui: bool,
) -> AppResult<String> {
    let api_key = secrets::get_api_key().ok_or(AppError::NoApiKey)?;
    let (system, mut contents) =
        prepare_context(&app, list_id.as_deref(), &user_text, &source)?;
    let tools = tools::declarations();

    // The active list can change mid-turn via the switch_list tool.
    let mut current_list = list_id.clone();

    // First pass with tools.
    let mut content = gemini::generate(&api_key, &system, &contents, Some(&tools)).await?;
    let mut rounds = 0;

    let final_text;
    loop {
        let calls = gemini::function_calls(&content);
        if calls.is_empty() {
            // Model answered directly. Stream the already-produced text to the UI.
            let text = gemini::text_of(&content);
            if stream_to_ui {
                emit_chunked(&app, &text);
            }
            final_text = text;
            break;
        }

        if rounds >= MAX_TOOL_ROUNDS {
            // Safety valve: ask for a plain answer.
            final_text = if stream_to_ui {
                gemini::stream(&api_key, &system, &contents, |t| emit_token(&app, t)).await?
            } else {
                gemini::text_of(&gemini::generate(&api_key, &system, &contents, None).await?)
            };
            break;
        }
        rounds += 1;

        // Record the model's tool-call turn.
        if let Value::Array(arr) = &mut contents {
            arr.push(content.clone());
        }

        // Execute each call and collect functionResponses.
        let mut resp_parts: Vec<Value> = Vec::new();
        for call in calls {
            let name = call.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
            let args = call.get("args").cloned().unwrap_or_else(|| json!({}));
            let result = {
                let state = app.state::<AppState>();
                let conn = state.db.lock().unwrap();
                tools::execute(&app, &conn, &mut current_list, &name, &args)
                    .unwrap_or_else(|e| json!({ "ok": false, "error": e.to_string() }))
            };
            resp_parts.push(json!({
                "functionResponse": { "name": name, "response": result }
            }));
        }
        if let Value::Array(arr) = &mut contents {
            arr.push(json!({ "role": "user", "parts": resp_parts }));
        }

        // After acting, ask the model to either act more or answer. Stream when
        // we expect this to be the final natural-language turn.
        if stream_to_ui {
            // Use a non-streaming probe to detect further tool calls.
            content = gemini::generate(&api_key, &system, &contents, Some(&tools)).await?;
            if gemini::function_calls(&content).is_empty() {
                let text = gemini::text_of(&content);
                emit_chunked(&app, &text);
                final_text = text;
                break;
            }
        } else {
            content = gemini::generate(&api_key, &system, &contents, Some(&tools)).await?;
        }
    }

    if stream_to_ui {
        let _ = app.emit("sam:done", json!({ "text": final_text }));
    }
    persist_reply(&app, list_id.as_deref(), &final_text, &source);
    // Tell the app to reload the chat for this scope, so messages that arrive via
    // other channels (e.g. WhatsApp) appear live in the in-app the assistant panel.
    let _ = app.emit("sam:refresh", json!({ "list_id": list_id }));
    Ok(final_text)
}

fn emit_token(app: &tauri::AppHandle, t: &str) {
    let _ = app.emit("sam:token", json!({ "text": t }));
}

/// Emit an already-complete string as a series of small token events so the UI
/// renders it progressively even when the source call was non-streaming.
fn emit_chunked(app: &tauri::AppHandle, text: &str) {
    for word in text.split_inclusive(' ') {
        emit_token(app, word);
    }
}
