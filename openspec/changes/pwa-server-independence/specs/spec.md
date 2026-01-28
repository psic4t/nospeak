# PWA Server Independence Specification

## Purpose
Enable the nospeak PWA to function as a standalone application independent of the nospeak.chat server availability by using static site generation and client-side runtime configuration.

## Requirements

### Requirement: Static Site Generation
The PWA SHALL use `@sveltejs/adapter-static` for all builds to generate pre-rendered HTML that works without a server.

#### Scenario: Default build uses static adapter
- **GIVEN** the project is built without the `ADAPTER=android` environment variable
- **WHEN** the build runs
- **THEN** it SHALL use `@sveltejs/adapter-static` instead of `@sveltejs/adapter-node`
- **AND** all routes SHALL be pre-rendered to static HTML files

#### Scenario: Android build continues to work
- **GIVEN** the `ADAPTER=android` environment variable is set
- **WHEN** the build runs
- **THEN** it SHALL continue to use `@sveltejs/adapter-static` with Android-specific configuration
- **AND** the Android app SHALL continue to function normally

### Requirement: Client-Side Runtime Configuration
The application SHALL bake runtime configuration into the client at build time instead of fetching it from `/api/runtime-config`.

#### Scenario: Runtime config available at build time
- **GIVEN** the application is being built
- **WHEN** the build process runs
- **THEN** default runtime configuration SHALL be embedded in the client bundle
- **AND** the client SHALL NOT make requests to `/api/runtime-config` on startup

#### Scenario: Config uses build-time defaults
- **GIVEN** the application is running
- **WHEN** runtime configuration is needed
- **THEN** the embedded default values SHALL be used
- **AND** the following defaults SHALL be baked in:
  - discoveryRelays: wss://nostr.data.haus, wss://relay.damus.io, wss://nos.lol, wss://relay.primal.net, wss://purplepag.es
  - defaultMessagingRelays: wss://nostr.data.haus, wss://nos.lol, wss://relay.damus.io
  - searchRelayUrl: wss://nostr.wine
  - blasterRelayUrl: wss://sendit.nosflare.com
  - defaultBlossomServers: https://blossom.data.haus, https://blossom.primal.net
  - webAppBaseUrl: https://nospeak.chat

### Requirement: Service Worker Navigation Fallback
The service worker SHALL intercept ALL navigation requests and serve index.html, enabling client-side routing for direct URL access and page reloads.

#### Scenario: Navigation to any route
- **GIVEN** the PWA is installed
- **WHEN** the user navigates to any route (e.g., /chat, /contacts, /chat/npub1...)
- **THEN** the service worker SHALL intercept the navigation request via NavigationRoute
- **AND** serve the cached index.html
- **AND** the client-side router SHALL handle the route

#### Scenario: Page reload works for any route
- **GIVEN** the user is viewing a specific chat at /chat/npub1...
- **WHEN** the user reloads the page
- **THEN** the service worker SHALL serve index.html
- **AND** the application SHALL render the correct chat view
- **AND** no 404 error SHALL occur

#### Scenario: Precached routes available offline
- **GIVEN** the PWA has been installed and the service worker has cached assets
- **WHEN** the user is offline
- **THEN** all navigation requests SHALL be handled by the service worker
- **AND** the application SHALL render without server requests

### Requirement: URL Preview Graceful Degradation
URL preview metadata fetching SHALL continue to use the server endpoint but gracefully degrade when the server is unavailable.

#### Scenario: URL preview when server is available
- **GIVEN** the server is available
- **WHEN** a message with a URL is rendered
- **THEN** the client SHALL fetch preview metadata from `/api/url-preview`
- **AND** the preview card SHALL be displayed

#### Scenario: URL preview when server is unavailable
- **GIVEN** the server is unavailable
- **WHEN** a message with a URL is rendered
- **THEN** the client SHALL attempt to fetch preview metadata
- **AND** when the request fails, no preview SHALL be rendered
- **AND** the original link SHALL remain clickable
- **AND** no error message SHALL be shown to the user

### Requirement: All Routes Pre-rendered
All application routes SHALL be pre-rendered at build time to static HTML files.

#### Scenario: Login page pre-rendered
- **GIVEN** the build process runs
- **WHEN** it processes the root route
- **THEN** a static index.html SHALL be generated

#### Scenario: Chat routes pre-rendered
- **GIVEN** the build process runs
- **WHEN** it processes chat routes (/chat, /chat/[npub])
- **THEN** static HTML files SHALL be generated
- **AND** the client-side router SHALL handle dynamic parameters

#### Scenario: Contact routes pre-rendered
- **GIVEN** the build process runs
- **WHEN** it processes contact routes (/contacts, /contacts/create-group)
- **THEN** static HTML files SHALL be generated

### Requirement: Runtime Config Initialization Removed
The application SHALL no longer fetch runtime configuration on startup.

#### Scenario: App startup without config fetch
- **GIVEN** the application initializes
- **WHEN** the runtime configuration is needed
- **THEN** it SHALL use the embedded configuration directly
- **AND** SHALL NOT call `initRuntimeConfig()` or similar functions that fetch from server

#### Scenario: Layout initialization updated
- **GIVEN** the application layout initializes
- **WHEN** it previously called `initRuntimeConfig()`
- **THEN** this call SHALL be removed or made optional
- **AND** the application SHALL start using baked-in configuration
