# voice-calling Spec Delta — Group voice calls

## ADDED Requirements

### Requirement: Group Voice Call Lifecycle
The system SHALL support a group voice call between 2 and 4 members of an existing group conversation. A group voice call is identified by a 32-byte hex `group-call-id` (distinct from the per-pair `call-id`) and anchored to a 16-character hex `conversation-id` matching a local `Conversation` row whose `isGroup` is true. The local user SHALL be a member of that group conversation, and every other roster member SHALL also be a member of the same local group conversation. A group voice call SHALL hold one `RTCPeerConnection` (web) or one native `org.webrtc.PeerConnection` (Android) per other roster member. The aggregate per-call status `outgoing-ringing | incoming-ringing | connecting | active | ended` SHALL be derived from the per-participant `pcStatus` map, NOT stored independently. The aggregate status SHALL transition to `active` as soon as at least one per-participant `pcStatus` reaches `active`. The aggregate status SHALL transition to `ended` when the local user hangs up OR when every other participant's `pcStatus` is `ended` (last-one-standing). Only one call SHALL be active at any time per client; multiple inbound offers carrying the SAME `group-call-id` SHALL be treated as mesh-formation, not as concurrent calls.

#### Scenario: Successful 4-way group call setup
- **GIVEN** the local user U is a member of a group conversation `conv-X` with participants `{U, A, B, C}` (4 members total)
- **WHEN** U taps the group-call button in the chat header
- **THEN** the system SHALL allocate a fresh 32-byte hex `group-call-id` G
- **AND** the aggregate per-call status SHALL transition to `outgoing-ringing`
- **AND** the system SHALL publish three kind-25050 inner events, one addressed to each of A, B, C, each carrying tags `['group-call-id', G]`, `['conversation-id', 'conv-X']`, `['initiator', <U-hex>]`, and `['participants', <U-hex>, <A-hex>, <B-hex>, <C-hex>]`
- **WHEN** the first per-participant `pcStatus` (any of A, B, C) reaches `active`
- **THEN** the aggregate per-call status SHALL transition to `active`
- **AND** the call duration timer SHALL start

#### Scenario: Last-one-standing transitions to ended
- **GIVEN** the local user is `active` in a group call with peers A, B, and C
- **WHEN** A's `pcStatus` becomes `ended` (remote hangup) and B's `pcStatus` becomes `ended` (remote hangup) and C's `pcStatus` becomes `ended` (remote hangup)
- **THEN** the aggregate per-call status SHALL transition to `ended` with reason `hangup`
- **AND** a Kind 1405 group-call-history event SHALL be authored with `call-event-type='ended'`

#### Scenario: Local hangup leaves the call without ending it for others
- **GIVEN** the local user is `active` in a group call with peers A, B, and C
- **WHEN** the user taps hangup
- **THEN** the system SHALL publish three kind-25053 events, one to each of A, B, C, each carrying the per-pair `call-id` for that edge plus `['group-call-id', G]`, `['conversation-id', 'conv-X']`, `['initiator', <initiator-hex>]`
- **AND** the local aggregate per-call status SHALL transition to `ended` with reason `hangup`
- **AND** A, B, and C SHALL each see only their own per-pair PC end with reason `hangup`; their other PCs SHALL remain unaffected

### Requirement: Group Call Signaling Wire Format
Group call signaling SHALL reuse the existing NIP-AC kind-21059 ephemeral gift wrap and inner kinds 25050 (Offer), 25051 (Answer), 25052 (ICE Candidate), 25053 (Hangup), 25054 (Reject). The kind-21059 wrap structure SHALL be byte-identical to the 1-on-1 case: a single `['p', <recipient-hex>]` tag, no `expiration` tag, signed by a freshly generated ephemeral key, with `content` equal to the NIP-44 v2 ciphertext of the signed inner event JSON, and with no NIP-13 seal layer. Inner events for a group call SHALL include the additional tags `['group-call-id', <hex32>]`, `['conversation-id', <hex16>]`, and `['initiator', <hex>]`. Inner kind 25050 SHALL additionally include a `['participants', <hex>, <hex>, ...]` tag listing the full roster (including the initiator) in canonical sort order. Inner kind 25050 with empty `content` SHALL include a `['role', 'invite']` tag indicating that the offer is an addressing-only invite and the recipient is the designated SDP offerer for that pair. Group calls SHALL NOT introduce any new inner kind. The kind-25055 Renegotiate event is voice-only and SHALL NOT be authored for group calls in this version. Inner kind 25050 carrying both a `group-call-id` and `['call-type', 'video']` SHALL be rejected by the receiver (silently dropped — group video is not supported in this version). Group offers SHALL NOT be self-wrapped. Group answers and group rejects SHALL be self-wrapped. Group ICE and group hangup SHALL NOT be self-wrapped.

#### Scenario: Group offer event structure
- **WHEN** the system sends a group Call Offer
- **THEN** the inner event SHALL have `kind: 25050` and `content` equal to the raw SDP offer string
- **AND** the inner event tags SHALL include `['p', <recipient-hex>]`, `['call-id', <per-pair-UUID>]`, `['call-type', 'voice']`, `['group-call-id', <hex32>]`, `['conversation-id', <hex16>]`, `['initiator', <initiator-hex>]`, `['participants', <hex>, <hex>, ...]`, and `['alt', <human-readable>]`
- **AND** the inner event SHALL be signed by the sender's real key
- **AND** the wrap SHALL have `kind: 21059`, a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed by a fresh ephemeral key

#### Scenario: Invite-only group offer event structure
- **WHEN** the initiator's pubkey is lex-higher than a recipient's pubkey for some edge
- **THEN** the initiator SHALL publish a kind-25050 to that recipient with `content = ""`
- **AND** the inner event tags SHALL additionally include `['role', 'invite']`
- **AND** all the other group tags (`group-call-id`, `conversation-id`, `initiator`, `participants`, `call-type`, `call-id`, `p`, `alt`) SHALL be present as in a real-SDP group offer

