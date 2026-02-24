import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getImageMetadata, getVideoMetadata, generateVideoPoster } from './mediaMetadata';

// Mock blurhash encode
vi.mock('blurhash', () => ({
    encode: vi.fn(() => 'LEHV6nWB2yk8pyo0adR*.7kCMdnj')
}));

describe('getImageMetadata', () => {
    let mockCanvas: any;
    let mockCtx: any;
    let mockImageData: any;

    beforeEach(() => {
        mockImageData = {
            data: new Uint8ClampedArray(32 * 32 * 4)
        };
        mockCtx = {
            drawImage: vi.fn(),
            getImageData: vi.fn(() => mockImageData)
        };
        mockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => mockCtx)
        };
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') return mockCanvas as any;
            if (tag === 'video') {
                const video: any = {
                    preload: '',
                    muted: false,
                    playsInline: false,
                    videoWidth: 1280,
                    videoHeight: 720,
                    src: '',
                    currentTime: 0,
                    onloadeddata: null,
                    onerror: null
                };
                // Simulate loadeddata after src is set
                Object.defineProperty(video, 'src', {
                    set(val: string) {
                        video._src = val;
                    },
                    get() { return video._src; }
                });
                Object.defineProperty(video, 'currentTime', {
                    set() {
                        // Trigger loadeddata when seeking
                        setTimeout(() => video.onloadeddata?.(), 0);
                    },
                    get() { return 0; }
                });
                return video;
            }
            return {} as any;
        });

        // Mock URL.createObjectURL / revokeObjectURL
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        // Mock Image constructor
        vi.stubGlobal('Image', class MockImage {
            width = 1920;
            height = 1080;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_val: string) {
                setTimeout(() => this.onload?.(), 0);
            }
        });
    });

    it('returns correct dimensions and blurhash for an image', async () => {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        const result = await getImageMetadata(file);

        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
        expect(result.blurhash).toBe('LEHV6nWB2yk8pyo0adR*.7kCMdnj');
    });

    it('draws image to 32x32 canvas for encoding', async () => {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        await getImageMetadata(file);

        expect(mockCanvas.width).toBe(32);
        expect(mockCanvas.height).toBe(32);
        expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 32, 32);
        expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 32, 32);
    });

    it('revokes object URL after extraction', async () => {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        await getImageMetadata(file);

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });

    it('throws when canvas context is unavailable', async () => {
        mockCanvas.getContext = vi.fn(() => null);
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

        await expect(getImageMetadata(file)).rejects.toThrow('Canvas 2D context unavailable');
    });

    it('throws when image fails to load', async () => {
        vi.stubGlobal('Image', class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_val: string) {
                setTimeout(() => this.onerror?.(), 0);
            }
        });

        const file = new File(['test'], 'bad.jpg', { type: 'image/jpeg' });
        await expect(getImageMetadata(file)).rejects.toThrow('Failed to load image');
    });
});

describe('getVideoMetadata', () => {
    let mockCanvas: any;
    let mockCtx: any;
    let mockImageData: any;

    beforeEach(() => {
        mockImageData = {
            data: new Uint8ClampedArray(32 * 32 * 4)
        };
        mockCtx = {
            drawImage: vi.fn(),
            getImageData: vi.fn(() => mockImageData)
        };
        mockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => mockCtx)
        };
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') return mockCanvas as any;
            if (tag === 'video') {
                const video: any = {
                    preload: '',
                    muted: false,
                    playsInline: false,
                    videoWidth: 1280,
                    videoHeight: 720,
                    _src: '',
                    _currentTime: 0,
                    onloadeddata: null as (() => void) | null,
                    onerror: null as (() => void) | null
                };
                Object.defineProperty(video, 'src', {
                    set(val: string) {
                        video._src = val;
                    },
                    get() { return video._src; }
                });
                Object.defineProperty(video, 'currentTime', {
                    set(_val: number) {
                        setTimeout(() => video.onloadeddata?.(), 0);
                    },
                    get() { return 0; }
                });
                return video;
            }
            return {} as any;
        });

        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-video-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    it('returns correct dimensions and blurhash for a video', async () => {
        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const result = await getVideoMetadata(file);

        expect(result.width).toBe(1280);
        expect(result.height).toBe(720);
        expect(result.blurhash).toBe('LEHV6nWB2yk8pyo0adR*.7kCMdnj');
    });

    it('draws video first frame to 32x32 canvas', async () => {
        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        await getVideoMetadata(file);

        expect(mockCanvas.width).toBe(32);
        expect(mockCanvas.height).toBe(32);
        expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 32, 32);
    });

    it('revokes object URL after extraction', async () => {
        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        await getVideoMetadata(file);

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-video-url');
    });

    it('throws when video fails to load', async () => {
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') return mockCanvas as any;
            if (tag === 'video') {
                const video: any = {
                    preload: '',
                    muted: false,
                    playsInline: false,
                    _src: '',
                    onloadeddata: null as (() => void) | null,
                    onerror: null as (() => void) | null
                };
                Object.defineProperty(video, 'src', {
                    set(val: string) {
                        video._src = val;
                    },
                    get() { return video._src; }
                });
                Object.defineProperty(video, 'currentTime', {
                    set() {
                        setTimeout(() => video.onerror?.(), 0);
                    },
                    get() { return 0; }
                });
                return video;
            }
            return {} as any;
        });

        const file = new File(['test'], 'bad.mp4', { type: 'video/mp4' });
        await expect(getVideoMetadata(file)).rejects.toThrow('Failed to load video');
    });
});

