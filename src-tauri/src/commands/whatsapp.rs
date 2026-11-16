use tauri::AppHandle;

use crate::error::AppResult;
use crate::whatsapp;

#[tauri::command]
pub fn wa_connect(app: AppHandle) -> AppResult<()> {
    whatsapp::sidecar::connect(&app)
}

#[tauri::command]
pub fn wa_disconnect(app: AppHandle) -> AppResult<()> {
    whatsapp::sidecar::disconnect(&app)
}

#[tauri::command]
pub fn wa_status(app: AppHandle) -> AppResult<String> {
    Ok(whatsapp::status(&app))
}

#[tauri::command]
pub fn wa_send_test(app: AppHandle) -> AppResult<()> {
    whatsapp::send_test_message(&app)
}
