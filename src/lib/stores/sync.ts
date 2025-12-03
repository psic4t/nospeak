import { writable } from 'svelte/store';

export interface SyncState {
    isSyncing: boolean;
    progress: number;
    isFirstSync: boolean;
}

const initialState: SyncState = {
    isSyncing: false,
    progress: 0,
    isFirstSync: false
};

export const syncState = writable<SyncState>(initialState);

export function startSync(isFirstSync: boolean) {
    syncState.set({
        isSyncing: true,
        progress: 0,
        isFirstSync
    });
}

export function updateSyncProgress(progress: number) {
    syncState.update(state => ({
        ...state,
        progress
    }));
}

export function endSync() {
    syncState.set({
        isSyncing: false,
        progress: 0,
        isFirstSync: false
    });
}
