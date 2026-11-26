/** Saving and opening files: native dialogs in the desktop app, download/upload in a browser tab. */
import { isTauri } from '../lib/platform';

export async function saveTextFile(defaultName: string, text: string, ext: 'json' | 'csv'): Promise<boolean> {
  if (isTauri) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const blob = new Blob([text], { type: ext === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function openTextFile(ext: 'json'): Promise<string | null> {
  if (isTauri) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const path = await open({ multiple: false, directory: false, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!path || Array.isArray(path)) return null;
    return readTextFile(path);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `.${ext},application/json`;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

export interface DbInfo {
  path: string;
  sizeBytes: number;
  backupsDir: string;
  backups: string[];
}

export async function getDbInfo(): Promise<DbInfo | null> {
  if (!isTauri) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<DbInfo>('db_info');
}

export async function openDataFolder(): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_data_folder');
}

export async function openUrl(url: string): Promise<void> {
  if (isTauri) {
    const { openUrl: open } = await import('@tauri-apps/plugin-opener');
    await open(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}
