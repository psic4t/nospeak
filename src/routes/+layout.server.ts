import { getRuntimeConfig } from '$lib/server/runtimeConfig.server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
    return {
        runtimeConfig: getRuntimeConfig()
    };
};
