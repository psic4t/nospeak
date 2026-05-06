import { writable } from 'svelte/store';
import type {
    VoiceCallState,
    VoiceCallEndReason,
    CallKind,
    RenegotiationState,
    GroupVoiceCallState,
    ParticipantState,
    ParticipantPcStatus,
    ParticipantRole,
    VoiceCallStatus
} from '$lib/core/voiceCall/types';

const INITIAL_STATE: VoiceCallState = {
    status: 'idle',
    peerNpub: null,
    callId: null,
    duration: 0,
    isMuted: false,
    isSpeakerOn: false,
    endReason: null,
    callKind: 'voice',
    isCameraOff: false,
    isCameraFlipping: false,
    facingMode: 'user',
    renegotiationState: 'idle'
};

export const voiceCallState = writable<VoiceCallState>({ ...INITIAL_STATE });

export function setOutgoingRinging(
    peerNpub: string,
    callId: string,
    kind: CallKind = 'voice'
): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'outgoing-ringing',
        peerNpub,
        callId,
        callKind: kind
    });
}

export function setIncomingRinging(
    peerNpub: string,
    callId: string,
    kind: CallKind = 'voice'
): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'incoming-ringing',
        peerNpub,
        callId,
        callKind: kind
    });
}

export function setConnecting(): void {
    voiceCallState.update(s => ({ ...s, status: 'connecting' }));
}

export function setActive(): void {
    voiceCallState.update(s => ({ ...s, status: 'active' }));
}

export function endCall(reason: VoiceCallEndReason): void {
    voiceCallState.update(s => ({
        ...s,
        status: 'ended',
        endReason: reason,
        // Per spec: any in-flight renegotiation is implicitly cancelled
        // when the underlying call ends.
        renegotiationState: 'idle'
    }));
}

/**
 * NIP-AC multi-device: another device of the same user accepted the
 * incoming call. Transitions to `ended` with reason `answered-elsewhere`
 * while preserving peerNpub and callId for the brief Ended display.
 */
export function setEndedAnsweredElsewhere(): void {
    voiceCallState.update(s => ({
        ...s,
        status: 'ended',
        endReason: 'answered-elsewhere',
        renegotiationState: 'idle'
    }));
}

/**
 * NIP-AC multi-device: another device of the same user rejected the
 * incoming call.
 */
export function setEndedRejectedElsewhere(): void {
    voiceCallState.update(s => ({
        ...s,
        status: 'ended',
        endReason: 'rejected-elsewhere',
        renegotiationState: 'idle'
    }));
}

export function toggleMute(): void {
    voiceCallState.update(s => ({ ...s, isMuted: !s.isMuted }));
}

export function toggleSpeaker(): void {
    voiceCallState.update(s => ({ ...s, isSpeakerOn: !s.isSpeakerOn }));
}

export function incrementDuration(): void {
    voiceCallState.update(s => ({ ...s, duration: s.duration + 1 }));
}

export function resetCall(): void {
    voiceCallState.set({ ...INITIAL_STATE });
}

/**
 * Set the call kind explicitly. Used by backends when the kind is
 * determined after the initial state transition (e.g. when reading
 * `call-type` off an inbound offer).
 */
export function setCallKind(kind: CallKind): void {
    voiceCallState.update(s => ({ ...s, callKind: kind }));
}

/**
 * Set whether the local camera is off (track.enabled = false). Mutator
 * called by the backend after the underlying flip resolves.
 */
export function setCameraOff(off: boolean): void {
    voiceCallState.update(s => ({ ...s, isCameraOff: off }));
}

/**
 * Mark a camera flip as in-flight or completed. UI can use this to
 * disable the flip control while a swap is pending.
 */
export function setCameraFlipping(flag: boolean): void {
    voiceCallState.update(s => ({ ...s, isCameraFlipping: flag }));
}

/**
 * Set the active camera facing mode. Drives self-view mirroring in the
 * UI: front-facing cameras are mirrored, back-facing cameras are not.
 */
export function setFacingMode(mode: 'user' | 'environment'): void {
    voiceCallState.update(s => ({ ...s, facingMode: mode }));
}

/**
 * Force the speaker flag without invoking the backend toggle. Used to
 * default speakerphone ON when a video call transitions to active.
 */
export function setSpeakerOn(on: boolean): void {
    voiceCallState.update(s => ({ ...s, isSpeakerOn: on }));
}

