//! the assistant's function-calling tools: the JSON declarations sent to Gemini and the
//! executor that runs each call against the SQLite database.
//!
//! the assistant is multi-list aware: it can list all lists, switch the active list (which
//! persists as the default), and target a specific list per operation via a
//! `list` argument. All mutations emit `data:changed` so every channel refreshes.

use rusqlite::Connection;
use serde_json::{json, Value};
use tauri::Emitter;

use crate::commands::emit_data_changed;
use crate::db::now;
use crate::error::{AppError, AppResult};

/// The tool declarations advertised to Gemini.
pub fn declarations() -> Value {
    json!([{
        "functionDeclarations": [
            {
                "name": "list_lists",
                "description": "List all the user's todo lists with their task counts. Use to answer 'what lists do I have' or before switching.",
                "parameters": { "type": "object", "properties": {} }
            },
            {
                "name": "switch_list",
                "description": "Switch the active/default list to the one named. Subsequent actions target it, and it persists as the default.",
                "parameters": {
                    "type": "object",
                    "properties": { "name": { "type": "string", "description": "List name (case-insensitive)." } },
                    "required": ["name"]
                }
            },
            {
                "name": "add_task",
                "description": "Create a new task. Targets the active list unless 'list' names another.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "description": { "type": "string" },
                        "priority": { "type": "string", "enum": ["none","low","med","high","urgent"] },
                        "section": { "type": "string", "description": "Target column name, e.g. 'In Progress'." },
                        "list": { "type": "string", "description": "Optional: a different list to add to, by name." }
                    },
                    "required": ["title"]
                }
            },
            {
                "name": "update_task",
                "description": "Update fields of an existing task in the active list (or 'list'), by id or matching title.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string" },
                        "title_match": { "type": "string" },
                        "title": { "type": "string" },
                        "description": { "type": "string" },
                        "priority": { "type": "string", "enum": ["none","low","med","high","urgent"] },
                        "list": { "type": "string" }
                    }
                }
            },
            {
                "name": "move_task",
                "description": "Move a task to a different column/section by name, within the active list (or 'list').",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string" },
                        "title_match": { "type": "string" },
                        "section": { "type": "string" },
                        "list": { "type": "string" }
                    },
                    "required": ["section"]
                }
            },
            {
                "name": "delete_task",
                "description": "Delete a task by id or matching title in the active list (or 'list').",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string" },
                        "title_match": { "type": "string" },
                        "list": { "type": "string" }
                    }
                }
            },
            {
                "name": "search_tasks",
                "description": "List/preview tasks in a list (the active one or 'list'), optionally filtered. Use to show a list preview.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" },
                        "section": { "type": "string" },
                        "priority": { "type": "string" },
                        "list": { "type": "string" }
                    }
                }
            },
            {
                "name": "bulk_update",
                "description": "Update many tasks matching a filter in the active list (or 'list').",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "filter_section": { "type": "string" },
                        "filter_priority": { "type": "string" },
                        "set_section": { "type": "string" },
                        "set_priority": { "type": "string" },
                        "list": { "type": "string" }
                    }
                }
            },
            {
                "name": "create_label",
                "description": "Create a label in the active list (or 'list').",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "color": { "type": "string" },
                        "list": { "type": "string" }
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "enhance_tasks",
                "description": "Use AI to clean up and improve tasks — better title/description, suggested priority and labels — for new or existing tasks. Target one task by title_match, or set all=true to enhance every task in the list.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title_match": { "type": "string", "description": "Enhance the task(s) whose title contains this." },
                        "all": { "type": "boolean", "description": "Enhance all tasks in the list." },
                        "list": { "type": "string" }
                    }
                }
            },
            {
                "name": "answer",
                "description": "Use when no data change is needed and you just want to answer the user.",
                "parameters": { "type": "object", "properties": {} }
            }
        ]
    }])
}

