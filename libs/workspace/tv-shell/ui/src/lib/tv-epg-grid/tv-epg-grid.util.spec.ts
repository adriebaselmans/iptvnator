import type { TvEpgGridRow } from './tv-epg-grid.component';
import {
    PIXELS_PER_MINUTE,
    buildTimeSlots,
    ceilToSlot,
    computeTimelineBounds,
    floorToSlot,
    formatSlotTime,
    isNowWithinTimeline,
    nowLineOffsetPx,
    programmeLayout,
    timelineWidthPx,
} from './tv-epg-grid.util';

const HOUR_MS = 60 * 60_000;

function ms(hour: number, minute = 0): number {
    return new Date(2026, 0, 1, hour, minute, 0, 0).getTime();
}

describe('tv-epg-grid.util', () => {
    describe('floorToSlot / ceilToSlot', () => {
        it('floors to the previous 30-minute mark', () => {
            expect(floorToSlot(ms(18, 17))).toBe(ms(18, 0));
            expect(floorToSlot(ms(18, 42))).toBe(ms(18, 30));
        });

        it('leaves a value already on a 30-minute mark unchanged', () => {
            expect(floorToSlot(ms(18, 30))).toBe(ms(18, 30));
        });

        it('ceils to the next 30-minute mark', () => {
            expect(ceilToSlot(ms(18, 5))).toBe(ms(18, 30));
            expect(ceilToSlot(ms(18, 45))).toBe(ms(19, 0));
        });

        it('leaves a value already on a 30-minute mark unchanged when ceiling', () => {
            expect(ceilToSlot(ms(19, 0))).toBe(ms(19, 0));
        });
    });

    describe('computeTimelineBounds', () => {
        it('spans the earliest start (floored) to the latest stop (ceiled)', () => {
            const rows: TvEpgGridRow[] = [
                {
                    channelId: 1,
                    channelName: 'A',
                    programmes: [
                        {
                            id: 'a',
                            title: 'A1',
                            startMs: ms(18, 10),
                            stopMs: ms(19, 5),
                            isCurrent: false,
                        },
                    ],
                },
                {
                    channelId: 2,
                    channelName: 'B',
                    programmes: [
                        {
                            id: 'b',
                            title: 'B1',
                            startMs: ms(19, 5),
                            stopMs: ms(20, 50),
                            isCurrent: false,
                        },
                    ],
                },
            ];

            const bounds = computeTimelineBounds(rows, ms(19, 0));
            expect(bounds.startMs).toBe(ms(18, 0));
            expect(bounds.endMs).toBe(ms(21, 0));
        });

        it('falls back to a window around now when there are no programmes', () => {
            const rows: TvEpgGridRow[] = [{ channelId: 1, channelName: 'A', programmes: [] }];
            const bounds = computeTimelineBounds(rows, ms(19, 0));
            expect(bounds.startMs).toBe(ms(19, 0));
            expect(bounds.endMs).toBe(ms(19, 30));
        });
    });

    describe('formatSlotTime', () => {
        it('formats as zero-padded HH:mm', () => {
            expect(formatSlotTime(ms(9, 5))).toBe('09:05');
            expect(formatSlotTime(ms(18, 30))).toBe('18:30');
        });
    });

    describe('buildTimeSlots', () => {
        it('produces one marker every 30 minutes, offsets increasing by 120px', () => {
            const slots = buildTimeSlots(ms(18, 0), ms(19, 0));
            expect(slots.map((slot) => slot.label)).toEqual(['18:00', '18:30', '19:00']);
            expect(slots.map((slot) => slot.offsetPx)).toEqual([0, 120, 240]);
        });
    });

    describe('programmeLayout / timelineWidthPx / nowLineOffsetPx', () => {
        it('computes proportional left/width at PIXELS_PER_MINUTE', () => {
            const layout = programmeLayout(
                {
                    id: 'a',
                    title: 'A1',
                    startMs: ms(18, 30),
                    stopMs: ms(19, 30),
                    isCurrent: false,
                },
                ms(18, 0)
            );
            expect(layout.leftPx).toBe(30 * PIXELS_PER_MINUTE);
            expect(layout.widthPx).toBe(60 * PIXELS_PER_MINUTE);
        });

        it('computes total timeline width from the bounds', () => {
            expect(timelineWidthPx(ms(18, 0), ms(20, 0))).toBe(
                (2 * HOUR_MS) / 60_000 * PIXELS_PER_MINUTE
            );
        });

        it('computes the now-line offset relative to the timeline start', () => {
            expect(nowLineOffsetPx(ms(18, 45), ms(18, 0))).toBe(45 * PIXELS_PER_MINUTE);
        });
    });

    describe('isNowWithinTimeline', () => {
        it('is true within bounds and false outside', () => {
            expect(isNowWithinTimeline(ms(18, 30), ms(18, 0), ms(19, 0))).toBe(true);
            expect(isNowWithinTimeline(ms(17, 30), ms(18, 0), ms(19, 0))).toBe(false);
            expect(isNowWithinTimeline(ms(19, 30), ms(18, 0), ms(19, 0))).toBe(false);
        });
    });
});
