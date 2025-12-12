import { App } from '@capacitor/app';
import type { BackButtonListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { imageViewerState, closeImageViewer } from '$lib/stores/imageViewer';
import {
    showSettingsModal,
    showManageContactsModal,
    showEmptyProfileModal,
    showUserQrModal,
    profileModalState,
    closeProfileModal
} from '$lib/stores/modals';
import { showRelayStatusModal } from '$lib/stores/connection';

let backHandlerInitialized = false;

function isAndroidNativeShell(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return Capacitor.getPlatform() === 'android';
    } catch {
        return false;
    }
}

export function initAndroidBackNavigation(): void {
    if (backHandlerInitialized) {
        return;
    }

    if (!isAndroidNativeShell()) {
        return;
    }

    backHandlerInitialized = true;

    void App.addListener('backButton', async (event: BackButtonListenerEvent) => {
        console.debug('[AndroidBackHandler] backButton event', event);

        // 1. Full-screen overlays (image viewer)
        const viewerState = get(imageViewerState);
        if (viewerState.url) {
            closeImageViewer();
            return;
        }

        // 2. Global modals layered over main UI
        if (get(showSettingsModal)) {
            showSettingsModal.set(false);
            return;
        }

        if (get(showManageContactsModal)) {
            showManageContactsModal.set(false);
            return;
        }

        if (get(showRelayStatusModal)) {
            showRelayStatusModal.set(false);
            return;
        }

        if (get(showEmptyProfileModal)) {
            showEmptyProfileModal.set(false);
            return;
        }

        const profileState = get(profileModalState);
        if (profileState.isOpen) {
            closeProfileModal();
            return;
        }

        if (get(showUserQrModal)) {
            showUserQrModal.set(false);
            return;
        }

        // 3. Route-level navigation for chat detail vs contact list
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const isChatDetail = path.startsWith('/chat/') && path !== '/chat';
        const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

        if (isChatDetail && isMobile) {
            await goto('/chat');
            return;
        }

        // 4. Fallback: history navigation or exit app
        if (event.canGoBack) {
            window.history.back();
            return;
        }

        await App.exitApp();
    });
}
