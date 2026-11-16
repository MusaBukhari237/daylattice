//! Auto-enhance a freshly created task: corrected title/description, a suggested
//! priority, and labels (created if new) — guided by the list's knowledge. The
//! original values are preserved in `ai_metadata`.

use serde_json::{json, Value};
use tauri::Manager;

use crate::commands::emit_data_changed;
use crate::db::now;
use crate::secrets;
use crate::state::AppState;

/// Fire-and-forget enhancement. No-ops silently when no API key is configured.
pub fn spawn_enhance(app: tauri::AppHandle, task_id: String) {
    if !secrets::has_api_key() {
        return;
    }
    tauri::async_runtime::spawn(async move {
        if let Err(e) = enhance_task(app, task_id).await {
            log::warn!("auto-enhance failed: {e}");
        }
    });
}

async fn enhance_task(app: tauri::AppHandle, task_id: String) -> crate::error::AppResult<()> {
    let api_key = match secrets::get_api_key() {
        Some(k) => k,
        None => return Ok(()),
    };

    // Gather the task + list context.
    let (list_id, title, description, knowledge) = {
        let state = app.state::<AppState>();
        let conn = state.db.lock().unwrap();
        let row = conn.query_row(
            "SELECT t.list_id, t.title, t.description, l.knowledge
             FROM tasks t JOIN lists l ON l.id = t.list_id WHERE t.id = ?1",
            rusqlite::params![task_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            },
        );
        match row {
            Ok(v) => v,
            Err(_) => return Ok(()),
        }
    };

    let system = format!(
        "You improve a single todo item for a list. Use the list knowledge for domain context.\n\
         Return ONLY a compact JSON object with keys: title (string, corrected/clearer), \
         description (string, may be empty), priority (one of none|low|med|high|urgent), \
         labels (array of 0-3 short label strings). Do not add commentary.\n\n\
         List knowledge:\n{knowledge}"
    );
    let contents = json!([{
        "role": "user",
        "parts": [{ "text": format!("Title: {title}\nDescription: {description}") }]
    }]);

    let content = super::gemini::generate(&api_key, &system, &contents, None).await?;
    let raw = super::gemini::text_of(&content);
    let parsed = match extract_json(&raw) {
        Some(v) => v,
        None => return Ok(()), // model didn't return usable JSON; leave task as-is
    };

    let new_title = parsed
        .get("title")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| title.clone());
    let new_desc = parsed
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| description.clone());
    let new_priority = parsed
        .get("priority")
        .and_then(|v| v.as_str())
        .filter(|p| matches!(*p, "none" | "low" | "med" | "high" | "urgent"))
        .unwrap_or("none")
        .to_string();
    let labels: Vec<String> = parsed
        .get("labels")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .take(3)
                .collect()
        })
        .unwrap_or_default();

    let metadata = json!({
        "original": { "title": title, "description": description },
        "model": "gemini-2.5-flash"
    });

    // Apply within a single lock.
    {
        let state = app.state::<AppState>();
        let conn = state.db.lock().unwrap();
        let ts = now();
        conn.execute(
            "UPDATE tasks SET title=?1, description=?2, priority=?3, ai_enhanced=1, ai_metadata=?4, updated_at=?5 WHERE id=?6",
            rusqlite::params![new_title, new_desc, new_priority, metadata.to_string(), ts, task_id],
        )?;

        for label_name in labels {
            // Find or create the label within this list.
            let existing: Option<String> = conn
                .query_row(
                    "SELECT id FROM labels WHERE list_id=?1 AND LOWER(name)=LOWER(?2) LIMIT 1",
                    rusqlite::params![list_id, label_name],
                    |r| r.get(0),
                )
                .ok();
            let label_id = match existing {
                Some(id) => id,
                None => {
                    let id = uuid::Uuid::new_v4().to_string();
                    conn.execute(
                        "INSERT INTO labels (id, list_id, name, color) VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![id, list_id, label_name, "#6366f1"],
                    )?;
                    id
                }
            };
            conn.execute(
                "INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?1, ?2)",
                rusqlite::params![task_id, label_id],
            )?;
        }
    }

    emit_data_changed(&app);
    Ok(())
}

/// Pull the first JSON object out of a model response (handles ```json fences).
fn extract_json(raw: &str) -> Option<Value> {
    let trimmed = raw.trim();
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        return Some(v);
    }
    let start = trimmed.find('{')?;
    let end = trimmed.rfind('}')?;
    if end <= start {
        return None;
    }
    serde_json::from_str::<Value>(&trimmed[start..=end]).ok()
}
