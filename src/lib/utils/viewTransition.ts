import { goto } from '$app/navigation';
import { supportsViewTransitions } from './platform';

/**
 * Navigate to a URL with View Transition animation on supported platforms.
 * Falls back to standard navigation on unsupported platforms.
 *
 * @param url - The URL to navigate to
 * @param options - Optional SvelteKit navigation options
 */
export async function navigateWithTransition(
    url: string,
    options?: Parameters<typeof goto>[1]
): Promise<void> {
    if (!supportsViewTransitions()) {
        // Fallback: standard navigation for unsupported platforms
        await goto(url, options);
        return;
    }

    // Trigger view transition
    const transition = (document as Document & { startViewTransition: (callback: () => Promise<void>) => { finished: Promise<void> } })
        .startViewTransition(async () => {
            await goto(url, options);
        });

    await transition.finished;
}
