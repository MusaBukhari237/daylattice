use tauri::{AppHandle, State};

use crate::commands::emit_data_changed;
use crate::db::{map_list, now, seed_default_sections};
use crate::error::{AppError, AppResult};
use crate::models::{CreateListInput, List, UpdateListInput};
use crate::state::AppState;

#[tauri::command]
pub fn get_lists(state: State<AppState>) -> AppResult<Vec<List>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM lists ORDER BY position, created_at")?;
    let rows = stmt.query_map([], map_list)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[tauri::command]
pub fn create_list(
    app: AppHandle,
    state: State<AppState>,
    input: CreateListInput,
) -> AppResult<List> {
    let conn = state.db.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let ts = now();
    let pos: i64 = conn
        .query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM lists", [], |r| {
            r.get(0)
        })
        .unwrap_or(0);
    let color = input.color.unwrap_or_else(|| "#6366f1".to_string());
    let knowledge = input.knowledge.unwrap_or_default();
    conn.execute(
        "INSERT INTO lists (id, name, knowledge, color, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        rusqlite::params![id, input.name.trim(), knowledge, color, pos, ts],
    )?;
    seed_default_sections(&conn, &id)?;
    drop(conn);
    emit_data_changed(&app);
    Ok(List {
        id,
        name: input.name.trim().to_string(),
        knowledge,
        color,
        position: pos,
        created_at: ts.clone(),
        updated_at: ts,
    })
}

#[tauri::command]
pub fn update_list(
    app: AppHandle,
    state: State<AppState>,
    input: UpdateListInput,
) -> AppResult<List> {
    let conn = state.db.lock().unwrap();
    let ts = now();
    if let Some(name) = &input.name {
        conn.execute(
            "UPDATE lists SET name = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![name.trim(), ts, input.id],
        )?;
    }
    if let Some(knowledge) = &input.knowledge {
        conn.execute(
            "UPDATE lists SET knowledge = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![knowledge, ts, input.id],
        )?;
    }
    if let Some(color) = &input.color {
        conn.execute(
            "UPDATE lists SET color = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![color, ts, input.id],
        )?;
    }
    let list = conn.query_row(
        "SELECT * FROM lists WHERE id = ?1",
        rusqlite::params![input.id],
        map_list,
    )?;
    drop(conn);
    emit_data_changed(&app);
    Ok(list)
}

#[tauri::command]
pub fn delete_list(app: AppHandle, state: State<AppState>, id: String) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    let affected = conn.execute("DELETE FROM lists WHERE id = ?1", rusqlite::params![id])?;
    if affected == 0 {
        return Err(AppError::msg("list not found"));
    }
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn reorder_lists(
    app: AppHandle,
    state: State<AppState>,
    ordered_ids: Vec<String>,
) -> AppResult<()> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction()?;
    for (i, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE lists SET position = ?1 WHERE id = ?2",
            rusqlite::params![i as i64, id],
        )?;
    }
    tx.commit()?;
    drop(conn);
    emit_data_changed(&app);
    Ok(())
}