fn s<'a>(args: &'a Value, k: &str) -> Option<&'a str> {
    args.get(k).and_then(|v| v.as_str()).filter(|s| !s.is_empty())
}

fn list_id_by_name(conn: &Connection, name: &str) -> Option<String> {
    conn.query_row(
        "SELECT id FROM lists WHERE LOWER(name) = LOWER(?1) ORDER BY position LIMIT 1",
        rusqlite::params![name],
        |r| r.get(0),
    )
    .ok()
    .or_else(|| {
        // fall back to a fuzzy contains match
        conn.query_row(
            "SELECT id FROM lists WHERE name LIKE ?1 ORDER BY position LIMIT 1",
            rusqlite::params![format!("%{name}%")],
            |r| r.get(0),
        )
        .ok()
    })
}

fn list_name(conn: &Connection, id: &str) -> Option<String> {
    conn.query_row(
        "SELECT name FROM lists WHERE id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    )
    .ok()
}

/// Resolve the list an operation should target: an explicit `list` arg by name,
/// else the current/active list.
fn resolve_list(
    conn: &Connection,
    current: &Option<String>,
    args: &Value,
) -> Option<String> {
    if let Some(name) = s(args, "list") {
        return list_id_by_name(conn, name);
    }
    current.clone()
}

fn section_id_by_name(conn: &Connection, list_id: &str, name: &str) -> Option<String> {
    conn.query_row(
        "SELECT id FROM sections WHERE list_id = ?1 AND LOWER(name) = LOWER(?2) LIMIT 1",
        rusqlite::params![list_id, name],
        |r| r.get(0),
    )
    .ok()
}

fn first_section_id(conn: &Connection, list_id: &str) -> Option<String> {
    conn.query_row(
        "SELECT id FROM sections WHERE list_id = ?1 ORDER BY position LIMIT 1",
        rusqlite::params![list_id],
        |r| r.get(0),
    )
    .ok()
}

fn find_task(conn: &Connection, list_id: &str, args: &Value) -> Option<String> {
    if let Some(id) = s(args, "task_id") {
        return Some(id.to_string());
    }
    if let Some(m) = s(args, "title_match") {
        return conn
            .query_row(
                "SELECT id FROM tasks WHERE list_id = ?1 AND title LIKE ?2 ORDER BY updated_at DESC LIMIT 1",
                rusqlite::params![list_id, format!("%{m}%")],
                |r| r.get(0),
            )
            .ok();
    }
    None
}

fn no_list() -> Value {
    json!({ "ok": false, "error": "No list selected. Use switch_list first, or pass a 'list' name." })
}

/// Execute one tool call against the DB. `current` is the active list id, which
/// `switch_list` can change for the remainder of the turn.
pub fn execute(
    app: &tauri::AppHandle,
    conn: &Connection,
    current: &mut Option<String>,
    name: &str,
    args: &Value,
) -> AppResult<Value> {
    let ts = now();
    let mut mutated = false;

    let result = match name {
        "list_lists" => {
            let mut stmt = conn.prepare(
                "SELECT l.id, l.name,
                        (SELECT COUNT(*) FROM tasks t WHERE t.list_id = l.id) AS n
                 FROM lists l ORDER BY l.position, l.created_at",
            )?;
            let rows = stmt.query_map([], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "name": r.get::<_, String>(1)?,
                    "tasks": r.get::<_, i64>(2)?
                }))
            })?;
            let lists: Vec<Value> = rows.collect::<Result<_, _>>()?;
            let active = current.as_ref().and_then(|id| list_name(conn, id));
            json!({ "ok": true, "active_list": active, "lists": lists })
        }
        "switch_list" => {
            let Some(name) = s(args, "name") else {
                return Ok(json!({ "ok": false, "error": "missing list name" }));
            };
            match list_id_by_name(conn, name) {
                Some(id) => {
                    *current = Some(id.clone());
                    // Persist as the default and tell the UI to follow.
                    let _ = conn.execute(
                        "UPDATE profile SET default_list_id = ?1",
                        rusqlite::params![id],
                    );
                    let _ = app.emit("nav:list", json!({ "id": id }));
                    emit_data_changed(app);
                    json!({ "ok": true, "active_list": list_name(conn, &id) })
                }
                None => {
                    let names: Vec<String> = {
                        let mut stmt =
                            conn.prepare("SELECT name FROM lists ORDER BY position")?;
                        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
                        rows.collect::<Result<_, _>>()?
                    };
                    json!({ "ok": false, "error": "list not found", "available": names })
                }
            }
        }
        "add_task" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let title = s(args, "title").unwrap_or("Untitled").trim().to_string();
            let section_id = s(args, "section")
                .and_then(|n| section_id_by_name(conn, &list_id, n))
                .or_else(|| first_section_id(conn, &list_id))
                .ok_or_else(|| AppError::msg("list has no sections"))?;
            let id = uuid::Uuid::new_v4().to_string();
            let pos: i64 = conn
                .query_row(
                    "SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE section_id = ?1",
                    rusqlite::params![section_id],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            conn.execute(
                "INSERT INTO tasks (id, list_id, section_id, title, description, priority, due_date, position, ai_enhanced, ai_metadata, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, 0, NULL, ?8, ?8)",
                rusqlite::params![
                    id, list_id, section_id, title,
                    s(args, "description").unwrap_or(""),
                    s(args, "priority").unwrap_or("none"),
                    pos, ts
                ],
            )?;
            mutated = true;
            json!({ "ok": true, "task_id": id, "title": title, "list": list_name(conn, &list_id) })
        }
        "update_task" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let Some(tid) = find_task(conn, &list_id, args) else {
                return Ok(json!({ "ok": false, "error": "task not found" }));
            };
            if let Some(v) = s(args, "title") {
                conn.execute("UPDATE tasks SET title=?1, updated_at=?2 WHERE id=?3", rusqlite::params![v, ts, tid])?;
            }
            if let Some(v) = s(args, "description") {
                conn.execute("UPDATE tasks SET description=?1, updated_at=?2 WHERE id=?3", rusqlite::params![v, ts, tid])?;
            }
            if let Some(v) = s(args, "priority") {
                conn.execute("UPDATE tasks SET priority=?1, updated_at=?2 WHERE id=?3", rusqlite::params![v, ts, tid])?;
            }
            mutated = true;
            json!({ "ok": true, "task_id": tid })
        }
        "move_task" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let Some(tid) = find_task(conn, &list_id, args) else {
                return Ok(json!({ "ok": false, "error": "task not found" }));
            };
            let Some(section) = s(args, "section").and_then(|n| section_id_by_name(conn, &list_id, n)) else {
                return Ok(json!({ "ok": false, "error": "unknown section" }));
            };
            let pos: i64 = conn
                .query_row(
                    "SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE section_id = ?1",
                    rusqlite::params![section],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            conn.execute(
                "UPDATE tasks SET section_id=?1, position=?2, updated_at=?3 WHERE id=?4",
                rusqlite::params![section, pos, ts, tid],
            )?;
            mutated = true;
            json!({ "ok": true, "task_id": tid })
        }
        "delete_task" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let Some(tid) = find_task(conn, &list_id, args) else {
                return Ok(json!({ "ok": false, "error": "task not found" }));
            };
            conn.execute("DELETE FROM tasks WHERE id=?1", rusqlite::params![tid])?;
            mutated = true;
            json!({ "ok": true, "task_id": tid })
        }
        "search_tasks" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let mut sql = String::from(
                "SELECT t.title, t.priority, s.name FROM tasks t JOIN sections s ON s.id = t.section_id WHERE t.list_id = ?1",
            );
            let mut params: Vec<String> = vec![list_id.clone()];
            if let Some(q) = s(args, "query") {
                sql.push_str(" AND t.title LIKE ?");
                params.push(format!("%{q}%"));
            }
            if let Some(p) = s(args, "priority") {
                sql.push_str(" AND t.priority = ?");
                params.push(p.to_string());
            }
            if let Some(sec) = s(args, "section") {
                sql.push_str(" AND LOWER(s.name) = LOWER(?)");
                params.push(sec.to_string());
            }
            sql.push_str(" ORDER BY s.position, t.position LIMIT 100");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |r| {
                Ok(json!({
                    "title": r.get::<_, String>(0)?,
                    "priority": r.get::<_, String>(1)?,
                    "section": r.get::<_, String>(2)?
                }))
            })?;
            let items: Vec<Value> = rows.collect::<Result<_, _>>()?;
            json!({ "ok": true, "list": list_name(conn, &list_id), "count": items.len(), "tasks": items })
        }
        "bulk_update" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let mut sql = String::from("SELECT t.id FROM tasks t JOIN sections s ON s.id = t.section_id WHERE t.list_id = ?1");
            let mut params: Vec<String> = vec![list_id.clone()];
            if let Some(sec) = s(args, "filter_section") {
                sql.push_str(" AND LOWER(s.name) = LOWER(?)");
                params.push(sec.to_string());
            }
            if let Some(p) = s(args, "filter_priority") {
                sql.push_str(" AND t.priority = ?");
                params.push(p.to_string());
            }
            let ids: Vec<String> = {
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |r| r.get::<_, String>(0))?;
                rows.collect::<Result<_, _>>()?
            };
            let set_section = s(args, "set_section").and_then(|n| section_id_by_name(conn, &list_id, n));
            let set_priority = s(args, "set_priority");
            let mut n = 0u64;
            for id in &ids {
                if let Some(sec) = &set_section {
                    n += conn.execute("UPDATE tasks SET section_id=?1, updated_at=?2 WHERE id=?3", rusqlite::params![sec, ts, id])? as u64;
                }
                if let Some(p) = set_priority {
                    n += conn.execute("UPDATE tasks SET priority=?1, updated_at=?2 WHERE id=?3", rusqlite::params![p, ts, id])? as u64;
                }
            }
            mutated = true;
            json!({ "ok": true, "matched": ids.len(), "updated": n })
        }
        "create_label" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let id = uuid::Uuid::new_v4().to_string();
            let lname = s(args, "name").unwrap_or("Label").trim().to_string();
            conn.execute(
                "INSERT INTO labels (id, list_id, name, color) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![id, list_id, lname, s(args, "color").unwrap_or("#94a3b8")],
            )?;
            mutated = true;
            json!({ "ok": true, "label_id": id, "name": lname })
        }
        "enhance_tasks" => {
            let Some(list_id) = resolve_list(conn, current, args) else {
                return Ok(no_list());
            };
            let ids: Vec<String> = if let Some(m) = s(args, "title_match") {
                let mut stmt = conn
                    .prepare("SELECT id FROM tasks WHERE list_id = ?1 AND title LIKE ?2")?;
                let rows = stmt.query_map(
                    rusqlite::params![list_id, format!("%{m}%")],
                    |r| r.get::<_, String>(0),
                )?;
                rows.collect::<Result<_, _>>()?
            } else {
                let mut stmt = conn.prepare("SELECT id FROM tasks WHERE list_id = ?1")?;
                let rows =
                    stmt.query_map(rusqlite::params![list_id], |r| r.get::<_, String>(0))?;
                rows.collect::<Result<_, _>>()?
            };
            // Fire-and-forget; each enhancement emits data:changed when it lands.
            for id in &ids {
                crate::ai::enhance::spawn_enhance(app.clone(), id.clone());
            }
            json!({ "ok": true, "enhancing": ids.len() })
        }
        "answer" => json!({ "ok": true }),
        other => json!({ "ok": false, "error": format!("unknown tool: {other}") }),
    };

    if mutated {
        emit_data_changed(app);
        let _ = app.emit("sam:action", json!({ "tool": name }));
    }
    Ok(result)
}
