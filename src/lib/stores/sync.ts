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
    label: string;
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
            label: 'Connect to discovery relays',
            status: 'pending'
        },
        {
            id: 'fetch-messaging-relays',
            label: "Fetch and cache user's messaging relays",
            status: 'pending'
        },
        {
            id: 'connect-read-relays',
            label: "Connect to user's read relays",
            status: 'pending'
        },
        {
            id: 'fetch-history',
            label: 'Fetch and cache history items from relays',
            status: 'pending'
        },
        {
            id: 'fetch-contact-profiles',
            label: 'Fetch and cache contact profiles and relay info',
            status: 'pending'
        },
        {
            id: 'fetch-user-profile',
            label: 'Fetch and cache user profile',
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
