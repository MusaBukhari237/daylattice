//! Window lifecycle: close-to-tray and startup show/hide behavior.

use tauri::{Manager, WindowEvent};

/// The CLI flag the autostart plugin appends when the app is launched at login.
pub const AUTOSTART_FLAG: &str = "--autostart";

/// Decide whether to show the main window on launch.
///
/// - Manual launch (double-click, shortcut): show the window.
/// - Login/autostart launch (flag present): stay hidden in the tray; the core +
///   sidecar still run so WhatsApp/AI remain live.
pub fn apply_startup_visibility(app: &tauri::AppHandle) {
    let launched_at_login = std::env::args().any(|a| a == AUTOSTART_FLAG);
    if let Some(win) = app.get_webview_window("main") {
        if launched_at_login {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// Intercept window close → hide instead of exit (close-to-tray). The process
/// keeps running so WhatsApp and the assistant stay active in the background.
pub fn on_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}
