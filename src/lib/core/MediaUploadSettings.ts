export type UploadBackend = 'local' | 'blossom';

const SETTINGS_STORAGE_KEY = 'nospeak-settings';
const DEFAULT_UPLOAD_BACKEND: UploadBackend = 'local';

function readSettingsObject(): Record<string, unknown> {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function getStoredUploadBackend(): UploadBackend {
    const settings = readSettingsObject();
    const value = settings.uploadBackend;

    if (value === 'blossom' || value === 'local') {
        return value;
    }

    return DEFAULT_UPLOAD_BACKEND;
}

export function setStoredUploadBackend(backend: UploadBackend): void {
    if (typeof window === 'undefined') {
        return;
    }

    const settings = readSettingsObject();
    const next = {
        ...settings,
        uploadBackend: backend
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
}
