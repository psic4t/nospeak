import { buildBlossomUploadAuthHeader } from './BlossomAuth';
import { normalizeBlossomServerUrl } from './BlossomServers';

export interface BlossomBlobDescriptor {
    url: string;
    sha256: string;
    size: number;
    type: string;
    uploaded: number;
}

function getSubtle(): SubtleCrypto {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        return window.crypto.subtle;
    }
    throw new Error('WebCrypto SubtleCrypto is not available in this environment');
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function sha256HexFromBlob(blob: Blob): Promise<string> {
    const subtle = getSubtle();
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await subtle.digest('SHA-256', buffer);
    return toHex(new Uint8Array(hashBuffer));
}

async function putUpload(params: {
    server: string;
    body: Blob;
    mimeType: string;
    sha256: string;
    onProgress?: (percent: number) => void;
}): Promise<BlossomBlobDescriptor> {
    const authHeader = await buildBlossomUploadAuthHeader({
        sha256: params.sha256,
        content: 'Upload blob'
    });

    if (!authHeader) {
        throw new Error('You must be logged in to upload media');
    }

    return await new Promise<BlossomBlobDescriptor>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (!params.onProgress) return;
            if (e.lengthComputable) {
                params.onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        const uploadTimeout = setTimeout(() => {
            xhr.abort();
            reject(new Error('Upload timeout - please try again'));
        }, 30000);

        xhr.onload = () => {
            clearTimeout(uploadTimeout);

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const descriptor = JSON.parse(xhr.responseText) as BlossomBlobDescriptor;
                    if (!descriptor?.url) {
                        reject(new Error('Invalid response from Blossom server'));
                        return;
                    }
                    resolve(descriptor);
                } catch {
                    reject(new Error('Invalid response from Blossom server'));
                }
                return;
            }

            const reason = xhr.getResponseHeader('X-Reason');
            if (reason) {
                reject(new Error(reason));
                return;
            }

            reject(new Error(`Upload failed with status ${xhr.status}`));
        };

        xhr.onerror = () => {
            clearTimeout(uploadTimeout);
            reject(new Error('Network error during upload'));
        };

        xhr.onabort = () => {
            clearTimeout(uploadTimeout);
            reject(new Error('Upload was cancelled'));
        };

        xhr.open('PUT', `${params.server}/upload`);
        xhr.setRequestHeader('Authorization', authHeader);
        xhr.setRequestHeader('Content-Type', params.mimeType);
        xhr.send(params.body);
    });
}

export async function uploadToBlossomServers(params: {
    servers: string[];
    body: Blob;
    mimeType: string;
    sha256?: string;
    onProgress?: (percent: number) => void;
}): Promise<{ url: string; primaryServer: string; descriptor: BlossomBlobDescriptor }> {
    const normalizedServers = params.servers
        .map((s) => normalizeBlossomServerUrl(s))
        .filter((s): s is string => Boolean(s));

    if (normalizedServers.length === 0) {
        throw new Error('No Blossom servers configured');
    }

    const sha256 = params.sha256 ?? await sha256HexFromBlob(params.body);

    let primary: { server: string; descriptor: BlossomBlobDescriptor } | null = null;
    let lastError: Error | null = null;

    for (const server of normalizedServers) {
        try {
            const descriptor = await putUpload({
                server,
                body: params.body,
                mimeType: params.mimeType,
                sha256,
                onProgress: params.onProgress
            });

            primary = { server, descriptor };
            break;
        } catch (e) {
            lastError = e as Error;
        }
    }

    if (!primary) {
        throw lastError ?? new Error('Upload failed');
    }

    // Best-effort mirroring to remaining servers.
    void mirrorToRemainingServers({
        servers: normalizedServers,
        primaryServer: primary.server,
        body: params.body,
        mimeType: params.mimeType,
        sha256
    });

    return {
        url: primary.descriptor.url,
        primaryServer: primary.server,
        descriptor: primary.descriptor
    };
}

async function mirrorToRemainingServers(params: {
    servers: string[];
    primaryServer: string;
    body: Blob;
    mimeType: string;
    sha256: string;
}): Promise<void> {
    const targets = params.servers.filter((s) => s !== params.primaryServer);

    await Promise.allSettled(
        targets.map(async (server) => {
            try {
                await putUpload({
                    server,
                    body: params.body,
                    mimeType: params.mimeType,
                    sha256: params.sha256
                });
            } catch (e) {
                console.warn('Blossom mirror upload failed', { server, error: e });
            }
        })
    );
}
