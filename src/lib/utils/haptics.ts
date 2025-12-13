import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

export function softVibrate(): void {
    if (!isAndroidCapacitorShell()) {
        return;
    }

    try {
        const result = Haptics.impact({
            style: ImpactStyle.Light
        });

        if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(() => {
                // Swallow plugin errors to keep haptics non-blocking
            });
        }
    } catch {
        // Ignore synchronous errors from the haptics plugin
    }
}
