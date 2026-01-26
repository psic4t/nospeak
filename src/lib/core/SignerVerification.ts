import { Nip07Signer } from './signer/Nip07Signer';
import { setSignerMismatch, clearSignerMismatch } from '$lib/stores/signerMismatch';

const VERIFICATION_TIMEOUT_MS = 5_000; // 5 seconds timeout for extension response

class SignerVerificationService {
    private expectedPubkeyHex: string | null = null;
    private visibilityHandler: (() => void) | null = null;
    private isVerifying = false;

    /**
     * Clear visibility listener without clearing state.
     * Used internally when restarting verification.
     */
    private clearVisibilityListener(): void {
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
    }

    /**
     * Verify that the current NIP-07 signer's active account matches the expected pubkey.
     * Returns true if they match, false if mismatch detected.
     * Updates the signerMismatch store on mismatch.
     */
    async verifyCurrentSigner(expectedPubkeyHex: string): Promise<boolean> {
        if (this.isVerifying) {
            console.log('[SignerVerification] Already verifying, skipping');
            return true; // Assume OK if already checking
        }

        this.isVerifying = true;

        try {
            // Create a timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Signer verification timed out'));
                }, VERIFICATION_TIMEOUT_MS);
            });

            // Race between getting pubkey and timeout
            const actualPubkeyHex = await Promise.race([
                Nip07Signer.getCurrentSignerPubkeyUncached(),
                timeoutPromise
            ]);

            if (actualPubkeyHex !== expectedPubkeyHex) {
                console.warn('[SignerVerification] Account mismatch detected!', {
                    expected: expectedPubkeyHex.substring(0, 16) + '...',
                    actual: actualPubkeyHex.substring(0, 16) + '...'
                });
                setSignerMismatch(expectedPubkeyHex, actualPubkeyHex);
                return false;
            }

            console.log('[SignerVerification] Account verified OK');
            return true;

        } catch (error) {
            // On timeout or extension error, log but don't trigger mismatch
            // This prevents false positives when extension is slow/unavailable
            console.warn('[SignerVerification] Verification check failed (not treating as mismatch):', error);
            return true; // Assume OK on error to avoid false positive blocking
        } finally {
            this.isVerifying = false;
        }
    }

    /**
     * Start verification of the NIP-07 signer account.
     * Checks on visibility change (tab focus) when user returns to the app.
     * 
     * Note: Most NIP-07 extensions cache getPublicKey() responses, so mid-session
     * account switches may not be detected until page reload. The primary detection
     * happens during session restore on page load.
     */
    startPeriodicVerification(expectedPubkeyHex: string): void {
        // Clear any existing listener first (but not state)
        this.clearVisibilityListener();

        // Then set the expected pubkey
        this.expectedPubkeyHex = expectedPubkeyHex;

        console.log('[SignerVerification] Starting visibility-based verification');

        // Set up visibility change listener (fires when user returns to tab)
        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible' && this.expectedPubkeyHex) {
                console.log('[SignerVerification] Tab became visible, verifying...');
                this.verifyCurrentSigner(this.expectedPubkeyHex).catch(console.error);
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    /**
     * Stop verification and clean up listeners.
     */
    stopPeriodicVerification(): void {
        console.log('[SignerVerification] Stopping verification');

        this.clearVisibilityListener();
        this.expectedPubkeyHex = null;
        clearSignerMismatch();
    }
}

export const signerVerificationService = new SignerVerificationService();
