/**
 * Centralized name-resolution helpers for Nostr user metadata.
 *
 * Metadata comes from kind-0 events and may use either `display_name`
 * (snake_case, per NIP-01) or `displayName` (camelCase, used by some clients).
 * All functions treat empty / whitespace-only strings as missing.
 */

/** Return `npub1abc…` style short label, or null when input is absent. */
function shortNpub(npub?: string): string | null {
    if (!npub || !npub.trim()) return null;
    return npub.slice(0, 12) + '...';
}

/** Trim a value and return it only when non-empty. */
function trimOrNull(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Best-effort human-readable display name.
 *
 * Priority: display_name → name → displayName → shortNpub → 'Unknown'
 */
export function resolveDisplayName(metadata: any, fallbackNpub?: string): string {
    if (metadata) {
        const displayName = trimOrNull(metadata.display_name);
        if (displayName) return displayName;

        const name = trimOrNull(metadata.name);
        if (name) return name;

        const camelDisplayName = trimOrNull(metadata.displayName);
        if (camelDisplayName) return camelDisplayName;
    }

    return shortNpub(fallbackNpub) ?? 'Unknown';
}

/**
 * Resolve a username (typically the `name` field).
 *
 * Priority: name → shortNpub → 'Unknown'
 */
export function resolveUsername(metadata: any, fallbackNpub?: string): string {
    if (metadata) {
        const name = trimOrNull(metadata.name);
        if (name) return name;
    }

    return shortNpub(fallbackNpub) ?? 'Unknown';
}

/**
 * Build a mention label that may combine display name and username.
 *
 * - Both present:  `Display Name (@username)`
 * - Only name:     `@username`
 * - Only display:  `Display Name`
 * - Neither:       shortNpub or 'Unknown'
 */
export function resolveMentionLabel(metadata: any, fallbackNpub?: string): string {
    if (metadata) {
        const displayName = trimOrNull(metadata.display_name) ?? trimOrNull(metadata.displayName);
        const name = trimOrNull(metadata.name);

        if (displayName && name) return `${displayName} (@${name})`;
        if (name) return `@${name}`;
        if (displayName) return displayName;
    }

    return shortNpub(fallbackNpub) ?? 'Unknown';
}
