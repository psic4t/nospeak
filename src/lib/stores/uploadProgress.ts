import { writable } from 'svelte/store';

export type UploadPhase = 'encrypting' | 'uploading' | 'delivering';

export interface UploadProgress {
    phase: UploadPhase;
    percent: number;
}

export const uploadProgress = writable<Map<string, UploadProgress>>(new Map());

export function setUploadPhase(eventId: string, phase: UploadPhase): void {
    uploadProgress.update((map) => {
        const next = new Map(map);
        next.set(eventId, { phase, percent: 0 });
        return next;
    });
}

export function setUploadPercent(eventId: string, percent: number): void {
    uploadProgress.update((map) => {
        const existing = map.get(eventId);
        if (!existing) return map;
        const next = new Map(map);
        next.set(eventId, { ...existing, percent });
        return next;
    });
}

export function clearUploadProgress(eventId: string): void {
    uploadProgress.update((map) => {
        if (!map.has(eventId)) return map;
        const next = new Map(map);
        next.delete(eventId);
        return next;
    });
}
