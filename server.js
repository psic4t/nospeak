import express from 'express';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Basic logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// URL Preview Service (inlined from TypeScript source)
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml'
]);

const MAX_PREVIEW_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT = 10000; // 10 seconds

async function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = client.request(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; nospeak-bot/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
            },
            timeout: FETCH_TIMEOUT,
            ...options
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Follow redirects
                resolve(fetchUrl(res.headers.location, options));
                return;
            }
            
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            let data = '';
            let size = 0;
            
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size > MAX_PREVIEW_SIZE) {
                    req.destroy();
                    reject(new Error('Response too large'));
                    return;
                }
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    data,
                    headers: res.headers,
                    statusCode: res.statusCode
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

function parseOpenGraph(html, baseUrl) {
    const result = {
        url: baseUrl,
        title: null,
        description: null,
        image: null
    };
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
        result.title = titleMatch[1].trim();
    }
    
    // Extract Open Graph tags
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["'][^>]*>/i);
    if (ogTitleMatch) {
        result.title = ogTitleMatch[1].trim();
    }
    
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                       html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["'][^>]*>/i);
    if (ogDescMatch) {
        result.description = ogDescMatch[1].trim();
    }
    
    // Fallback to meta description
    if (!result.description) {
        const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                           html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
        if (metaDescMatch) {
            result.description = metaDescMatch[1].trim();
        }
    }
    
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["'][^>]*>/i);
    if (ogImageMatch) {
        let imageUrl = ogImageMatch[1].trim();
        // Resolve relative URLs
        if (imageUrl.startsWith('/')) {
            const base = new URL(baseUrl);
            imageUrl = `${base.protocol}//${base.host}${imageUrl}`;
        } else if (!imageUrl.startsWith('http')) {
            const base = new URL(baseUrl);
            imageUrl = new URL(imageUrl, base).href;
        }
        result.image = imageUrl;
    }
    
    return result;
}

async function fetchUrlPreviewMetadata(targetUrl) {
    try {
        const parsedUrl = new URL(targetUrl);
        
        // Only support http/https
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return null;
        }
        
        const response = await fetchUrl(targetUrl);
        const contentType = response.headers['content-type'] || '';
        
        // Handle direct image links
        if (ALLOWED_IMAGE_TYPES.has(contentType.split(';')[0])) {
            return {
                url: targetUrl,
                title: null,
                description: null,
                image: targetUrl
            };
        }
        
        // Handle HTML pages
        if (contentType.includes('text/html')) {
            const metadata = parseOpenGraph(response.data, targetUrl);
            
            // Only return if we have at least a title or description
            if (metadata.title || metadata.description) {
                return metadata;
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Failed to fetch preview for ${targetUrl}:`, error.message);
        return null;
    }
}

// API: URL preview endpoint
app.get('/api/url-preview', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid url parameter' });
    }
    
    try {
        const metadata = await fetchUrlPreviewMetadata(targetUrl);
        
        if (!metadata) {
            return res.status(204).send();
        }
        
        res.json(metadata);
    } catch (error) {
        console.error('URL preview error:', error);
        res.status(500).json({ error: 'Failed to fetch URL preview' });
    }
});

// Serve static files from build directory (PWA assets)
app.use(express.static(path.join(__dirname, 'build')));

// SPA fallback: serve index.html for all non-API routes
// This enables client-side routing to work for direct URL access
app.get('*', (req, res) => {
    // Don't serve index.html for asset files - return 404 instead
    // This prevents MIME type errors when service worker cache misses
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|json|webmanifest)$/)) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
