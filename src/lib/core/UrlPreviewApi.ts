const DEFAULT_SERVER_BASE_URL = 'https://nospeak.chat';

function getServerBaseUrl(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const envBase = import.meta.env.PUBLIC_WEB_APP_BASE_URL as string | undefined;
    const trimmedEnvBase = envBase ? envBase.trim() : '';

    if (trimmedEnvBase) {
        return trimmedEnvBase.replace(/\/$/, '');
    }

    return DEFAULT_SERVER_BASE_URL;
}

function isAndroidCapacitorShell(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };

    if (w.Capacitor && typeof w.Capacitor.getPlatform === 'function') {
        try {
            return w.Capacitor.getPlatform() === 'android';
        } catch {
            return false;
        }
    }

    return false;
}

export function getUrlPreviewApiUrl(targetUrl: string): string {
    const encodedTarget = encodeURIComponent(targetUrl);

    // Server-side or standard web browser: use same-origin relative path
    if (!isAndroidCapacitorShell()) {
        return `/api/url-preview?url=${encodedTarget}`;
    }

    // Android Capacitor shell: call remote preview API on nospeak.chat (or configured base)
    const base = getServerBaseUrl();

    if (!base) {
        // Fallback to relative path; preview may fail but messaging still works
        return `/api/url-preview?url=${encodedTarget}`;
    }

    return `${base}/api/url-preview?url=${encodedTarget}`;
}