#### Scenario: Group answer event structure
- **WHEN** the system sends a group Call Answer
- **THEN** the inner event SHALL have `kind: 25051` and `content` equal to the raw SDP answer string
- **AND** the inner event tags SHALL include `['p', <recipient-hex>]`, `['call-id', <per-pair-UUID>]`, `['group-call-id', <hex32>]`, `['conversation-id', <hex16>]`, `['initiator', <initiator-hex>]`, and `['alt', <human-readable>]`
- **AND** the inner event SHALL NOT include a `participants` tag
- **AND** the system SHALL also publish a self-wrap copy addressed to the sender's own pubkey

#### Scenario: Group video offer rejected
- **WHEN** an inbound kind 25050 carrying both `['group-call-id', <hex32>]` and `['call-type', 'video']` arrives
- **THEN** the receiver SHALL silently drop the event
- **AND** the local status SHALL remain unchanged
- **AND** no Call Reject SHALL be sent

### Requirement: Group Call Mesh Formation
For every unordered pair of roster members, exactly one side SHALL be the designated SDP offerer for that pair: the participant whose lowercase-hex pubkey is lexicographically lower SHALL be the offerer for that edge. The initiator SHALL seed every edge by publishing a kind-25050 addressed to that peer. For edges where the initiator's pubkey is lex-lower than the peer's, the initiator's kind-25050 SHALL carry a real SDP offer. For edges where the initiator's pubkey is lex-higher than the peer's, the initiator's kind-25050 SHALL be invite-only (empty `content`, `['role', 'invite']` tag). On accept, every accepter SHALL also offer to every other roster member with whom no edge exists yet, applying the same lex rule (lex-lower → real-SDP kind-25050; lex-higher → wait for the peer to offer). The accepter-to-accepter offer SHALL repeat the full `participants` tag and SHALL carry the same `group-call-id`, `conversation-id`, and `initiator` tag values as the original initiator's kind-25050.

#### Scenario: Initiator with lex-lower pubkey sends real-SDP offer
- **GIVEN** the initiator U's hex pubkey is `0001...` and recipient A's hex pubkey is `0002...`
- **WHEN** U starts a group call
- **THEN** U SHALL publish a kind-25050 to A with non-empty `content` (the SDP offer)
- **AND** the inner event SHALL NOT include a `['role', 'invite']` tag

#### Scenario: Initiator with lex-higher pubkey sends invite-only offer
- **GIVEN** the initiator U's hex pubkey is `00ff...` and recipient A's hex pubkey is `0001...`
- **WHEN** U starts a group call
- **THEN** U SHALL publish a kind-25050 to A with empty `content`
- **AND** the inner event SHALL include a `['role', 'invite']` tag

#### Scenario: Accepter with lex-lower pubkey offers to other accepter
- **GIVEN** A and B are both roster members of an active group call with `group-call-id` G
- **AND** A's hex pubkey is `0001...` and B's hex pubkey is `0002...`
- **AND** A has just accepted the call
- **WHEN** A's accept-flow processes the roster
- **THEN** A SHALL publish a real-SDP kind-25050 to B with `group-call-id=G`, `conversation-id=<conv>`, `initiator=<U-hex>`, and the full `participants` tag
- **AND** A SHALL NOT publish anything to peers with hex pubkey lex-lower than A's

#### Scenario: Accepter receiving invite-only becomes the offerer
- **GIVEN** the local user R receives a kind-25050 with `content = ""` and a `['role', 'invite']` tag from the initiator U
- **WHEN** R taps Accept
- **THEN** R SHALL build a fresh `RTCPeerConnection` for the {R, U} pair
- **AND** R SHALL `createOffer()`, `setLocalDescription()`, and publish a real-SDP kind-25050 to U with R's own per-pair `call-id` and the full set of group tags

### Requirement: Group Call Roster Cap
The system SHALL enforce a hard cap of 4 total participants (including the initiator) on every group call. The chat-header group-call button SHALL be disabled (greyed with a tooltip) when the local group conversation has more than 3 other participants. Inbound kind-25050 carrying a `group-call-id` and a `['participants', ...]` tag whose length exceeds 4 SHALL be silently dropped by the receiver.

#### Scenario: Group-call button greyed when group too large
- **GIVEN** the user is viewing a group conversation with 5 participants (including self)
- **WHEN** the chat header is rendered
- **THEN** the group-call button SHALL be visible but disabled
- **AND** the button SHALL display a tooltip "Group calls support up to 4 participants"

#### Scenario: Inbound offer with oversized roster dropped
- **GIVEN** an inbound kind-25050 with `group-call-id` and a `participants` tag listing 5 hex pubkeys
- **WHEN** the receive path inspects the offer
- **THEN** the offer SHALL be silently dropped
- **AND** the local status SHALL remain unchanged

### Requirement: Group Follow-Gating
For inbound kind-25050 carrying a `group-call-id`, the system SHALL replace the 1-on-1 NIP-02 contact-list follow-gate with the following group follow-gate, which SHALL pass only when ALL conditions hold:

1. The local DB contains a `Conversation` row whose `id` equals the `conversation-id` tag value AND whose `isGroup` is true AND whose `participants` list contains the local user's pubkey.
2. The inner event's `pubkey` (the sender) is present in that local conversation's `participants` list.
3. The wire `participants` tag, treated as a set of hex pubkeys, equals the local conversation's `participants` set.
4. The wire `participants` tag has no more than 4 entries.
5. The local user's pubkey is present in the wire `participants` tag (defense in depth).

