import type { TvEpgGridProgramme, TvEpgGridRow } from './tv-epg-grid.component';

/** Horizontal pixels per minute of programme duration (constant §-tuned for TV legibility). */
export const PIXELS_PER_MINUTE = 4;

/** Time-axis marker interval, in minutes. */
export const SLOT_INTERVAL_MINUTES = 30;

const SLOT_INTERVAL_MS = SLOT_INTERVAL_MINUTES * 60_000;

/** One 30-minute marker rendered in the timeline header. */
export interface TvEpgTimeSlot {
    readonly label: string;
    readonly offsetPx: number;
}

/** Pixel geometry for one programme cell, relative to the timeline's start. */
export interface TvEpgProgrammeLayout {
    readonly leftPx: number;
    readonly widthPx: number;
}

/** Floors a timestamp to the previous local 30-minute wall-clock mark. */
export function floorToSlot(ms: number): number {
    const date = new Date(ms);
    date.setSeconds(0, 0);
    const minutes = date.getMinutes();
    date.setMinutes(minutes - (minutes % SLOT_INTERVAL_MINUTES));
    return date.getTime();
}

/** Ceils a timestamp to the next local 30-minute wall-clock mark. */
export function ceilToSlot(ms: number): number {
    const floored = floorToSlot(ms);
    return floored === ms ? floored : floored + SLOT_INTERVAL_MS;
}

/**
 * The timeline's visible range: the earliest programme start (floored to the
 * previous 30-min mark) through the latest programme stop (ceiled to the
 * next). Falls back to a single empty slot around `nowMs` when there are no
 * programmes at all, so the header still renders something sensible.
 */
export function computeTimelineBounds(
    rows: readonly TvEpgGridRow[],
    nowMs: number
): { startMs: number; endMs: number } {
    let earliest = Number.POSITIVE_INFINITY;
    let latest = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
        for (const programme of row.programmes) {
            if (programme.startMs < earliest) earliest = programme.startMs;
            if (programme.stopMs > latest) latest = programme.stopMs;
        }
    }
    if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
        earliest = nowMs;
        latest = nowMs + SLOT_INTERVAL_MS;
    }
    return { startMs: floorToSlot(earliest), endMs: ceilToSlot(latest) };
}

/** `HH:mm` in the viewer's local time zone. */
export function formatSlotTime(ms: number): string {
    const date = new Date(ms);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/** Every 30-minute marker between `startMs` and `endMs`, with its pixel offset. */
export function buildTimeSlots(startMs: number, endMs: number): TvEpgTimeSlot[] {
    const slots: TvEpgTimeSlot[] = [];
    for (let ms = startMs; ms <= endMs; ms += SLOT_INTERVAL_MS) {
        slots.push({
            label: formatSlotTime(ms),
            offsetPx: msToPx(ms - startMs),
        });
    }
    return slots;
}

/** Converts a millisecond duration to a pixel length at `PIXELS_PER_MINUTE`. */
export function msToPx(durationMs: number): number {
    return (durationMs / 60_000) * PIXELS_PER_MINUTE;
}

/** Left offset + width for one programme cell, relative to `timelineStartMs`. */
export function programmeLayout(
    programme: TvEpgGridProgramme,
    timelineStartMs: number
): TvEpgProgrammeLayout {
    return {
        leftPx: msToPx(programme.startMs - timelineStartMs),
        widthPx: msToPx(programme.stopMs - programme.startMs),
    };
}

/** Pixel offset of the "now" indicator, relative to `timelineStartMs`. */
export function nowLineOffsetPx(nowMs: number, timelineStartMs: number): number {
    return msToPx(nowMs - timelineStartMs);
}

/** Whether `nowMs` falls within the rendered timeline range. */
export function isNowWithinTimeline(
    nowMs: number,
    startMs: number,
    endMs: number
): boolean {
    return nowMs >= startMs && nowMs <= endMs;
}

/** Total pixel width of the scrollable timeline body. */
export function timelineWidthPx(startMs: number, endMs: number): number {
    return msToPx(endMs - startMs);
}
