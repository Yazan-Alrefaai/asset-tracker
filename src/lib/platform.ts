/** True inside the Tauri desktop app; false in a normal browser tab (dev/demo mode). */
export const isTauri: boolean = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
