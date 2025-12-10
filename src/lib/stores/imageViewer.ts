import { writable } from 'svelte/store';

export const imageViewerState = writable<{
    url: string | null;
    fitToScreen: boolean;
}>({
    url: null,
    fitToScreen: true
});

export function openImageViewer(url: string) {
    imageViewerState.set({
        url,
        fitToScreen: true
    });
}

export function closeImageViewer() {
    imageViewerState.update(state => ({ ...state, url: null }));
}

export function toggleImageViewerFit() {
    imageViewerState.update(state => ({ ...state, fitToScreen: !state.fitToScreen }));
}