/**
 * Set the in-flight NIP-AC kind-25055 renegotiation state. Drives
 * "Add video" button gating and is observable by tests. The store
 * does not enforce transitions — backends are the source of truth.
 */
export function setRenegotiationState(state: RenegotiationState): void {
    voiceCallState.update(s => ({ ...s, renegotiationState: state }));
}

/* ------------------------------------------------------------------ *
 * Group voice-call store                                             *
 *                                                                    *
 * Parallel to {@link voiceCallState}. UI components branch on        *
 * {@code groupCallId !== null} to choose between the two stores.     *
 * The "one call total" invariant guarantees that at most one of the  *
 * two stores is non-idle at any moment.                              *
 * ------------------------------------------------------------------ */

const INITIAL_GROUP_STATE: GroupVoiceCallState = {
    groupCallId: null,
    conversationId: null,
    initiatorHex: null,
    roster: [],
    participants: {},
    status: 'idle',
    endReason: null,
    duration: 0,
    isMuted: false,
    isSpeakerOn: false,
    callKind: 'voice'
};

export const groupVoiceCallState = writable<GroupVoiceCallState>({
    ...INITIAL_GROUP_STATE
});

/**
 * Derive the aggregate per-call status from a participants map. Pure
 * function, exported for unit tests. Source of truth for the rule
 * captured in the spec's "Group Voice Call Lifecycle" requirement:
 *
 * <ul>
 *   <li>{@code 'active'} — at least one participant is {@code 'active'}.</li>
 *   <li>{@code 'connecting'} — at least one participant is
 *       {@code 'connecting'} and none are yet {@code 'active'}.</li>
 *   <li>{@code 'ended'} — every participant is {@code 'ended'}
 *       (last-one-standing) or the explicit ended override is set.</li>
 *   <li>Otherwise — the caller-provided fallback (used to seed the
 *       aggregate during outgoing-ringing / incoming-ringing where
 *       the participant map alone cannot distinguish caller intent
 *       from callee intent).</li>
 * </ul>
 *
 * The ringing states are passed in explicitly because the participants
 * map cannot tell the difference between "we are calling them" and
 * "they are calling us" — that distinction is set by the caller of
 * the seed mutators ({@link setGroupOutgoingRinging} /
 * {@link setGroupIncomingRinging}).
 */
export function deriveGroupStatus(
    participants: Record<string, ParticipantState>,
    fallback: VoiceCallStatus
): VoiceCallStatus {
    const entries = Object.values(participants);
    if (entries.length === 0) return fallback;
    if (entries.some((p) => p.pcStatus === 'active')) return 'active';
    if (entries.every((p) => p.pcStatus === 'ended')) return 'ended';
    if (entries.some((p) => p.pcStatus === 'connecting')) return 'connecting';
    return fallback;
}

function buildParticipantSeed(
    pubkeyHex: string,
    callId: string,
    role: ParticipantRole,
    pcStatus: ParticipantPcStatus
): ParticipantState {
    return {
        pubkeyHex,
        callId,
        role,
        pcStatus,
        endReason: null
    };
}

/**
 * Seed the group store for an outgoing call we are initiating. The
 * caller passes the full roster (other participants only — self is
 * excluded from the participants map but remains in {@code roster}).
 * Each entry's seed values are determined by the deterministic-pair
 * offerer rule applied at the call site.
 */
export function setGroupOutgoingRinging(
    groupCallId: string,
    conversationId: string,
    initiatorHex: string,
    roster: string[],
    seeds: Array<{
        pubkeyHex: string;
        callId: string;
        role: ParticipantRole;
        pcStatus: ParticipantPcStatus;
    }>
): void {
    const participants: Record<string, ParticipantState> = {};
    for (const s of seeds) {
        participants[s.pubkeyHex] = buildParticipantSeed(
            s.pubkeyHex,
            s.callId,
            s.role,
            s.pcStatus
        );
    }
    groupVoiceCallState.set({
        ...INITIAL_GROUP_STATE,
        groupCallId,
        conversationId,
        initiatorHex,
        roster: [...roster],
        participants,
        status: 'outgoing-ringing'
    });
}

/**
 * Seed the group store for an incoming call. Only the offerer's
 * participant entry is added at this point; further entries are
 * added when their offers arrive (mesh-formation buffering) or when
 * the user accepts and the accept-flow wires them up.
 */
