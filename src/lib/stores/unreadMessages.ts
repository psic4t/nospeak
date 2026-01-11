import { nip19 } from 'nostr-tools';
import { syncActiveConversationToNative } from '$lib/core/BackgroundMessaging';

export interface UnreadChatState {
    messages: string[];
    reactions: string[];
}

export interface UnreadStorageV1 {
    version: 1;
    byChat: Record<string, UnreadChatState>;
}

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'nospeak:unread:';

function isBrowser(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const localStorage = (window as any).localStorage;
    return !!localStorage && typeof localStorage.getItem === 'function' && typeof localStorage.setItem === 'function';
}

function getStorageKey(currentUserNpub: string): string {
    return `${STORAGE_PREFIX}${currentUserNpub}`;
}

function createEmptyState(): UnreadStorageV1 {
    return {
        version: STORAGE_VERSION,
        byChat: {}
    };
}

function normalizeChatState(state: Partial<UnreadChatState> | undefined): UnreadChatState {
    return {
        messages: Array.isArray(state?.messages) ? state?.messages.filter((v) => typeof v === 'string') : [],
        reactions: Array.isArray(state?.reactions) ? state?.reactions.filter((v) => typeof v === 'string') : []
    };
}

function npubToHex(npub: string): string | null {
    try {
        const decoded = nip19.decode(npub);
        if (decoded.type === 'npub' && typeof decoded.data === 'string') {
            return decoded.data;
        }
    } catch {
        // ignore
    }
    return null;
}

let activeConversationNpub: string | null = null;
let appIsVisible = true;
let appHasFocus = true;

let focusTrackingRefCount = 0;
let focusTrackingCleanup: (() => void) | null = null;

export function setActiveConversation(npub: string) {
    activeConversationNpub = npub;

    const hex = npubToHex(npub);
    if (hex) {
        void syncActiveConversationToNative(hex);
    }
}

export function clearActiveConversation() {
    activeConversationNpub = null;
    void syncActiveConversationToNative(null);
}

