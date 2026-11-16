use tauri::{AppHandle, State};

use crate::commands::emit_data_changed;
use crate::db::map_section;
use crate::error::{AppError, AppResult};
use crate::models::{CreateSectionInput, Section, UpdateSectionInput};
use crate::state::AppState;

#[tauri::command]
pub fn get_sections(state: State<AppState>, list_id: String) -> AppResult<Vec<Section>> {
    let conn = state.db.lock().unwrap();
    let mut stmt =
        conn.prepare("SELECT * FROM sections WHERE list_id = ?1 ORDER BY position")?;
    let rows = stmt.query_map(rusqlite::params![list_id], map_section)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[tauri::command]
pub fn create_section(
    app: AppHandle,
    state: State<AppState>,
    input: CreateSectionInput,
) -> AppResult<Section> {
    let conn = state.db.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let pos: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM sections WHERE list_id = ?1",
            rusqlite::params![input.list_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO sections (id, list_id, name, position, is_default)
         VALUES (?1, ?2, ?3, ?4, 0)",
        rusqlite::params![id, input.list_id, input.name.trim(), pos],
    )?;
    drop(conn);
    emit_data_changed(&app);
    Ok(Section {
        id,
        list_id: input.list_id,
        name: input.name.trim().to_string(),
        position: pos,
        is_default: false,
    })
}

#[tauri::command]
pub fn update_section(
    app: AppHandle,
    state: State<AppState>,
    input: UpdateSectionInput,
) -> AppResult<Section> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE sections SET name = ?1 WHERE id = ?2",
        rusqlite::params![input.name.trim(), input.id],
    )?;
    let section = conn.query_row(
        "SELECT * FROM sections WHERE id = ?1",
        rusqlite::params![input.id],
        map_section,
    )?;
    drop(conn);
    emit_data_changed(&app);
    Ok(section)
}

#[tauri::command]
pub fn delete_section(app: AppHandle, state: State<AppState>, id: String) -> AppResult<()> {
    let mut conn = state.db.lock().unwrap();
    // Don't orphan tasks: move them to the list's first remaining section.
    let (list_id, is_default): (String, i64) = conn.query_row(
        "SELECT list_id, is_default FROM sections WHERE id = ?1",
        rusqlite::params![id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    if is_default != 0 {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sections WHERE list_id = ?1",
            rusqlite::params![list_id],
            |r| r.get(0),
        )?;
        if count <= 1 {
            return Err(AppError::msg("a list must keep at least one column"));
        }
    }
    let tx = conn.transaction()?;
    let fallback: Option<String> = tx
        .query_row(
            "SELECT id FROM sections WHERE list_id = ?1 AND id != ?2 ORDER BY position LIMIT 1",
            rusqlite::params![list_id, id],
            |r| r.get(0),
        )
        .ok();
    if let Some(fallback) = fallback {
        tx.execute(
            "UPDATE tasks SET section_id = ?1 WHERE section_id = ?2",
            rusqlite::params![fallback, id],
        )?;
    }
    tx.execute("DELETE FROM sections WHERE id = ?1", rusqlite::params![id])?;
    tx.commit()?;
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn reorder_sections(
    app: AppHandle,
    state: State<AppState>,
    ordered_ids: Vec<String>,
) -> AppResult<()> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    for (i, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE sections SET position = ?1 WHERE id = ?2",
            rusqlite::params![i as i64, id],
        )?;
    }
    tx.commit()?;
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}
