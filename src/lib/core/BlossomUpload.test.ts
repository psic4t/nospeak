import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./BlossomAuth', () => ({
    buildBlossomUploadAuthHeader: vi.fn(async () => 'Nostr test')
}));

import { uploadToBlossomServers } from './BlossomUpload';

interface MockResponse {
    method: string;
    url: string;
    status: number;
    responseText?: string;
    headers?: Record<string, string>;
}

interface RecordedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
}

class MockXMLHttpRequest {
    public static responses: MockResponse[] = [];
    public static requests: RecordedRequest[] = [];

    public status: number = 0;
    public responseText: string = '';

    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public onabort: (() => void) | null = null;

    public upload = {
        addEventListener: () => undefined
    };

    private method: string | null = null;
    private url: string | null = null;
    private requestHeaders: Record<string, string> = {};
    private responseHeaders: Record<string, string> = {};

    public open(method: string, url: string): void {
        this.method = method;
        this.url = url;
    }

    public setRequestHeader(name: string, value: string): void {
        this.requestHeaders[name] = value;
    }

    public getResponseHeader(name: string): string | null {
        const key = Object.keys(this.responseHeaders).find((h) => h.toLowerCase() === name.toLowerCase());
        return key ? this.responseHeaders[key] : null;
    }

    public abort(): void {
        queueMicrotask(() => {
            this.onabort?.();
        });
    }

    public send(body: unknown): void {
        if (!this.method || !this.url) {
            throw new Error('MockXMLHttpRequest used without open()');
        }

        MockXMLHttpRequest.requests.push({
            method: this.method,
            url: this.url,
            headers: { ...this.requestHeaders },
            body
        });

        const responseIndex = MockXMLHttpRequest.responses.findIndex(
            (r) => r.method === this.method && r.url === this.url
        );

        if (responseIndex === -1) {
            queueMicrotask(() => {
                this.onerror?.();
            });
            return;
        }

        const response = MockXMLHttpRequest.responses.splice(responseIndex, 1)[0];
        this.status = response.status;
        this.responseText = response.responseText ?? '';
        this.responseHeaders = response.headers ?? {};

        queueMicrotask(() => {
            this.onload?.();
        });
    }

    public static respond(response: MockResponse): void {
        MockXMLHttpRequest.responses.push(response);
    }
}

async function flushAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function descriptorJson(url: string): string {
    return JSON.stringify({
        url,
        sha256: 'deadbeef',
        size: 1,
        type: 'application/octet-stream',
        uploaded: 0
    });
}

describe('uploadToBlossomServers mirroring', () => {
    const originalXhr = globalThis.XMLHttpRequest;

    beforeEach(() => {
        MockXMLHttpRequest.responses = [];
        MockXMLHttpRequest.requests = [];
        globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXhr;
    });

    it('mirrors to secondary server using PUT /mirror', async () => {
        MockXMLHttpRequest.respond({
            method: 'PUT',
            url: 'https://a/upload',
            status: 200,
            responseText: descriptorJson('https://a/file')
        });

        MockXMLHttpRequest.respond({
            method: 'PUT',
            url: 'https://b/mirror',
            status: 200,
            responseText: descriptorJson('https://b/file')
        });

        const blob = new Blob(['abc'], { type: 'text/plain' });

        const result = await uploadToBlossomServers({
            servers: ['https://a', 'https://b'],
            body: blob,
            mimeType: 'text/plain',
            sha256: 'deadbeef'
        });

        expect(result.url).toBe('https://a/file');

        await flushAsync();

        expect(MockXMLHttpRequest.requests).toHaveLength(2);
        expect(MockXMLHttpRequest.requests[0].url).toBe('https://a/upload');
        expect(MockXMLHttpRequest.requests[1].url).toBe('https://b/mirror');

        expect(MockXMLHttpRequest.requests[0].headers.Authorization).toBe('Nostr test');
        expect(MockXMLHttpRequest.requests[1].headers.Authorization).toBe('Nostr test');

        expect(MockXMLHttpRequest.requests[1].body).toBe(JSON.stringify({ url: 'https://a/file' }));
    });

    it('falls back to PUT /upload when /mirror is unsupported', async () => {
        MockXMLHttpRequest.respond({
            method: 'PUT',
            url: 'https://a/upload',
            status: 200,
            responseText: descriptorJson('https://a/file')
        });

        MockXMLHttpRequest.respond({
            method: 'PUT',
            url: 'https://b/mirror',
            status: 404,
            responseText: ''
        });

        MockXMLHttpRequest.respond({
            method: 'PUT',
            url: 'https://b/upload',
            status: 200,
            responseText: descriptorJson('https://b/file')
        });

        const blob = new Blob(['abc'], { type: 'text/plain' });

        const result = await uploadToBlossomServers({
            servers: ['https://a', 'https://b'],
            body: blob,
            mimeType: 'text/plain',
            sha256: 'deadbeef'
        });

        expect(result.url).toBe('https://a/file');

        await flushAsync();

        expect(MockXMLHttpRequest.requests.map((r) => r.url)).toEqual([
            'https://a/upload',
            'https://b/mirror',
            'https://b/upload'
        ]);
    });

    it('does not fall back to PUT /upload when /mirror fails with auth', async () => {
        MockXMLHttpRequest.respond({
            method: 'PUT',
            url: 'https://a/upload',
            status: 200,
            responseText: descriptorJson('https://a/file')
        });

        MockXMLHttpRequest.respond({
            method: 'PUT',
            url: 'https://b/mirror',
            status: 403,
            responseText: ''
        });

        const blob = new Blob(['abc'], { type: 'text/plain' });

        const result = await uploadToBlossomServers({
            servers: ['https://a', 'https://b'],
            body: blob,
            mimeType: 'text/plain',
            sha256: 'deadbeef'
        });

        expect(result.url).toBe('https://a/file');

        await flushAsync();

        expect(MockXMLHttpRequest.requests.map((r) => r.url)).toEqual(['https://a/upload', 'https://b/mirror']);
    });
});
