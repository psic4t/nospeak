import { encode } from 'blurhash';

export interface MediaMetadata {
    width: number;
    height: number;
    blurhash: string;
}

const ENCODE_WIDTH = 32;
const ENCODE_HEIGHT = 32;
const COMPONENT_X = 4;
const COMPONENT_Y = 3;

/**
 * Extract dimensions and compute blurhash for an image file.
 * Throws on failure so callers can catch and proceed without metadata.
 */
export async function getImageMetadata(file: File): Promise<MediaMetadata> {
    const url = URL.createObjectURL(file);
    try {
        const img = await loadImage(url);
        const { width, height } = img;
        const blurhash = encodeFromImage(img);
        return { width, height, blurhash };
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Extract dimensions and compute blurhash from the first frame of a video file.
 * Throws on failure so callers can catch and proceed without metadata.
 */
export async function getVideoMetadata(file: File): Promise<MediaMetadata> {
    const url = URL.createObjectURL(file);
    try {
        const video = await loadVideoFirstFrame(url);
        const width = video.videoWidth;
        const height = video.videoHeight;
        const blurhash = encodeFromVideo(video);
        return { width, height, blurhash };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
    });
}

function loadVideoFirstFrame(src: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        video.onloadeddata = () => resolve(video);
        video.onerror = () => reject(new Error('Failed to load video'));

        video.src = src;
        // Seek to the first frame
        video.currentTime = 0.001;
    });
}

function encodeFromImage(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = ENCODE_WIDTH;
    canvas.height = ENCODE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.drawImage(img, 0, 0, ENCODE_WIDTH, ENCODE_HEIGHT);
    const imageData = ctx.getImageData(0, 0, ENCODE_WIDTH, ENCODE_HEIGHT);
    return encode(imageData.data, ENCODE_WIDTH, ENCODE_HEIGHT, COMPONENT_X, COMPONENT_Y);
}

const POSTER_MAX_WIDTH = 320;
const POSTER_TIMEOUT_MS = 3000;

/**
 * Generate a poster image (data URL) from the first frame of a video.
 * Returns empty string on failure or timeout — safe to pass as poster attribute.
 */
export async function generateVideoPoster(src: string): Promise<string> {
    return Promise.race([
        extractFirstFrame(src),
        new Promise<string>((resolve) =>
            setTimeout(() => resolve(''), POSTER_TIMEOUT_MS)
        )
    ]);
}

function extractFirstFrame(src: string): Promise<string> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        const cleanup = () => {
            video.removeAttribute('src');
            video.load();
        };

        video.onerror = () => { cleanup(); resolve(''); };

        video.onloadeddata = () => {
            try {
                const w = video.videoWidth;
                const h = video.videoHeight;
                if (!w || !h) { cleanup(); resolve(''); return; }

                const scale = Math.min(1, POSTER_MAX_WIDTH / w);
                const cw = Math.round(w * scale);
                const ch = Math.round(h * scale);

                const canvas = document.createElement('canvas');
                canvas.width = cw;
                canvas.height = ch;
                const ctx = canvas.getContext('2d');
                if (!ctx) { cleanup(); resolve(''); return; }

                ctx.drawImage(video, 0, 0, cw, ch);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                cleanup();
                resolve(dataUrl);
            } catch {
                cleanup();
                resolve('');
            }
        };

        video.src = src;
        video.currentTime = 0.001;
    });
}

function encodeFromVideo(video: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = ENCODE_WIDTH;
    canvas.height = ENCODE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.drawImage(video, 0, 0, ENCODE_WIDTH, ENCODE_HEIGHT);
    const imageData = ctx.getImageData(0, 0, ENCODE_WIDTH, ENCODE_HEIGHT);
    return encode(imageData.data, ENCODE_WIDTH, ENCODE_HEIGHT, COMPONENT_X, COMPONENT_Y);
}
