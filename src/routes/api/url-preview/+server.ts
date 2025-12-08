import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { fetchUrlPreviewMetadata } from '$lib/core/UrlPreviewService';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
} as const;
 
export const GET: RequestHandler = async ({ url }) => {
    const target = url.searchParams.get('url');
 
    if (!target) {
        throw error(400, 'Missing url parameter');
    }
 
    const metadata = await fetchUrlPreviewMetadata(target);
 
    if (!metadata) {
        // Graceful degradation: return 204 so client can skip preview
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
 
    return json(metadata, { headers: CORS_HEADERS });
};

export const OPTIONS: RequestHandler = async () => {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
};