If any condition fails, the offer SHALL be silently dropped (no ringer, no notification, no error to the sender). For inbound kinds 25051, 25052, 25053, 25054 carrying a `group-call-id`, the receiver SHALL NOT re-run the full group follow-gate; the receiver SHALL only verify that the `group-call-id` matches an active local per-call session AND the sender is in the cached roster. The Android `NativeBackgroundMessagingService` SHALL enforce the same group follow-gate before posting any lockscreen FSI notification.

#### Scenario: Group offer from member of local group conversation rings
- **GIVEN** the local DB has a group `Conversation` with id `conv-X` and participants `{U, A, B, C}`
- **AND** the local user U is a member of that conversation
- **WHEN** a kind-25050 with `group-call-id=G`, `conversation-id=conv-X`, `participants=[U, A, B, C]`, signed by A, arrives
- **THEN** the local user SHALL transition to `incoming-ringing` for `group-call-id=G`
- **AND** the in-app ringtone SHALL play
- **AND** on Android the lockscreen FSI notification SHALL be posted

#### Scenario: Group offer for unknown conversation dropped
- **GIVEN** the local DB has no `Conversation` with id matching the wire `conversation-id` tag value
- **WHEN** a kind-25050 with that `conversation-id` arrives
- **THEN** the offer SHALL be silently dropped
- **AND** the 1-on-1 NIP-02 follow-gate SHALL NOT be consulted as a fallback

#### Scenario: Group offer with mismatched roster dropped
- **GIVEN** the local DB's group conversation `conv-X` has participants `{U, A, B, C}`
- **WHEN** an inbound kind-25050 with `conversation-id=conv-X` carries `participants=[U, A, B, D]` (D substituted for C)
- **THEN** the offer SHALL be silently dropped

#### Scenario: Sender not in local conversation membership dropped
- **GIVEN** the local DB's group conversation `conv-X` has participants `{U, A, B, C}`
- **WHEN** an inbound kind-25050 with `conversation-id=conv-X` is signed by E (E is not in `{U, A, B, C}`)
- **THEN** the offer SHALL be silently dropped

#### Scenario: 1-on-1 NIP-02 follow-gate bypassed for group offers
- **GIVEN** the local user does NOT follow A in their NIP-02 contact list
- **AND** the local DB has a group `Conversation` with participants `{U, A, B, C}`
- **WHEN** A sends a group offer for that conversation
- **THEN** the offer SHALL ring on the local user's device
- **AND** the absence of A from the NIP-02 contact list SHALL NOT cause the offer to be dropped

### Requirement: Group Call Authoritative Initiator and Roster
The first kind-25050 received locally for a given `group-call-id` SHALL establish the authoritative tuple `(group-call-id, initiator, roster, conversation-id)`. The receiver SHALL cache this tuple keyed by `group-call-id`. Any subsequent inner event (kind 25050, 25051, 25052, 25053, or 25054) for the same `group-call-id` whose `initiator` tag, `conversation-id` tag, OR (kind 25050 only) `participants` tag disagrees with the cached tuple SHALL be silently dropped and a warning SHALL be logged. The cache entry SHALL be cleared when the local per-call status returns to `idle`.

#### Scenario: Mesh-formation offer with matching authoritative tuple accepted
- **GIVEN** the local user has cached the authoritative tuple `(G, U, [U, A, B, C], conv-X)` from the initiator U's first kind-25050
- **WHEN** an inbound kind-25050 with `group-call-id=G`, signed by A, with `initiator=U`, `conversation-id=conv-X`, `participants=[U, A, B, C]` arrives
- **THEN** the offer SHALL be processed as mesh formation
- **AND** the local user SHALL build a `RTCPeerConnection` for the {local, A} pair and proceed with the appropriate offer/answer role

#### Scenario: Inner event with disagreeing initiator dropped
- **GIVEN** the cached authoritative tuple has `initiator = U`
- **WHEN** an inbound kind-25051 for the same `group-call-id` carries `initiator = A`
- **THEN** the event SHALL be silently dropped
- **AND** a warning SHALL be logged

#### Scenario: Mesh-formation offer with disagreeing roster dropped
- **GIVEN** the cached authoritative tuple has `roster = [U, A, B, C]`
- **WHEN** an inbound kind-25050 for the same `group-call-id` carries `participants = [U, A, B, D]`
- **THEN** the offer SHALL be silently dropped

### Requirement: Group Call Concurrency
While the local user is in any non-`idle`/non-`ended` call (1-on-1 or group), inbound offers SHALL be processed as follows:

- Inbound kind-25050 with NO `group-call-id` (a 1-on-1 offer): the system SHALL auto-reject with kind-25054 reason `busy`.
- Inbound kind-25050 with a `group-call-id` that DOES NOT match the local current call's `group-call-id`: the system SHALL auto-reject with kind-25054 reason `busy`.
- Inbound kind-25050 with a `group-call-id` that MATCHES the local current call's `group-call-id`: the system SHALL process the offer as mesh formation (NOT auto-reject as busy).

While the local user is in a 1-on-1 call (no `group-call-id`), an inbound kind-25050 carrying ANY `group-call-id` SHALL be auto-rejected with `busy`.

#### Scenario: Different-group inbound offer rejected with busy
- **GIVEN** the local user is `active` in a group call with `group-call-id = G`
- **WHEN** an inbound kind-25050 with `group-call-id = G2` (G2 != G) arrives
- **THEN** the system SHALL respond with a kind-25054 whose `content` is `"busy"` to the sender
- **AND** the local call with `group-call-id = G` SHALL remain unaffected

#### Scenario: Same-group inbound offer drives mesh formation
- **GIVEN** the local user is `active` in a group call with `group-call-id = G`, with peers A and B already `active`
- **WHEN** an inbound kind-25050 with `group-call-id = G` arrives from C (also a roster member)
- **THEN** the offer SHALL be processed as mesh formation
- **AND** no kind-25054 SHALL be sent
- **AND** the local user SHALL build a third `RTCPeerConnection` for the {local, C} pair

