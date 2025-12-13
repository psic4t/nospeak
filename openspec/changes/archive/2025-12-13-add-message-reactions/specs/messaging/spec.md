## ADDED Requirements

### Requirement: NIP-25 Message Reactions for Encrypted DMs
The messaging experience SHALL support NIP-25 `kind 7` reactions for individual messages inside the existing NIP-17 encrypted direct message flow. Reactions SHALL be represented as unsigned `kind 7` rumors that are sealed and gift-wrapped using the current NIP-17 pipeline and SHALL use the DM gift-wrap event id as the reaction target in the `e` tag and local storage. The client SHALL support sending a fixed set of standard reactions (thumb up, thumb down, heart, and laugh) from the message interaction menu and SHALL accept arbitrary Unicode emoji reactions received from other clients while ignoring NIP-30 custom emoji tags.

#### Scenario: Send standard reaction to a direct message
- **GIVEN** the user is viewing a one-to-one NIP-17 encrypted conversation and sees a specific message bubble in the message list
- **WHEN** the user opens the message interaction menu for that bubble and selects one of the standard reactions (thumb up, thumb down, heart, or laugh)
- **THEN** the client SHALL create an unsigned NIP-25 `kind 7` rumor that references the DM gift-wrap event id for that message in an `e` tag and the author pubkey of the original message in a `p` tag
- **AND** the client SHALL seal and gift-wrap this reaction using the same NIP-17 mechanism and publish the resulting gift-wrap events to the appropriate relays for both the sender and recipient.

#### Scenario: Receive and store reactions for encrypted direct messages
- **GIVEN** the messaging service is decrypting incoming NIP-17 gift-wrap events for the current user
- **WHEN** it unwraps a gift-wrap whose inner rumor is a NIP-25 `kind 7` reaction that includes a valid `e` tag pointing to a known DM gift-wrap event id and a `p` tag that is either the current user’s pubkey or the current user is the reaction author
- **THEN** the client SHALL persist a reaction record associated with the target DM message using the gift-wrap event id
- **AND** SHALL allow each participant to record at most one reaction per (message, emoji, author) tuple while still permitting a single participant to react to the same message with multiple different emojis.

#### Scenario: Reactions do not appear as standalone chat messages
- **GIVEN** the system is fetching historical messages or processing real-time subscriptions for NIP-17 gift-wrap events
- **WHEN** a gift-wrap unwraps to a NIP-25 `kind 7` reaction rumor
- **THEN** the reaction SHALL NOT be added to the visible chat history as a standalone message bubble
- **AND** SHALL instead be stored and surfaced only as aggregated reactions attached to the target message.

### Requirement: Message Interaction Menu Shows Standard Reactions
The message interaction menu for each chat message SHALL expose a fixed set of standard reactions: thumb up, thumb down, heart, and laugh. The interaction menu SHALL be accessible via context menu or long-press interactions on a message bubble, SHALL clearly present these reaction options with touch-friendly targets, and SHALL invoke the NIP-25 reaction send path when a reaction is chosen.

#### Scenario: Desktop user opens interaction menu and chooses a reaction
- **GIVEN** the user is viewing a one-to-one conversation on a desktop or laptop device
- **WHEN** the user right-clicks or otherwise invokes the context menu on a message bubble
- **THEN** the message interaction menu SHALL appear near the pointer and display the thumb up, thumb down, heart, and laugh reactions as selectable options
- **AND** when the user selects one of these reactions, the client SHALL call the NIP-25 reaction send path for that message and close the interaction menu.

#### Scenario: Mobile user long-presses a message to react
- **GIVEN** the user is viewing a one-to-one conversation on a touch device
- **WHEN** the user long-presses a message bubble for at least a short threshold duration
- **THEN** the message interaction menu SHALL appear anchored to that bubble and display the thumb up, thumb down, heart, and laugh reactions as selectable options
- **AND** when the user taps one of these reactions, the client SHALL send the corresponding NIP-25 reaction for that message and dismiss the menu.

### Requirement: Reactions Render Under Messages with Viewport-Aware Hydration
The messaging interface SHALL render reactions as aggregated emoji chips directly under the corresponding message bubble and SHALL only hydrate and render reaction summaries for messages that are currently within the visible scroll viewport. For each message, the client SHALL group reactions by emoji, display a count when more than one participant has used the same emoji, and visually distinguish emojis that include at least one reaction from the current user.

#### Scenario: Reactions appear as chips under a visible message
- **GIVEN** a message in a one-to-one conversation has at least one stored reaction associated with its DM gift-wrap event id
- **AND** that message bubble is currently visible within the scroll viewport of the conversation
- **WHEN** the message list is rendered
- **THEN** the UI SHALL display a compact row of emoji chips directly under the message content representing each distinct reaction emoji
- **AND** each chip SHALL show the emoji and, when more than one reaction exists for that emoji, a numeric count.

#### Scenario: Current user’s reactions are visually highlighted
- **GIVEN** the current user has reacted to a particular message with one or more emojis
- **AND** the message bubble is visible within the scroll viewport
- **WHEN** the reaction chips are rendered under that message
- **THEN** any chip that includes at least one reaction from the current user SHALL be visually distinguished from chips with only the other participant’s reactions (for example, by a different border or background intensity).

#### Scenario: Reaction hydration is limited to messages in the viewport
- **GIVEN** a conversation with a long message history that includes many messages with stored reactions
- **WHEN** the user scrolls the message list so that only a subset of messages are within the visible viewport
- **THEN** the client SHALL only query, aggregate, and subscribe to reaction data for message bubbles that are currently within or entering the viewport
- **AND** SHALL avoid performing reaction aggregation work for messages that are scrolled far above or below the current view, while still preserving stored reaction data for those messages.
