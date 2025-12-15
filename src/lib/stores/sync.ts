import { writable } from 'svelte/store';

export type LoginSyncStepId =
    | 'connect-discovery-relays'
    | 'fetch-messaging-relays'
    | 'connect-read-relays'
    | 'fetch-history'
    | 'fetch-contact-profiles'
    | 'fetch-user-profile';

export interface LoginSyncStep {
    id: LoginSyncStepId;
    labelKey: string;
    status: 'pending' | 'active' | 'completed';
}

export interface SyncState {
    isSyncing: boolean;
    progress: number;
    isFirstSync: boolean;
    flowActive: boolean;
    steps: LoginSyncStep[];
    currentStepId: LoginSyncStepId | null;
}

const STEP_ORDER: LoginSyncStepId[] = [
    'connect-discovery-relays',
    'fetch-messaging-relays',
    'connect-read-relays',
    'fetch-history',
    'fetch-contact-profiles',
    'fetch-user-profile'
];

function createInitialSteps(): LoginSyncStep[] {
    return [
        {
            id: 'connect-discovery-relays',
            labelKey: 'sync.steps.connectDiscoveryRelays',
            status: 'pending'
        },
        {
            id: 'fetch-messaging-relays',
            labelKey: 'sync.steps.fetchMessagingRelays',
            status: 'pending'
        },
        {
            id: 'connect-read-relays',
            labelKey: 'sync.steps.connectReadRelays',
            status: 'pending'
        },
        {
            id: 'fetch-history',
            labelKey: 'sync.steps.fetchHistory',
            status: 'pending'
        },
        {
            id: 'fetch-contact-profiles',
            labelKey: 'sync.steps.fetchContactProfiles',
            status: 'pending'
        },
        {
            id: 'fetch-user-profile',
            labelKey: 'sync.steps.fetchUserProfile',
            status: 'pending'
        }
    ];
}

const initialState: SyncState = {
    isSyncing: false,
    progress: 0,
    isFirstSync: false,
    flowActive: false,
    steps: createInitialSteps(),
    currentStepId: null
};

export const syncState = writable<SyncState>(initialState);

export function beginLoginSyncFlow(isFirstSync: boolean) {
    syncState.set({
        ...initialState,
        isFirstSync,
        flowActive: true
    });
}

export function setLoginSyncActiveStep(stepId: LoginSyncStepId) {
    syncState.update(state => {
        if (!state.flowActive) {
            return state;
        }

        const steps = state.steps.map(step => {
            if (step.id === stepId) {
                return { ...step, status: 'active' as const };
            }
            if (step.status === 'active') {
                return { ...step, status: 'completed' as const };
            }
            return step;
        });

        return {
            ...state,
            steps,
            currentStepId: stepId
        };
    });
}

export function completeLoginSyncFlow() {
    syncState.update(state => ({
        ...state,
        isSyncing: false,
        isFirstSync: false,
        progress: 0,
        flowActive: false,
        steps: state.steps.map(step =>
            step.status === 'pending' || step.status === 'active'
                ? { ...step, status: 'completed' as const }
                : step
        ),
        currentStepId: null
    }));
}

export function startSync(isFirstSync: boolean) {
    syncState.update(state => ({
        ...state,
        isSyncing: true,
        progress: 0,
        isFirstSync
    }));
}

export function updateSyncProgress(progress: number) {
    syncState.update(state => ({
        ...state,
        progress
    }));
}

export function endSync() {
    syncState.update(state => ({
        ...state,
        isSyncing: false,
        progress: 0,
        isFirstSync: false
    }));
}
