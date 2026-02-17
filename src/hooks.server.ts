import { sequence } from '@sveltejs/kit/hooks';
import { recordRequest } from '$lib/server/metrics.server';
import { getRuntimeConfig } from '$lib/server/runtimeConfig.server';

export const handle = sequence(async ({ event, resolve }) => {
    recordRequest(event);
    return resolve(event, {
        transformPageChunk({ html }) {
            const config = getRuntimeConfig();
            const json = JSON.stringify(config);
            // Inject runtime config before </head> so it's available synchronously
            // before any component code runs. The JSON is safe to inline because
            // getRuntimeConfig returns only URL strings and string arrays.
            return html.replace(
                '</head>',
                `<script>window.__NOSPEAK_CONFIG__=${json}</script></head>`
            );
        }
    });
});
