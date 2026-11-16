//! WhatsApp integration: a Baileys sidecar bridged over stdio. Incoming messages
//! and voice notes are routed through the same the assistant pipeline as the UI, and the
//! reply is sent back to the originating chat.

pub mod protocol;
pub mod sidecar;

use tauri::Manager;

use crate::ai;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Pick the list a WhatsApp message should act on: the configured default list
/// (if it still exists), else the most recently updated one.
fn target_list(app: &tauri::AppHandle) -> Option<String> {
    let state = app.state::<AppState>();
    let conn = state.db.lock().unwrap();
    let default: Option<String> = conn
        .query_row("SELECT default_list_id FROM profile LIMIT 1", [], |r| r.get(0))
        .unwrap_or(None);
    if let Some(id) = default {
        let exists = conn
            .query_row(
                "SELECT 1 FROM lists WHERE id = ?1",
                rusqlite::params![id],
                |_| Ok(()),
            )
            .is_ok();
        if exists {
            return Some(id);
        }
    }
    conn.query_row(
        "SELECT id FROM lists ORDER BY updated_at DESC LIMIT 1",
        [],
        |r| r.get(0),
    )
    .ok()
}

/// The configured control number (digits only), if set.
fn control_number(app: &tauri::AppHandle) -> Option<String> {
    let state = app.state::<AppState>();
    let conn = state.db.lock().unwrap();
    conn.query_row("SELECT wa_control_number FROM profile LIMIT 1", [], |r| r.get(0))
        .unwrap_or(None)
        .filter(|c: &String| !c.is_empty())
}

/// Accept only the configured international phone number on a direct WhatsApp JID.
fn sender_allowed(control: Option<&str>, from: &str) -> bool {
    let Some(control) = control else { return false };
    let Some(jid_number) = from.strip_suffix("@s.whatsapp.net") else { return false };
    let number = jid_number.split_once(':').map_or(jid_number, |(number, _)| number);
    !control.is_empty() && number == control
}

#[cfg(test)]
mod sender_tests {
    use super::sender_allowed;

    #[test]
    fn requires_exact_configured_number_and_phone_jid() {
        let control = Some("12025550142");
        assert!(sender_allowed(control,"12025550142@s.whatsapp.net"));
        assert!(sender_allowed(control,"12025550142:7@s.whatsapp.net"));
        assert!(!sender_allowed(None,"12025550142@s.whatsapp.net"));
        assert!(!sender_allowed(control,"2025550142@s.whatsapp.net"));
        assert!(!sender_allowed(control,"12025550142@lid"));
        assert!(!sender_allowed(control,"12025550142@g.us"));
    }
}

/// Handle an inbound WhatsApp message: run the assistant, then reply to the same chat.
pub fn handle_incoming(
    app: tauri::AppHandle,
    from: String,
    text: String,
    audio_base64: Option<String>,
    mime: Option<String>,
) {
    if !sender_allowed(control_number(&app).as_deref(), &from) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        let list_id = target_list(&app);
        let result = if let Some(audio) = audio_base64 {
            ai::voice::run_voice(
                app.clone(),
                list_id.clone(),
                audio,
                mime.unwrap_or_else(|| "audio/ogg".to_string()),
                "whatsapp".to_string(),
                false,
            )
            .await
        } else if !text.trim().is_empty() {
            ai::run_sam(app.clone(), list_id, text, "whatsapp".to_string(), false).await
        } else {
            return;
        };

        let reply = match result {
            Ok(text) if !text.trim().is_empty() => text,
            Ok(_) => "Done.".to_string(),
            Err(e) => format!("the assistant couldn't process that: {e}"),
        };

        let _ = sidecar::send(&app, protocol::Outbound::Send { to: from, text: reply });
    });
}

/// Whether a Baileys session already exists on disk (so we can auto-reconnect
/// on startup). The session lives in `appData/wa-session/` and is never exported.
pub fn has_saved_session(app: &tauri::AppHandle) -> bool {
    let Ok(dir) = app.path().app_data_dir() else {
        return false;
    };
    let session = dir.join("wa-session");
    std::fs::read_dir(&session)
        .map(|mut entries| entries.next().is_some())
        .unwrap_or(false)
}

/// Send a test message from the connected account to the configured control
/// number, so the user can verify the integration end to end.
pub fn send_test_message(app: &tauri::AppHandle) -> AppResult<()> {
    let number = control_number(app).ok_or_else(|| {
        AppError::msg("Set a WhatsApp control number in Settings first.")
    })?;
    let jid = format!("{number}@s.whatsapp.net");
    sidecar::send(
        app,
        protocol::Outbound::Send {
            to: jid,
            text: "✅ Daylattice is connected!\n\nReply to this chat to manage your todos — e.g. \"add buy milk\", \"show my list\", or \"switch to Work\".".to_string(),
        },
    )
}

/// Current connection status string.
pub fn status(app: &tauri::AppHandle) -> String {
    let state = app.state::<AppState>();
    let wa = state.wa.lock().unwrap();
    wa.status.clone()
}

/// Tear down the sidecar (called on quit).
pub fn shutdown(app: &tauri::AppHandle) {
    let _ = sidecar::disconnect(app);
}
