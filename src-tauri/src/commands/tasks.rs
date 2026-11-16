use rusqlite::Connection;
use tauri::{AppHandle, State};

use crate::commands::emit_data_changed;
use crate::db::{hydrate_labels, map_task, now};
use crate::error::{AppError, AppResult};
use crate::models::{CreateTaskInput, MoveTaskInput, Task, UpdateTaskInput};
use crate::state::AppState;

/// Resolve the section a new task should land in: explicit, else the list's first.
fn first_section(conn: &Connection, list_id: &str) -> AppResult<String> {
    conn.query_row(
        "SELECT id FROM sections WHERE list_id = ?1 ORDER BY position LIMIT 1",
        rusqlite::params![list_id],
        |r| r.get(0),
    )
    .map_err(|_| AppError::msg("list has no sections"))
}

#[tauri::command]
pub fn get_tasks(state: State<AppState>, list_id: String) -> AppResult<Vec<Task>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT * FROM tasks WHERE list_id = ?1 ORDER BY section_id, position, created_at",
    )?;
    let rows = stmt.query_map(rusqlite::params![list_id], map_task)?;
    let mut tasks = rows.collect::<Result<Vec<_>, _>>()?;
    hydrate_labels(&conn, &mut tasks)?;
    Ok(tasks)
}

#[tauri::command]
pub fn create_task(
    app: AppHandle,
    state: State<AppState>,
    input: CreateTaskInput,
) -> AppResult<Task> {
    let task = {
        let conn = state.db.lock().unwrap();
        let section_id = match input.section_id {
            Some(s) => s,
            None => first_section(&conn, &input.list_id)?,
        };
        let id = uuid::Uuid::new_v4().to_string();
        let ts = now();
        let pos: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE section_id = ?1",
                rusqlite::params![section_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let priority = input.priority.unwrap_or_else(|| "none".to_string());
        let description = input.description.unwrap_or_default();
        conn.execute(
            "INSERT INTO tasks
                (id, list_id, section_id, title, description, priority, due_date,
                 position, ai_enhanced, ai_metadata, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, NULL, ?9, ?9)",
            rusqlite::params![
                id,
                input.list_id,
                section_id,
                input.title.trim(),
                description,
                priority,
                input.due_date,
                pos,
                ts
            ],
        )?;
        Task {
            id,
            list_id: input.list_id,
            section_id,
            title: input.title.trim().to_string(),
            description,
            priority,
            due_date: input.due_date,
            position: pos,
            ai_enhanced: false,
            ai_metadata: None,
            created_at: ts.clone(),
            updated_at: ts,
            label_ids: Vec::new(),
        }
    };

    emit_data_changed(&app);

    // Fire-and-forget auto-enhance (no-op if no key / enhancement disabled).
    if input.enhance {
        crate::ai::enhance::spawn_enhance(app.clone(), task.id.clone());
    }

    Ok(task)
}

#[tauri::command]
pub fn update_task(
    app: AppHandle,
    state: State<AppState>,
    input: UpdateTaskInput,
) -> AppResult<Task> {
    let task = {
        let conn = state.db.lock().unwrap();
        let ts = now();
        if let Some(title) = &input.title {
            conn.execute(
                "UPDATE tasks SET title = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![title.trim(), ts, input.id],
            )?;
        }
        if let Some(description) = &input.description {
            conn.execute(
                "UPDATE tasks SET description = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![description, ts, input.id],
            )?;
        }
        if let Some(priority) = &input.priority {
            conn.execute(
                "UPDATE tasks SET priority = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![priority, ts, input.id],
            )?;
        }
        if let Some(due) = &input.due_date {
            conn.execute(
                "UPDATE tasks SET due_date = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![due, ts, input.id],
            )?;
        }
        if let Some(section_id) = &input.section_id {
            conn.execute(
                "UPDATE tasks SET section_id = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![section_id, ts, input.id],
            )?;
        }
        let mut task =
            conn.query_row("SELECT * FROM tasks WHERE id = ?1", rusqlite::params![input.id], map_task)?;
        hydrate_labels(&conn, std::slice::from_mut(&mut task))?;
        task
    };
    emit_data_changed(&app);
    Ok(task)
}

#[tauri::command]
pub fn delete_task(app: AppHandle, state: State<AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    let affected = conn.execute("DELETE FROM tasks WHERE id = ?1", rusqlite::params![id])?;
    if affected == 0 {
        return Err(AppError::msg("task not found"));
    }
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn move_task(
    app: AppHandle,
    state: State<AppState>,
    input: MoveTaskInput,
) -> AppResult<()> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    let ts = now();

    // Ids currently in the target section, in order, excluding the moved task.
    let mut ids: Vec<String> = {
        let mut stmt = tx.prepare(
            "SELECT id FROM tasks WHERE section_id = ?1 AND id != ?2 ORDER BY position",
        )?;
        let rows = stmt.query_map(rusqlite::params![input.section_id, input.id], |r| {
            r.get::<_, String>(0)
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    let idx = (input.position.max(0) as usize).min(ids.len());
    ids.insert(idx, input.id.clone());

    tx.execute(
        "UPDATE tasks SET section_id = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![input.section_id, ts, input.id],
    )?;
    for (i, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE tasks SET position = ?1 WHERE id = ?2",
            rusqlite::params![i as i64, id],
        )?;
    }
    tx.commit()?;
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}

/// Bulk update a set of tasks (used by the UI multi-select and by the assistant's
/// `bulk_update` tool). Any provided field is applied to every id.
#[tauri::command]
pub fn bulk_update_tasks(
    app: AppHandle,
    state: State<AppState>,
    ids: Vec<String>,
    priority: Option<String>,
    section_id: Option<String>,
) -> AppResult<u64> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    let ts = now();
    let mut changed: u64 = 0;
    for id in &ids {
        if let Some(p) = &priority {
            changed += tx.execute(
                "UPDATE tasks SET priority = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![p, ts, id],
            )? as u64;
        }
        if let Some(s) = &section_id {
            changed += tx.execute(
                "UPDATE tasks SET section_id = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![s, ts, id],
            )? as u64;
        }
    }
    tx.commit()?;
    drop(conn);
    emit_data_changed(&app);
    Ok(changed)
}
