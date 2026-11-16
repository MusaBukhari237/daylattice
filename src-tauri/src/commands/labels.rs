use tauri::{AppHandle, State};

use crate::commands::emit_data_changed;
use crate::db::map_label;
use crate::error::AppResult;
use crate::models::{CreateLabelInput, Label, UpdateLabelInput};
use crate::state::AppState;

#[tauri::command]
pub fn get_labels(state: State<AppState>, list_id: String) -> AppResult<Vec<Label>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM labels WHERE list_id = ?1 ORDER BY name")?;
    let rows = stmt.query_map(rusqlite::params![list_id], map_label)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[tauri::command]
pub fn create_label(
    app: AppHandle,
    state: State<AppState>,
    input: CreateLabelInput,
) -> AppResult<Label> {
    let conn = state.db.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let color = input.color.unwrap_or_else(|| "#94a3b8".to_string());
    conn.execute(
        "INSERT INTO labels (id, list_id, name, color) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, input.list_id, input.name.trim(), color],
    )?;
    drop(conn);
    emit_data_changed(&app);
    Ok(Label {
        id,
        list_id: input.list_id,
        name: input.name.trim().to_string(),
        color,
    })
}

#[tauri::command]
pub fn update_label(
    app: AppHandle,
    state: State<AppState>,
    input: UpdateLabelInput,
) -> AppResult<Label> {
    let conn = state.db.lock().unwrap();
    if let Some(name) = &input.name {
        conn.execute(
            "UPDATE labels SET name = ?1 WHERE id = ?2",
            rusqlite::params![name.trim(), input.id],
        )?;
    }
    if let Some(color) = &input.color {
        conn.execute(
            "UPDATE labels SET color = ?1 WHERE id = ?2",
            rusqlite::params![color, input.id],
        )?;
    }
    let label = conn.query_row(
        "SELECT * FROM labels WHERE id = ?1",
        rusqlite::params![input.id],
        map_label,
    )?;
    drop(conn);
    emit_data_changed(&app);
    Ok(label)
}

#[tauri::command]
pub fn delete_label(app: AppHandle, state: State<AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM labels WHERE id = ?1", rusqlite::params![id])?;
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn assign_label(
    app: AppHandle,
    state: State<AppState>,
    task_id: String,
    label_id: String,
) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?1, ?2)",
        rusqlite::params![task_id, label_id],
    )?;
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn unassign_label(
    app: AppHandle,
    state: State<AppState>,
    task_id: String,
    label_id: String,
) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "DELETE FROM task_labels WHERE task_id = ?1 AND label_id = ?2",
        rusqlite::params![task_id, label_id],
    )?;
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}
