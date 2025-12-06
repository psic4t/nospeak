## MODIFIED Requirements

### Requirement: First-Time Sync Progress Indicator
The system SHALL display a blocking modal progress indicator during the ordered login and first-time message synchronization flow on both desktop and mobile devices. The indicator SHALL remain visible and blocking until the flow has completed all required steps and SHALL show both the current step label and the number of fetched messages, updating in real time as history sync batches are processed.

#### Scenario: Ordered login and history sync steps
- **GIVEN** the user has successfully authenticated but the messaging environment has not yet completed initialization
- **WHEN** the application starts the login history synchronization flow
- **THEN** a blocking modal overlay appears and displays the following steps in order:
  1. Connect to discovery relays
  2. Fetch and cache the user's messaging relays
  3. Connect to the user's read relays
  4. Fetch and cache history items from relays
  5. Fetch and cache profile and relay information for created contacts
  6. Fetch and cache the current user profile
- **AND** the modal remains visible and prevents interaction with the underlying chat UI while any of these steps are in progress
- **AND** the modal highlights the current step as it runs and marks prior steps as completed before moving on
- **AND** the fetched message count displayed in the modal updates in real time during step 4 as history batches are processed.

#### Scenario: Modal dismissal and view refresh after flow completion
- **GIVEN** the blocking login history synchronization flow is in progress
- **AND** all six steps have completed successfully
- **WHEN** the flow reaches its terminal success state
- **THEN** the blocking modal overlay is dismissed
- **AND** the main chat interface is refreshed to reflect the newly synchronized history, contacts, and user profile (for example, by re-evaluating startup navigation and active conversation selection)
- **AND** normal background messaging behaviors (such as real-time subscriptions and non-blocking profile refreshes) MAY start or resume.

#### Scenario: Returning user with cached state still respects ordered flow
- **GIVEN** the user has previously logged in and some data (such as messaging relays, history, or profile) is cached locally
- **WHEN** the user logs in again and the application begins messaging initialization
- **THEN** the system SHALL still execute the ordered login history synchronization flow
- **AND** steps whose data is already fresh MAY complete quickly or be marked as skipped, but the modal SHALL remain visible until all required steps reach a completed or intentionally skipped state
- **AND** the user SHALL NOT be able to interact with the main messaging UI until the flow completes and the modal is dismissed.
