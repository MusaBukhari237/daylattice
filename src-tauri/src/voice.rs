//! Push-to-talk voice hotkey: a global shortcut that, when held for a
//! configurable delay, shows the window and starts a listening session; on
//! release it tells the UI to stop recording and hand the audio to the assistant.
//!
//! Works even when the window is hidden in the tray (global, OS-level shortcut).

use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::error::{AppError, AppResult};
use crate::state::{AppState, VoiceConfig};

/// Read the persisted voice config from the profile row.
pub fn load_config(app: &AppHandle) -> VoiceConfig {
    let state = app.state::<AppState>();
    let conn = state.db.lock().unwrap();
    conn.query_row(
        "SELECT voice_shortcut, voice_hold_ms FROM profile LIMIT 1",
        [],
        |r| {
            Ok(VoiceConfig {
                shortcut: r.get::<_, String>(0)?,
                hold_ms: r.get::<_, i64>(1)?.max(0) as u64,
            })
        },
    )
    .unwrap_or_default()
}

/// (Re)register the global shortcut, replacing any previous one.
pub fn register(app: &AppHandle, shortcut: &str) -> AppResult<()> {
    let parsed = shortcut
        .parse::<tauri_plugin_global_shortcut::Shortcut>()
        .map_err(|e| AppError::msg(format!("invalid shortcut '{shortcut}': {e:?}")))?;
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    gs.register(parsed)
        .map_err(|e| AppError::msg(format!("failed to register shortcut: {e}")))?;
    Ok(())
}

/// Entry point from the plugin handler.
pub fn on_shortcut(app: &AppHandle, state: ShortcutState) {
    match state {
        ShortcutState::Pressed => on_press(app),
        ShortcutState::Released => on_release(app),
    }
}

fn on_press(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (gen, hold_ms) = {
        let mut v = state.voice.lock().unwrap();
        if v.pressed {
            return; // ignore OS key-repeat while held
        }
        v.pressed = true;
        v.generation += 1;
        let gen = v.generation;
        let hold_ms = state.voice_config.lock().unwrap().hold_ms;
        (gen, hold_ms)
    };

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if hold_ms > 0 {
            tokio::time::sleep(Duration::from_millis(hold_ms)).await;
        }
        let state = app.state::<AppState>();
        let activate = {
            let mut v = state.voice.lock().unwrap();
            if v.pressed && v.generation == gen && !v.active {
                v.active = true;
                true
            } else {
                false
            }
        };
        if activate {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            let _ = app.emit("voice:start", ());
        }
    });
}

fn on_release(app: &AppHandle) {
    let state = app.state::<AppState>();
    let was_active = {
        let mut v = state.voice.lock().unwrap();
        v.pressed = false;
        v.generation += 1; // invalidate any pending hold timer
        let was = v.active;
        v.active = false;
        was
    };
    if was_active {
        let _ = app.emit("voice:stop", ());
    }
}
