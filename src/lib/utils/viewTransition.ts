import { goto } from '$app/navigation';
import { supportsViewTransitions } from './platform';

interface ViewTransitionDocument extends Document {
    startViewTransition(callback: () => Promise<void>): ViewTransition;
}

/**
 * Navigate to a URL with View Transition animation on supported platforms.
 * Falls back to standard navigation on unsupported platforms.
 *
 * @param url - The URL to navigate to
 * @param options - Optional SvelteKit navigation options
 * @returns Promise that resolves when navigation completes
 */
export async function navigateWithTransition(
    url: string,
    options?: Parameters<typeof goto>[1]
): Promise<void> {
    if (!supportsViewTransitions()) {
        await goto(url, options);
        return;
    }

    const doc = document as ViewTransitionDocument;

    try {
        const transition = doc.startViewTransition(async () => {
            await goto(url, options);
        });
        await transition.finished;
    } catch (error) {
        // Fallback to standard navigation on transition failure
        console.warn('View transition failed, falling back:', error);
        await goto(url, options);
    }
}
