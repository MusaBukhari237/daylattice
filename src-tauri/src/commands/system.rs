use tauri::{AppHandle, Manager};

use crate::error::AppResult;

#[tauri::command]
pub fn show_window(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn hide_window(app: AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> AppResult<()> {
    // Tear down the WhatsApp sidecar before exiting.
    crate::whatsapp::shutdown(&app);
    app.exit(0);
    Ok(())
}
