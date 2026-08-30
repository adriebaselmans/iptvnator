import { TestBed } from '@angular/core/testing';
import type { PlayerController } from '@iptvnator/ui/playback';
import {
    TvPlaybackSession,
    TvPlaybackSessionService,
} from './tv-playback-session.service';

function fakeSession(overrides: Partial<TvPlaybackSession> = {}): TvPlaybackSession {
    return {
        controller: {} as PlayerController,
        isLive: () => false,
        reveal: jest.fn(),
        onExit: jest.fn(),
        ...overrides,
    };
}

describe('TvPlaybackSessionService', () => {
    let service: TvPlaybackSessionService;

    beforeEach(() => {
        service = TestBed.inject(TvPlaybackSessionService);
    });

    it('starts with no active session', () => {
        expect(service.active()).toBeNull();
    });

    it('registers a session as active', () => {
        const session = fakeSession();
        service.register(session);
        expect(service.active()).toBe(session);
    });

    it('unregisters the exact session it was given', () => {
        const session = fakeSession();
        const unregister = service.register(session);
        unregister();
        expect(service.active()).toBeNull();
    });

    it('does not let a stale unregister clear a newer session', () => {
        const first = fakeSession();
        const unregisterFirst = service.register(first);
        const second = fakeSession();
        service.register(second);

        unregisterFirst();

        expect(service.active()).toBe(second);
    });
});
