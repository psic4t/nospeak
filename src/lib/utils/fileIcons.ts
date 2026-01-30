/**
 * File icon utilities for generic file upload display.
 * Provides extension-specific icons, colors, and labels for common file types.
 */

export interface FileIconInfo {
    /** SVG markup string (24x24 viewBox, stroke-based) */
    svg: string;
    /** Tailwind color class for icon background/accent */
    color: string;
    /** Short label for the file type (e.g., "PDF", "ZIP") */
    label: string;
}

// Base document icon (used for most file types with variations)
const documentBase = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`;

// SVG icons for different file types
const icons = {
    // PDF - document with corner fold
    pdf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${documentBase}<text x="12" y="16" text-anchor="middle" font-size="6" font-weight="bold" fill="currentColor" stroke="none">PDF</text></svg>`,

    // Archive - box with zipper
    archive: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/><path d="M10 15h4"/><path d="M10 18h4"/></svg>`,

    // Word document - document with lines
    word: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${documentBase}<line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,

    // Excel - grid/table
    excel: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,

    // PowerPoint - presentation slides
    powerpoint: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,

    // Text file - plain document
    text: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${documentBase}<line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>`,

    // Code - brackets
    code: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,

    // Generic file - plain document
    generic: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${documentBase}</svg>`,
};

// Color mappings (Tailwind classes)
const colors = {
    pdf: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    archive: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    word: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    excel: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    powerpoint: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    text: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400',
    code: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    generic: 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400',
};

/**
 * MIME type to file category mapping
 */
function getFileCategory(mimeType: string): keyof typeof icons {
    const mime = mimeType.toLowerCase();

    // PDF
    if (mime === 'application/pdf') {
        return 'pdf';
    }

    // Archives
    if (
        mime === 'application/zip' ||
        mime === 'application/x-zip-compressed' ||
        mime === 'application/x-rar-compressed' ||
        mime === 'application/vnd.rar' ||
        mime === 'application/x-7z-compressed' ||
        mime === 'application/gzip' ||
        mime === 'application/x-tar'
    ) {
        return 'archive';
    }

    // Word documents
    if (
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/vnd.oasis.opendocument.text'
    ) {
        return 'word';
    }

    // Excel spreadsheets
    if (
        mime === 'application/vnd.ms-excel' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.oasis.opendocument.spreadsheet'
    ) {
        return 'excel';
    }

    // PowerPoint presentations
    if (
        mime === 'application/vnd.ms-powerpoint' ||
        mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mime === 'application/vnd.oasis.opendocument.presentation'
    ) {
        return 'powerpoint';
    }

    // Plain text
    if (mime === 'text/plain') {
        return 'text';
    }

    // Code files
    if (
        mime === 'text/html' ||
        mime === 'text/css' ||
        mime === 'text/javascript' ||
        mime === 'application/javascript' ||
        mime === 'application/json' ||
        mime === 'application/xml' ||
        mime === 'text/xml' ||
        mime === 'application/x-yaml' ||
        mime === 'text/yaml' ||
        mime === 'text/markdown'
    ) {
        return 'code';
    }

    return 'generic';
}

/**
 * Get file icon info for a given MIME type
 */
export function getFileIconInfo(mimeType: string): FileIconInfo {
    const category = getFileCategory(mimeType);

    const labelMap: Record<keyof typeof icons, string> = {
        pdf: 'PDF',
        archive: 'ZIP',
        word: 'DOC',
        excel: 'XLS',
        powerpoint: 'PPT',
        text: 'TXT',
        code: 'CODE',
        generic: 'FILE',
    };

    return {
        svg: icons[category],
        color: colors[category],
        label: labelMap[category],
    };
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(mimeType: string): string {
    const mime = mimeType.toLowerCase();

    const mimeToExt: Record<string, string> = {
        'application/pdf': '.pdf',
        'application/zip': '.zip',
        'application/x-zip-compressed': '.zip',
        'application/x-rar-compressed': '.rar',
        'application/vnd.rar': '.rar',
        'application/x-7z-compressed': '.7z',
        'application/gzip': '.gz',
        'application/x-tar': '.tar',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.oasis.opendocument.text': '.odt',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/vnd.oasis.opendocument.spreadsheet': '.ods',
        'application/vnd.ms-powerpoint': '.ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
        'application/vnd.oasis.opendocument.presentation': '.odp',
        'text/plain': '.txt',
        'text/html': '.html',
        'text/css': '.css',
        'text/javascript': '.js',
        'application/javascript': '.js',
        'application/json': '.json',
        'application/xml': '.xml',
        'text/xml': '.xml',
        'application/x-yaml': '.yaml',
        'text/yaml': '.yaml',
        'text/markdown': '.md',
    };

    return mimeToExt[mime] || '';
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);

    // Use 1 decimal place for KB and above, no decimals for bytes
    if (i === 0) {
        return `${size} ${units[i]}`;
    }

    return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * Detect if a file is a media type (image/video/audio) based on MIME and extension.
 * Returns the detected media type or 'file' for generic files.
 */
export function detectMediaType(file: File): 'image' | 'video' | 'audio' | 'file' {
    const mime = file.type.toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    // Check MIME type first
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';

    // Fallback to extension for files with missing/generic MIME
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';

    return 'file';
}

/** Maximum file size for generic file uploads (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate file size against the maximum allowed
 */
export function validateFileSize(file: File): boolean {
    return file.size <= MAX_FILE_SIZE;
}
