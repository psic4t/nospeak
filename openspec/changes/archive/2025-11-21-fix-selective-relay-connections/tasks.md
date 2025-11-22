# Fix Selective Relay Connections - Tasks

## Implementation Tasks

### 1. Modify Client Startup Connection Logic
- [x] Update `Connect()` method to only connect to user's cached read relays
- [x] Add fallback to discovery relays when user relays are not cached
- [x] Remove automatic connection to all contact relays at startup
- [x] Update `bootstrapUserRelays()` to only add user's read relays to persistent connections

### 2. Enhance Connection Management
- [x] Add distinction between persistent and temporary relay connections in ConnectionManager
- [x] Implement temporary connection management for message delivery
- [x] Add method to connect to relays temporarily without adding to persistent management
- [x] Update connection health monitoring to handle temporary connections

### 3. Update Message Sending Logic
- [x] Modify `SendChatMessage()` to use temporary connections for contact's read relays
- [x] Ensure message is sent to both user's persistent relays and contact's temporary relays
- [x] Add cleanup of temporary connections after message delivery
- [x] Update retry logic to handle temporary connections appropriately
- [x] **FIXED**: Also treat sender's write relays as temporary connections for proper cleanup

### 4. Update Relay Discovery and Caching
- [x] Ensure user's read relays are properly cached and retrieved
- [x] Add method to check if user's read relays are cached
- [x] Update `DiscoverUserRelays()` to handle temporary vs persistent connection decisions
- [x] Ensure cache TTL is appropriate for user's read relays

### 5. Update TUI Integration
- [x] Modify TUI startup to handle new connection behavior
- [x] Update relay connection status display to show persistent vs temporary connections
- [x] Ensure UI remains responsive during temporary connection establishment
- [x] Update connection status indicators to reflect new connection model

### 6. Testing and Validation
- [x] Add unit tests for selective connection logic
- [x] Add integration tests for message sending with temporary connections
- [x] Test fallback behavior when user relays are not cached
- [x] Validate that temporary connections are properly cleaned up
- [x] Test connection status display in TUI

### 7. Documentation and Debugging
- [x] Update debug logging to show persistent vs temporary connections
- [x] Add connection type information to debug output
- [x] Update documentation to reflect new connection behavior
- [x] Ensure error messages are clear for connection failures

## Dependencies

- Task 1 depends on understanding current connection behavior
- Task 2 depends on ConnectionManager architecture review
- Task 3 depends on Task 2 completion
- Task 4 depends on cache system understanding
- Task 5 depends on Tasks 1-4
- Task 6 depends on all implementation tasks
- Task 7 depends on implementation completion

## Implementation Status

**✅ COMPLETED**: The selective relay connection functionality has been **fully implemented** on 2025-11-21 with the following changes:

### Core Implementation Changes:

1. **ConnectionManager Enhancement**:
   - Added `ConnectionType` enum (PersistentConnection, TemporaryConnection)
   - Added `Type` field to `RelayHealth` struct
   - Added `AddPersistentRelay()` and `AddTemporaryRelay()` methods
   - Added `CleanupTemporaryConnections()` method
   - Updated `handleReconnection()` to only retry persistent connections

2. **Client Startup Logic**:
   - Modified `Connect()` to check cached user read relays first
   - Added fallback to discovery relays when user relays not cached
   - Updated `bootstrapUserRelays()` to use persistent connections
   - Updated `AddMailboxRelays()` to use persistent connections

3. **Message Sending Logic**:
   - Modified `SendChatMessage()` to use temporary connections for contact relays
   - Added automatic cleanup of temporary connections after message delivery
   - Separated sender write relays (persistent) from recipient read relays (temporary)

4. **Enhanced Statistics**:
   - Updated `GetConnectionStats()` to show persistent vs temporary connection counts
   - Added connection type information to per-relay health stats

### Validation Criteria

- [x] Startup only connects to user's cached read relays
- [x] Message sending temporarily connects to contact relays
- [x] Temporary connections are cleaned up after message delivery
- [x] Fallback to discovery relays works when user relays are not cached
- [x] TUI correctly displays connection status
- [x] All existing functionality remains intact

### Test Coverage:
- Added `TestTemporaryConnections` to verify connection type functionality
- All existing connection manager tests pass
- Code compiles and builds successfully