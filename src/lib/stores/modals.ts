import { writable } from 'svelte/store';
 
 export const showSettingsModal = writable(false);
 export const showManageContactsModal = writable(false);
 export const showEmptyProfileModal = writable(false);
 export const showUserQrModal = writable(false);
 export const showScanContactQrModal = writable(false);
 export const showCreateGroupModal = writable(false);
 export const profileModalState = writable<{ isOpen: boolean; npub: string | null }>({
     isOpen: false,
     npub: null
 });


 
 export const scanContactQrResultState = writable<{ isOpen: boolean; npub: string | null }>({
     isOpen: false,
     npub: null
 });
 
 export function openProfileModal(npub: string) {
     profileModalState.set({ isOpen: true, npub });
 }
 
 export function closeProfileModal() {
     profileModalState.set({ isOpen: false, npub: null });
 }
 
 export function openScanContactQrResult(npub: string) {
     scanContactQrResultState.set({ isOpen: true, npub });
 }
 
export function closeScanContactQrResult() {
    scanContactQrResultState.set({ isOpen: false, npub: null });
}

export type PinSetupMode = 'set' | 'verify' | 'change';

export const pinSetupModalState = writable<{ isOpen: boolean; mode: PinSetupMode; onSuccess: ((pin: string) => void) | null }>({
    isOpen: false,
    mode: 'set',
    onSuccess: null
});

export function openPinSetupModal(mode: PinSetupMode, onSuccess: (pin: string) => void) {
    pinSetupModalState.set({ isOpen: true, mode, onSuccess });
}

export function closePinSetupModal() {
    pinSetupModalState.set({ isOpen: false, mode: 'set', onSuccess: null });
}


