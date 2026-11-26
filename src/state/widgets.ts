/**
 * Pop-out widgets: small frameless windows (always on top by default) that show a live card.
 * Each widget keeps its own settings row ("widget:<label>") with position, size and pin state,
 * so several windows never overwrite each other's data.
 */
import { getDb } from '../lib/db';
import { deleteSetting, loadWidgetRows, setSetting, WIDGET_KEY_PREFIX } from '../lib/db/repo';
import { isTauri } from '../lib/platform';

export type WidgetKind = 'total' | 'prices' | 'asset';

export interface WidgetConfig {
  label: string;
  kind: WidgetKind;
  /** portfolio id for "total" (0 = all), asset id for "asset", 0 for "prices" */
  ref: number;
  open: boolean;
  onTop: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

const SIZES: Record<WidgetKind, [number, number]> = {
  total: [300, 176],
  prices: [300, 236],
  asset: [300, 176],
};

export function widgetLabel(kind: WidgetKind, ref = 0): string {
  return kind === 'prices' ? 'widget-prices' : `widget-${kind}-${ref}`;
}

export function widgetHash(kind: WidgetKind, ref = 0): string {
  return kind === 'prices' ? '#/widget/prices' : `#/widget/${kind}/${ref}`;
}

export function parseWidgetConfig(value: string): WidgetConfig | null {
  try {
    const c = JSON.parse(value) as Partial<WidgetConfig>;
    if (!c || typeof c.label !== 'string' || !c.label.startsWith('widget-')) return null;
    if (c.kind !== 'total' && c.kind !== 'prices' && c.kind !== 'asset') return null;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    return {
      label: c.label,
      kind: c.kind,
      ref: n(c.ref) ?? 0,
      open: c.open !== false,
      onTop: c.onTop !== false,
      x: n(c.x),
      y: n(c.y),
      w: n(c.w),
      h: n(c.h),
    };
  } catch {
    return null;
  }
}

export async function readWidgetConfigs(): Promise<WidgetConfig[]> {
  const rows = await loadWidgetRows(await getDb());
  return rows.map((r) => parseWidgetConfig(r.value)).filter((c): c is WidgetConfig => c != null);
}

export async function readWidgetConfig(label: string): Promise<WidgetConfig | null> {
  return (await readWidgetConfigs()).find((c) => c.label === label) ?? null;
}

export async function saveWidgetConfig(c: WidgetConfig): Promise<void> {
  await setSetting(await getDb(), `${WIDGET_KEY_PREFIX}${c.label}`, c);
}

export async function forgetWidget(label: string): Promise<void> {
  await deleteSetting(await getDb(), `${WIDGET_KEY_PREFIX}${label}`);
}

/** Saved position is only reused when it is still on one of the screens. */
async function onScreen(x: number, y: number): Promise<boolean> {
  try {
    const { availableMonitors } = await import('@tauri-apps/api/window');
    for (const mon of await availableMonitors()) {
      const pos = mon.position.toLogical(mon.scaleFactor);
      const size = mon.size.toLogical(mon.scaleFactor);
      if (x >= pos.x - 40 && y >= pos.y - 10 && x < pos.x + size.width - 60 && y < pos.y + size.height - 60) return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

async function createWindow(c: WidgetConfig): Promise<void> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  if (await WebviewWindow.getByLabel(c.label)) return;
  const [w, h] = SIZES[c.kind];
  const place = c.x != null && c.y != null && (await onScreen(c.x, c.y)) ? { x: c.x, y: c.y } : { center: true };
  new WebviewWindow(c.label, {
    url: `index.html${widgetHash(c.kind, c.ref)}`,
    title: 'Asset Tracker',
    width: c.w ?? w,
    height: c.h ?? h,
    minWidth: 220,
    minHeight: 120,
    ...place,
    decorations: false,
    resizable: true,
    alwaysOnTop: c.onTop,
    skipTaskbar: true,
    shadow: true,
    focus: true,
  });
}

export async function openWidget(kind: WidgetKind, ref = 0): Promise<void> {
  const label = widgetLabel(kind, ref);
  if (!isTauri) {
    const [w, h] = SIZES[kind];
    window.open(widgetHash(kind, ref), label, `popup,width=${w},height=${h}`);
    return;
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }
  const saved = await readWidgetConfig(label);
  const c: WidgetConfig = saved ? { ...saved, open: true } : { label, kind, ref, open: true, onTop: true };
  await saveWidgetConfig(c);
  await createWindow(c);
}

/** Desktop app start: bring back the widgets that were open last time. */
export async function reopenWidgets(): Promise<void> {
  if (!isTauri) return;
  for (const c of await readWidgetConfigs()) {
    if (c.open) await createWindow(c).catch(() => {});
  }
}
