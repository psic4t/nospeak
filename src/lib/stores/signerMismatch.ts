import { writable } from 'svelte/store';

export interface SignerMismatchState {
    detected: boolean;
    expectedPubkey: string | null;  // hex format
    actualPubkey: string | null;    // hex format
}

export const signerMismatch = writable<SignerMismatchState | null>(null);

export function setSignerMismatch(expectedPubkey: string, actualPubkey: string): void {
    signerMismatch.set({
        detected: true,
        expectedPubkey,
        actualPubkey
    });
}

export function clearSignerMismatch(): void {
    signerMismatch.set(null);
}
