import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version)
	},
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',
			registerType: 'prompt',
			injectManifest: {
				// Ensure the app shell and boot files are revisioned.
				// This prevents stale index.html referencing missing hashed chunks on reload.
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}']
			},
			scope: '/',
			base: '/',
			includeAssets: ['robots.txt', 'favicons/*.png', 'favicons/*.ico', 'nospeak.svg'],
			manifest: {
				name: 'nospeak',
				short_name: 'nospeak',
				description: 'A Nostr-based messaging application',
				theme_color: '#000000',
				background_color: '#ffffff',
				display: 'standalone',
				start_url: '/',
				icons: [
					{
						src: '/nospeak.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any maskable'
					},
					{
						src: '/favicons/favicon-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/favicons/favicon-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			}
		})
	]
});
