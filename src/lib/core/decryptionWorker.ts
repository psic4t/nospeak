/**
 * Web Worker that performs media fetch + AES-GCM decryption off the main thread.
 *
 * Receives:  { id, url, key, nonce, mimeType }
 * Returns:   { id, blobUrl }   on success
 *            { id, error }     on failure
 *
 * Abort:     { id, type: 'abort' }  — cancels an in-flight request
 *
 * All large buffer allocations (fetch arrayBuffer, decrypt output, Blob)
 * happen in the worker's own heap, never on the main thread. Only the
 * tiny blob-URL string crosses the boundary.
 */

// ── Hex / Base64URL helpers (duplicated from FileEncryption.ts to keep worker self-contained) ──

function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function fromBase64Url(input: string): Uint8Array {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const binary = atob(b64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function isHex(str: string): boolean {
    return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

function decodeKeyOrNonce(input: string): Uint8Array {
    if (isHex(input)) {
        return fromHex(input);
    }
    return fromBase64Url(input);
}

// ── In-flight request tracking ──

const inflightAbortControllers = new Map<string, AbortController>();

// ── Message handler ──

self.onmessage = async (e: MessageEvent) => {
    const data = e.data;

    // Handle abort requests
    if (data.type === 'abort') {
        const controller = inflightAbortControllers.get(data.id);
        if (controller) {
            controller.abort();
            inflightAbortControllers.delete(data.id);
        }
        return;
    }

    const { id, url, key, nonce, mimeType } = data as {
        id: string;
        url: string;
        key: string;
        nonce: string;
        mimeType: string;
    };

    const abortController = new AbortController();
    inflightAbortControllers.set(id, abortController);

    try {
        // 1. Fetch ciphertext
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) {
            throw new Error(`Download failed with status ${response.status}`);
        }
        const ciphertextBuffer = await response.arrayBuffer();

        // Abort check after expensive fetch
        if (abortController.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        // 2. Decode key and nonce
        const keyBytes = decodeKeyOrNonce(key);
        const nonceBytes = decodeKeyOrNonce(nonce);

        if (keyBytes.length !== 16 && keyBytes.length !== 32) {
            throw new Error(`Invalid AES key size: expected 16 or 32 bytes, got ${keyBytes.length} bytes`);
        }

        // 3. Import key and decrypt
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes.buffer as ArrayBuffer,
            { name: 'AES-GCM', length: keyBytes.length * 8 },
            false,
            ['decrypt']
        );

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonceBytes as any },
            cryptoKey,
            ciphertextBuffer
        );

        // 4. Create Blob + object URL entirely in the worker
        const blob = new Blob([decryptedBuffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        self.postMessage({ id, blobUrl });
    } catch (err) {
        const error = err as Error;
        self.postMessage({
            id,
            error: error.name === 'AbortError' ? 'AbortError' : error.message,
        });
    } finally {
        inflightAbortControllers.delete(id);
    }
};
