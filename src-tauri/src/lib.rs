mod db;
mod tray;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, WindowEvent};

/// When true, closing the main window hides it and the app keeps running in the
/// menu bar / tray, so price alerts and widgets keep working.
pub struct UiState {
    keep_in_tray: AtomicBool,
}

#[tauri::command]
fn set_keep_in_tray(state: tauri::State<'_, UiState>, value: bool) {
    state.keep_in_tray.store(value, Ordering::Relaxed);
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    tray::show_main(&app);
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Must be first: a second launch just brings the running app to the front.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main(app);
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(UiState {
            keep_in_tray: AtomicBool::new(true),
        })
        .setup(|app| {
            let state = db::open(app.handle())?;
            // Respect the saved choice from the very first second (before the screens have loaded).
            let keep = state.setting("keepInTray").map_or(true, |v| v.trim() != "false");
            app.state::<UiState>().keep_in_tray.store(keep, Ordering::Relaxed);
            app.manage(state);
            tray::create(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    if window.state::<UiState>().keep_in_tray.load(Ordering::Relaxed) {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            db::db_execute,
            db::db_select,
            db::db_batch,
            db::db_backup,
            db::db_info,
            db::open_data_folder,
            tray::tray_update,
            set_keep_in_tray,
            show_main_window,
            quit_app,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Asset Tracker");

    app.run(|_app, _event| {
        // macOS: clicking the Dock icon brings the hidden main window back.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = _event {
            tray::show_main(_app);
        }
    });
}
