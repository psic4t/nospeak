export function isAndroidCapacitorShell(): boolean {
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

/**
 * Returns the appropriate backdrop-blur class based on platform.
 * On Android, backdrop-blur is disabled for scroll performance.
 * @param level - Blur intensity: 'sm', 'md', or 'xl'
 * @returns Tailwind backdrop-blur class or empty string on Android
 */
export function blur(level: 'sm' | 'md' | 'xl' = 'sm'): string {
    if (isAndroidCapacitorShell()) {
        return '';
    }
    return `backdrop-blur-${level}`;
}

/**
 * Checks if the current platform supports CSS View Transitions API.
 * Only returns true on Android Capacitor with WebView 114+ (Android 14+ or updated WebView).
 */
export function supportsViewTransitions(): boolean {
    return isAndroidCapacitorShell() &&
           typeof document !== 'undefined' &&
           'startViewTransition' in document;
}
