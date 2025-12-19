## ADDED Requirements

### Requirement: Optimistic Outgoing Message Rendering
The messaging UI SHALL render a newly submitted outgoing message immediately in the conversation view, without waiting for local persistence or relay publishing to complete.

#### Scenario: Text message appears immediately with sending status
- **GIVEN** the user is viewing an encrypted DM conversation
- **WHEN** the user submits a text message
- **THEN** the message SHALL appear immediately in the chat as an outgoing bubble
- **AND** the message input SHALL be cleared immediately
- **AND** the latest outgoing message bubble SHALL display a `sending...` status until delivery is confirmed

#### Scenario: Media message appears immediately after confirmation
- **GIVEN** the user is viewing an encrypted DM conversation
- **AND** the user has opened the media preview with a selected attachment
- **WHEN** the user confirms sending the attachment
- **THEN** the conversation SHALL immediately display an outgoing attachment bubble
- **AND** the latest outgoing message bubble SHALL display a `sending...` status until delivery is confirmed

#### Scenario: Only the latest outgoing message shows status
- **GIVEN** the conversation contains multiple outgoing messages
- **WHEN** the UI renders delivery status text
- **THEN** it SHALL display the status text only for the latest outgoing message

### Requirement: Relay Publish Confirmation Window
For outgoing encrypted DMs, the system SHALL confirm delivery based on recipient relay publish acknowledgements observed within a bounded confirmation window.

#### Scenario: Delivery is confirmed when any recipient relay acknowledges within 5 seconds
- **GIVEN** the user submits an outgoing encrypted DM
- **AND** the system determines a list of recipient messaging relays for that contact
- **WHEN** the client attempts to publish the recipient gift-wrap to those recipient relays
- **THEN** the send attempt SHALL be considered successful if at least one recipient relay acknowledges the publish within 5 seconds
- **AND** the UI SHALL update the latest outgoing message to show `sent to x/x relays` after the first successful acknowledgement

#### Scenario: Delivery fails when no recipient relay acknowledges within 5 seconds
- **GIVEN** the user submits an outgoing encrypted DM
- **AND** the system determines a list of recipient messaging relays for that contact
- **WHEN** the client attempts to publish the recipient gift-wrap to those recipient relays
- **AND** no recipient relay acknowledges the publish within 5 seconds
- **THEN** the UI SHALL remove the optimistic message bubble from the conversation
- **AND** the UI SHALL display an error message indicating that sending failed

#### Scenario: Text send failure restores the draft input
- **GIVEN** the user submits a text message
- **WHEN** the send attempt fails due to no recipient relay acknowledgement within 5 seconds
- **THEN** the system SHALL restore the message text into the input field

#### Scenario: Media send failure restores the media preview
- **GIVEN** the user confirms sending an attachment from the media preview
- **WHEN** the send attempt fails due to no recipient relay acknowledgement within 5 seconds
- **THEN** the system SHALL restore the media preview state including the selected file and any caption input
