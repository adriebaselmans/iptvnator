import { isEmbeddedMpvFrameCopyAvailable } from './tv-embedded-mpv-support.util';

describe('isEmbeddedMpvFrameCopyAvailable', () => {
    it('is false when window.electron is undefined (PWA)', async () => {
        await expect(isEmbeddedMpvFrameCopyAvailable(undefined)).resolves.toBe(
            false
        );
    });

    it('is false when the bridge has no getEmbeddedMpvSupport method', async () => {
        await expect(
            isEmbeddedMpvFrameCopyAvailable({} as never)
        ).resolves.toBe(false);
    });

    it('is true only when supported and the resolved engine is frame-copy', async () => {
        await expect(
            isEmbeddedMpvFrameCopyAvailable({
                getEmbeddedMpvSupport: () =>
                    Promise.resolve({
                        supported: true,
                        platform: 'linux',
                        engine: 'frame-copy',
                    }),
            } as never)
        ).resolves.toBe(true);
    });

    it('is false when supported but the resolved engine is native-view', async () => {
        await expect(
            isEmbeddedMpvFrameCopyAvailable({
                getEmbeddedMpvSupport: () =>
                    Promise.resolve({
                        supported: true,
                        platform: 'darwin',
                        engine: 'native',
                    }),
            } as never)
        ).resolves.toBe(false);
    });

    it('is false when the packaged gate reports unsupported', async () => {
        await expect(
            isEmbeddedMpvFrameCopyAvailable({
                getEmbeddedMpvSupport: () =>
                    Promise.resolve({
                        supported: false,
                        platform: 'linux',
                        reason: 'helper-probe-failed',
                    }),
            } as never)
        ).resolves.toBe(false);
    });

    it('fails closed to false when the probe rejects', async () => {
        await expect(
            isEmbeddedMpvFrameCopyAvailable({
                getEmbeddedMpvSupport: () =>
                    Promise.reject(new Error('ipc timeout')),
            } as never)
        ).resolves.toBe(false);
    });
});
