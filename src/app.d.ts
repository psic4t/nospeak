/// <reference types="vite-plugin-pwa/client" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
 	namespace App {
 		// interface Error {}
 		// interface Locals {}
 		// interface PageData {}
 		// interface PageState {}
 		// interface Platform {}
 	}
 
 	interface BackgroundMessagingPlugin {
 		start(options: { summary: string }): Promise<void>;
 		stop(): Promise<void>;
 	}
 
 	interface Window {
 		Capacitor?: {
 			Plugins?: {
 				BackgroundMessaging?: BackgroundMessagingPlugin;
 			};
 		};
 	}
 
 	const __APP_VERSION__: string;
 }
 
 export {};

