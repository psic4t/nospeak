import { writable, get } from 'svelte/store';

const PIN_HASH_KEY = 'nospeak:pin_hash';
const SETTINGS_KEY = 'nospeak-settings';

/** Whether the PIN lock screen is currently showing */
export const isPinLocked = writable(false);

/** Whether PIN protection is enabled (derived from settings on load) */
export const isPinEnabled = writable(false);

/**
 * Hash a 4-digit PIN using SHA-256.
 * Returns lowercase hex string.
 */
export async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against the stored hash.
 * Returns true if the PIN matches.
 */
export async function verifyPin(pin: string): Promise<boolean> {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash) {
        return false;
    }
    const inputHash = await hashPin(pin);
    return inputHash === storedHash;
}

/**
 * Enable PIN protection by hashing and storing the PIN.
 * Also sets pinEnabled=true in nospeak-settings.
 */
export async function enablePin(pin: string): Promise<void> {
    const hash = await hashPin(pin);
    localStorage.setItem(PIN_HASH_KEY, hash);

    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    settings.pinEnabled = true;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    isPinEnabled.set(true);
}

/**
 * Disable PIN protection. Removes hash and sets pinEnabled=false.
 */
export function disablePin(): void {
    localStorage.removeItem(PIN_HASH_KEY);

    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    settings.pinEnabled = false;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    isPinEnabled.set(false);
    isPinLocked.set(false);
}

/**
 * Attempt to unlock with a PIN.
 * Returns true if successful.
 */
export async function unlockWithPin(pin: string): Promise<boolean> {
    const valid = await verifyPin(pin);
    if (valid) {
        isPinLocked.set(false);
    }
    return valid;
}

/**
 * Lock the app (if PIN is enabled).
 */
export function lockApp(): void {
    if (get(isPinEnabled)) {
        isPinLocked.set(true);
    }
}

/**
 * Initialize PIN state from localStorage.
 * Should be called once on app startup (after auth restore).
 * Returns true if the app should be locked.
 */
export function initPinState(): boolean {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (settings.pinEnabled === true) {
                const hasHash = !!localStorage.getItem(PIN_HASH_KEY);
                if (hasHash) {
                    isPinEnabled.set(true);
                    isPinLocked.set(true);
                    return true;
                }
            }
        } catch {
            // Corrupted settings, ignore
        }
    }

    isPinEnabled.set(false);
    isPinLocked.set(false);
    return false;
}

/**
 * Clear all PIN data. Called on logout.
 */
export function clearPinData(): void {
    localStorage.removeItem(PIN_HASH_KEY);
    isPinEnabled.set(false);
    isPinLocked.set(false);
}
