/** Today's date in the user's local time zone, as YYYY-MM-DD. */
export function todayLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Seconds since an ISO timestamp (Infinity when missing or invalid). */
export function ageSeconds(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (now - t) / 1000) : Infinity;
}
