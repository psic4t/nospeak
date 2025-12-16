import { isAndroidNative } from '$lib/core/NativeDialogs';

type FilesystemDirectory = 'DOCUMENTS' | 'DATA' | 'CACHE' | 'EXTERNAL' | 'EXTERNAL_STORAGE';

interface FilesystemWriteFileOptions {
    path: string;
    data: string;
    directory?: FilesystemDirectory;
    recursive?: boolean;
}

interface FilesystemWriteFileResult {
    uri?: string;
    path?: string;
}

interface FilesystemDeleteFileOptions {
    path: string;
    directory?: FilesystemDirectory;
}

interface FilesystemReaddirEntry {
    name: string;
    type?: 'file' | 'directory';
}

interface FilesystemReaddirResult {
    files: FilesystemReaddirEntry[];
}

interface FilesystemLike {
    writeFile(options: FilesystemWriteFileOptions): Promise<FilesystemWriteFileResult>;
    deleteFile(options: FilesystemDeleteFileOptions): Promise<void>;
    readdir(options: { path: string; directory?: FilesystemDirectory }): Promise<FilesystemReaddirResult>;
    requestPermissions?(): Promise<unknown>;
}

function getFilesystem(): FilesystemLike {
    if (typeof window === 'undefined') {
        throw new Error('Capacitor Filesystem plugin is not available in this environment');
    }

    const fs = (window as any).Capacitor?.Plugins?.Filesystem;

    if (!fs) {
        throw new Error('Capacitor Filesystem plugin is not available');
    }

    return fs as FilesystemLike;
}

const DIRECTORY_CACHE: FilesystemDirectory = 'CACHE';
const DIRECTORY_DOCUMENTS: FilesystemDirectory = 'DOCUMENTS';

async function fetchBlob(url: string): Promise<Blob> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch media for sharing: ${response.status}`);
    }

    return await response.blob();
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
            const result = reader.result;

            if (typeof result !== 'string') {
                reject(new Error('Failed to convert blob to base64'));
                return;
            }

            const commaIndex = result.indexOf(',');

            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };

        reader.onerror = () => {
            reject(reader.error ?? new Error('FileReader error'));
        };

        reader.readAsDataURL(blob);
    });
}

export async function createAndroidShareFileFromUrl(url: string, filename: string): Promise<string> {
    if (!isAndroidNative()) {
        throw new Error('createAndroidShareFileFromUrl is only supported on Android');
    }

    const blob = await fetchBlob(url);
    const base64 = await blobToBase64(blob);

    const path = `nospeak-share/${filename}`;
    const filesystem = getFilesystem();

    const result = await filesystem.writeFile({
        path,
        data: base64,
        directory: DIRECTORY_CACHE,
        recursive: true
    });

    return result.uri ?? path;
}

export async function createAndroidDownloadFileFromUrl(url: string, filename: string): Promise<string> {
    if (!isAndroidNative()) {
        throw new Error('createAndroidDownloadFileFromUrl is only supported on Android');
    }

    const filesystem = getFilesystem();

    if (filesystem.requestPermissions) {
        try {
            await filesystem.requestPermissions();
        } catch {
            // Ignore permission errors here; writeFile will surface them if critical
        }
    }

    const blob = await fetchBlob(url);
    const base64 = await blobToBase64(blob);

    const path = `nospeak-downloads/${filename}`;

    const result = await filesystem.writeFile({
        path,
        data: base64,
        directory: DIRECTORY_DOCUMENTS,
        recursive: true
    });

    return result.uri ?? path;
}

export async function cleanupAndroidDecryptedShareFiles(): Promise<void> {
    if (!isAndroidNative()) {
        return;
    }

    try {
        const directory = 'nospeak-share';
        const filesystem = getFilesystem();
        const listing = await filesystem.readdir({
            path: directory,
            directory: DIRECTORY_CACHE
        });

        if (!listing.files || listing.files.length === 0) {
            return;
        }

        await Promise.all(
            listing.files.map(async (entry: { name: string }) => {
                try {
                    await filesystem.deleteFile({
                        path: `${directory}/${entry.name}`,
                        directory: DIRECTORY_CACHE
                    });
                } catch {
                    // Best-effort cleanup; ignore individual delete errors
                }
            })
        );
    } catch {
        // If the directory does not exist or cannot be read, ignore
    }
}
