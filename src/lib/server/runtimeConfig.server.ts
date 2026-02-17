import type { RuntimeConfig } from '$lib/core/runtimeConfig/types';
import { getRuntimeConfigFromEnv } from '$lib/core/runtimeConfig/env';

export { getRuntimeConfigFromEnv };

export function getRuntimeConfig(): RuntimeConfig {
    return getRuntimeConfigFromEnv(process.env as Record<string, string | undefined>);
}
