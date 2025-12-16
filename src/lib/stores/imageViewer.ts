import { writable } from 'svelte/store';

export const imageViewerState = writable<{
    url: string | null;
    originalUrl: string | null;
    fitToScreen: boolean;
}>({
    url: null,
    originalUrl: null,
    fitToScreen: true
});
 
export function openImageViewer(url: string, originalUrl?: string | null) {
    imageViewerState.set({
        url,
        originalUrl: originalUrl ?? url,
        fitToScreen: true
    });
}


export function closeImageViewer() {
    imageViewerState.update(state => ({ ...state, url: null, originalUrl: null }));
}

export function toggleImageViewerFit() {
    imageViewerState.update(state => ({ ...state, fitToScreen: !state.fitToScreen }));
}
