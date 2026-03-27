# 1-on-1 Encrypted Voice Calling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time 1-on-1 encrypted voice calling using WebRTC for P2P audio and Nostr relay gift-wrapping for signaling, with call event messages displayed in chat history.

**Architecture:** WebRTC `RTCPeerConnection` for P2P audio with DTLS-SRTP encryption. All signaling (SDP offers/answers, ICE candidates, call control) sent as NIP-17 gift-wrapped Kind 14 events through existing Nostr relay connections. NAT traversal via STUN/TURN from `turn.data.haus` with Cloudflare STUN fallback. Call events (missed, ended) stored as Kind 16 rumor messages and rendered as centered system messages in chat.

**Tech Stack:** TypeScript, Svelte 5, SvelteKit, WebRTC API, nostr-tools (NIP-44/NIP-59), Tailwind CSS, Vitest

**Design docs:**
- `.opencode/plans/2026-02-21-voice-call-design.md`
- `.opencode/plans/2026-02-22-voice-call-messages-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/core/runtimeConfig/types.ts` | Modify | Add `iceServers` field to `RuntimeConfig` |
| `src/lib/core/runtimeConfig/defaults.ts` | Modify | Add default STUN/TURN servers |
| `src/lib/core/runtimeConfig/env.ts` | Modify | Add `NOSPEAK_ICE_SERVERS` env override |
| `src/lib/core/runtimeConfig/store.ts` | Modify | Add `getIceServers()` getter |
| `src/lib/core/voiceCall/types.ts` | Create | Signal interface, state types, end reasons |
| `src/lib/core/voiceCall/constants.ts` | Create | Timeouts, audio constraints |
| `src/lib/stores/voiceCall.ts` | Create | Reactive call state store |
| `src/lib/stores/voiceCall.test.ts` | Create | Store unit tests |
| `src/lib/core/voiceCall/VoiceCallService.ts` | Create | WebRTC lifecycle, signaling, call management |
| `src/lib/core/voiceCall/VoiceCallService.test.ts` | Create | Service unit tests |
| `src/lib/core/Messaging.ts` | Modify | Send/receive voice call signals via gift-wrap |
| `src/lib/components/IncomingCallOverlay.svelte` | Create | Incoming call accept/decline UI |
| `src/lib/components/ActiveCallOverlay.svelte` | Create | Active call controls, duration, mute/speaker |
| `src/lib/components/CallEventMessage.svelte` | Create | Missed/ended call message in chat |
| `src/lib/components/CallEventMessage.test.ts` | Create | Component unit tests |
| `src/routes/+layout.svelte` | Modify | Mount call overlays app-wide |
| `src/lib/components/ChatView.svelte` | Modify | Add call button in header, render call events |
| `src/lib/db/db.ts` | Modify | Add call event fields to `Message` interface |
| `src/lib/i18n/locales/en.ts` | Modify | Add English voice call strings |

---

## Task 1: ICE Server Runtime Configuration

Add STUN/TURN server URLs to the runtime config system.

**Files:**
- Modify: `src/lib/core/runtimeConfig/types.ts:1-8`
- Modify: `src/lib/core/runtimeConfig/defaults.ts:1-26`
- Modify: `src/lib/core/runtimeConfig/env.ts:106-161`
- Modify: `src/lib/core/runtimeConfig/store.ts:90-118`

- [ ] **Step 1: Add `iceServers` to RuntimeConfig interface**

In `src/lib/core/runtimeConfig/types.ts`, add to the `RuntimeConfig` interface:

```typescript
export interface RuntimeConfig {
    discoveryRelays: string[];
    defaultMessagingRelays: string[];
    searchRelayUrl: string;
    blasterRelayUrl: string;
    defaultBlossomServers: string[];
    webAppBaseUrl: string;
    iceServers: RTCIceServer[];
}
```

- [ ] **Step 2: Add defaults**

In `src/lib/core/runtimeConfig/defaults.ts`, add to `DEFAULT_RUNTIME_CONFIG`:

```typescript
iceServers: [
    { urls: 'stun:turn.data.haus:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
        urls: 'turn:turn.data.haus:3478',
        username: 'free',
        credential: 'free'
    }
]
```

Note: Verify `turn.data.haus` credentials before shipping — `free`/`free` is a placeholder.

- [ ] **Step 3: Add env override**

In `src/lib/core/runtimeConfig/env.ts`, add parsing for `NOSPEAK_ICE_SERVERS` env var inside `getRuntimeConfigFromEnv()`. The env var is a JSON string of `RTCIceServer[]`:

```typescript
// After existing parsing, before the return statement:
let iceServers: RTCIceServer[] = DEFAULT_RUNTIME_CONFIG.iceServers;
const iceServersRaw = env.NOSPEAK_ICE_SERVERS;
if (iceServersRaw && iceServersRaw.trim().length > 0) {
    try {
        const parsed = JSON.parse(iceServersRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
            iceServers = parsed;
        } else {
            console.warn('Ignoring NOSPEAK_ICE_SERVERS override; invalid array');
        }
    } catch {
        console.warn('Ignoring NOSPEAK_ICE_SERVERS override; invalid JSON');
    }
}
```

Add `iceServers` to the return object.

- [ ] **Step 4: Add getter**

In `src/lib/core/runtimeConfig/store.ts`:

1. Update `isRuntimeConfig()` to validate the new field:
   ```typescript
   Array.isArray(candidate.iceServers) &&
   ```

2. Update `initRuntimeConfig()` — the injected config path already spreads the full object, so it will include `iceServers` automatically.

3. Add getter function:
   ```typescript
   export function getIceServers(): RTCIceServer[] {
       return getRuntimeConfigSnapshot().iceServers;
   }
   ```

- [ ] **Step 5: Run checks**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/runtimeConfig/
git commit -m "feat(voice-call): add ICE server runtime configuration"
```

---

## Task 2: Voice Call Types and Constants

Define shared types and constants.

**Files:**
- Create: `src/lib/core/voiceCall/types.ts`
- Create: `src/lib/core/voiceCall/constants.ts`

- [ ] **Step 1: Create types file**

Create `src/lib/core/voiceCall/types.ts`:

```typescript
export interface VoiceCallSignal {
    type: 'voice-call';
    action: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'reject' | 'busy';
    callId: string;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
}

