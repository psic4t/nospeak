import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AndroidNip55SignerPlugin {
    isAvailable(): Promise<{ available: boolean; hasKnownPackage: boolean }>;
    getPublicKey(): Promise<{ pubkeyHex: string; packageName: string }>;
    signEvent(args: { eventJson: string; currentUserPubkeyHex: string }): Promise<{ signedEventJson: string }>;
    nip44Encrypt(args: { plaintext: string; recipientPubkeyHex: string; currentUserPubkeyHex: string }): Promise<{ ciphertext: string }>;
    nip44Decrypt(args: { ciphertext: string; senderPubkeyHex: string; currentUserPubkeyHex: string }): Promise<{ plaintext: string }>;
}

export const AndroidNip55Signer = Capacitor.getPlatform() === 'android'
    ? registerPlugin<AndroidNip55SignerPlugin>('AndroidNip55Signer')
    : (null as unknown as AndroidNip55SignerPlugin);
