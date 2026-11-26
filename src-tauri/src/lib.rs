mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = db::open(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_execute,
            db::db_select,
            db::db_batch,
            db::db_backup,
            db::db_info,
            db::open_data_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Asset Tracker");
}
