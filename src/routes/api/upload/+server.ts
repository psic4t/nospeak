import { json, type RequestHandler } from '@sveltejs/kit';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { verifyEvent, type Event as NostrEvent } from 'nostr-tools';

// File type validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
} as const;

const CANONICAL_UPLOAD_URL = 'https://nospeak.chat/api/upload';
const NIP98_KIND = 27235;
const NIP98_MAX_SKEW_SECONDS = 300; // ±5 minutes

function getFileExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov'
    };
    return mimeToExt[mimeType] || 'bin';
}

function decodeBase64Url(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    return Buffer.from(padded, 'base64').toString('utf8');
}

function jsonError(status: number, message: string): Response {
    return new Response(JSON.stringify({ success: false, error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        }
    });
}

export async function validateNip98(request: Request): Promise<Response | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Nostr ')) {
        return jsonError(401, 'Missing NIP-98 Authorization header');
    }

    const token = authHeader.slice('Nostr '.length).trim();
    let event: NostrEvent;

    try {
        const jsonString = decodeBase64Url(token);
        const parsed = JSON.parse(jsonString) as NostrEvent;
        event = parsed;
    } catch {
        return jsonError(401, 'Invalid NIP-98 Authorization payload');
    }

    if (event.kind !== NIP98_KIND) {
        return jsonError(401, 'Invalid NIP-98 event kind');
    }

    if (!verifyEvent(event)) {
        return jsonError(401, 'Invalid NIP-98 event signature');
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof event.created_at !== 'number' || Math.abs(event.created_at - now) > NIP98_MAX_SKEW_SECONDS) {
        return jsonError(401, 'NIP-98 event expired or not yet valid');
    }

    const urlTag = event.tags.find((tag) => tag[0] === 'u');
    const methodTag = event.tags.find((tag) => tag[0] === 'method');

    if (!urlTag || urlTag[1] !== CANONICAL_UPLOAD_URL) {
        return jsonError(401, 'NIP-98 event URL does not match canonical upload endpoint');
    }

    if (!methodTag || methodTag[1].toUpperCase() !== 'POST') {
        return jsonError(401, 'NIP-98 event method is not POST');
    }

    return null;
}

export const POST: RequestHandler = async ({ request }) => {
    const authError = await validateNip98(request);
    if (authError) {
        return authError;
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string | null; // 'image' or 'video'

        if (!file) {
            return jsonError(400, 'No file provided');
        }

        if (!type || (type !== 'image' && type !== 'video')) {
            return jsonError(400, 'Invalid file type specified');
        }

        // Validate file type
        const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
        if (!allowedTypes.includes(file.type)) {
            return jsonError(400, `Invalid ${type} file type. Allowed types: ${allowedTypes.join(', ')}`);
        }

        // Validate file size
        const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
        if (file.size > maxSize) {
            return jsonError(400, `File too large. Maximum size for ${type}s: ${maxSize / (1024 * 1024)}MB`);
        }

        // Generate unique filename
        const fileExtension = getFileExtension(file.type);
        const uniqueFilename = `${uuidv4()}.${fileExtension}`;

        // Ensure user_media directory exists
        // In production, files are served from build/client, in development from static
        const isProduction = process.env.NODE_ENV === 'production';
        const userMediaDir = join(process.cwd(), isProduction ? 'build/client' : 'static', 'user_media');
        try {
            await mkdir(userMediaDir, { recursive: true });
        } catch {
            // Directory might already exist, ignore error
        }

        // Save file
        const filePath = join(userMediaDir, uniqueFilename);
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));

        // Return the file URL - use the dynamic route instead of static file serving
        const fileUrl = `${baseUrl}/user_media/${uniqueFilename}`;

        return json(
            {
                success: true,
                url: fileUrl,
                filename: uniqueFilename,
                size: file.size,
                type: file.type
            },
            { headers: CORS_HEADERS }
        );
    } catch (err) {
        console.error('Upload error:', err);
        return jsonError(500, 'Failed to upload file');
    }
};

export const OPTIONS: RequestHandler = async () => {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
    });
};