describe('generateVideoPoster', () => {
    let mockCanvas: any;
    let mockCtx: any;

    beforeEach(() => {
        vi.useFakeTimers();
        mockCtx = {
            drawImage: vi.fn(),
        };
        mockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => mockCtx),
            toDataURL: vi.fn(() => 'data:image/jpeg;base64,fakeposter'),
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function setupMockVideo(opts: { videoWidth?: number; videoHeight?: number; triggerError?: boolean } = {}) {
        const { videoWidth = 1280, videoHeight = 720, triggerError = false } = opts;
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') return mockCanvas as any;
            if (tag === 'video') {
                const video: any = {
                    preload: '',
                    muted: false,
                    playsInline: false,
                    videoWidth,
                    videoHeight,
                    _src: '',
                    _currentTime: 0,
                    onloadeddata: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                    removeAttribute: vi.fn(),
                    load: vi.fn(),
                };
                Object.defineProperty(video, 'src', {
                    set(val: string) {
                        video._src = val;
                    },
                    get() { return video._src; },
                });
                Object.defineProperty(video, 'currentTime', {
                    set(_val: number) {
                        if (triggerError) {
                            setTimeout(() => video.onerror?.(), 0);
                        } else {
                            setTimeout(() => video.onloadeddata?.(), 0);
                        }
                    },
                    get() { return 0; },
                });
                return video;
            }
            return {} as any;
        });
    }

    it('returns a data URL on success', async () => {
        setupMockVideo();
        const promise = generateVideoPoster('blob:test-url');
        await vi.advanceTimersByTimeAsync(10);
        const result = await promise;
        expect(result).toBe('data:image/jpeg;base64,fakeposter');
    });

    it('scales down to max 320px width', async () => {
        setupMockVideo({ videoWidth: 1920, videoHeight: 1080 });
        const promise = generateVideoPoster('blob:test-url');
        await vi.advanceTimersByTimeAsync(10);
        await promise;

        // scale = 320 / 1920 = 1/6, cw = 320, ch = 180
        expect(mockCanvas.width).toBe(320);
        expect(mockCanvas.height).toBe(180);
    });

    it('does not upscale small videos', async () => {
        setupMockVideo({ videoWidth: 200, videoHeight: 150 });
        const promise = generateVideoPoster('blob:test-url');
        await vi.advanceTimersByTimeAsync(10);
        await promise;

        expect(mockCanvas.width).toBe(200);
        expect(mockCanvas.height).toBe(150);
    });

    it('returns empty string when video fails to load', async () => {
        setupMockVideo({ triggerError: true });
        const promise = generateVideoPoster('blob:bad-url');
        await vi.advanceTimersByTimeAsync(10);
        const result = await promise;
        expect(result).toBe('');
    });

    it('returns empty string on timeout', async () => {
        // Set up a video that never fires loadeddata or onerror
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') return mockCanvas as any;
            if (tag === 'video') {
                const video: any = {
                    preload: '',
                    muted: false,
                    playsInline: false,
                    videoWidth: 0,
                    videoHeight: 0,
                    _src: '',
                    onloadeddata: null,
                    onerror: null,
                    removeAttribute: vi.fn(),
                    load: vi.fn(),
                };
                Object.defineProperty(video, 'src', {
                    set(val: string) { video._src = val; },
                    get() { return video._src; },
                });
                Object.defineProperty(video, 'currentTime', {
                    set() { /* never fires callback */ },
                    get() { return 0; },
                });
                return video;
            }
            return {} as any;
        });

        const promise = generateVideoPoster('blob:stuck-url');
        // Advance past the 3000ms timeout
        await vi.advanceTimersByTimeAsync(3100);
        const result = await promise;
        expect(result).toBe('');
    });

    it('returns empty string when video dimensions are zero', async () => {
        setupMockVideo({ videoWidth: 0, videoHeight: 0 });
        const promise = generateVideoPoster('blob:test-url');
        await vi.advanceTimersByTimeAsync(10);
        const result = await promise;
        expect(result).toBe('');
    });

    it('returns empty string when canvas context is unavailable', async () => {
        mockCanvas.getContext = vi.fn(() => null);
        setupMockVideo();
        const promise = generateVideoPoster('blob:test-url');
        await vi.advanceTimersByTimeAsync(10);
        const result = await promise;
        expect(result).toBe('');
    });
});