export function initAppVisibilityAndFocusTracking(): () => void {
    if (!isBrowser()) {
        return () => {
            // noop
        };
    }

    focusTrackingRefCount++;

    if (focusTrackingCleanup) {
        return () => {
            focusTrackingRefCount = Math.max(0, focusTrackingRefCount - 1);
            if (focusTrackingRefCount === 0 && focusTrackingCleanup) {
                focusTrackingCleanup();
                focusTrackingCleanup = null;
            }
        };
    }

    appIsVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    appHasFocus = true;

    const handleFocus = () => {
        appHasFocus = true;
    };

    const handleBlur = () => {
        appHasFocus = false;
    };

    const handleVisibilityChange = () => {
        const wasVisible = appIsVisible;
        appIsVisible = document.visibilityState === 'visible';

        // Re-sync active conversation to native when app becomes visible
        if (!wasVisible && appIsVisible && activeConversationNpub) {
            const hex = npubToHex(activeConversationNpub);
            if (hex) {
                void syncActiveConversationToNative(hex);
            }
        }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    focusTrackingCleanup = () => {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    return () => {
        focusTrackingRefCount = Math.max(0, focusTrackingRefCount - 1);
        if (focusTrackingRefCount === 0 && focusTrackingCleanup) {
            focusTrackingCleanup();
            focusTrackingCleanup = null;
        }
    };
}

export function isActivelyViewingConversation(partnerNpub: string): boolean {
    if (!isBrowser()) {
        return false;
    }

    if (!activeConversationNpub || activeConversationNpub !== partnerNpub) {
        return false;
    }

    return appIsVisible && appHasFocus;
}

function readState(currentUserNpub: string): UnreadStorageV1 {
    if (!isBrowser()) {
        return createEmptyState();
    }

    const key = getStorageKey(currentUserNpub);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
        return createEmptyState();
    }

    try {
        const parsed = JSON.parse(raw) as Partial<UnreadStorageV1>;
        if (parsed.version !== STORAGE_VERSION || typeof parsed.byChat !== 'object' || parsed.byChat === null) {
            return createEmptyState();
        }

        const byChat: Record<string, UnreadChatState> = {};
        for (const [npub, chat] of Object.entries(parsed.byChat)) {
            byChat[npub] = normalizeChatState(chat as Partial<UnreadChatState>);
        }

        return {
            version: STORAGE_VERSION,
            byChat
        };
    } catch {
        return createEmptyState();
    }
}

function writeState(currentUserNpub: string, state: UnreadStorageV1) {
    if (!isBrowser()) {
        return;
    }

    const key = getStorageKey(currentUserNpub);
    try {
        window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
        // Ignore quota / serialization errors
    }
}

export function getUnreadSnapshot(currentUserNpub: string, partnerNpub: string): { messages: Set<string>; reactions: Set<string> } {
    const state = readState(currentUserNpub);
    const chat = state.byChat[partnerNpub];

    return {
        messages: new Set(chat?.messages ?? []),
        reactions: new Set(chat?.reactions ?? [])
    };
}

export function addUnreadMessage(currentUserNpub: string, partnerNpub: string, eventId: string) {
    if (!isBrowser()) {
        return;
    }

    if (!eventId || eventId.trim().length === 0) {
        return;
    }

    const state = readState(currentUserNpub);
    const chat = normalizeChatState(state.byChat[partnerNpub]);

    if (!chat.messages.includes(eventId)) {
        chat.messages = [...chat.messages, eventId];
    }

    state.byChat[partnerNpub] = chat;
    writeState(currentUserNpub, state);
    syncAppBadge(currentUserNpub);
}

export function addUnreadReaction(currentUserNpub: string, partnerNpub: string, reactionEventId: string) {
    if (!isBrowser()) {
        return;
    }

    if (!reactionEventId || reactionEventId.trim().length === 0) {
        return;
    }

    const state = readState(currentUserNpub);
    const chat = normalizeChatState(state.byChat[partnerNpub]);

    if (!chat.reactions.includes(reactionEventId)) {
        chat.reactions = [...chat.reactions, reactionEventId];
    }

    state.byChat[partnerNpub] = chat;
    writeState(currentUserNpub, state);
    syncAppBadge(currentUserNpub);
}

export function clearChatUnread(currentUserNpub: string, partnerNpub: string) {
    if (!isBrowser()) {
        return;
    }

    const state = readState(currentUserNpub);

    if (state.byChat[partnerNpub]) {
        delete state.byChat[partnerNpub];
        writeState(currentUserNpub, state);
        syncAppBadge(currentUserNpub);
    }
}

export function getTotalUnreadCount(currentUserNpub: string): number {
    const state = readState(currentUserNpub);

    let total = 0;
    for (const chat of Object.values(state.byChat)) {
        total += (chat.messages?.length ?? 0) + (chat.reactions?.length ?? 0);
    }

    return total;
}

export async function syncAppBadge(currentUserNpub: string): Promise<void> {
    if (typeof navigator === 'undefined') {
        return;
    }

    try {
        const total = getTotalUnreadCount(currentUserNpub);

        if (total === 0) {
            if (typeof (navigator as any).clearAppBadge === 'function') {
                await (navigator as any).clearAppBadge();
                return;
            }

            if (typeof (navigator as any).setAppBadge === 'function') {
                await (navigator as any).setAppBadge(0);
            }

            return;
        }

        if (typeof (navigator as any).setAppBadge === 'function') {
            await (navigator as any).setAppBadge(total);
        }
    } catch {
        // Best-effort only
    }
}

export async function clearAppBadge(): Promise<void> {
    if (typeof navigator === 'undefined') {
        return;
    }

    try {
        if (typeof (navigator as any).clearAppBadge === 'function') {
            await (navigator as any).clearAppBadge();
            return;
        }

        if (typeof (navigator as any).setAppBadge === 'function') {
            await (navigator as any).setAppBadge(0);
        }
    } catch {
        // ignore
    }
}
