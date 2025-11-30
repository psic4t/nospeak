import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const EXTENSION_TO_MIME: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime'
};

function getMimeType(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1] : '';
    return EXTENSION_TO_MIME[ext] ?? 'application/octet-stream';
}

export async function GET({ params }: { params: { filename: string } }) {
    const { filename } = params;

    if (!filename) {
        throw error(400, 'Filename is required');
    }

    // Basic path traversal protection
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw error(400, 'Invalid filename');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const baseDir = join(process.cwd(), isProduction ? 'build/client' : 'static', 'user_media');
    const filePath = join(baseDir, filename);

    try {
        const fileBuffer = await readFile(filePath);
        const mimeType = getMimeType(filename);

        return new Response(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                // Allow caching of user media while ensuring updates propagate
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            throw error(404, 'File not found');
        }

        console.error('Error serving user media file:', err);
        throw error(500, 'Failed to read media file');
    }
}