export type VoiceCallStatus =
    | 'idle'
    | 'outgoing-ringing'
    | 'incoming-ringing'
    | 'connecting'
    | 'active'
    | 'ended';

export type VoiceCallEndReason =
    | 'hangup'
    | 'rejected'
    | 'busy'
    | 'timeout'
    | 'ice-failed'
    | 'error';

export interface VoiceCallState {
    status: VoiceCallStatus;
    peerNpub: string | null;
    callId: string | null;
    duration: number;
    isMuted: boolean;
    isSpeakerOn: boolean;
    endReason: VoiceCallEndReason | null;
}
```

- [ ] **Step 2: Create constants file**

Create `src/lib/core/voiceCall/constants.ts`:

```typescript
export const CALL_OFFER_TIMEOUT_MS = 60_000;
export const ICE_CONNECTION_TIMEOUT_MS = 30_000;
export const CALL_SIGNAL_TYPE = 'voice-call' as const;
export const CALL_END_DISPLAY_MS = 2_000;
export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    video: false
};
```

- [ ] **Step 3: Run checks**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/voiceCall/
git commit -m "feat(voice-call): add voice call types and constants"
```

---

## Task 3: Voice Call Store

Create the Svelte store for voice call state.

**Files:**
- Create: `src/lib/stores/voiceCall.ts`
- Create: `src/lib/stores/voiceCall.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/stores/voiceCall.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
    voiceCallState,
    setOutgoingRinging,
    setIncomingRinging,
    setConnecting,
    setActive,
    endCall,
    toggleMute,
    toggleSpeaker,
    incrementDuration,
    resetCall
} from './voiceCall';

describe('voiceCall store', () => {
    beforeEach(() => {
        resetCall();
    });

    it('should start in idle state', () => {
        const state = get(voiceCallState);
        expect(state.status).toBe('idle');
        expect(state.peerNpub).toBeNull();
        expect(state.callId).toBeNull();
        expect(state.duration).toBe(0);
        expect(state.isMuted).toBe(false);
        expect(state.isSpeakerOn).toBe(false);
        expect(state.endReason).toBeNull();
    });

    it('should transition to outgoing-ringing', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        const state = get(voiceCallState);
        expect(state.status).toBe('outgoing-ringing');
        expect(state.peerNpub).toBe('npub1abc');
        expect(state.callId).toBe('call-123');
    });

    it('should transition to incoming-ringing', () => {
        setIncomingRinging('npub1def', 'call-456');
        const state = get(voiceCallState);
        expect(state.status).toBe('incoming-ringing');
        expect(state.peerNpub).toBe('npub1def');
        expect(state.callId).toBe('call-456');
    });

    it('should transition to connecting', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        setConnecting();
        expect(get(voiceCallState).status).toBe('connecting');
    });

    it('should transition to active', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        setConnecting();
        setActive();
        expect(get(voiceCallState).status).toBe('active');
    });

    it('should end call with reason', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        endCall('rejected');
        const state = get(voiceCallState);
        expect(state.status).toBe('ended');
        expect(state.endReason).toBe('rejected');
    });

    it('should toggle mute', () => {
        setActive();
        toggleMute();
        expect(get(voiceCallState).isMuted).toBe(true);
        toggleMute();
        expect(get(voiceCallState).isMuted).toBe(false);
    });

    it('should toggle speaker', () => {
        setActive();
        toggleSpeaker();
        expect(get(voiceCallState).isSpeakerOn).toBe(true);
        toggleSpeaker();
        expect(get(voiceCallState).isSpeakerOn).toBe(false);
    });

    it('should increment duration', () => {
        setActive();
        incrementDuration();
        incrementDuration();
        incrementDuration();
        expect(get(voiceCallState).duration).toBe(3);
    });

    it('should reset to idle', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        setConnecting();
        setActive();
        toggleMute();
        incrementDuration();
        resetCall();
        const state = get(voiceCallState);
        expect(state.status).toBe('idle');
        expect(state.peerNpub).toBeNull();
        expect(state.callId).toBeNull();
        expect(state.duration).toBe(0);
        expect(state.isMuted).toBe(false);
        expect(state.endReason).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest src/lib/stores/voiceCall.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `src/lib/stores/voiceCall.ts`:

```typescript
import { writable } from 'svelte/store';
import type { VoiceCallState, VoiceCallEndReason } from '$lib/core/voiceCall/types';

const INITIAL_STATE: VoiceCallState = {
    status: 'idle',
    peerNpub: null,
    callId: null,
    duration: 0,
    isMuted: false,
    isSpeakerOn: false,
    endReason: null
};

export const voiceCallState = writable<VoiceCallState>({ ...INITIAL_STATE });

export function setOutgoingRinging(peerNpub: string, callId: string): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'outgoing-ringing',
        peerNpub,
        callId
    });
}

export function setIncomingRinging(peerNpub: string, callId: string): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'incoming-ringing',
        peerNpub,
        callId
    });
}

export function setConnecting(): void {
    voiceCallState.update(s => ({ ...s, status: 'connecting' }));
}

export function setActive(): void {
    voiceCallState.update(s => ({ ...s, status: 'active' }));
}

