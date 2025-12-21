import { normalizeBlossomServerUrl } from './BlossomServers';

export interface ExtractedBlossomHash {
    sha256: string;
    extension: string;
}

const SHA256_REGEX = /([0-9a-f]{64})(\.[^/?#]+)?/gi;

export function extractBlossomSha256FromUrl(url: string): ExtractedBlossomHash | null {
    const matches = Array.from(url.matchAll(SHA256_REGEX));
    if (matches.length === 0) {
        return null;
    }

    const last = matches[matches.length - 1];
    const sha256 = (last[1] ?? '').toLowerCase();
    const extension = last[2] ?? '';

    if (!sha256) {
        return null;
    }

    return { sha256, extension };
}

export function buildBlossomCandidateUrls(params: {
    servers: string[];
    sha256: string;
    extension?: string;
}): string[] {
    const extension = params.extension ?? '';

    const urls: string[] = [];
    const seen = new Set<string>();

    for (const server of params.servers) {
        const normalized = normalizeBlossomServerUrl(server);
        if (!normalized) continue;

        const candidate = `${normalized}/${params.sha256}${extension}`;
        if (seen.has(candidate)) continue;

        seen.add(candidate);
        urls.push(candidate);
    }

    return urls;
}