#### Scenario: 1-on-1 inbound offer rejected during group call
- **GIVEN** the local user is `active` in a group call with `group-call-id = G`
- **WHEN** an inbound kind-25050 with NO `group-call-id` arrives
- **THEN** the system SHALL respond with a kind-25054 whose `content` is `"busy"`

#### Scenario: Group inbound offer rejected during 1-on-1 call
- **GIVEN** the local user is `active` in a 1-on-1 call (no `group-call-id`)
- **WHEN** an inbound kind-25050 with any `group-call-id` arrives
- **THEN** the system SHALL respond with a kind-25054 whose `content` is `"busy"`

### Requirement: Group Call Closed Roster
The roster of a group call SHALL be fixed by the initiator's first round of kind-25050 publications. The system SHALL NOT define a "join request" inner kind in this version. A roster member who never receives the initiator's kind-25050 (e.g., offline) SHALL NOT be invited later by other accepters. A roster member who does receive the initiator's kind-25050 but does not respond before the per-pair 60-second offer timeout SHALL be `'no-answer'` from each peer's view and SHALL author a local-only `'missed'` Kind 1405 from their own view if the offer ever resolved locally without acceptance. Re-inviting a missed participant in v1 requires placing a fresh group call (with a fresh `group-call-id`).

#### Scenario: Late participant cannot join an in-progress group call
- **GIVEN** a group call with `group-call-id = G` has been `active` for 5 minutes between U, A, and B
- **AND** C is a roster member who has been offline the entire time
- **WHEN** C comes online
- **THEN** C SHALL NOT receive a fresh offer for `group-call-id = G`
- **AND** C SHALL NOT be able to join the in-progress call
- **AND** any kind-25050 C may eventually decrypt for `group-call-id = G` SHALL be subject to the existing 60-second staleness rule and dropped

### Requirement: Group Call History via Kind 1405
On every transition of the local aggregate per-call status to `ended`, the system SHALL author one Kind 1405 rumor through the existing 3-layer NIP-17 gift-wrap pipeline (kind 14 rumor inside kind 13 seal inside kind 1059 wrap). The rumor SHALL be addressed to every other roster member (one `['p', <hex>]` tag per other participant) and self-wrapped to the local user's own pubkey. The rumor SHALL include the tags `['p', <hex>]` (one per other roster member), `['conversation-id', <hex16>]`, `['type', 'call-event']`, `['call-event-type', <type>]`, `['call-initiator', <hex>]`, `['group-call-id', <hex32>]`, and `['call-media-type', 'voice']`. When `call-event-type` is `'ended'`, the rumor SHALL also include `['call-duration', <seconds>]`. The rumor `content` SHALL be the empty string. The rumor SHALL be saved to the local message database and rendered as a system-style entry in the group conversation timeline. Local-only call-history entries (`'missed'`, `'cancelled'`) SHALL be authored through the local-only path with the same tag set, without any relay publish. Multiple Kind 1405 rumors with the same `group-call-id` from different authors SHALL all be persisted and rendered (each line shows that author's outcome).

#### Scenario: Group ended-call event includes duration and roster
- **GIVEN** a group call with `group-call-id = G` and roster `{U, A, B, C}` was `active` locally for 84 seconds
- **WHEN** the local user hangs up
- **THEN** a Kind 1405 rumor SHALL be authored
- **AND** the rumor SHALL have three `['p', <hex>]` tags (one each for A, B, C)
- **AND** the rumor SHALL have tags `['group-call-id', G]`, `['conversation-id', <hex16>]`, `['call-event-type', 'ended']`, `['call-duration', '84']`, `['call-initiator', <U-hex>]`, `['call-media-type', 'voice']`
- **AND** the rumor `content` SHALL be the empty string
- **AND** the rumor SHALL be persisted to the local message database
- **AND** the rumor SHALL be rendered as a system-style entry in the conversation `<hex16>`

#### Scenario: Group missed-call event written locally only
- **GIVEN** the local user receives a kind-25050 group offer for `group-call-id = G` and never accepts before the per-edge 60-second timeout fires
- **WHEN** the local timeout fires
- **THEN** a Kind 1405 SHALL be written to the local DB with `call-event-type='missed'` and `group-call-id=G`
- **AND** the Kind 1405 SHALL NOT be published to any relay

### Requirement: Group Call Multi-Device Self-Notification
When the local user accepts (kind 25051) or rejects (kind 25054) a group call, the multi-device self-wrap behavior SHALL key on `group-call-id` rather than per-pair `call-id`. Specifically: a self-addressed kind-25051 carrying `group-call-id = G` while another device of the same user is `incoming-ringing` for `group-call-id = G` SHALL transition that other device to `ended` with reason `answered-elsewhere` and SHALL stop ringing. A self-addressed kind-25054 carrying `group-call-id = G` SHALL similarly transition the other device to `ended` with reason `rejected-elsewhere`. On Android, the JS layer SHALL invoke `dismissIncomingCall(groupCallId)` to cancel the lockscreen FSI notification, finish `IncomingCallActivity` if showing, and stop the FGS if running.

#### Scenario: Group answer self-wrap dismisses ringer on another device
- **GIVEN** device D1 of user U is `incoming-ringing` for `group-call-id = G`
- **AND** device D2 of the same user U accepts the same group call and publishes self-wrapped kind-25051s
- **WHEN** D1 receives the first self-addressed kind-25051 with `group-call-id = G`
- **THEN** D1 SHALL transition to `ended` with reason `answered-elsewhere`
- **AND** D1's in-app ringtone SHALL stop
- **AND** on Android, D1 SHALL invoke `dismissIncomingCall(G)` to cancel the lockscreen FSI notification

