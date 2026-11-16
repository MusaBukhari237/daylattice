//! Tauri command handlers, grouped by domain. Each `pub` function annotated with
//! `#[tauri::command]` is registered in `lib.rs`'s `invoke_handler`.

pub mod backup;
pub mod labels;
pub mod lists;
pub mod profile;
pub mod sam;
pub mod sections;
pub mod settings;
pub mod system;
pub mod tasks;
pub mod voice;
pub mod whatsapp;

/// Emit `data:changed` so every open view refetches after a mutation from any
/// channel (UI, the assistant, WhatsApp).
pub fn emit_data_changed(app: &tauri::AppHandle) {
    use tauri::Emitter;
    let _ = app.emit("data:changed", ());
}
