use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

use crate::error::{AppError, AppResult};
use crate::models::Settings;
use crate::secrets;
use crate::state::AppState;

#[tauri::command]
pub fn get_settings(app: AppHandle, state: State<AppState>) -> AppResult<Settings> {
    let conn = state.db.lock().unwrap();
    #[allow(clippy::type_complexity)]
    let (name, output_language, theme, wa_control_number, default_list_id): (
        String,
        Option<String>,
        String,
        Option<String>,
        Option<String>,
    ) = conn
        .query_row(
            "SELECT name, output_language, theme, wa_control_number, default_list_id FROM profile LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .unwrap_or_else(|_| ("".to_string(), None, "light".to_string(), None, None));
    drop(conn);

    let wa_status = state.wa.lock().unwrap().status.clone();
    let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);

    Ok(Settings {
        name,
        output_language,
        theme,
        has_api_key: secrets::has_api_key(),
        api_key_preview: secrets::masked_preview(),
        autostart_enabled,
        wa_status,
        wa_control_number,
        default_list_id,
    })
}

/// Set (or clear) the WhatsApp control number — only messages from this number
/// are acted on, and replies go back to that chat. Stored as digits only.
#[tauri::command]
pub fn set_wa_control_number(state: State<AppState>, number: Option<String>) -> AppResult<()> {
    let normalized = number.map(|n| n.chars().filter(|c| c.is_ascii_digit()).collect::<String>());
    let normalized = normalized.filter(|s| !s.is_empty());
    if normalized.as_ref().is_some_and(|number| !(7..=15).contains(&number.len()) || number.starts_with('0')) {
        return Err(AppError::msg("Use the full international number, including the country code."));
    }
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE profile SET wa_control_number = ?1",
        rusqlite::params![normalized],
    )?;
    Ok(())
}

/// Set (or clear) the default list used by WhatsApp and as the opening scope.
#[tauri::command]
pub fn set_default_list(state: State<AppState>, list_id: Option<String>) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE profile SET default_list_id = ?1",
        rusqlite::params![list_id],
    )?;
    Ok(())
}

/// The configured default list id (if any).
#[tauri::command]
pub fn get_default_list(state: State<AppState>) -> AppResult<Option<String>> {
    let conn = state.db.lock().unwrap();
    Ok(conn
        .query_row("SELECT default_list_id FROM profile LIMIT 1", [], |r| {
            r.get(0)
        })
        .unwrap_or(None))
}

#[tauri::command]
pub fn set_api_key(key: String) -> AppResult<()> {
    let key = key.trim();
    if key.is_empty() {
        return Err(AppError::msg("API key cannot be empty"));
    }
    secrets::set_api_key(key)
}

#[tauri::command]
pub fn clear_api_key() -> AppResult<()> {
    secrets::clear_api_key()
}

#[tauri::command]
pub fn has_api_key() -> bool {
    secrets::has_api_key()
}

#[tauri::command]
pub fn set_language(state: State<AppState>, language: Option<String>) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE profile SET output_language = ?1",
        rusqlite::params![language],
    )?;
    Ok(())
}

#[tauri::command]
pub fn set_theme(state: State<AppState>, theme: String) -> AppResult<()> {
    let conn = state.db.lock().unwrap();
    conn.execute("UPDATE profile SET theme = ?1", rusqlite::params![theme])?;
    Ok(())
}

#[tauri::command]
pub fn get_autostart(app: AppHandle) -> AppResult<bool> {
    Ok(app.autolaunch().is_enabled().unwrap_or(false))
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> AppResult<()> {
    let manager = app.autolaunch();
    if enabled {
        manager
            .enable()
            .map_err(|e| AppError::msg(format!("failed to enable autostart: {e}")))?;
    } else {
        manager
            .disable()
            .map_err(|e| AppError::msg(format!("failed to disable autostart: {e}")))?;
    }
    Ok(())
}