#### Scenario: Group reject self-wrap dismisses ringer on another device
- **GIVEN** device D1 of user U is `incoming-ringing` for `group-call-id = G`
- **AND** device D2 of the same user U declines the same group call and publishes self-wrapped kind-25054s
- **WHEN** D1 receives the first self-addressed kind-25054 with `group-call-id = G`
- **THEN** D1 SHALL transition to `ended` with reason `rejected-elsewhere`

### Requirement: Group Call Per-Pair Timeouts
The existing per-pair timeouts SHALL apply unchanged to each edge of a group call independently. The 60-second offer-without-answer timeout SHALL transition only that one edge to `pcStatus='ended'` with `endReason='timeout'`; other edges of the same group call SHALL be unaffected. The 30-second ICE-establishment timeout SHALL transition only the affected edge to `pcStatus='ended'` with `endReason='ice-failed'`. The aggregate per-call status SHALL transition to `ended` with reason `'no-answer'` only when ALL edges have ended in `'timeout'` without ever reaching `active` AND the local user did not hang up.

#### Scenario: One peer times out without ending the group call
- **GIVEN** the local user is in `outgoing-ringing` with peers A, B, C
- **AND** A and B have transitioned to `pcStatus='active'` while C has been `pcStatus='ringing'` the entire time
- **WHEN** 60 seconds pass since C's offer was published without C's answer arriving
- **THEN** C's `pcStatus` SHALL transition to `ended` with `endReason='timeout'`
- **AND** A's and B's `pcStatus` SHALL remain `active`
- **AND** the aggregate per-call status SHALL remain `active`

#### Scenario: All peers time out yields no-answer
- **GIVEN** the local user is in `outgoing-ringing` with peers A, B, C
- **AND** no per-participant `pcStatus` ever reaches `active`
- **WHEN** all three per-pair 60-second offer timeouts fire
- **THEN** the aggregate per-call status SHALL transition to `ended` with reason `no-answer`
- **AND** a relay-published Kind 1405 SHALL be authored with `call-event-type='no-answer'` and `group-call-id=G`

### Requirement: Android Native Pure-Java Helpers Are Group-Aware
The pure-Java `NativeBusyRejectDecision`, `GlobalIceBuffer`, and `NativeSelfDismissDecision` helpers SHALL be group-aware. `NativeBusyRejectDecision` SHALL distinguish `MESH_FORMATION` (same `group-call-id`) from `AUTO_REJECT_BUSY` (different `group-call-id`, or cross-mode 1-on-1↔group concurrency). `GlobalIceBuffer` SHALL key candidates by the tuple `(senderHex, groupCallId | null)` so two distinct group-call-ids from the same sender, and 1-on-1 candidates from the same sender, are stored in disjoint buckets. `NativeSelfDismissDecision` SHALL dedup self kind-25051 / kind-25054 events by `group-call-id` when present, and by per-pair `call-id` otherwise; cross-mode confusion (e.g., self 1-on-1 event matching a group-call manager) SHALL produce `DROP`. The legacy 1-on-1 entry signatures of all three helpers SHALL be preserved as overloads so existing callers compile unchanged.

The native NIP-AC senders (`NativeBackgroundMessagingService.sendVoiceCall*`) SHALL each gain an overload accepting a group context so they can emit byte-equivalent inner-event JSON to the JavaScript senders for the same logical inputs (verified by `NativeNipAcSenderTest` against the cross-platform fixture under `tests/fixtures/nip-ac-wire/inner-events.json`).

The full multi-PC `NativeVoiceCallManager` rewrite (peer-session map, `initiateGroupCall` / `acceptIncomingGroupCall` / `notifyIncomingGroupRinging` entry points, native receive-side group dispatch in `NativeBackgroundMessagingService`, the lockscreen Activity group variants, and the FGS notification text) is **deferred to a follow-up change** (`add-group-voice-calling-android-manager`). Until that follow-up lands, the group-call entry point in the chat header is hidden on Android by an `isAndroidNative()` gate, group offers received in the JS layer on Android continue to flow through the existing JS group state machine when the WebView is alive, and group offers received by `NativeBackgroundMessagingService` while the WebView is dead are silently dropped (no FSI ringer, no notification) because the native lockscreen UI is not yet implemented for group calls.

#### Scenario: GlobalIceBuffer keys candidates by sender and group-call-id
- **GIVEN** ICE candidates for `(senderHex=A, groupCallId=G1)` and `(senderHex=A, groupCallId=G2)` arrive before any matching `PeerSession` exists
- **WHEN** `GlobalIceBuffer.add(senderHex, groupCallId, payload, nowMs)` runs for each candidate
- **THEN** candidates SHALL be stored under distinct keys
- **AND** a later `drain(senderHex='A', groupCallId='G1', nowMs)` call SHALL return only the G1 candidates and SHALL NOT return G2 candidates

#### Scenario: NativeBusyRejectDecision distinguishes mesh formation from busy
- **GIVEN** the manager is busy with `group-call-id = G`
- **WHEN** an inbound kind-25050 with `group-call-id = G` from a different roster member arrives
- **THEN** `NativeBusyRejectDecision.decide(...)` SHALL return `MESH_FORMATION` (not `AUTO_REJECT_BUSY`)
- **WHEN** an inbound kind-25050 with `group-call-id = G2` (G2 != G) arrives
- **THEN** the helper SHALL return `AUTO_REJECT_BUSY`
- **WHEN** an inbound 1-on-1 kind-25050 (no `group-call-id` tag) arrives
- **THEN** the helper SHALL return `AUTO_REJECT_BUSY`

