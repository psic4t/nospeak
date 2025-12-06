import { error, json } from '@sveltejs/kit';
import { fetchUrlPreviewMetadata } from '$lib/core/UrlPreviewService';

export async function GET({ url }: { url: URL }) {
    const target = url.searchParams.get('url');

    if (!target) {
        throw error(400, 'Missing url parameter');
    }

    const metadata = await fetchUrlPreviewMetadata(target);

    if (!metadata) {
        // Graceful degradation: return 204 so client can skip preview
        return new Response(null, { status: 204 });
    }

    return json(metadata);
}
