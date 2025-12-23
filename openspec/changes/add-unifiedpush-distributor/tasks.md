## 1. Android Native Implementation
- [x] 1.1 Create `AndroidUnifiedPushPlugin.java` with methods: `start(serverUrl, topics)`, `stop()`, `addTopic(topic)`, `removeTopic(topic)`, `getRegistrations()`, `updateNotificationSummary(summary)`
- [x] 1.2 Create `AndroidUnifiedPushDistributorReceiver.java` BroadcastReceiver handling:
  - `org.unifiedpush.android.distributor.REGISTER` - store token, packageName, VAPID key, message, send `NEW_ENDPOINT` response
  - `org.unifiedpush.android.distributor.UNREGISTER` - remove registration, send `UNREGISTERED` response
  - `org.unifiedpush.android.distributor.MESSAGE_ACK` - acknowledge message delivery
- [x] 1.3 Create `AndroidUnifiedPushDistributorLinkActivity.java` Activity handling:
  - `unifiedpush://link` deep links, return RESULT_OK with pending intent
- [x] 1.4 Create `AndroidUnifiedPushService.java` foreground service:
  - WebSocket client connecting to ntfy server (`wss://<server>/ws` or per topic)
  - Message JSON parsing (id, time, event, topic, message, title, priority, tags)
  - Registration storage (token → {packageName, endpoint, vapidKey, message})
  - Topic management (subscribe to user topics, max 20 topics)
  - Android notification generation for messages with full ntfy feature support
  - Persistent foreground notification showing connection status and subscribed topics
  - Reconnection logic with exponential backoff
  - Error notification when server is unavailable
- [x] 1.5 Create `AndroidUnifiedPushPrefs.java` SharedPreferences helper:
  - Store/retrieve: enabled, serverUrl, topics[], registrations{}
  - Methods: `setEnabled()`, `setServerUrl()`, `setTopics()`, `saveRegistration()`, `getRegistrations()`

## 2. Capacitor Plugin Registration
- [x] 2.1 Update `capacitor.config.ts` to register `AndroidUnifiedPushPlugin`
- [x] 2.2 Add plugin to MainActivity's plugins array

## 3. JavaScript/WebView Layer
- [x] 3.1 Create `src/lib/core/UnifiedPushService.ts` with:
  - Interface: `UnifiedPushSettings` with enabled, serverUrl, topics (max 20)
  - Methods: `start()`, `stop()`, `addTopic()`, `removeTopic()`, `getRegistrations()`
  - Default "test-topic" when no topics exist
- [x] 3.2 Create `src/lib/stores/unifiedPush.ts` Svelte store for UnifiedPush settings
- [x] 3.3 Add `CHANNEL_UNIFIED_PUSH` notification channel constant

## 4. Settings UI (SettingsModal.svelte)
- [x] 4.1 Add "UnifiedPush" to Category type
- [x] 4.2 Add UnifiedPush category UI with:
  - Server URL text input with validation (HTTPS/WSS required)
  - Enable/disable toggle (only visible when notifications are enabled)
  - List of registered apps (packageName, message, endpoint) - read-only
  - Add topic input field with button (max 20 topics)
  - List of user topics with delete buttons
  - "Test Push" button that sends test message to "test-topic"
  - Error message display when server unavailable
- [x] 4.3 Update localStorage schema to include `unifiedPushEnabled`, `unifiedPushServerUrl`, `unifiedPushTopics`
- [x] 4.4 Ensure UnifiedPush settings use same notification channel as DM notifications

## 5. Android Manifest Updates
- [x] 5.1 Add `AndroidUnifiedPushDistributorReceiver` with intent filters for REGISTER/UNREGISTER/MESSAGE_ACK
- [x] 5.2 Add `AndroidUnifiedPushDistributorLinkActivity` with unifiedpush://link intent filter
- [x] 5.3 Add `AndroidUnifiedPushService` as foreground service with dataSync type
- [x] 5.4 Add notification channel `CHANNEL_UNIFIED_PUSH` to strings.xml

## 6. Testing
- [ ] 6.1 Test plugin registration flow with a real UnifiedPush app (e.g., Mastodon, Tusky)
- [ ] 6.2 Test WebSocket connection to ntfy server
- [ ] 6.3 Test topic subscription and notification display with full ntfy features (priority, tags, etc.)
- [ ] 6.4 Test user topic management (add/remove, 20 topic limit)
- [ ] 6.5 Test service restart persistence
- [ ] 6.6 Test "Test Push" button functionality
- [ ] 6.7 Test error notification when server unavailable
- [ ] 6.8 Test default "test-topic" behavior
- [x] 6.9 Run `npm run check` and `npx vitest run`

## 7. Documentation
- [ ] 7.1 Update AGENTS.md if needed for UnifiedPush testing
