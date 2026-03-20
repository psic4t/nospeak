import nodeAdapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isAndroid = process.env.ADAPTER === 'android';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
			adapter: isAndroid
				? staticAdapter({
					pages: 'build/android',
					assets: 'build/android',
					fallback: 'index.html',
					precompress: false,
					strict: true
				})
				: nodeAdapter({
					out: 'build',
					static: true
				}),
			serviceWorker: {
				register: false
			},
			csrf: {
				trustedOrigins: ['*']
			}
		}

};

export default config;
