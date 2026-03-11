import { nip19 } from 'nostr-tools';

export type Nip05Status = 'valid' | 'invalid' | 'unknown';

export interface Nip05VerificationResult {
    status: Nip05Status;
    nip05: string;
    checkedAt: number;
    matchedPubkey?: string;
    error?: string;
}

interface CachedVerification {
    result: Nip05VerificationResult;
    cachedAt: number;
}

const MEMORY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const memoryCache = new Map<string, CachedVerification>();

function buildCacheKey(nip05: string, pubkeyHex: string): string {
    return `${nip05.toLowerCase()}|${pubkeyHex.toLowerCase()}`;
}

export async function verifyNip05(nip05: string, pubkeyHex: string): Promise<Nip05VerificationResult> {
    const trimmed = (nip05 || '').trim();
    const now = Date.now();

    if (!trimmed) {
        return { status: 'invalid', nip05: '', checkedAt: now, error: 'empty-nip05' };
    }

    if (typeof window === 'undefined') {
        return { status: 'unknown', nip05: trimmed, checkedAt: now, error: 'no-window' };
    }

    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0 || atIndex === trimmed.length - 1) {
        return { status: 'invalid', nip05: trimmed, checkedAt: now, error: 'invalid-format' };
    }

    const localPart = trimmed.slice(0, atIndex).toLowerCase();
    const domain = trimmed.slice(atIndex + 1);

    const cacheKey = buildCacheKey(trimmed, pubkeyHex);
    const cached = memoryCache.get(cacheKey);
    if (cached && now - cached.cachedAt < MEMORY_CACHE_TTL_MS) {
        return cached.result;
    }

    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`;

    let status: Nip05Status = 'unknown';
    let matchedPubkey: string | undefined;
    let error: string | undefined;

    try {
        const resp = await fetch(url);

        if (!resp.ok) {
            error = `http-${resp.status}`;
        } else {
            const json = await resp.json();
            const names = (json as any).names;

            if (!names || typeof names !== 'object') {
                status = 'invalid';
                error = 'missing-names';
            } else {
                const mapped = (names as Record<string, string>)[localPart];
                if (!mapped) {
                    status = 'invalid';
                    error = 'name-not-found';
                } else {
                    matchedPubkey = mapped;
                    if (mapped.toLowerCase() === pubkeyHex.toLowerCase()) {
                        status = 'valid';
                    } else {
                        status = 'invalid';
                        error = 'pubkey-mismatch';
                    }
                }
            }
        }
    } catch (e: any) {
        status = 'unknown';
        error = e?.message || 'network-error';
    }

    const result: Nip05VerificationResult = {
        status,
        nip05: trimmed,
        checkedAt: now,
        matchedPubkey,
        error
    };

    memoryCache.set(cacheKey, { result, cachedAt: now });

    return result;
}

export async function resolveNip05ToNpub(nip05: string): Promise<string | null> {
    const trimmed = (nip05 || '').trim();

    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0 || atIndex === trimmed.length - 1) {
        throw new Error('invalid-format');
    }

    const localPart = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);

    if (!localPart || !domain) {
        throw new Error('invalid-format');
    }

    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`;

    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(`http-${resp.status}`);
    }

    let json: any;
    try {
        json = await resp.json();
    } catch {
        return null;
    }
    const names = (json as any).names;

    if (!names || typeof names !== 'object') {
        throw new Error('invalid-response');
    }

    const mapped = (names as Record<string, string>)[localPart.toLowerCase()];
    if (!mapped) {
        throw new Error('not-found');
    }

    return mapped;
}

export async function verifyNip05ForNpub(nip05: string, npub: string): Promise<Nip05VerificationResult> {
    const now = Date.now();

    try {
        const decoded = nip19.decode(npub);
        if (decoded.type !== 'npub') {
            return { status: 'unknown', nip05, checkedAt: now, error: 'unsupported-type' };
        }

        const data = decoded.data as any;
        const pubkeyHex = typeof data === 'string' ? data : data.pubkey;

        if (!pubkeyHex || typeof pubkeyHex !== 'string') {
            return { status: 'unknown', nip05, checkedAt: now, error: 'invalid-npub-data' };
        }

        return await verifyNip05(nip05, pubkeyHex);
    } catch (e: any) {
        return {
            status: 'unknown',
            nip05,
            checkedAt: now,
            error: e?.message || 'decode-error'
        };
    }
}
