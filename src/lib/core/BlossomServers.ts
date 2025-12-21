export function normalizeBlossomServerUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(withScheme);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return null;
        }

        // Blossom endpoints are defined at the domain root; normalize to origin.
        // Keep any explicit port, drop path/query/hash, and remove trailing slash.
        return url.origin;
    } catch {
        return null;
    }
}

export function parseBlossomServerListEvent(event: { tags: string[][] }): string[] {
    const servers: string[] = [];
    const seen = new Set<string>();

    for (const tag of event.tags) {
        if (tag.length < 2 || tag[0] !== 'server') continue;

        const normalized = normalizeBlossomServerUrl(tag[1]);
        if (!normalized || seen.has(normalized)) continue;

        seen.add(normalized);
        servers.push(normalized);
    }

    return servers;
}
