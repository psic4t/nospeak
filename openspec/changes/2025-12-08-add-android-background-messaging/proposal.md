# Change: Add Android background messaging with persistent relay connections

## Why
Nospeak is a pull-only messaging app that currently relies on the app being in the foreground (or a foreground-capable web context) to keep relay subscriptions active and deliver new messages. On Android, this means users can easily miss messages whenever the app is backgrounded or the device is idle, and the existing local notification behavior only works while the JS runtime is active. To make nospeak viable as a primary messenger on Android while preserving its pull-only, client-driven model, we need an energy-efficient background messaging mode that keeps read-relay connections alive and surfaces new messages through OS notifications.

## What Changes
- Add an Android-only background messaging mode that keeps the user's read relays connected via a foreground-capable background task while the user has opted in and the OS allows background activity.
- Require the Android app to show a persistent foreground notification whenever background messaging is active, including a summary of the currently connected read relays so users understand what the app is doing in the background.
- Extend messaging requirements so that background-capable Android sessions continue to receive and process incoming messages from read relays while the UI is not visible, triggering the existing local notification pipeline for new messages.
- Introduce a Settings-level control and permission flow that explicitly asks Android users to allow persistent background activity for messaging, including guiding them through any OS-level battery/background restrictions and allowing opt-out.
- Define energy-efficiency expectations for Android background messaging, including limiting work to maintaining relay connections and firing notifications for new messages, with sensible reconnection and backoff behavior.

## Impact
- Affected specs: `android-app-shell`, `messaging`, `settings`.
- Affected code: Android Capacitor shell (foreground service / background task wiring), relay connection and subscription management in `src/lib/core/Messaging.ts` and related connection services, notification flows in `src/lib/core/NotificationService.ts`, settings UI and persistence in `src/lib/components/SettingsModal.svelte`, and any Android-specific environment detection helpers.
