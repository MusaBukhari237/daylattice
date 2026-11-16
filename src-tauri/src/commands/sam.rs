use tauri::{AppHandle, State};

use crate::ai;
use crate::db::map_sam_message;
use crate::error::AppResult;
use crate::models::SamMessage;
use crate::state::AppState;

/// Load chat history for a list (or the global chat when `list_id` is None).
#[tauri::command]
pub fn get_sam_messages(
    state: State<AppState>,
    list_id: Option<String>,
) -> AppResult<Vec<SamMessage>> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT * FROM sam_messages
         WHERE (?1 IS NULL AND list_id IS NULL) OR list_id = ?1
         ORDER BY created_at ASC LIMIT 200",
    )?;
    let rows = stmt.query_map(rusqlite::params![list_id], map_sam_message)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// A text command from the UI. Streams the reply via `sam:token` / `sam:done`;
/// resolves with the final reply text.
#[tauri::command]
pub async fn sam_text_command(
    app: AppHandle,
    list_id: Option<String>,
    message: String,
    source: Option<String>,
) -> AppResult<String> {
    let source = source.unwrap_or_else(|| "ui".to_string());
    ai::run_sam(app, list_id, message, source, true).await
}

/// A voice command from the UI mic. Transcribes then runs the assistant; streams the reply.
#[tauri::command]
pub async fn sam_voice_command(
    app: AppHandle,
    list_id: Option<String>,
    audio_base64: String,
    mime: Option<String>,
) -> AppResult<String> {
    let mime = mime.unwrap_or_else(|| "audio/webm".to_string());
    ai::voice::run_voice(app, list_id, audio_base64, mime, "voice".to_string(), true).await
}

/// Transcribe an audio clip to text only (no the assistant action). Used by the new-list
/// wizard's voice dictation for the knowledge field.
#[tauri::command]
pub async fn sam_transcribe(audio_base64: String, mime: Option<String>) -> AppResult<String> {
    let api_key = crate::secrets::get_api_key().ok_or(crate::error::AppError::NoApiKey)?;
    let mime = mime.unwrap_or_else(|| "audio/webm".to_string());
    ai::gemini::transcribe(&api_key, &mime, &audio_base64).await
}

/// Manually trigger auto-enhance for an existing task (used by the task drawer).
#[tauri::command]
pub fn sam_enhance_task(app: AppHandle, task_id: String) -> AppResult<()> {
    ai::enhance::spawn_enhance(app, task_id);
    Ok(())
}

/// Clear chat history for a scope.
#[tauri::command]
pub fn clear_sam_messages(
    app: AppHandle,
    state: State<AppState>,
    list_id: Option<String>,
) -> AppResult<()> {
    {
        let conn = state.db.lock().unwrap();
        conn.execute(
            "DELETE FROM sam_messages WHERE (?1 IS NULL AND list_id IS NULL) OR list_id = ?1",
            rusqlite::params![list_id],
        )?;
    }
    crate::commands::emit_data_changed(&app);
    Ok(())
}