#### Scenario: NativeSelfDismissDecision dedups by group-call-id when present
- **GIVEN** the manager is in `INCOMING_RINGING` for a group call with `group-call-id = G`
- **WHEN** a self-authored kind-25051 with `group-call-id = G` arrives
- **THEN** `NativeSelfDismissDecision.decide(...)` SHALL return `END_MANAGER_ANSWERED`
- **AND** the per-pair `call-id` value SHALL NOT be required to match
- **WHEN** a self-authored kind-25051 with no `group-call-id` (a stray 1-on-1 echo) arrives while the manager is in a group call
- **THEN** the helper SHALL return `DROP`

#### Scenario: Native NIP-AC senders emit byte-equivalent group inner events
- **GIVEN** the same logical inputs (recipient, callId, sdp/content, sender keys, timestamp, group context)
- **WHEN** `NativeBackgroundMessagingService.sendVoiceCallOffer(..., GroupSendContext)` builds the inner event
- **AND** the JavaScript `Messaging.sendCallOffer(..., { group })` builds the inner event with the same inputs
- **THEN** the resulting inner event JSON (with normalized property order) SHALL be byte-equivalent
- **AND** the canonical NIP-01 event id SHALL match the value in `tests/fixtures/nip-ac-wire/inner-events.json`

### Requirement: Android Group Calls Disabled at User-Facing Entry (Phase 1)
On Android, group voice calls SHALL be disabled at every user-facing entry point in this phase, while preserving spec compliance for receive-side wire-format behavior. The full Android UI for group calls — the lockscreen `IncomingCallActivity` group variant, `ActiveCallActivity` participant grid, the `nospeak_pending_incoming_call` SharedPreferences extensions, the FGS notification text, and the multi-PC `NativeVoiceCallManager` rewrite — is deferred to a follow-up change. In this version:

- The chat-header group-call button SHALL be hidden on Android. The web/PWA build (Section "Call Initiation Restrictions") still renders it for groups of 2-4 members.
- `VoiceCallServiceNative.initiateGroupCall`, `acceptGroupCall`, `declineGroupCall`, `hangupGroupCall`, and `toggleGroupMute` SHALL each throw a clear "not yet implemented" error so any UI bug that tries to start a group call on Android surfaces immediately during development.
- A group-call kind-25050 received by `NativeBackgroundMessagingService` while the WebView is dead SHALL be silently dropped (no FSI ringer, no notification, no SharedPreferences write) because the native lockscreen UI for group calls does not yet exist.
- A group-call kind-25050 received by the JS layer on Android (WebView alive) SHALL flow through the existing JS group state machine; this is identical to the web/PWA receive path and is therefore spec-compliant for receive-side behavior, but does not produce a usable user flow on Android because the chat-header initiate button is hidden.
- The pure-Java group-aware helpers and senders (preceding requirement) SHALL still be wired up and exercised by the existing `NativeNipAcSenderTest` so any future invocation from the native layer produces wire-format-compliant output.

#### Scenario: Chat-header group-call button hidden on Android
- **GIVEN** the user is on the Android app shell
- **AND** the active conversation is a group with 3 participants
- **WHEN** the chat header is rendered
- **THEN** the group-call button SHALL NOT appear

#### Scenario: Native receive path drops group offer when WebView is dead
- **GIVEN** the app is closed on Android and `NativeBackgroundMessagingService` is the only listener
- **WHEN** an inbound kind-25050 carrying `group-call-id` is decrypted
- **THEN** the service SHALL discard the event without persisting state and without posting any notification
- **AND** the 1-on-1 follow-gate SHALL NOT be consulted as a fallback

## MODIFIED Requirements

### Requirement: Call Initiation Restrictions
The system SHALL allow voice call initiation in two contexts: (a) one-to-one conversations, and (b) group conversations whose participant count (including self) is between 2 and 4 inclusive. The phone-icon 1-on-1 call button SHALL be rendered in 1-on-1 conversation headers and SHALL NOT be rendered in group conversation headers. A separate group-call button SHALL be rendered in group conversation headers when the group's `participants` array has between 2 and 4 entries (including self) and the local user is a member of that group conversation; the button SHALL be disabled with a tooltip "Group calls support up to 4 participants" when the group has more than 4 participants. The system SHALL only allow one concurrent call (1-on-1 or group counts as one); if the user is already in a non-`idle`/non-`ended` call state, attempts to initiate or accept a new call SHALL be rejected, with the single exception of accepting additional inbound mesh-formation offers carrying the same `group-call-id` as the current group call.

#### Scenario: 1-on-1 call button visible in 1-on-1 chats
- **GIVEN** the user is viewing a one-to-one conversation with a contact
- **WHEN** the chat header is rendered
- **THEN** the 1-on-1 call button SHALL appear and be clickable
- **AND** the group-call button SHALL NOT appear

#### Scenario: Group-call button visible in groups of 2-4
- **GIVEN** the user is viewing a group conversation with 3 participants total (2 others + self) and the local user is a member
- **WHEN** the chat header is rendered
- **THEN** the group-call button SHALL appear and be clickable
- **AND** the 1-on-1 call button SHALL NOT appear

#### Scenario: Group-call button disabled in oversized groups
- **GIVEN** the user is viewing a group conversation with 6 participants total
- **WHEN** the chat header is rendered
- **THEN** the group-call button SHALL appear in a disabled state
- **AND** clicking the button SHALL show a tooltip "Group calls support up to 4 participants"

#### Scenario: Concurrent call rejected with busy
- **GIVEN** the user has an `active` 1-on-1 or group call
- **WHEN** an offer arrives that does NOT match the current call's `group-call-id` (or is a 1-on-1 offer while the current call is a group call, or vice versa)
- **THEN** the system SHALL respond with a Call Reject (kind 25054) whose `content` is `"busy"`
- **AND** the existing call SHALL be unaffected