export function endCall(reason: VoiceCallEndReason): void {
    voiceCallState.update(s => ({ ...s, status: 'ended', endReason: reason }));
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest src/lib/stores/voiceCall.test.ts --run`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/voiceCall.ts src/lib/stores/voiceCall.test.ts
git commit -m "feat(voice-call): add voice call state store with tests"
```

---

## Task 4: VoiceCallService — Core WebRTC + Signaling

The central service managing WebRTC peer connections, signaling, and call lifecycle.

**Files:**
- Create: `src/lib/core/voiceCall/VoiceCallService.ts`
- Create: `src/lib/core/voiceCall/VoiceCallService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/core/voiceCall/VoiceCallService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/stores/auth', () => ({
    signer: { subscribe: vi.fn() },
    currentUser: { subscribe: vi.fn() }
}));

vi.mock('$lib/core/runtimeConfig/store', () => ({
    getIceServers: vi.fn().mockReturnValue([
        { urls: 'stun:turn.data.haus:3478' }
    ])
}));

import { VoiceCallService } from './VoiceCallService';
import { resetCall } from '$lib/stores/voiceCall';
import type { VoiceCallSignal } from './types';

describe('VoiceCallService', () => {
    let service: VoiceCallService;

    beforeEach(() => {
        vi.clearAllMocks();
        resetCall();
        service = new VoiceCallService();
    });

    describe('isVoiceCallSignal', () => {
        it('should identify valid voice call signals', () => {
            const signal: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId: 'abc123',
                sdp: 'v=0...'
            };
            expect(service.isVoiceCallSignal(JSON.stringify(signal))).toBe(true);
        });

        it('should reject non-voice-call content', () => {
            expect(service.isVoiceCallSignal('Hello, world!')).toBe(false);
            expect(service.isVoiceCallSignal('{"type":"text"}')).toBe(false);
            expect(service.isVoiceCallSignal('')).toBe(false);
        });

        it('should reject malformed JSON', () => {
            expect(service.isVoiceCallSignal('{invalid')).toBe(false);
        });

        it('should reject signals missing required fields', () => {
            expect(service.isVoiceCallSignal('{"type":"voice-call"}')).toBe(false);
            expect(service.isVoiceCallSignal('{"type":"voice-call","action":"offer"}')).toBe(false);
        });
    });

    describe('parseSignal', () => {
        it('should parse valid signal content', () => {
            const signal: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId: 'abc123',
                sdp: 'v=0...'
            };
            const parsed = service.parseSignal(JSON.stringify(signal));
            expect(parsed).toEqual(signal);
        });

        it('should return null for invalid content', () => {
            expect(service.parseSignal('not json')).toBeNull();
            expect(service.parseSignal('{"type":"text"}')).toBeNull();
        });
    });

    describe('generateCallId', () => {
        it('should generate a hex string', () => {
            const id = service.generateCallId();
            expect(id).toMatch(/^[0-9a-f]{32}$/);
        });

        it('should generate unique IDs', () => {
            const id1 = service.generateCallId();
            const id2 = service.generateCallId();
            expect(id1).not.toBe(id2);
        });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest src/lib/core/voiceCall/VoiceCallService.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement VoiceCallService**

Create `src/lib/core/voiceCall/VoiceCallService.ts`:

```typescript
import { get } from 'svelte/store';
import {
    setOutgoingRinging,
    setIncomingRinging,
    setConnecting,
    setActive,
    endCall,
    toggleMute as storeMute,
    resetCall,
    voiceCallState,
    incrementDuration
} from '$lib/stores/voiceCall';
import { getIceServers } from '$lib/core/runtimeConfig/store';
import { CALL_OFFER_TIMEOUT_MS, ICE_CONNECTION_TIMEOUT_MS, CALL_SIGNAL_TYPE, AUDIO_CONSTRAINTS } from './constants';
import type { VoiceCallSignal } from './types';

type SignalSender = (recipientNpub: string, signalContent: string) => Promise<void>;

export class VoiceCallService {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private offerTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private iceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private durationIntervalId: ReturnType<typeof setInterval> | null = null;
    private sendSignalFn: SignalSender | null = null;

    /**
     * Register the function used to send signaling messages.
     * Called by Messaging on init to avoid circular imports.
     */
    public registerSignalSender(fn: SignalSender): void {
        this.sendSignalFn = fn;
    }

    public isVoiceCallSignal(content: string): boolean {
        return this.parseSignal(content) !== null;
    }

    public parseSignal(content: string): VoiceCallSignal | null {
        try {
            const parsed = JSON.parse(content);
            if (
                parsed &&
                parsed.type === CALL_SIGNAL_TYPE &&
                typeof parsed.action === 'string' &&
                typeof parsed.callId === 'string'
            ) {
                return parsed as VoiceCallSignal;
            }
            return null;
        } catch {
            return null;
        }
    }

    public generateCallId(): string {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    public async initiateCall(recipientNpub: string): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'idle') {
            console.warn('[VoiceCall] Cannot initiate call — already in a call');
            return;
        }

        const callId = this.generateCallId();
        setOutgoingRinging(recipientNpub, callId);

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            this.createPeerConnection(recipientNpub, callId);

            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            const offer = await this.peerConnection!.createOffer();
            await this.peerConnection!.setLocalDescription(offer);

            await this.sendSignal(recipientNpub, {
                type: CALL_SIGNAL_TYPE,
                action: 'offer',
                callId,
                sdp: offer.sdp
            });

            this.offerTimeoutId = setTimeout(() => {
                const current = get(voiceCallState);
                if (current.status === 'outgoing-ringing' && current.callId === callId) {
                    this.cleanup();
                    endCall('timeout');
                }
            }, CALL_OFFER_TIMEOUT_MS);
        } catch (err) {
            console.error('[VoiceCall] Failed to initiate call:', err);
            this.cleanup();
            endCall('error');
        }
    }

    public async handleSignal(signal: VoiceCallSignal, senderNpub: string): Promise<void> {
        switch (signal.action) {
            case 'offer':
                await this.handleOffer(signal, senderNpub);
                break;
            case 'answer':
                await this.handleAnswer(signal);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(signal);
                break;
            case 'hangup':
                this.handleHangup(signal);
                break;
            case 'reject':
                this.handleReject(signal);
                break;
            case 'busy':
                this.handleBusy(signal);
                break;
        }
    }

    public async acceptCall(): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'incoming-ringing' || !state.peerNpub || !state.callId) {
            console.warn('[VoiceCall] Cannot accept — not in incoming-ringing state');
            return;
        }

        try {
            setConnecting();
            this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);

            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            const answer = await this.peerConnection!.createAnswer();
            await this.peerConnection!.setLocalDescription(answer);

            await this.sendSignal(state.peerNpub, {
                type: CALL_SIGNAL_TYPE,
                action: 'answer',
                callId: state.callId,
                sdp: answer.sdp
            });
        } catch (err) {
            console.error('[VoiceCall] Failed to accept call:', err);
            this.cleanup();
            endCall('error');
        }
    }

    public async declineCall(): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'incoming-ringing' || !state.peerNpub || !state.callId) return;

        await this.sendSignal(state.peerNpub, {
            type: CALL_SIGNAL_TYPE,
            action: 'reject',
            callId: state.callId
        });
        this.cleanup();
        endCall('rejected');
    }

    public async hangup(): Promise<void> {
        const state = get(voiceCallState);
        if (!state.peerNpub || !state.callId) return;

        await this.sendSignal(state.peerNpub, {
            type: CALL_SIGNAL_TYPE,
            action: 'hangup',
            callId: state.callId
        });
        this.cleanup();
        endCall('hangup');
    }

    public toggleMute(): void {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
        storeMute();
    }

    public getRemoteStream(): MediaStream | null {
        return this.remoteStream;
    }

    // --- Private ---

    private createPeerConnection(peerNpub: string, callId: string): void {
        const iceServers = getIceServers();
        this.peerConnection = new RTCPeerConnection({ iceServers });

        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await this.sendSignal(peerNpub, {
                    type: CALL_SIGNAL_TYPE,
                    action: 'ice-candidate',
                    callId,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const iceState = this.peerConnection?.iceConnectionState;
            if (iceState === 'connected' || iceState === 'completed') {
                this.clearTimeouts();
                setActive();
                this.startDurationTimer();
            } else if (iceState === 'failed' || iceState === 'disconnected') {
                this.cleanup();
                endCall('ice-failed');
            }
        };

        this.iceTimeoutId = setTimeout(() => {
            const iceState = this.peerConnection?.iceConnectionState;
            if (iceState !== 'connected' && iceState !== 'completed') {
                this.cleanup();
                endCall('ice-failed');
            }
        }, ICE_CONNECTION_TIMEOUT_MS);
    }

    private async handleOffer(signal: VoiceCallSignal, senderNpub: string): Promise<void> {
        const state = get(voiceCallState);

        if (state.status !== 'idle') {
            await this.sendSignal(senderNpub, {
                type: CALL_SIGNAL_TYPE,
                action: 'busy',
                callId: signal.callId
            });
            return;
        }

        setIncomingRinging(senderNpub, signal.callId);
        this.createPeerConnection(senderNpub, signal.callId);

        const remoteDesc = new RTCSessionDescription({
            type: 'offer',
            sdp: signal.sdp!
        });
        await this.peerConnection!.setRemoteDescription(remoteDesc);
    }

    private async handleAnswer(signal: VoiceCallSignal): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId || !this.peerConnection) return;

        this.clearTimeouts();
        setConnecting();

        const remoteDesc = new RTCSessionDescription({
            type: 'answer',
            sdp: signal.sdp!
        });
        await this.peerConnection.setRemoteDescription(remoteDesc);
    }

    private async handleIceCandidate(signal: VoiceCallSignal): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId || !this.peerConnection) return;

        if (signal.candidate) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    }

    private handleHangup(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
        this.cleanup();
        endCall('hangup');
    }

    private handleReject(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
        this.cleanup();
        endCall('rejected');
    }

    private handleBusy(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
        this.cleanup();
        endCall('busy');
    }

    private async sendSignal(recipientNpub: string, signal: VoiceCallSignal): Promise<void> {
        if (!this.sendSignalFn) {
            console.error('[VoiceCall] Signal sender not registered');
            return;
        }
        try {
            await this.sendSignalFn(recipientNpub, JSON.stringify(signal));
        } catch (err) {
            console.error('[VoiceCall] Failed to send signal:', err);
        }
    }

    private startDurationTimer(): void {
        this.durationIntervalId = setInterval(() => {
            incrementDuration();
        }, 1000);
    }

    private clearTimeouts(): void {
        if (this.offerTimeoutId) {
            clearTimeout(this.offerTimeoutId);
            this.offerTimeoutId = null;
        }
        if (this.iceTimeoutId) {
            clearTimeout(this.iceTimeoutId);
            this.iceTimeoutId = null;
        }
    }

    private cleanup(): void {
        this.clearTimeouts();

        if (this.durationIntervalId) {
            clearInterval(this.durationIntervalId);
            this.durationIntervalId = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.remoteStream = null;

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
}

export const voiceCallService = new VoiceCallService();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest src/lib/core/voiceCall/VoiceCallService.test.ts --run`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/voiceCall/VoiceCallService.ts src/lib/core/voiceCall/VoiceCallService.test.ts
git commit -m "feat(voice-call): add VoiceCallService with WebRTC lifecycle management"
```

---

## Task 5: Messaging Integration — Send and Receive Voice Call Signals

Wire voice call signaling into the existing NIP-17 gift-wrap pipeline.

**Files:**
- Modify: `src/lib/core/Messaging.ts:163-234` (handleGiftWrap) and add new method

**Key context:** The `MessagingService` class is in `src/lib/core/Messaging.ts`. It's exported as singleton on line 1804: `export const messagingService = new MessagingService()`. The `sendEnvelope` method (line 920) is `private` and accepts `{ recipients, rumor, skipDbSave, ... }`. Incoming messages flow through `handleGiftWrap` (line 163) which decrypts and calls `processRumor` (line 506).

- [ ] **Step 1: Add `sendVoiceCallSignal` public method**

Add to `MessagingService` class (after existing public methods). This builds a Kind 14 rumor with a `['type', 'voice-call']` tag and sends via `sendEnvelope` with `skipDbSave: true`:

```typescript
public async sendVoiceCallSignal(recipientNpub: string, signalContent: string): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const pubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const rumor: Partial<NostrEvent> = {
        kind: 14,
        created_at: Math.floor(Date.now() / 1000),
        content: signalContent,
        tags: [
            ['p', recipientPubkey],
            ['type', 'voice-call']
        ],
        pubkey
    };

    await this.sendEnvelope({
        recipients: [recipientNpub],
        rumor,
        skipDbSave: true
    });
}
```

- [ ] **Step 2: Intercept voice call signals in `handleGiftWrap`**

In `handleGiftWrap` (around line 228), before `this.processRumor(rumor, event.id)`, add:

```typescript
// Route voice-call signals to VoiceCallService (don't save to DB)
const voiceCallTag = rumor.tags?.find((t: string[]) => t[0] === 'type' && t[1] === 'voice-call');
if (voiceCallTag) {
    const { voiceCallService } = await import('$lib/core/voiceCall/VoiceCallService');
    const signal = voiceCallService.parseSignal(rumor.content);
    if (signal) {
        const senderNpub = nip19.npubEncode(rumor.pubkey);
        await voiceCallService.handleSignal(signal, senderNpub);
    }
    return;
}
```

Note: Dynamic `import()` avoids circular dependency between Messaging and VoiceCallService.

Also update the kind filter at line 203 to allow Kind 16 (call event messages):

```typescript
// Before (line 203):
if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7) {

// After:
if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7 && rumor.kind !== 16) {
```

- [ ] **Step 3: Register signal sender on init**

In `listenForMessages()` (line 53), after the service is set up, register the signal sender callback with VoiceCallService:

```typescript
// Register voice call signal sender
import('$lib/core/voiceCall/VoiceCallService').then(({ voiceCallService }) => {
    voiceCallService.registerSignalSender(
        (recipientNpub: string, signalContent: string) =>
            this.sendVoiceCallSignal(recipientNpub, signalContent)
    );
});
```

- [ ] **Step 4: Run checks**

Run: `npm run check`
Expected: No new type errors.

- [ ] **Step 5: Run existing tests**

Run: `npx vitest --run`
Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/Messaging.ts
git commit -m "feat(voice-call): integrate voice call signaling with NIP-17 gift-wrap messaging"
```

---

## Task 6: Extend Message Interface for Call Events

Add call event fields to the `Message` interface for displaying call history in chat.

**Files:**
- Modify: `src/lib/db/db.ts:4-34`

- [ ] **Step 1: Add call event fields**

In `src/lib/db/db.ts`, add after the `location` field:

```typescript
    // Call event fields
    callEventType?: 'missed' | 'outgoing' | 'incoming' | 'ended';
    callDuration?: number; // in seconds
    callInitiatorNpub?: string;
```

- [ ] **Step 2: Run checks**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/db.ts
git commit -m "feat(voice-call): add call event fields to Message interface"
```

---

## Task 7: CallEventMessage Component

Create the component that renders call events (missed, ended) as centered system messages in chat.

**Files:**
- Create: `src/lib/components/CallEventMessage.svelte`
- Create: `src/lib/components/CallEventMessage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/CallEventMessage.test.ts`. The project does not use `@testing-library/svelte` — tests extract pure logic into functions and test those directly:

```typescript
import { describe, it, expect } from 'vitest';

// Mirror the component's pure functions for testing
function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getMessageText(callEventType: string | undefined, callDuration?: number): string {
    switch (callEventType) {
        case 'missed':
            return 'Missed voice call';
        case 'ended': {
            const duration = formatDuration(callDuration);
            return duration ? `Voice call ended \u2022 ${duration}` : 'Voice call ended';
        }
        case 'outgoing':
            return 'Outgoing voice call';
        case 'incoming':
            return 'Incoming voice call';
        default:
            return 'Voice call';
    }
}

describe('CallEventMessage', () => {
    describe('formatDuration', () => {
        it('formats seconds to MM:SS', () => {
            expect(formatDuration(150)).toBe('2:30');
            expect(formatDuration(0)).toBe('');
            expect(formatDuration(undefined)).toBe('');
            expect(formatDuration(61)).toBe('1:01');
            expect(formatDuration(3600)).toBe('60:00');
        });
    });

    describe('getMessageText', () => {
        it('returns missed call text', () => {
            expect(getMessageText('missed')).toBe('Missed voice call');
        });

        it('returns ended call with duration', () => {
            expect(getMessageText('ended', 150)).toBe('Voice call ended \u2022 2:30');
        });

        it('returns ended call without duration', () => {
            expect(getMessageText('ended')).toBe('Voice call ended');
        });

        it('returns outgoing call text', () => {
            expect(getMessageText('outgoing')).toBe('Outgoing voice call');
        });

        it('returns default for unknown type', () => {
            expect(getMessageText(undefined)).toBe('Voice call');
        });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest src/lib/components/CallEventMessage.test.ts --run`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create CallEventMessage component**

Create `src/lib/components/CallEventMessage.svelte`:

```svelte
<script lang="ts">
    import type { Message } from '$lib/db/db';

    interface Props {
        message: Message;
    }

    let { message }: Props = $props();

    function formatDuration(seconds: number | undefined): string {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getMessageText(): string {
        switch (message.callEventType) {
            case 'missed':
                return 'Missed voice call';
            case 'ended': {
                const duration = formatDuration(message.callDuration);
                return duration ? `Voice call ended \u2022 ${duration}` : 'Voice call ended';
            }
            case 'outgoing':
                return 'Outgoing voice call';
            case 'incoming':
                return 'Incoming voice call';
            default:
                return 'Voice call';
        }
    }

    const isMissed = $derived(message.callEventType === 'missed');
    const iconColor = $derived(isMissed ? 'text-red-500' : 'text-green-500');
</script>

<div class="flex justify-center my-2">
    <div class="flex flex-col items-center">
        <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4 {iconColor}"
            >
                {#if isMissed}
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                    <path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                {:else}
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                {/if}
            </svg>
            <span class="text-sm text-gray-700 dark:text-gray-300">
                {getMessageText()}
            </span>
        </div>
        <span class="text-xs text-gray-400 mt-1">
            {new Date(message.sentAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
    </div>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest src/lib/components/CallEventMessage.test.ts --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/CallEventMessage.svelte src/lib/components/CallEventMessage.test.ts
git commit -m "feat(voice-call): create CallEventMessage component for call events"
```

---

## Task 8: IncomingCallOverlay Component

Create the incoming call overlay UI.

**Files:**
- Create: `src/lib/components/IncomingCallOverlay.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/IncomingCallOverlay.svelte`:

```svelte
<script lang="ts">
    import { voiceCallState } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_OFFER_TIMEOUT_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';

    let profileName = $state('');
    let profilePicture = $state('');
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        if ($voiceCallState.status === 'incoming-ringing' && $voiceCallState.peerNpub) {
            loadProfile($voiceCallState.peerNpub);
            // Don't send reject on timeout — let caller's own timeout fire.
            // Just dismiss the UI locally.
            dismissTimeout = setTimeout(() => {
                voiceCallService.hangup();
            }, CALL_OFFER_TIMEOUT_MS);

            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
        } else {
            if (dismissTimeout) {
                clearTimeout(dismissTimeout);
                dismissTimeout = null;
            }
        }
    });

    async function loadProfile(npub: string) {
        const profile = await profileRepo.getProfileIgnoreTTL(npub);
        if (profile?.metadata) {
            profileName = resolveDisplayName(profile.metadata, npub);
            profilePicture = profile.metadata.picture || '';
        } else {
            profileName = npub.slice(0, 12) + '...';
        }
    }

    function accept() {
        voiceCallService.acceptCall();
    }

    function decline() {
        voiceCallService.declineCall();
    }

    onDestroy(() => {
        if (dismissTimeout) clearTimeout(dismissTimeout);
    });
</script>

{#if $voiceCallState.status === 'incoming-ringing'}
    <div class="fixed inset-0 z-[55] bg-black/90 flex flex-col items-center justify-center gap-8">
        <!-- Caller info -->
        <div class="flex flex-col items-center gap-4">
            {#if profilePicture}
                <img src={profilePicture} alt="" class="w-24 h-24 rounded-full object-cover" />
            {:else}
                <div class="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-3xl text-white">
                    {profileName.charAt(0).toUpperCase()}
                </div>
            {/if}
            <span class="text-white text-xl font-medium">{profileName}</span>
            <span class="text-gray-400 text-sm">{$t('voiceCall.incomingCall')}</span>
        </div>

        <!-- Accept / Decline buttons -->
        <div class="flex gap-16">
            <button
                onclick={decline}
                class="flex flex-col items-center gap-2"
                aria-label={$t('voiceCall.decline')}
            >
                <div class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 rotate-[135deg]">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </div>
                <span class="text-white text-xs">{$t('voiceCall.decline')}</span>
            </button>

            <button
                onclick={accept}
                class="flex flex-col items-center gap-2"
                aria-label={$t('voiceCall.accept')}
            >
                <div class="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </div>
                <span class="text-white text-xs">{$t('voiceCall.accept')}</span>
            </button>
        </div>
    </div>
{/if}
```

- [ ] **Step 2: Run check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/IncomingCallOverlay.svelte
git commit -m "feat(voice-call): add incoming call overlay component"
```

---

## Task 9: ActiveCallOverlay Component

Create the active call overlay UI with duration, mute, speaker, and hangup controls.

**Files:**
- Create: `src/lib/components/ActiveCallOverlay.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/ActiveCallOverlay.svelte`:

```svelte
<script lang="ts">
    import { voiceCallState, resetCall } from '$lib/stores/voiceCall';
    import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
    import { CALL_END_DISPLAY_MS } from '$lib/core/voiceCall/constants';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { onDestroy } from 'svelte';
    import { t } from '$lib/i18n';

    let profileName = $state('');
    let profilePicture = $state('');
    let audioEl: HTMLAudioElement;
    let endResetTimeout: ReturnType<typeof setTimeout> | null = null;

    const isVisible = $derived(
        $voiceCallState.status === 'outgoing-ringing' ||
        $voiceCallState.status === 'connecting' ||
        $voiceCallState.status === 'active' ||
        $voiceCallState.status === 'ended'
    );

    const statusText = $derived.by(() => {
        switch ($voiceCallState.status) {
            case 'outgoing-ringing': return $t('voiceCall.calling');
            case 'connecting': return $t('voiceCall.connecting');
            case 'active': return formatDuration($voiceCallState.duration);
            case 'ended': return endReasonText($voiceCallState.endReason);
            default: return '';
        }
    });

    function formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function endReasonText(reason: string | null): string {
        switch (reason) {
            case 'hangup': return $t('voiceCall.endReasonHangup');
            case 'rejected': return $t('voiceCall.endReasonRejected');
            case 'busy': return $t('voiceCall.endReasonBusy');
            case 'timeout': return $t('voiceCall.endReasonTimeout');
            case 'ice-failed': return $t('voiceCall.endReasonIceFailed');
            case 'error': return $t('voiceCall.endReasonError');
            default: return $t('voiceCall.endReasonHangup');
        }
    }

    $effect(() => {
        if ($voiceCallState.peerNpub) {
            loadProfile($voiceCallState.peerNpub);
        }
    });

    $effect(() => {
        if ($voiceCallState.status === 'active' && audioEl) {
            const stream = voiceCallService.getRemoteStream();
            if (stream) {
                audioEl.srcObject = stream;
            }
        }
    });

    $effect(() => {
        if ($voiceCallState.status === 'ended') {
            endResetTimeout = setTimeout(() => {
                resetCall();
            }, CALL_END_DISPLAY_MS);
        }
    });

    async function loadProfile(npub: string) {
        const profile = await profileRepo.getProfileIgnoreTTL(npub);
        if (profile?.metadata) {
            profileName = resolveDisplayName(profile.metadata, npub);
            profilePicture = profile.metadata.picture || '';
        } else {
            profileName = npub.slice(0, 12) + '...';
        }
    }

    function handleHangup() {
        voiceCallService.hangup();
    }

    function handleToggleMute() {
        voiceCallService.toggleMute();
    }

    onDestroy(() => {
        if (endResetTimeout) clearTimeout(endResetTimeout);
    });
</script>

{#if isVisible}
    <div class="fixed inset-0 z-[55] bg-black/90 flex flex-col items-center justify-center gap-8">
        <!-- Hidden audio element for remote stream -->
        <audio bind:this={audioEl} autoplay></audio>

        <!-- Peer info -->
        <div class="flex flex-col items-center gap-4">
            {#if profilePicture}
                <img src={profilePicture} alt="" class="w-24 h-24 rounded-full object-cover" />
            {:else}
                <div class="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-3xl text-white">
                    {profileName.charAt(0).toUpperCase()}
                </div>
            {/if}
            <span class="text-white text-xl font-medium">{profileName}</span>
            <span class="text-gray-400 text-lg">{statusText}</span>
        </div>

        <!-- Controls -->
        {#if $voiceCallState.status !== 'ended'}
            <div class="flex gap-12 items-center">
                <!-- Mute -->
                <button
                    onclick={handleToggleMute}
                    class="flex flex-col items-center gap-2"
                    aria-label={$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                >
                    <div class="w-14 h-14 rounded-full flex items-center justify-center {$voiceCallState.isMuted ? 'bg-white' : 'bg-gray-700'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={$voiceCallState.isMuted ? 'black' : 'white'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
                            {#if $voiceCallState.isMuted}
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            {:else}
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            {/if}
                        </svg>
                    </div>
                    <span class="text-white text-xs">
                        {$voiceCallState.isMuted ? $t('voiceCall.unmute') : $t('voiceCall.mute')}
                    </span>
                </button>

                <!-- Hangup -->
                <button
                    onclick={handleHangup}
                    class="flex flex-col items-center gap-2"
                    aria-label={$t('voiceCall.hangup')}
                >
                    <div class="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 rotate-[135deg]">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                </button>

                <!-- Speaker -->
                <button
                    onclick={() => { /* speaker toggle - platform-dependent, placeholder for v1 */ }}
                    class="flex flex-col items-center gap-2"
                    aria-label={$t('voiceCall.speaker')}
                >
                    <div class="w-14 h-14 rounded-full flex items-center justify-center {$voiceCallState.isSpeakerOn ? 'bg-white' : 'bg-gray-700'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={$voiceCallState.isSpeakerOn ? 'black' : 'white'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </div>
                    <span class="text-white text-xs">{$t('voiceCall.speaker')}</span>
                </button>
            </div>
        {/if}
    </div>
{/if}
```

- [ ] **Step 2: Run check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ActiveCallOverlay.svelte
git commit -m "feat(voice-call): add active call overlay component"
```

---

## Task 10: Mount Overlays in Root Layout

Mount call overlays in the root layout so they work app-wide.

**Files:**
- Modify: `src/routes/+layout.svelte:606-607`

- [ ] **Step 1: Add imports**

In `src/routes/+layout.svelte`, add to the `<script>` imports:

```typescript
import IncomingCallOverlay from '$lib/components/IncomingCallOverlay.svelte';
import ActiveCallOverlay from '$lib/components/ActiveCallOverlay.svelte';
```

- [ ] **Step 2: Mount overlays**

After `<Toast />` (line 607), before `<!-- PIN Setup Modal -->` (line 609), add:

```svelte
      <IncomingCallOverlay />
      <ActiveCallOverlay />
```

- [ ] **Step 3: Run check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat(voice-call): mount call overlays in root layout"
```

---

## Task 11: Call Button in Chat Header

Add the phone icon button to the 1-on-1 chat view header.

**Files:**
- Modify: `src/lib/components/ChatView.svelte:2017-2027`

- [ ] **Step 1: Add import**

In `src/lib/components/ChatView.svelte`, add to imports:

```typescript
import { voiceCallService } from '$lib/core/voiceCall/VoiceCallService';
```

- [ ] **Step 2: Add call handler**

Add in the `<script>` section:

```typescript
async function startVoiceCall() {
    if (partnerNpub) {
        await voiceCallService.initiateCall(partnerNpub);
    }
}
```

- [ ] **Step 3: Add call button in header**

In the header right section, before the search toggle `<Button>` (line 2017), add:

```svelte
          {#if partnerNpub && !isGroup}
            <button
                onclick={startVoiceCall}
                class="flex h-11 w-11 items-center justify-center rounded-full text-ctp-subtext0 hover:text-ctp-text transition-colors"
                aria-label="Voice call"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
            </button>
          {/if}
```

- [ ] **Step 4: Run check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ChatView.svelte
git commit -m "feat(voice-call): add call button to 1-on-1 chat header"
```

---

## Task 12: Integrate CallEventMessage into ChatView

Render call event messages as centered system messages in chat.

**Files:**
- Modify: `src/lib/components/ChatView.svelte` (message rendering section)

- [ ] **Step 1: Add import**

In `src/lib/components/ChatView.svelte`, add:

```typescript
import CallEventMessage from './CallEventMessage.svelte';
```

- [ ] **Step 2: Add conditional rendering for rumorKind 16**

Find the message rendering loop in ChatView (where individual messages are rendered). Before the existing message bubble rendering, add:

```svelte
{#if message.rumorKind === 16}
    <CallEventMessage {message} />
{:else}
    <!-- existing message bubble rendering -->
{/if}
```

The exact location depends on the current message rendering pattern — look for the `{#each}` loop over messages and the per-message rendering block.

- [ ] **Step 3: Run check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ChatView.svelte
git commit -m "feat(voice-call): integrate CallEventMessage into ChatView for rumorKind 16"
```

---

## Task 13: Call Event Creation in VoiceCallService

Add methods to VoiceCallService that create call event messages when calls end.

**Files:**
- Modify: `src/lib/core/voiceCall/VoiceCallService.ts`
- Modify: `src/lib/core/Messaging.ts`

- [ ] **Step 1: Add `createCallEventMessage` to MessagingService**

In `src/lib/core/Messaging.ts`, add a public method:

```typescript
public async createCallEventMessage(
    recipientNpub: string,
    callEventType: 'missed' | 'outgoing' | 'incoming' | 'ended',
    duration?: number
): Promise<void> {
    const s = get(signer);
    if (!s) throw new Error('Not authenticated');

    const pubkey = await s.getPublicKey();
    const recipientPubkey = nip19.decode(recipientNpub).data as string;

    const tags: string[][] = [
        ['p', recipientPubkey],
        ['type', 'call-event'],
        ['call-event-type', callEventType]
    ];

    if (duration !== undefined) {
        tags.push(['call-duration', String(duration)]);
    }

    tags.push(['call-initiator', pubkey]);

    const senderNpub = nip19.npubEncode(pubkey);

    const rumor: Partial<NostrEvent> = {
        kind: 16,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags,
        pubkey
    };

    await this.sendEnvelope({
        recipients: [recipientNpub],
        rumor,
        messageDbFields: { callEventType, callDuration: duration, callInitiatorNpub: senderNpub }
    });
}
```

- [ ] **Step 2: Handle incoming Kind 16 call events in `handleGiftWrap`**

In `handleGiftWrap`, after the voice-call signal interception (added in Task 5) and before `processRumor`, the existing code already routes Kind 14/15 to `processRumor`. Kind 16 should also flow through `processRumor` — verify it does. If there's a kind filter, add `16` to the allowed kinds.

In `processRumor` or `createMessageFromRumor`, add parsing for call event tags:

```typescript
// If rumorKind is 16, extract call event fields from tags
if (rumor.kind === 16) {
    const callEventTypeTag = rumor.tags?.find((t: string[]) => t[0] === 'call-event-type');
    const callDurationTag = rumor.tags?.find((t: string[]) => t[0] === 'call-duration');
    const callInitiatorTag = rumor.tags?.find((t: string[]) => t[0] === 'call-initiator');
    if (callEventTypeTag) {
        message.callEventType = callEventTypeTag[1] as any;
    }
    if (callDurationTag) {
        message.callDuration = parseInt(callDurationTag[1]);
    }
    if (callInitiatorTag) {
        message.callInitiatorNpub = nip19.npubEncode(callInitiatorTag[1]);
    }
}
```

- [ ] **Step 3: Add call event creation to VoiceCallService**

In `VoiceCallService.ts`, add a callback registration and call event methods:

```typescript
private createCallEventFn: ((recipientNpub: string, type: string, duration?: number) => Promise<void>) | null = null;

public registerCallEventCreator(fn: (recipientNpub: string, type: string, duration?: number) => Promise<void>): void {
    this.createCallEventFn = fn;
}

private async createCallEvent(type: 'missed' | 'outgoing' | 'ended', duration?: number): Promise<void> {
    const state = get(voiceCallState);
    if (!state.peerNpub || !this.createCallEventFn) return;
    try {
        await this.createCallEventFn(state.peerNpub, type, duration);
    } catch (err) {
        console.error('[VoiceCall] Failed to create call event:', err);
    }
}
```

Then call `createCallEvent` at the right points:
- In `endCall('timeout')` (offer timeout): `this.createCallEvent('outgoing')`
- In `handleHangup` / when call ends with `status === 'active'`: `this.createCallEvent('ended', state.duration)`
- In incoming call timeout: callee creates `this.createCallEvent('missed')`

- [ ] **Step 4: Register callback in Messaging init**

Update the lazy import in `listenForMessages()` to also register the call event creator:

```typescript
import('$lib/core/voiceCall/VoiceCallService').then(({ voiceCallService }) => {
    voiceCallService.registerSignalSender(
        (recipientNpub: string, signalContent: string) =>
            this.sendVoiceCallSignal(recipientNpub, signalContent)
    );
    voiceCallService.registerCallEventCreator(
        (recipientNpub: string, type: string, duration?: number) =>
            this.createCallEventMessage(recipientNpub, type as any, duration)
    );
});
```

- [ ] **Step 5: Run checks**

Run: `npm run check && npx vitest --run`
Expected: No errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/voiceCall/VoiceCallService.ts src/lib/core/Messaging.ts
git commit -m "feat(voice-call): add call event message creation and handling"
```

---

## Task 14: i18n Strings

Add English translation strings for all voice call UI.

**Files:**
- Modify: `src/lib/i18n/locales/en.ts`

- [ ] **Step 1: Add voice call i18n keys**

In `src/lib/i18n/locales/en.ts`, add a `voiceCall` section to the `en` object:

```typescript
voiceCall: {
    calling: 'Calling...',
    connecting: 'Connecting...',
    incomingCall: 'Incoming voice call',
    accept: 'Accept',
    decline: 'Decline',
    hangup: 'Hang up',
    mute: 'Mute',
    unmute: 'Unmute',
    speaker: 'Speaker',
    endReasonHangup: 'Call ended',
    endReasonRejected: 'Call declined',
    endReasonBusy: 'User busy',
    endReasonTimeout: 'No answer',
    endReasonIceFailed: 'Connection failed',
    endReasonError: 'Call failed'
},
```

- [ ] **Step 2: Run check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/locales/en.ts
git commit -m "feat(voice-call): add English i18n strings for voice call UI"
```

---

## Task 15: Final Integration Test and Validation

End-to-end validation of the complete feature.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest --run`
Expected: All tests pass.

- [ ] **Step 2: Run type checks**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Manual smoke test checklist**

- [ ] Open two browser tabs with different Nostr accounts
- [ ] Tab A: Navigate to 1-on-1 chat with Tab B's user
- [ ] Verify phone icon appears in chat header for 1-on-1 chats
- [ ] Verify phone icon does NOT appear in group chats
- [ ] Tab A: Click phone icon to initiate call
- [ ] Tab B: Verify incoming call overlay appears with caller name/avatar
- [ ] Tab B: Click accept
- [ ] Verify both tabs show active call overlay with duration timer
- [ ] Verify audio flows between tabs (speak into mic, hear on other tab)
- [ ] Test mute toggle (muted tab's audio should stop on other tab)
- [ ] Test hangup from either side — verify "Call ended" appears briefly, then dismisses
- [ ] Verify "Voice call ended - 0:XX" message appears in chat for both parties
- [ ] Test decline flow — verify "Call declined" message on caller side
- [ ] Test timeout flow (wait 60s without answering) — verify "No answer" / "Missed voice call"
- [ ] Test calling someone already in a call — verify "User busy" response
- [ ] Verify call events persist across app restarts (reload page, check chat history)

- [ ] **Step 5: Commit any fixes**

```bash
git commit -m "fix(voice-call): address issues found during smoke testing"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | ICE server runtime config | — | 4 runtimeConfig files |
| 2 | Types and constants | 2 | — |
| 3 | Voice call store + tests | 2 | — |
| 4 | VoiceCallService core + tests | 2 | — |
| 5 | Messaging integration (signals) | — | Messaging.ts |
| 6 | Message interface extension | — | db.ts |
| 7 | CallEventMessage component + tests | 2 | — |
| 8 | IncomingCallOverlay | 1 | — |
| 9 | ActiveCallOverlay | 1 | — |
| 10 | Mount overlays in layout | — | +layout.svelte |
| 11 | Call button in chat header | — | ChatView.svelte |
| 12 | Call events in ChatView | — | ChatView.svelte |
| 13 | Call event creation | — | VoiceCallService.ts, Messaging.ts |
| 14 | i18n strings | — | en.ts |
| 15 | Final validation | — | — |