export function setGroupIncomingRinging(
    groupCallId: string,
    conversationId: string,
    initiatorHex: string,
    roster: string[],
    initialPeer: {
        pubkeyHex: string;
        callId: string;
        role: ParticipantRole;
        pcStatus: ParticipantPcStatus;
    }
): void {
    const participants: Record<string, ParticipantState> = {
        [initialPeer.pubkeyHex]: buildParticipantSeed(
            initialPeer.pubkeyHex,
            initialPeer.callId,
            initialPeer.role,
            initialPeer.pcStatus
        )
    };
    groupVoiceCallState.set({
        ...INITIAL_GROUP_STATE,
        groupCallId,
        conversationId,
        initiatorHex,
        roster: [...roster],
        participants,
        status: 'incoming-ringing'
    });
}

/** Idempotently add or replace a participant entry. */
export function upsertGroupParticipant(
    pubkeyHex: string,
    seed: {
        callId: string;
        role: ParticipantRole;
        pcStatus: ParticipantPcStatus;
    }
): void {
    groupVoiceCallState.update((s) => {
        if (s.groupCallId === null) return s;
        const next = {
            ...s,
            participants: {
                ...s.participants,
                [pubkeyHex]: buildParticipantSeed(
                    pubkeyHex,
                    seed.callId,
                    seed.role,
                    seed.pcStatus
                )
            }
        };
        next.status = deriveGroupStatus(next.participants, s.status);
        return next;
    });
}

/**
 * Update a single participant's {@code pcStatus} (and optionally
 * {@code endReason}). Re-derives the aggregate status. Caller is
 * responsible for passing a {@code fallback} aggregate status that
 * matches the call's ringing/connecting phase if no participant alone
 * implies it.
 */
export function setGroupParticipantStatus(
    pubkeyHex: string,
    pcStatus: ParticipantPcStatus,
    endReason: VoiceCallEndReason | null = null
): void {
    groupVoiceCallState.update((s) => {
        if (s.groupCallId === null) return s;
        const existing = s.participants[pubkeyHex];
        if (!existing) return s;
        const updated: ParticipantState = {
            ...existing,
            pcStatus,
            endReason: pcStatus === 'ended' ? endReason : existing.endReason
        };
        const nextParticipants = { ...s.participants, [pubkeyHex]: updated };
        const nextStatus = deriveGroupStatus(nextParticipants, s.status);
        return { ...s, participants: nextParticipants, status: nextStatus };
    });
}

/**
 * Force the aggregate status to {@code connecting}. Used when the
 * local user accepts an incoming group call but no per-participant
 * {@code pcStatus} has yet advanced past {@code 'pending'} or
 * {@code 'ringing'}.
 */
export function setGroupConnecting(): void {
    groupVoiceCallState.update((s) => ({
        ...s,
        status: 'connecting'
    }));
}

/**
 * Force the aggregate status to {@code ended} with an explicit reason.
 * Used by the local hangup / decline / no-answer paths. The
 * participants map is preserved so the UI can render the final
 * per-peer outcomes during the brief Ended display window before
 * {@link resetGroupCall} is called.
 */
export function endGroupCall(reason: VoiceCallEndReason): void {
    groupVoiceCallState.update((s) => ({
        ...s,
        status: 'ended',
        endReason: reason
    }));
}

/**
 * NIP-AC multi-device: another device of the same user accepted the
 * incoming group call.
 */
export function setGroupEndedAnsweredElsewhere(): void {
    groupVoiceCallState.update((s) => ({
        ...s,
        status: 'ended',
        endReason: 'answered-elsewhere'
    }));
}

/**
 * NIP-AC multi-device: another device of the same user rejected the
 * incoming group call.
 */
export function setGroupEndedRejectedElsewhere(): void {
    groupVoiceCallState.update((s) => ({
        ...s,
        status: 'ended',
        endReason: 'rejected-elsewhere'
    }));
}

export function toggleGroupMute(): void {
    groupVoiceCallState.update((s) => ({ ...s, isMuted: !s.isMuted }));
}

export function toggleGroupSpeaker(): void {
    groupVoiceCallState.update((s) => ({ ...s, isSpeakerOn: !s.isSpeakerOn }));
}

export function incrementGroupDuration(): void {
    groupVoiceCallState.update((s) => ({ ...s, duration: s.duration + 1 }));
}

export function resetGroupCall(): void {
    groupVoiceCallState.set({ ...INITIAL_GROUP_STATE });
}
