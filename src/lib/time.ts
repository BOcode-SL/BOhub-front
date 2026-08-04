/** Date / duration helpers for Home + Timer Analytics. */

export function monthBounds(year: number, monthIndex: number): { from: string; to: string } {
    const from = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
    return { from, to };
}

export function currentMonthBounds(d = new Date()): { from: string; to: string } {
    return monthBounds(d.getFullYear(), d.getMonth());
}

export function daysInMonth(year: number, monthIndex: number): number {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function monthLabelEs(year: number, monthIndex: number): string {
    return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

export function formatHoursFromSeconds(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.length > 0 ? parts.join(' ') : '0h';
}

/** Normalize project.color → #rrggbb or null. */
export function normalizeHexColor(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : null;
}

export const CHART_FALLBACK_COLORS = [
    '#ccff00',
    '#60a5fa',
    '#fbbf24',
    '#a78bfa',
    '#34d399',
    '#f472b6',
    '#38bdf8',
    '#fb923c',
] as const;
