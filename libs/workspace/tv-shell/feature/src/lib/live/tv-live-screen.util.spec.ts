import type { EpgItem, XtreamLiveStream } from '@iptvnator/shared/interfaces';
import {
    buildTvChannelBarItems,
    buildTvEpgGridRow,
    resolveTvZapTarget,
    toEpgProgrammeSummary,
} from './tv-live-screen.util';

function stream(overrides: Partial<XtreamLiveStream> = {}): XtreamLiveStream {
    return {
        num: 1,
        name: 'Channel',
        stream_type: 'live',
        stream_id: 1,
        stream_icon: '',
        added: '',
        category_id: '1',
        custom_sid: '',
        direct_source: '',
        tv_archive: 0,
        tv_archive_duration: 0,
        xtream_id: 1,
        ...overrides,
    };
}

describe('buildTvChannelBarItems', () => {
    it('maps streams to channel bar items', () => {
        const items = buildTvChannelBarItems([
            stream({ xtream_id: 5, name: 'BBC One', stream_icon: 'logo.png' }),
        ]);
        expect(items).toEqual([{ id: 5, name: 'BBC One', logoUrl: 'logo.png' }]);
    });

    it('drops streams with no resolvable id or name', () => {
        const items = buildTvChannelBarItems([
            stream({ xtream_id: undefined, stream_id: NaN as never }),
            stream({ name: '' }),
        ]);
        expect(items).toEqual([]);
    });
});

describe('resolveTvZapTarget', () => {
    const channels = [
        stream({ xtream_id: 1, name: 'A' }),
        stream({ xtream_id: 2, name: 'B' }),
        stream({ xtream_id: 3, name: 'C' }),
    ];

    it('moves to the next channel on down', () => {
        expect(resolveTvZapTarget(channels, 1, 'down')?.xtream_id).toBe(2);
    });

    it('moves to the previous channel on up', () => {
        expect(resolveTvZapTarget(channels, 2, 'up')?.xtream_id).toBe(1);
    });

    it('wraps around both ends', () => {
        expect(resolveTvZapTarget(channels, 3, 'down')?.xtream_id).toBe(1);
        expect(resolveTvZapTarget(channels, 1, 'up')?.xtream_id).toBe(3);
    });

    it('returns null when the current channel is not in the list', () => {
        expect(resolveTvZapTarget(channels, 99, 'down')).toBeNull();
    });

    it('returns null for an empty list', () => {
        expect(resolveTvZapTarget([], 1, 'down')).toBeNull();
    });
});

describe('toEpgProgrammeSummary', () => {
    it('returns null for a null item', () => {
        expect(toEpgProgrammeSummary(null)).toBeNull();
    });

    it('prefers the unix timestamp over the ISO date', () => {
        const item: EpgItem = {
            id: '1',
            epg_id: '1',
            title: 'News',
            lang: 'en',
            start: 'invalid',
            end: 'invalid',
            stop: 'invalid',
            description: '',
            channel_id: '1',
            start_timestamp: '1000',
            stop_timestamp: '2000',
        };
        expect(toEpgProgrammeSummary(item)).toEqual({
            title: 'News',
            startMs: 1_000_000,
            stopMs: 2_000_000,
        });
    });
});

describe('buildTvEpgGridRow', () => {
    it('marks the programme covering `nowMs` as current', () => {
        const items: EpgItem[] = [
            {
                id: 'a',
                epg_id: '1',
                title: 'Past',
                lang: 'en',
                start: '',
                end: '',
                stop: '',
                description: '',
                channel_id: '1',
                start_timestamp: '1000',
                stop_timestamp: '2000',
            },
            {
                id: 'b',
                epg_id: '1',
                title: 'Now',
                lang: 'en',
                start: '',
                end: '',
                stop: '',
                description: '',
                channel_id: '1',
                start_timestamp: '2000',
                stop_timestamp: '3000',
            },
        ];
        const row = buildTvEpgGridRow(1, 'Channel', items, 2_500_000);
        expect(row.programmes.map((p) => [p.title, p.isCurrent])).toEqual([
            ['Past', false],
            ['Now', true],
        ]);
    });

    it('drops programmes with unparsable times', () => {
        const items: EpgItem[] = [
            {
                id: 'a',
                epg_id: '1',
                title: 'Bad',
                lang: 'en',
                start: 'invalid',
                end: 'invalid',
                stop: 'invalid',
                description: '',
                channel_id: '1',
                start_timestamp: '',
                stop_timestamp: '',
            },
        ];
        expect(buildTvEpgGridRow(1, 'Channel', items, 0).programmes).toEqual([]);
    });
});
