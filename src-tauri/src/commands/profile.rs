use tauri::State;

use crate::db::{map_profile, now};
use crate::error::{AppError, AppResult};
use crate::models::Profile;
use crate::state::AppState;

#[tauri::command]
pub fn get_profile(state: State<AppState>) -> AppResult<Option<Profile>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM profile LIMIT 1")?;
    let mut rows = stmt.query_map([], map_profile)?;
    match rows.next() {
        Some(p) => Ok(Some(p?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn create_profile(
    state: State<AppState>,
    name: String,
    output_language: Option<String>,
) -> AppResult<Profile> {
    let conn = state.db.lock().unwrap();
    // Single-row table: replace any prior profile.
    conn.execute("DELETE FROM profile", [])?;
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = now();
    conn.execute(
        "INSERT INTO profile (id, name, output_language, theme, onboarded, created_at)
         VALUES (?1, ?2, ?3, 'light', 0, ?4)",
        rusqlite::params![id, name.trim(), output_language, created_at],
    )?;
    Ok(Profile {
        id,
        name: name.trim().to_string(),
        output_language,
        theme: "light".to_string(),
        onboarded: false,
        created_at,
    })
}

#[tauri::command]
pub fn update_profile(
    state: State<AppState>,
    name: Option<String>,
    output_language: Option<Option<String>>,
    theme: Option<String>,
) -> AppResult<Profile> {
    let conn = state.db.lock().unwrap();
    if let Some(name) = name {
        conn.execute("UPDATE profile SET name = ?1", rusqlite::params![name.trim()])?;
    }
    if let Some(lang) = output_language {
        conn.execute(
            "UPDATE profile SET output_language = ?1",
            rusqlite::params![lang],
        )?;
    }
    if let Some(theme) = theme {
        conn.execute("UPDATE profile SET theme = ?1", rusqlite::params![theme])?;
    }
    let mut stmt = conn.prepare("SELECT * FROM profile LIMIT 1")?;
    let mut rows = stmt.query_map([], map_profile)?;
    rows.next()
        .ok_or_else(|| AppError::msg("no profile"))?
        .map_err(Into::into)
}

#[tauri::command]
pub fn complete_onboarding(state: State<AppState>) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    conn.execute("UPDATE profile SET onboarded = 1", [])?;
    Ok(())
}
