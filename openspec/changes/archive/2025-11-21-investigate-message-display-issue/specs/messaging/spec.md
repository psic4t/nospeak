# Messaging: Real-time Message Display

## ADDED Requirements

### Requirement: Real-time Message Subscription Relay Targeting
The system SHALL establish message subscriptions on all appropriate relays to ensure real-time message delivery.

**Description**: The `ListenForMessages()` function must establish subscriptions on the same relays where incoming messages are expected to be received.

#### Scenario: TUI Startup Message Subscription
When a user starts the nospeak TUI, the message listening system SHALL subscribe to incoming messages on mailbox relays, discovery relays, and user-specific relays to ensure real-time message delivery.

The system SHALL:
- Subscribe to mailbox relays in addition to default discovery relays
- Establish subscriptions on both NIP-65 discovered relays and fallback relays
- Wait for relay connections before establishing subscriptions in background mode
- Provide debug logging showing which relays are being subscribed to

### Requirement: Connection Manager Relay Synchronization
The system SHALL synchronize relays used for sending messages with those available for receiving subscriptions.

**Description**: The connection manager must ensure that relays used for sending messages are also available for receiving message subscriptions.

#### Scenario: Mailbox Relay Integration
When `AddMailboxRelays()` is called during message sending, those same relays SHALL be available for message subscriptions to enable real-time bidirectional communication.

The system SHALL:
- Persist mailbox relays added during message sending for subscription use
- Track relay purposes (discovery, mailbox, subscription) in connection manager
- Return appropriate relays for message subscriptions via GetConnectedRelays()
- Maintain proper relay connection state synchronization between sending and receiving

### Requirement: Message Handler Integration
The system SHALL properly invoke the TUI message handler when new messages are received via subscriptions.

**Description:** The TUI message handler must be properly called when new messages are received via subscriptions.

#### Scenario: Real-time Message Display
When a gift-wrapped message is received via a real-time subscription, the system SHALL immediately display the message if it's from the current chat partner.

The system SHALL:
- Deliver real-time message events to the message handler
- Display messages immediately upon receipt in the TUI
- Cache messages properly while displaying them in real-time
- Prevent duplicate message display
- Maintain correct message timestamps and formatting

### Requirement: Debug Instrumentation for Message Flow
The system SHALL provide comprehensive debug logging to trace message subscription and reception flow.

**Description:** Comprehensive debug logging must be available to trace message subscription and reception flow.

#### Scenario: Message Delivery Troubleshooting
When troubleshooting message delivery issues with --debug flag, the system SHALL log the complete path from subscription establishment to message display.

The system SHALL:
- Log which relays are being subscribed to for message listening
- Log connection state changes during subscription establishment
- Log message reception events with sender and content details
- Log TUI message handler invocations
- Control all debug output via the --debug command line flag