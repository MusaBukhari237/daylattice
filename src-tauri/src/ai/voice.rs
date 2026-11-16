//! Voice commands: transcribe an audio clip with Gemini, then run the same the assistant
//! pipeline on the transcript. Used by the mic button (UI) and WhatsApp voice notes.

use tauri::Emitter;

use crate::error::{AppError, AppResult};
use crate::secrets;

/// Transcribe `audio_b64` (base64, with `mime`) and run it through the assistant.
/// Returns the recognized transcript. The reply streams to the UI when requested.
pub async fn run_voice(
    app: tauri::AppHandle,
    list_id: Option<String>,
    audio_b64: String,
    mime: String,
    source: String,
    stream_to_ui: bool,
) -> AppResult<String> {
    let api_key = secrets::get_api_key().ok_or(AppError::NoApiKey)?;

    let transcript = super::gemini::transcribe(&api_key, &mime, &audio_b64).await?;
    if transcript.trim().is_empty() {
        return Err(AppError::msg("Couldn't understand the audio."));
    }

    // Let the UI show what was heard before the reply streams in.
    let _ = app.emit("sam:transcript", serde_json::json!({ "text": transcript }));

    // Returns the assistant's reply text (used by WhatsApp to relay back to the chat).
    super::run_sam(app, list_id, transcript, source, stream_to_ui).await
}
