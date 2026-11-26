//! Menu-bar (macOS) / system-tray (Windows) icon with live prices.
//!
//! The frontend computes the text and calls `tray_update`. On macOS the text shows next to the
//! icon in the menu bar; Windows has no tray text, so the prices appear in the tooltip.

use serde::Deserialize;
#[cfg(target_os = "macos")]
use tauri::image::Image;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, Wry,
};

pub const TRAY_ID: &str = "main-tray";

/// Menu items kept so their text can follow the app language.
pub struct TrayMenu {
    show: MenuItem<Wry>,
    refresh: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn create(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Asset Tracker", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", "Refresh prices", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &refresh, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Asset Tracker")
        .menu(&menu)
        // macOS: click shows the menu (normal for menu-bar apps). Windows: left click opens the app.
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "refresh" => {
                let _ = app.emit("tray-refresh", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if !cfg!(target_os = "macos") {
                    show_main(tray.app_handle());
                }
            }
        });

    #[cfg(target_os = "macos")]
    {
        // Black-and-transparent "template" image: macOS recolours it for light/dark menu bars.
        builder = builder
            .icon(Image::from_bytes(include_bytes!("../icons/tray-template.png"))?)
            .icon_as_template(true);
    }
    #[cfg(not(target_os = "macos"))]
    {
        if let Some(icon) = app.default_window_icon() {
            builder = builder.icon(icon.clone());
        }
    }

    builder.build(app)?;
    app.manage(TrayMenu { show, refresh, quit });
    Ok(())
}

#[derive(Deserialize)]
pub struct TrayLabels {
    show: String,
    refresh: String,
    quit: String,
}

#[tauri::command]
pub fn tray_update(
    app: AppHandle,
    title: Option<String>,
    tooltip: Option<String>,
    labels: Option<TrayLabels>,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let title = title.filter(|t| !t.is_empty());
        tray.set_title(title.as_deref()).map_err(|e| e.to_string())?;
        tray.set_tooltip(tooltip.as_deref()).map_err(|e| e.to_string())?;
    }
    if let Some(l) = labels {
        let menu = app.state::<TrayMenu>();
        menu.show.set_text(&l.show).map_err(|e| e.to_string())?;
        menu.refresh.set_text(&l.refresh).map_err(|e| e.to_string())?;
        menu.quit.set_text(&l.quit).map_err(|e| e.to_string())?;
    }
    Ok(())
}