#### Scenario: Same-group inbound offer not treated as concurrent
- **GIVEN** the user has an `active` group call with `group-call-id = G`
- **WHEN** an inbound kind-25050 with `group-call-id = G` arrives from another roster member
- **THEN** the system SHALL NOT respond with `busy`
- **AND** the offer SHALL be processed as mesh formation

### Requirement: NIP-AC Self-Event Filter
On receive, the system SHALL apply the following filter to inner signaling events whose `pubkey` equals the user's own public key:

- Kind **25052 (ICE Candidate)** and kind **25053 (Call Hangup)** from self SHALL always be ignored.
- Kind **25051 (Call Answer)** and kind **25054 (Call Reject)** from self SHALL be ignored UNLESS one of the following holds, in which case the system SHALL transition to `ended` with reason `answered-elsewhere` (kind 25051) or `rejected-elsewhere` (kind 25054) and SHALL stop ringing:
  - The event carries no `group-call-id` AND the local status is `incoming-ringing` AND the event's `call-id` matches the currently ringing 1-on-1 call.
  - The event carries a `group-call-id` AND the local status is `incoming-ringing` for that same `group-call-id`.

#### Scenario: Self ICE candidate ignored
- **GIVEN** the local status is `connecting` or `active`
- **WHEN** a kind 25052 inner event arrives whose `pubkey` equals the user's own pubkey
- **THEN** the event SHALL NOT be applied to any peer connection
- **AND** the local status SHALL be unchanged

#### Scenario: Self hangup ignored
- **GIVEN** the local status is `active`
- **WHEN** a kind 25053 inner event arrives whose `pubkey` equals the user's own pubkey
- **THEN** the event SHALL be ignored
- **AND** the local status SHALL remain `active`

#### Scenario: Self answer in incoming-ringing 1-on-1 triggers answered-elsewhere
- **GIVEN** the local status is `incoming-ringing` for a 1-on-1 call with `call-id = X`
- **WHEN** a kind 25051 inner event arrives whose `pubkey` equals the user's own pubkey, whose `call-id` tag equals `X`, and which has no `group-call-id` tag
- **THEN** the local status SHALL transition to `ended` with reason `answered-elsewhere`
- **AND** ringtones SHALL stop

#### Scenario: Self answer in incoming-ringing group triggers answered-elsewhere
- **GIVEN** the local status is `incoming-ringing` for a group call with `group-call-id = G`
- **WHEN** a kind 25051 inner event arrives whose `pubkey` equals the user's own pubkey and whose `group-call-id` tag equals `G`
- **THEN** the local status SHALL transition to `ended` with reason `answered-elsewhere`
- **AND** ringtones SHALL stop
- **AND** the matching per-pair `call-id` value SHALL NOT be required to match — `group-call-id` is the dedup key for groups

#### Scenario: Self reject in incoming-ringing group triggers rejected-elsewhere
- **GIVEN** the local status is `incoming-ringing` for a group call with `group-call-id = G`
- **WHEN** a kind 25054 inner event arrives whose `pubkey` equals the user's own pubkey and whose `group-call-id` tag equals `G`
- **THEN** the local status SHALL transition to `ended` with reason `rejected-elsewhere`
- **AND** ringtones SHALL stop

#### Scenario: Self answer in offering ignored
- **GIVEN** the local status is `outgoing-ringing` (1-on-1 or group)
- **WHEN** a kind 25051 inner event arrives whose `pubkey` equals the user's own pubkey
- **THEN** the event SHALL be ignored
- **AND** the local status SHALL remain `outgoing-ringing`

### Requirement: ICE Candidate Buffering
The system SHALL implement two layers of ICE candidate buffering:

1. A **global buffer** keyed by the tuple `(senderHex, groupCallId | null)`, holding ICE candidates received before any `RTCPeerConnection` exists for the corresponding peer-and-call. For 1-on-1 calls (no `group-call-id` tag on the inbound kind-25052), the second component of the key is `null`. For group calls, the second component is the `group-call-id` carried on the kind-25052. When a `RTCPeerConnection` is later created for that `(peer, group-call-id)` pair, the buffered candidates SHALL be moved to the per-session buffer and the global buffer entry SHALL be cleared.
2. A **per-session buffer** holding ICE candidates received after the `RTCPeerConnection` exists but before `setRemoteDescription()` has resolved. Once `setRemoteDescription()` resolves successfully, the system SHALL flush the per-session buffer by calling `addIceCandidate()` for each buffered candidate, in arrival order.

ICE candidates that arrive after both `setRemoteDescription()` and a live `RTCPeerConnection` exist SHALL be applied directly via `addIceCandidate()` without buffering. Candidates buffered while ringing SHALL NOT be cleared when accepting the call — they SHALL be drained into the new session. Both buffers SHALL be cleared on call cleanup (transition out of any non-`idle` state into `idle`). The global buffer SHALL enforce a per-key FIFO cap of 32 candidates, a total cap of 256 active keys, and a 60-second TTL matching `NIP_AC_STALENESS_SECONDS`.

#### Scenario: Candidate before peer connection buffered globally
- **GIVEN** the local status is `incoming-ringing` and no `RTCPeerConnection` has been created
- **WHEN** a kind 25052 ICE Candidate arrives from the caller
- **THEN** the candidate SHALL be appended to the global buffer keyed by `(senderHex, null)` for 1-on-1 or `(senderHex, groupCallId)` for groups
- **AND** no `addIceCandidate()` call SHALL be made

#### Scenario: Global buffer with distinct group-call-id keys does not collide
- **GIVEN** ICE candidates from sender A arrive for two different group calls G1 and G2 before any `RTCPeerConnection` exists
- **WHEN** each candidate is enqueued
- **THEN** the candidates SHALL be stored under the distinct keys `(A, G1)` and `(A, G2)`
- **AND** draining `(A, G1)` SHALL NOT also drain `(A, G2)`

