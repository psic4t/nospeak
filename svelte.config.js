import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isAndroid = process.env.ADAPTER === 'android';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: staticAdapter({
				pages: isAndroid ? 'build/android' : 'build',
				assets: isAndroid ? 'build/android' : 'build',
				fallback: 'index.html',
				precompress: false,
				strict: true
			}),
			prerender: {
				crawl: true,
				entries: ['*']
			},
			serviceWorker: {
				register: false
			},
			csrf: {
				trustedOrigins: ['*']
			}
		}

};

export default config;
