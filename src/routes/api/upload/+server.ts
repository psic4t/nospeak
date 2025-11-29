import { error, json } from '@sveltejs/kit';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

// File type validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

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

export async function POST({ request }: { request: Request }) {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string; // 'image' or 'video'

        if (!file) {
            return error(400, 'No file provided');
        }

        if (!type || (type !== 'image' && type !== 'video')) {
            return error(400, 'Invalid file type specified');
        }

        // Validate file type
        const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
        if (!allowedTypes.includes(file.type)) {
            return error(400, `Invalid ${type} file type. Allowed types: ${allowedTypes.join(', ')}`);
        }

        // Validate file size
        const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
        if (file.size > maxSize) {
            return error(400, `File too large. Maximum size for ${type}s: ${maxSize / (1024 * 1024)}MB`);
        }

        // Generate unique filename
        const fileExtension = getFileExtension(file.type);
        const uniqueFilename = `${uuidv4()}.${fileExtension}`;

        // Ensure user_media directory exists
        // In production, static files are served from build/client
        const isProduction = process.env.NODE_ENV === 'production';
        const userMediaDir = join(isProduction ? 'build/client' : 'static', 'user_media');
        try {
            await mkdir(userMediaDir, { recursive: true });
        } catch (err) {
            // Directory might already exist, ignore error
        }

        // Save file
        const filePath = join(userMediaDir, uniqueFilename);
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));

        // Return the file URL
        const fileUrl = `${baseUrl}/user_media/${uniqueFilename}`;
        
        return json({
            success: true,
            url: fileUrl,
            filename: uniqueFilename,
            size: file.size,
            type: file.type
        });

    } catch (err) {
        console.error('Upload error:', err);
        return error(500, 'Failed to upload file');
    }
}