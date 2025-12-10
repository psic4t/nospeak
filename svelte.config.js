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
			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
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
			csrf: {
				trustedOrigins: ['*']
			}
		}

};

export default config;