#### Scenario: Global buffer drains into session on peer-connection creation
- **GIVEN** the global buffer holds 3 candidates for `(senderHex=P, groupCallId=G)`
- **WHEN** the user accepts the call and a `RTCPeerConnection` is created for the (P, G) pair
- **THEN** all 3 candidates SHALL be moved to the per-session buffer in arrival order
- **AND** the global buffer entry for `(P, G)` SHALL be cleared

#### Scenario: Per-session buffer flushed after setRemoteDescription
- **GIVEN** the per-session buffer holds N candidates and `setRemoteDescription()` has been awaited
- **WHEN** `setRemoteDescription()` resolves successfully
- **THEN** `addIceCandidate()` SHALL be called for each buffered candidate in arrival order
- **AND** the per-session buffer SHALL be empty afterward

#### Scenario: Late candidate applied directly
- **GIVEN** the `RTCPeerConnection` exists and `setRemoteDescription()` has already resolved
- **WHEN** a kind 25052 ICE Candidate arrives from the peer
- **THEN** the candidate SHALL be applied directly via `addIceCandidate()` without entering any buffer

#### Scenario: Buffers cleared on call cleanup
- **GIVEN** a call ends (transition to `idle` after the `ended` display window)
- **WHEN** the cleanup routine runs
- **THEN** the global buffer SHALL be cleared
- **AND** the per-session buffer SHALL be cleared

### Requirement: NIP-AC Receive-Path Staleness and Deduplication
The system SHALL discard any decrypted kind-21059 inner event whose `created_at` is more than 60 seconds before the current Unix time. The system SHALL maintain a recent processed-event-ID set (at least 256 entries, FIFO eviction) and SHALL drop any inner event whose ID has already been processed. Both checks SHALL run before kind-specific dispatch and apply identically to 1-on-1 inner events (no `group-call-id` tag) and group-call inner events (with `group-call-id` tag).

#### Scenario: Stale offer dropped silently
- **GIVEN** a kind 21059 wrap whose decrypted inner kind-25050 event has `created_at` more than 60 seconds in the past
- **WHEN** the receive path processes the event
- **THEN** the event SHALL NOT be dispatched to the voice call service
- **AND** no user-facing notification SHALL be raised

#### Scenario: Duplicate event dropped silently
- **GIVEN** a kind 21059 wrap whose decrypted inner event ID is present in the processed-event-ID set
- **WHEN** the receive path processes the event
- **THEN** the event SHALL NOT be dispatched to the voice call service

#### Scenario: Fresh first-delivery event processed
- **GIVEN** a kind 21059 wrap whose decrypted inner kind-25050 event has `created_at` within the last 60 seconds
- **AND** the inner event ID is not in the processed-event-ID set
- **WHEN** the receive path processes the event
- **THEN** the event SHALL proceed to the self-event filter and follow-gate (1-on-1 NIP-02 gate or group follow-gate, depending on `group-call-id` presence), then dispatch to the voice call service

### Requirement: Spam Prevention via Follow-Gating
The system SHALL apply different follow-gates to Call Offer (kind 25050) inner events based on the presence of a `group-call-id` tag:

- **1-on-1 offers** (no `group-call-id` tag): the system SHALL only display incoming-call notifications and SHALL only enter `incoming-ringing` state for offers whose sender's pubkey appears in the user's NIP-02 contact list. Offers from non-followed pubkeys SHALL be silently dropped. If the user's contact list has not been loaded in the current session at the time the offer is processed, the offer SHALL be silently dropped.
- **Group offers** (with `group-call-id` tag): the system SHALL apply the Group Follow-Gating requirement instead of the NIP-02 contact-list gate.

In both cases, follow-gating applies only to Call Offer (kind 25050); Call Answer, ICE Candidate, Call Hangup, and Call Reject events SHALL pass without follow-gating because they belong to in-progress calls. Both follow-gates SHALL be enforced both in the JavaScript receive path and in the Android `NativeBackgroundMessagingService` so that the lockscreen full-screen-intent ringer respects the same gates when the app is closed. There is no user-facing toggle for either follow-gating policy in this version.

#### Scenario: 1-on-1 offer from followed user rings
- **GIVEN** the user's contact list is loaded and contains pubkey P
- **WHEN** a kind 25050 Call Offer with no `group-call-id` arrives with sender pubkey P
- **THEN** the local status SHALL transition to `incoming-ringing`
- **AND** the in-app ringtone SHALL play
- **AND** on Android the lockscreen FSI notification SHALL be posted

#### Scenario: 1-on-1 offer from non-followed user dropped silently
- **GIVEN** the user's contact list is loaded and does NOT contain pubkey P
- **WHEN** a kind 25050 Call Offer with no `group-call-id` arrives with sender pubkey P
- **THEN** the local status SHALL remain `idle`
- **AND** no ringtone SHALL play
- **AND** no notification SHALL be posted

#### Scenario: 1-on-1 offer dropped on cold start before contacts loaded
- **GIVEN** the contact list has not yet been loaded in the current session
- **WHEN** a kind 25050 Call Offer with no `group-call-id` arrives
- **THEN** the local status SHALL remain `idle`
- **AND** no ringtone SHALL play
- **AND** no notification SHALL be posted

#### Scenario: Group offer routed to group follow-gate
- **GIVEN** an inbound kind 25050 carries a `group-call-id` tag
- **WHEN** the receive path inspects the offer
- **THEN** the NIP-02 contact-list follow-gate SHALL NOT be consulted
- **AND** the Group Follow-Gating requirement SHALL be applied instead

#### Scenario: Non-offer events bypass follow-gating
- **GIVEN** the local status is `outgoing-ringing` for a call to peer P (1-on-1 or group)
- **WHEN** a kind 25051 Call Answer arrives from peer P
- **THEN** the answer SHALL be processed normally
- **AND** neither follow-gate SHALL block in-progress call signaling
