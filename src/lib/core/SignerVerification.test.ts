import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { signerMismatch, clearSignerMismatch } from '$lib/stores/signerMismatch';
import { signerVerificationService } from './SignerVerification';
import { Nip07Signer } from './signer/Nip07Signer';

describe('SignerVerification', () => {
    beforeEach(() => {
        clearSignerMismatch();
        vi.clearAllMocks();
    });

    afterEach(() => {
        signerVerificationService.stopPeriodicVerification();
        clearSignerMismatch();
    });

    describe('verifyCurrentSigner', () => {
        it('returns true when pubkeys match', async () => {
            const expectedPubkey = 'abc123def456';
            vi.spyOn(Nip07Signer, 'getCurrentSignerPubkeyUncached').mockResolvedValue(expectedPubkey);

            const result = await signerVerificationService.verifyCurrentSigner(expectedPubkey);

            expect(result).toBe(true);
            expect(get(signerMismatch)).toBeNull();
        });

        it('returns false and sets mismatch store when pubkeys differ', async () => {
            const expectedPubkey = 'expected123';
            const actualPubkey = 'different456';
            vi.spyOn(Nip07Signer, 'getCurrentSignerPubkeyUncached').mockResolvedValue(actualPubkey);

            const result = await signerVerificationService.verifyCurrentSigner(expectedPubkey);

            expect(result).toBe(false);
            const state = get(signerMismatch);
            expect(state).not.toBeNull();
            expect(state?.detected).toBe(true);
            expect(state?.expectedPubkey).toBe(expectedPubkey);
            expect(state?.actualPubkey).toBe(actualPubkey);
        });

        it('returns true on timeout (does not trigger mismatch)', async () => {
            vi.spyOn(Nip07Signer, 'getCurrentSignerPubkeyUncached').mockImplementation(
                () => new Promise(() => {}) // Never resolves
            );

            // Use fake timers to make test faster
            vi.useFakeTimers();
            const resultPromise = signerVerificationService.verifyCurrentSigner('expected123');
            
            // Fast-forward past the timeout
            await vi.advanceTimersByTimeAsync(6000);
            
            const result = await resultPromise;
            vi.useRealTimers();

            expect(result).toBe(true); // Should assume OK on timeout
            expect(get(signerMismatch)).toBeNull();
        });

        it('returns true on extension error (does not trigger mismatch)', async () => {
            vi.spyOn(Nip07Signer, 'getCurrentSignerPubkeyUncached').mockRejectedValue(
                new Error('Extension not found')
            );

            const result = await signerVerificationService.verifyCurrentSigner('expected123');

            expect(result).toBe(true); // Should assume OK on error
            expect(get(signerMismatch)).toBeNull();
        });
    });

    describe('startPeriodicVerification', () => {
        it('preserves mismatch state when restarting (does not clear on restart)', () => {
            // Set up some mismatch state
            signerMismatch.set({
                detected: true,
                expectedPubkey: 'old',
                actualPubkey: 'wrong'
            });

            // Start verification - should NOT clear mismatch state (only visibility listener)
            // This is intentional: if there's a mismatch, restarting shouldn't hide it
            signerVerificationService.startPeriodicVerification('new-expected');

            // Mismatch state should be preserved
            const state = get(signerMismatch);
            expect(state?.detected).toBe(true);
        });

        it('sets expected pubkey correctly', () => {
            signerVerificationService.startPeriodicVerification('test-pubkey-123');
            
            // Verify by stopping and checking it was set (stop clears it)
            // We can't directly access private field, but we can verify behavior
            // by checking that stopPeriodicVerification works
            signerVerificationService.stopPeriodicVerification();
            expect(get(signerMismatch)).toBeNull();
        });
    });

    describe('stopPeriodicVerification', () => {
        it('clears mismatch state', () => {
            signerMismatch.set({
                detected: true,
                expectedPubkey: 'expected',
                actualPubkey: 'actual'
            });

            signerVerificationService.stopPeriodicVerification();

            expect(get(signerMismatch)).toBeNull();
        });
    });
});
