export interface EncryptedFileResult {
    ciphertext: Uint8Array;
    key: string; // hex-encoded AES-GCM key (256-bit)
    nonce: string; // hex-encoded AES-GCM nonce (16-byte)
    size: number; // ciphertext byte length
    hashEncrypted: string; // hex-encoded SHA-256 of ciphertext
    hashPlain?: string; // optional hex-encoded SHA-256 of original file bytes
}

function getSubtle(): SubtleCrypto {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        return window.crypto.subtle;
    }
    throw new Error('WebCrypto SubtleCrypto is not available in this environment');
}

function fromBase64Url(input: string): Uint8Array {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const binary = atob(b64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
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

async function sha256Hex(data: Uint8Array): Promise<string> {
    const subtle = getSubtle();
    const hashBuffer = await subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    return toHex(new Uint8Array(hashBuffer as ArrayBuffer));
}

export async function encryptFileWithAesGcm(file: File): Promise<EncryptedFileResult> {
    const subtle = getSubtle();

    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    const key = await subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    const rawKeyBuffer = await subtle.exportKey('raw', key) as ArrayBuffer;
    const rawKey = new Uint8Array(rawKeyBuffer);
    const nonceBytes = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(nonceBytes);
    } else if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
        (crypto as any).getRandomValues(nonceBytes);
    } else {
        throw new Error('No secure random source available for AES-GCM nonce');
    }

    const encryptedBuffer = await subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: nonceBytes
        },
        key,
        fileBuffer.buffer as ArrayBuffer
    );
    const ciphertextBuffer = new Uint8Array(encryptedBuffer as ArrayBuffer);

    const hashEncrypted = await sha256Hex(ciphertextBuffer);
    const hashPlain = await sha256Hex(fileBuffer);

    return {
        ciphertext: ciphertextBuffer,
        key: toHex(rawKey),
        nonce: toHex(nonceBytes),
        size: ciphertextBuffer.byteLength,
        hashEncrypted,
        hashPlain
    };
}

export async function decryptAesGcmToBytes(
    ciphertext: Uint8Array,
    keyEncoded: string,
    nonceEncoded: string
): Promise<Uint8Array> {
    const subtle = getSubtle();

    const keyBytes = decodeKeyOrNonce(keyEncoded);
    const nonceBytes = decodeKeyOrNonce(nonceEncoded);

    // Validate key size (AES-128 = 16 bytes, AES-256 = 32 bytes)
    if (keyBytes.length !== 16 && keyBytes.length !== 32) {
        throw new Error(`Invalid AES key size: expected 16 or 32 bytes, got ${keyBytes.length} bytes`);
    }

    const key = await subtle.importKey(
        'raw',
        keyBytes.buffer as ArrayBuffer,
        { name: 'AES-GCM', length: keyBytes.length * 8 },
        false,
        ['decrypt']
    );

    const decryptedBuffer = await subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: nonceBytes as any
        },
        key,
        ciphertext as any
    );

    return new Uint8Array(decryptedBuffer as ArrayBuffer);
}
