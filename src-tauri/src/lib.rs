//! Daylattice core library entry point. Wires plugins, managed state, the SQLite
//! database, the system tray, window lifecycle, and all Tauri commands.

mod ai;
mod commands;
mod db;
mod error;
mod lifecycle;
mod models;
mod secrets;
mod state;
mod tray;
mod voice;
mod whatsapp;

use tauri::Manager;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance MUST be the first plugin registered.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![lifecycle::AUTOSTART_FLAG]),
            ))
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app, _shortcut, event| {
                        voice::on_shortcut(app, event.state());
                    })
                    .build(),
            );
    }

    builder
        .setup(|app| {
            let handle = app.handle();

            // Open (or create) the database under the app data dir.
            let data_dir = handle.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("daylattice.db");
            let conn = db::open(&db_path).expect("failed to open database");
            app.manage(AppState::new(conn));

            // System tray.
            tray::create(handle)?;

            // Show or hide the window depending on how we were launched.
            lifecycle::apply_startup_visibility(handle);

            // Load + register the push-to-talk voice hotkey.
            #[cfg(desktop)]
            {
                let cfg = voice::load_config(handle);
                if let Err(e) = voice::register(handle, &cfg.shortcut) {
                    log::warn!("voice shortcut registration failed: {e}");
                }
                *app.state::<AppState>().voice_config.lock().unwrap() = cfg;
            }

            // If a WhatsApp session already exists, reconnect it in the background
            // so messages/voice notes keep working across restarts.
            if whatsapp::has_saved_session(handle) {
                let h = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = whatsapp::sidecar::connect(&h) {
                        log::warn!("WhatsApp auto-reconnect failed: {e}");
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            lifecycle::on_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            // profile
            commands::profile::get_profile,
            commands::profile::create_profile,
            commands::profile::update_profile,
            commands::profile::complete_onboarding,
            // lists
            commands::lists::get_lists,
            commands::lists::create_list,
            commands::lists::update_list,
            commands::lists::delete_list,
            commands::lists::reorder_lists,
            // sections
            commands::sections::get_sections,
            commands::sections::create_section,
            commands::sections::update_section,
            commands::sections::delete_section,
            commands::sections::reorder_sections,
            // tasks
            commands::tasks::get_tasks,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::tasks::move_task,
            commands::tasks::bulk_update_tasks,
            // labels
            commands::labels::get_labels,
            commands::labels::create_label,
            commands::labels::update_label,
            commands::labels::delete_label,
            commands::labels::assign_label,
            commands::labels::unassign_label,
            // settings
            commands::settings::get_settings,
            commands::settings::set_api_key,
            commands::settings::clear_api_key,
            commands::settings::has_api_key,
            commands::settings::set_language,
            commands::settings::set_theme,
            commands::settings::get_autostart,
            commands::settings::set_autostart,
            commands::settings::set_wa_control_number,
            commands::settings::set_default_list,
            commands::settings::get_default_list,
            // sam
            commands::sam::get_sam_messages,
            commands::sam::sam_text_command,
            commands::sam::sam_voice_command,
            commands::sam::sam_enhance_task,
            commands::sam::sam_transcribe,
            commands::sam::clear_sam_messages,
            // whatsapp
            commands::whatsapp::wa_connect,
            commands::whatsapp::wa_disconnect,
            commands::whatsapp::wa_status,
            commands::whatsapp::wa_send_test,
            // voice hotkey
            commands::voice::get_voice_settings,
            commands::voice::set_voice_settings,
            // backup
            commands::backup::export_backup,
            commands::backup::import_backup,
            // system
            commands::system::show_window,
            commands::system::hide_window,
            commands::system::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Daylattice");
}
