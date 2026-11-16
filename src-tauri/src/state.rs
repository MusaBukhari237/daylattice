//! Managed application state held in Tauri (`app.manage(...)`), reachable from
//! every command via `tauri::State<AppState>`.

use std::sync::Mutex;

use rusqlite::Connection;
use tauri_plugin_shell::process::CommandChild;

/// Live WhatsApp sidecar state.
#[derive(Default)]
pub struct WaState {
    /// Handle to the running sidecar process (its stdin sender), if connected.
    pub child: Option<CommandChild>,
    /// "disconnected" | "connecting" | "connected"
    pub status: String,
}

impl WaState {
    pub fn new() -> Self {
        WaState {
            child: None,
            status: "disconnected".to_string(),
        }
    }
}

/// Configuration for the push-to-talk voice hotkey.
#[derive(Clone)]
pub struct VoiceConfig {
    /// Tauri accelerator string, e.g. "Control+Shift+Space".
    pub shortcut: String,
    /// How long the shortcut must be held before listening starts (0 = instant).
    pub hold_ms: u64,
}

impl Default for VoiceConfig {
    fn default() -> Self {
        VoiceConfig {
            shortcut: "Control+Shift+Space".to_string(),
            hold_ms: 1000,
        }
    }
}

/// Live state of the voice hotkey press/hold lifecycle.
#[derive(Default)]
pub struct VoiceRuntime {
    /// Whether the shortcut is currently held (guards key-repeat events).
    pub pressed: bool,
    /// Bumped on every press/release to invalidate pending hold timers.
    pub generation: u64,
    /// Whether a listening session is currently active.
    pub active: bool,
}

pub struct AppState {
    /// The single SQLite connection guarded by a mutex. Commands run on Tauri's
    /// worker threads, so brief lock contention never blocks the UI thread.
    pub db: Mutex<Connection>,
    pub wa: Mutex<WaState>,
    pub voice_config: Mutex<VoiceConfig>,
    pub voice: Mutex<VoiceRuntime>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        AppState {
            db: Mutex::new(conn),
            wa: Mutex::new(WaState::new()),
            voice_config: Mutex::new(VoiceConfig::default()),
            voice: Mutex::new(VoiceRuntime::default()),
        }
    }
}
