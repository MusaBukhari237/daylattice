use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::models::VoiceSettings;
use crate::state::{AppState, VoiceConfig};
use crate::voice;

#[tauri::command]
pub fn get_voice_settings(state: State<AppState>) -> AppResult<VoiceSettings> {
    let cfg = state.voice_config.lock().unwrap().clone();
    Ok(VoiceSettings {
        shortcut: cfg.shortcut,
        hold_ms: cfg.hold_ms,
    })
}

#[tauri::command]
pub fn set_voice_settings(
    app: AppHandle,
    state: State<AppState>,
    shortcut: String,
    hold_ms: u64,
) -> AppResult<()> {
    let shortcut = shortcut.trim().to_string();
    if shortcut.is_empty() {
        return Err(AppError::msg("shortcut cannot be empty"));
    }

    // Validate + (re)register before persisting so a bad shortcut is rejected.
    voice::register(&app, &shortcut)?;

    {
        let conn = state.db.lock().unwrap();
        conn.execute(
            "UPDATE profile SET voice_shortcut = ?1, voice_hold_ms = ?2",
            rusqlite::params![shortcut, hold_ms as i64],
        )?;
    }
    *state.voice_config.lock().unwrap() = VoiceConfig { shortcut, hold_ms };
    Ok(())
}
