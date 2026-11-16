//! Spawns the Baileys sidecar binary and pumps its stdout events into the app.

use tauri::{Emitter, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use super::protocol::{Inbound, Outbound};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Start the sidecar (if not already running) and begin pairing.
pub fn connect(app: &tauri::AppHandle) -> AppResult<()> {
    {
        let state = app.state::<AppState>();
        let mut wa = state.wa.lock().unwrap();
        if wa.child.is_some() {
            // Already running — re-issue connect.
            if let Some(child) = wa.child.as_mut() {
                let _ = child.write(&Outbound::Connect.to_line());
            }
            return Ok(());
        }
        wa.status = "connecting".to_string();
    }
    let _ = app.emit("wa:status", serde_json::json!({ "status": "connecting" }));

    // Session folder lives outside the DB and is never exported.
    let session_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::msg(format!("no app data dir: {e}")))?
        .join("wa-session");
    std::fs::create_dir_all(&session_dir)?;

    let command = app
        .shell()
        .sidecar("daylattice-wa")
        .map_err(|e| AppError::msg(format!("failed to locate sidecar: {e}")))?
        .args([session_dir.to_string_lossy().to_string()]);

    let (mut rx, mut child) = command
        .spawn()
        .map_err(|e| AppError::msg(format!("failed to spawn sidecar: {e}")))?;

    // Tell it to connect.
    let _ = child.write(&Outbound::Connect.to_line());

    {
        let state = app.state::<AppState>();
        let mut wa = state.wa.lock().unwrap();
        wa.child = Some(child);
    }

    // Pump events on a background task.
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut line_buf = String::new();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    line_buf.push_str(&String::from_utf8_lossy(&bytes));
                    while let Some(pos) = line_buf.find('\n') {
                        let line = line_buf[..pos].trim().to_string();
                        line_buf.drain(..=pos);
                        if !line.is_empty() {
                            handle_line(&app, &line);
                        }
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    log::debug!("[wa] {}", String::from_utf8_lossy(&bytes).trim());
                }
                CommandEvent::Terminated(payload) => {
                    log::info!("[wa] sidecar terminated: {:?}", payload.code);
                    let state = app.state::<AppState>();
                    let mut wa = state.wa.lock().unwrap();
                    wa.child = None;
                    wa.status = "disconnected".to_string();
                    drop(wa);
                    let _ = app.emit("wa:status", serde_json::json!({ "status": "disconnected" }));
                    break;
                }
                CommandEvent::Error(err) => {
                    log::warn!("[wa] sidecar error: {err}");
                }
                _ => {}
            }
        }
    });

    Ok(())
}

fn handle_line(app: &tauri::AppHandle, line: &str) {
    let inbound: Inbound = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return,
    };
    match inbound {
        Inbound::Qr { data } => {
            let _ = app.emit("wa:qr", serde_json::json!({ "data": data }));
        }
        Inbound::Status { status } => {
            {
                let state = app.state::<AppState>();
                let mut wa = state.wa.lock().unwrap();
                wa.status = status.clone();
            }
            let _ = app.emit("wa:status", serde_json::json!({ "status": status }));
        }
        Inbound::Log { message } => {
            log::debug!("[wa] {message}");
        }
        Inbound::Message {
            from,
            text,
            audio_base64,
            mime,
        } => {
            let _ = app.emit(
                "wa:activity",
                serde_json::json!({ "from": from, "text": text }),
            );
            super::handle_incoming(app.clone(), from, text, audio_base64, mime);
        }
    }
}

/// Send a connect/disconnect/send command to the running sidecar.
pub fn send(app: &tauri::AppHandle, msg: Outbound) -> AppResult<()> {
    let state = app.state::<AppState>();
    let mut wa = state.wa.lock().unwrap();
    let child = wa.child.as_mut().ok_or(AppError::WaNotConnected)?;
    child
        .write(&msg.to_line())
        .map_err(|e| AppError::msg(format!("failed to write to sidecar: {e}")))?;
    Ok(())
}

/// Disconnect and kill the sidecar process.
pub fn disconnect(app: &tauri::AppHandle) -> AppResult<()> {
    let state = app.state::<AppState>();
    let mut wa = state.wa.lock().unwrap();
    if let Some(mut child) = wa.child.take() {
        let _ = child.write(&Outbound::Disconnect.to_line());
        let _ = child.kill();
    }
    wa.status = "disconnected".to_string();
    drop(wa);
    let _ = app.emit("wa:status", serde_json::json!({ "status": "disconnected" }));
    Ok(())
}
