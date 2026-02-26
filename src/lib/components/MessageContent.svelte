<script lang="ts">
    import { onMount } from 'svelte';
    import { getUrlPreviewApiUrl } from '$lib/core/UrlPreviewApi';
    import { IntersectionObserverManager } from '$lib/utils/observers';
    import AudioWaveformPlayer from './AudioWaveformPlayer.svelte';
    import LocationMap from './LocationMap.svelte';
    import YouTubeEmbed from './YouTubeEmbed.svelte';
    import { extractYouTubeVideoId, isYouTubeUrl } from '$lib/core/YouTube';
    import { decryptAesGcmToBytes } from '$lib/core/FileEncryption';
    import { DecryptionScheduler } from '$lib/core/DecryptionScheduler';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { profileResolver } from '$lib/core/ProfileResolver';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { buildBlossomCandidateUrls, extractBlossomSha256FromUrl } from '$lib/core/BlossomRetrieval';
    import { loadFromMediaCache, isMediaCacheEnabled, fetchDecryptAndSaveToGallery } from '$lib/core/AndroidMediaCache';
    import { decode as decodeBlurhash } from 'blurhash';
    import { generateVideoPoster } from '$lib/utils/mediaMetadata';
    import { nip19 } from 'nostr-tools';
    import { t } from '$lib/i18n';
    import { openProfileModal } from '$lib/stores/modals';
    import GenericFileDisplay from './GenericFileDisplay.svelte';

    let {
        content,
        highlight = undefined,
        isOwn = false,
        onImageClick,
        fileUrl = undefined,
        fileType = undefined,
        fileSize = undefined,
        fileEncryptionAlgorithm = undefined,
        fileKey = undefined,
        fileNonce = undefined,
        authorNpub = undefined,
        onMediaLoad = undefined,
        location = undefined,
        forceEagerLoad = false,
        fileWidth = undefined,
        fileHeight = undefined,
        fileBlurhash = undefined
    } = $props<{
        content: string;
        highlight?: string;
        isOwn?: boolean;
        onImageClick?: (url: string, originalUrl?: string | null) => void;
        fileUrl?: string;
        fileType?: string;
        fileSize?: number;
        fileEncryptionAlgorithm?: string;
        fileKey?: string;
        fileNonce?: string;
        authorNpub?: string;
        onMediaLoad?: () => void;
        location?: { latitude: number; longitude: number };
        forceEagerLoad?: boolean;
        fileWidth?: number;
        fileHeight?: number;
        fileBlurhash?: string;
    }>();

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const npubRegex = /(nostr:npub1[a-z0-9]{58,}|npub1[a-z0-9]{58,})/g;

    function escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function extractNpub(match: string): string {
        return match.startsWith('nostr:') ? match.slice('nostr:'.length) : match;
    }

    function truncateNpub(npub: string): string {
        if (npub.length <= 16) return npub;
        return `${npub.slice(0, 8)}...${npub.slice(-3)}`;
    }

    function isValidNpub(npub: string): boolean {
        try {
            const decoded = nip19.decode(npub);
            return decoded.type === 'npub';
        } catch {
            return false;
        }
    }

    // Extract unique valid npubs from content
    const contentNpubs = $derived((() => {
        const matches = content.match(npubRegex);
        if (!matches) return [] as string[];
        const unique = new Set<string>();
        for (const m of matches) {
            const npub = extractNpub(m);
            if (isValidNpub(npub)) {
                unique.add(npub);
            }
        }
        return Array.from(unique).slice(0, 20);
    })());

    // Reactive display-name map from profile cache
    let npubDisplayNames = $state<Map<string, string>>(new Map());

    $effect(() => {
        const npubs = contentNpubs;
        if (npubs.length === 0) {
            npubDisplayNames = new Map();
            return;
        }

        const newMap = new Map<string, string>();

        (async () => {
            const uncached: string[] = [];

            // Phase 1: Check cache for all npubs
            for (const npub of npubs) {
                try {
                    const profile = await profileRepo.getProfileIgnoreTTL(npub);
                    if (profile?.metadata) {
                        const name = resolveDisplayName(profile.metadata, npub);
                        newMap.set(npub, name);
                    } else {
                        uncached.push(npub);
                    }
                } catch { /* ignore */ }
            }

            // Update immediately with whatever we found in cache
            npubDisplayNames = new Map(newMap);

            // Phase 2: Fetch uncached profiles from relays
            if (uncached.length > 0) {
                await Promise.allSettled(
                    uncached.map(npub => profileResolver.resolveProfile(npub, true))
                );

                // Phase 3: Re-read resolved profiles from cache
                for (const npub of uncached) {
                    try {
                        const profile = await profileRepo.getProfileIgnoreTTL(npub);
                        if (profile?.metadata) {
                            const name = resolveDisplayName(profile.metadata, npub);
                            newMap.set(npub, name);
                        }
                    } catch { /* ignore */ }
                }

                npubDisplayNames = new Map(newMap);
            }
        })();
    });

    function getNpubDisplayLabel(npub: string): string {
        const name = npubDisplayNames.get(npub);
        return name ? `@${escapeHtml(name)}` : `@${truncateNpub(npub)}`;
    }

    function replaceNpubsWithMentions(html: string): string {
        return html.replace(npubRegex, (match) => {
            const npub = extractNpub(match);
            if (!isValidNpub(npub)) return escapeHtml(match);
            const label = getNpubDisplayLabel(npub);
            const ownClass = isOwn
                ? 'text-blue-100 hover:text-white'
                : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300';
            return `<a href="#" data-npub="${escapeHtml(npub)}" class="npub-mention underline cursor-pointer font-medium ${ownClass}">${label}</a>`;
        });
    }

    function isImage(url: string) {
        try {
            const u = new URL(url);
            return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u.pathname);
        } catch {
            return false;
        }
    }

    function isVideo(url: string) {
        try {
            const u = new URL(url);
            return /\.(mp4|webm|mov|ogg)$/i.test(u.pathname);
        } catch {
            return false;
        }
    }

    function isAudio(url: string) {
        try {
            const u = new URL(url);
            return /\.mp3$/i.test(u.pathname);
        } catch {
            return false;
        }
    }

    function isImageMime(mime?: string) {
        return !!mime && mime.startsWith('image/');
    }

    function isVideoMime(mime?: string) {
        return !!mime && mime.startsWith('video/');
    }

    function isAudioMime(mime?: string) {
        return !!mime && mime.startsWith('audio/');
    }

    function isGenericFileMime(mime?: string) {
        if (!mime) return false;
        // It's a generic file if it's not image, video, or audio
        return !isImageMime(mime) && !isVideoMime(mime) && !isAudioMime(mime);
    }
 
    function parseInlineMarkdown(text: string): string {
        // Process strikethrough first (~~text~~)
        text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
        
        // Process bold (**text** or __text__)
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        
        // Process italic (*text* or _text_)
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        return text;
    }

    function parseMarkdown(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Check for citation block (> text or > or >)
            if (/^>( .*)?$/.test(line)) {
                const citeLines: string[] = [];
                while (i < lines.length && /^>( .*)?$/.test(lines[i])) {
                    citeLines.push(lines[i].replace(/^> ?/, '')); // Remove "> " or ">"
                    i++;
                }
                // Recursively parse to handle nested citations and other block elements
                const citeContent = parseMarkdown(citeLines.join('\n'));
                result.push(`<blockquote class="border-s-2 border-gray-400 dark:border-slate-500 bg-gray-100/50 dark:bg-slate-800/50 ps-3 pe-3 py-1 my-1 rounded-e text-gray-700 dark:text-slate-300">${citeContent}</blockquote>`);
                continue;
            }

            // Check for unordered list (- item or * item)
            if (/^[-*] .+/.test(line)) {
                const listItems: string[] = [];
                while (i < lines.length && /^[-*] .+/.test(lines[i])) {
                    listItems.push(lines[i].substring(2)); // Remove "- " or "* "
                    i++;
                }
                const listContent = listItems.map(item => `<li>${parseInlineMarkdown(item)}</li>`).join('');
                result.push(`<ul class="list-disc ps-5 my-1">${listContent}</ul>`);
                continue;
            }

            // Check for ordered list (1. item, 2. item, etc.)
            if (/^\d+\. .+/.test(line)) {
                const listItems: string[] = [];
                while (i < lines.length && /^\d+\. .+/.test(lines[i])) {
                    listItems.push(lines[i].replace(/^\d+\. /, '')); // Remove "N. "
                    i++;
                }
                const listContent = listItems.map(item => `<li>${parseInlineMarkdown(item)}</li>`).join('');
                result.push(`<ol class="list-decimal ps-5 my-1">${listContent}</ol>`);
                continue;
            }

            // Regular line - apply inline markdown
            result.push(parseInlineMarkdown(line));
            i++;
        }

        return result.join('\n');
    }

    const highlightNeedle = $derived((highlight ?? '').trim());



    function escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function applyHighlightToHtml(html: string, needle: string): string {
        if (!needle) {
            return html;
        }

        if (typeof window === 'undefined') {
            return html;
        }

        try {
            const regex = new RegExp(escapeRegExp(needle), 'gi');
            const parser = new DOMParser();
            const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
            const root = doc.body.firstElementChild;

            if (!root) {
                return html;
            }

            const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            const textNodes: Text[] = [];

            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.nodeType === Node.TEXT_NODE) {
                    textNodes.push(node as Text);
                }
            }

            const markClass = 'bg-yellow-200/70 dark:bg-yellow-400/20 rounded px-0.5';

            for (const textNode of textNodes) {
                const text = textNode.nodeValue ?? '';
                regex.lastIndex = 0;

                if (!regex.test(text)) {
                    continue;
                }

                regex.lastIndex = 0;
                const fragment = doc.createDocumentFragment();
                let lastIndex = 0;
                let match: RegExpExecArray | null;

                while ((match = regex.exec(text)) !== null) {
                    const start = match.index;
                    const end = start + match[0].length;

                    if (start > lastIndex) {
                        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, start)));
                    }

                    const mark = doc.createElement('mark');
                    mark.setAttribute('class', markClass);
                    mark.textContent = text.slice(start, end);
                    fragment.appendChild(mark);

                    lastIndex = end;
                }

                if (lastIndex < text.length) {
                    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
                }

                textNode.parentNode?.replaceChild(fragment, textNode);
            }

            return root.innerHTML;
        } catch {
            return html;
        }
    }

    function getFirstNonMediaUrl(text: string): string | null {
        const matches = text.match(urlRegex) ?? [];
        for (const candidate of matches) {
            if (!isImage(candidate) && !isVideo(candidate) && !isAudio(candidate) && !isYouTubeUrl(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    function getUrlPreviewsEnabled(): boolean {
        if (typeof window === 'undefined') {
            return true;
        }
        try {
            const raw = localStorage.getItem('nospeak-settings');
            if (!raw) {
                return true;
            }
            const parsed = JSON.parse(raw) as { urlPreviewsEnabled?: boolean };
            if (typeof parsed.urlPreviewsEnabled === 'boolean') {
                return parsed.urlPreviewsEnabled;
            }
            return true;
        } catch {
            return true;
        }
    }
    
    let parts = $derived(content.split(urlRegex));

    const youTubeEmbed = $derived((() => {
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part.match(/^https?:\/\//)) {
                continue;
            }

            const videoId = extractYouTubeVideoId(part);
            if (videoId) {
                return {
                    partIndex: i,
                    videoId
                };
            }
        }

        return null;
    })());
    
    // Check if the content is a single emoji
    // Emoji regex to match a single emoji character (including composite ones)
    const singleEmojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
    let isSingleEmoji = $derived(singleEmojiRegex.test(content.trim()));

    type UrlPreviewState = {
        url: string;
        title?: string;
        description?: string;
        image?: string;
        domain?: string;
    } | null;

    let preview = $state<UrlPreviewState>(null);
    let previewStatus = $state<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
    let previewUrl = $derived(fileUrl ? null : getFirstNonMediaUrl(content));
 
     let container: HTMLElement | null = null;
     let isVisible = $state(false);
     const youTubeEmbedsEnabled = $derived(typeof window !== 'undefined' && getUrlPreviewsEnabled() && isVisible);
     let lastPreviewUrl: string | null = null;
     let fetchTimeout: number | null = null;

     let decryptedUrl = $state<string | null>(null);
     let isDecrypting = $state(false);
     let decryptError = $state<string | null>(null);
     let mediaLoaded = $state(false);
     let blurhashCanvas = $state<HTMLCanvasElement | null>(null);
     let decryptAbortController: AbortController | null = null;

     const hasBlurhashPlaceholder = $derived(
         !!(fileWidth && fileHeight && fileBlurhash)
     );

    // Calculate display dimensions for blurhash placeholder
    // Uses same formula as container CSS: max-height 300px, width scaled proportionally
    const maxDisplayHeight = 300;
    const blurhashDisplayHeight = $derived(
        fileHeight ? Math.min(fileHeight, maxDisplayHeight) : 0
    );
    const blurhashDisplayWidth = $derived(
        fileWidth && fileHeight ? Math.round(fileWidth * blurhashDisplayHeight / fileHeight) : 0
    );

    function renderBlurhash(canvas: HTMLCanvasElement) {
        if (!fileBlurhash || !blurhashDisplayWidth || !blurhashDisplayHeight) return;
        try {
            const pixels = decodeBlurhash(fileBlurhash, blurhashDisplayWidth, blurhashDisplayHeight);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = blurhashDisplayWidth;
            canvas.height = blurhashDisplayHeight;
            const imageData = ctx.createImageData(blurhashDisplayWidth, blurhashDisplayHeight);
            imageData.data.set(pixels);
            ctx.putImageData(imageData, 0, 0);
        } catch {
            // Silently ignore decode errors
        }
    }

     function handleRealMediaLoad() {
         mediaLoaded = true;
         onMediaLoad?.();
     }

     $effect(() => {
         if (blurhashCanvas && fileBlurhash) {
             renderBlurhash(blurhashCanvas);
         }
     });

    // Generate a poster image from the first video frame for Android WebView,
    // which does not display a static preview frame natively.
    let videoPosterUrl = $state('');

    $effect(() => {
        const videoSrc = decryptedUrl ?? fileUrl ?? null;
        if (!videoSrc) return;
        if (!isVideoMime(fileType) && !isVideo(videoSrc)) return;

        generateVideoPoster(videoSrc).then((poster) => {
            videoPosterUrl = poster;
        });
    });
 
     onMount(() => {
        if (typeof window === 'undefined') return;
        if (!container) {
            // Fallback: treat as visible so web behavior remains unchanged
            isVisible = true;
            return;
        }

        const manager = IntersectionObserverManager.getInstance();
        manager.observe(container, (entry) => {
            isVisible = entry.isIntersecting;
        });

        return () => {
            if (container) manager.unobserve(container);
            if (fetchTimeout) clearTimeout(fetchTimeout);
            // Abort any in-flight decryption when component unmounts
            decryptAbortController?.abort();
            decryptAbortController = null;
        };
    });
 
    $effect(() => {
        if (!previewUrl) {
            preview = null;
            previewStatus = 'idle';
            lastPreviewUrl = null;
            if (fetchTimeout) clearTimeout(fetchTimeout);
            return;
        }
        if (!getUrlPreviewsEnabled()) {
            preview = null;
            previewStatus = 'idle';
            lastPreviewUrl = null;
            if (fetchTimeout) clearTimeout(fetchTimeout);
            return;
        }
        if (typeof window === 'undefined') {
            preview = null;
            previewStatus = 'idle';
            return;
        }

        // Reserve space immediately while waiting for visibility/fetch
        if (previewStatus === 'idle') {
            previewStatus = 'loading';
        }

        if (!isVisible) {
            if (fetchTimeout) {
                clearTimeout(fetchTimeout);
                fetchTimeout = null;
            }
            return;
        }
        if (lastPreviewUrl === previewUrl) {
            return;
        }

        // Debounce the fetch
        if (fetchTimeout) clearTimeout(fetchTimeout);
        
        fetchTimeout = window.setTimeout(() => {
            lastPreviewUrl = previewUrl;
    
            (async () => {
                try {
                    const response = await fetch(getUrlPreviewApiUrl(previewUrl));
                    if (!response.ok || response.status === 204) {
                        preview = null;
                        previewStatus = 'failed';
                        return;
                    }
                    const data = (await response.json()) as {
                        url: string;
                        title?: string;
                        description?: string;
                        image?: string;
                    };
    
                    if (!data || (!data.title && !data.description)) {
                        preview = null;
                        previewStatus = 'failed';
                        return;
                    }
    
                    const parsedUrl = new URL(previewUrl);
    
                    preview = {
                        url: data.url ?? previewUrl,
                        title: data.title ?? parsedUrl.hostname,
                        description: data.description,
                        image: data.image,
                        domain: parsedUrl.hostname
                    };
                    previewStatus = 'loaded';
                } catch {
                    preview = null;
                    previewStatus = 'failed';
                }
            })();
        }, 300); // 300ms debounce
    });

    const NOSPEAK_INTERNAL_MEDIA_ORIGIN = 'https://nospeak.chat';

    function isLegacyNospeakUserMediaUrl(url: string): boolean {
        try {
            const u = new URL(url);
            return u.origin === NOSPEAK_INTERNAL_MEDIA_ORIGIN && u.pathname.startsWith('/api/user_media/');
        } catch {
            return false;
        }
    }

    async function fetchCiphertext(url: string): Promise<Uint8Array> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Download failed with status ${response.status}`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    async function getAuthorMediaServers(): Promise<string[]> {
        if (!authorNpub) {
            return [];
        }

        const cached = await profileRepo.getProfileIgnoreTTL(authorNpub);
        if (cached?.mediaServers?.length) {
            return cached.mediaServers;
        }

        try {
            await profileResolver.resolveProfile(authorNpub, true);
        } catch {
            // Best-effort; fallback will be skipped if servers remain empty.
        }

        const refreshed = await profileRepo.getProfileIgnoreTTL(authorNpub);
        return refreshed?.mediaServers ?? [];
    }

    async function buildCandidateUrls(originalUrl: string): Promise<string[]> {
        const urls = [originalUrl];
        const extracted = extractBlossomSha256FromUrl(originalUrl);
        if (!extracted) return urls;

        try {
            const servers = await getAuthorMediaServers();
            if (servers.length === 0) return urls;

            const withExt = buildBlossomCandidateUrls({
                servers,
                sha256: extracted.sha256,
                extension: extracted.extension,
            });
            const withoutExt = extracted.extension
                ? buildBlossomCandidateUrls({ servers, sha256: extracted.sha256, extension: '' })
                : [];

            return Array.from(new Set([originalUrl, ...withExt, ...withoutExt]));
        } catch {
            return urls;
        }
    }

    // Auto-decrypt encrypted attachments when the message is visible in the viewport.
    // Uses DecryptionScheduler to limit concurrency and cache decrypted blob URLs.
    $effect(() => {
        if (!fileUrl || fileEncryptionAlgorithm !== 'aes-gcm' || !fileKey || !fileNonce) {
            return;
        }
        if (isLegacyNospeakUserMediaUrl(fileUrl)) {
            return;
        }
        if (decryptedUrl || decryptError) {
            return;
        }
        if (!isVisible) {
            // Abort any in-flight decrypt when scrolling out of view
            if (decryptAbortController) {
                decryptAbortController.abort();
                decryptAbortController = null;
            }
            return;
        }

        // Abort any previous request (shouldn't happen, but defensive)
        decryptAbortController?.abort();
        decryptAbortController = new AbortController();

        // Fire and forget; errors are captured inside
        void enqueueDecryption(decryptAbortController.signal);
    });

    async function enqueueDecryption(signal: AbortSignal) {
        if (!fileUrl || fileEncryptionAlgorithm !== 'aes-gcm' || !fileKey || !fileNonce) {
            return;
        }

        const url = fileUrl;
        const key = fileKey;
        const nonce = fileNonce;
        const mimeType = fileType || 'application/octet-stream';

        try {
            isDecrypting = true;
            decryptError = null;

            const scheduler = DecryptionScheduler.getInstance();

            const mediaCacheEnabled = isMediaCacheEnabled();

            const blobUrl = await scheduler.enqueue({
                key: url,
                signal,
                decrypt: async (innerSignal: AbortSignal) => {
                    // Check Android gallery cache first (if enabled)
                    if (mediaCacheEnabled) {
                        const extracted = extractBlossomSha256FromUrl(url);
                        if (extracted?.sha256) {
                            const cached = await loadFromMediaCache(extracted.sha256, mimeType);
                            if (cached.found && cached.url) {
                                return cached.url;
                            }
                        }
                    }

                    // Abort check before building candidate URLs
                    if (innerSignal.aborted) {
                        throw new DOMException('Aborted', 'AbortError');
                    }

                    // Build Blossom candidate URLs for server fallback
                    const candidateUrls = await buildCandidateUrls(url);

                    // Abort check after candidate URL resolution
                    if (innerSignal.aborted) {
                        throw new DOMException('Aborted', 'AbortError');
                    }

                    // Offload fetch + decrypt + Blob creation to Web Worker.
                    // Worker tries each candidate URL until one succeeds.
                    const result = await scheduler.decryptInWorker(
                        { urls: candidateUrls, key, nonce, mimeType },
                        innerSignal,
                        // Fallback: main-thread decryption if worker unavailable
                        async (fallbackSignal: AbortSignal) => {
                            if (fallbackSignal.aborted) {
                                throw new DOMException('Aborted', 'AbortError');
                            }
                            let ciphertextBuffer: Uint8Array | null = null;
                            let lastError: unknown = null;
                            for (const candidateUrl of candidateUrls) {
                                try {
                                    ciphertextBuffer = await fetchCiphertext(candidateUrl);
                                    break;
                                } catch (e) {
                                    if ((e as Error).name === 'AbortError') throw e;
                                    lastError = e;
                                }
                            }
                            if (!ciphertextBuffer) {
                                throw lastError ?? new Error('All URLs failed');
                            }
                            if (fallbackSignal.aborted) {
                                throw new DOMException('Aborted', 'AbortError');
                            }
                            const plainBytes = await decryptAesGcmToBytes(ciphertextBuffer, key, nonce);
                            const blob = new Blob([plainBytes.buffer as ArrayBuffer], { type: mimeType });
                            const fallbackBlobUrl = URL.createObjectURL(blob);
                            return { blobUrl: fallbackBlobUrl };
                        },
                    );

                    // Fire-and-forget: Java fetches, decrypts, and saves to gallery independently.
                    // This is completely decoupled from the display blob URL above.
                    if (mediaCacheEnabled) {
                        const extracted = extractBlossomSha256FromUrl(url);
                        if (extracted?.sha256) {
                            fetchDecryptAndSaveToGallery(candidateUrls, key, nonce, extracted.sha256, mimeType)
                                .catch((err: unknown) => console.warn('Failed to save media to gallery:', err));
                        }
                    }

                    return result.blobUrl;
                },
            });

            decryptedUrl = blobUrl;
        } catch (e) {
            // Don't set error state for intentional cancellations
            if ((e as Error).name === 'AbortError') {
                return;
            }
            decryptError = (e as Error).message;
        } finally {
            isDecrypting = false;
        }
    }

    function handleNpubInteraction(e: MouseEvent | KeyboardEvent) {
        if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
        const target = (e.target as HTMLElement).closest('a[data-npub]');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            const npub = target.getAttribute('data-npub');
            if (npub) openProfileModal(npub);
        }
    }
 </script>
 
 <!-- svelte-ignore a11y_no_static_element_interactions -->
 <div bind:this={container} onclick={handleNpubInteraction} onkeydown={handleNpubInteraction} class={`whitespace-pre-wrap break-anywhere leading-relaxed ${isSingleEmoji ? 'text-4xl' : ''}`}>

    {#if location}
        <div class="my-1">
            <div class="flex items-center gap-2 typ-meta text-xs font-semibold text-gray-600 dark:text-slate-300 leading-none">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{$t('modals.locationPreview.title')}</span>
            </div>

            <LocationMap latitude={location.latitude} longitude={location.longitude} />
        </div>
     {:else if fileUrl && fileEncryptionAlgorithm === 'aes-gcm' && fileKey && fileNonce}
          <div class="space-y-2">
              {#if isLegacyNospeakUserMediaUrl(fileUrl)}
                  <div class="my-1 px-3 py-2 rounded-xl bg-gray-100/70 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/60">
                      <div class="typ-meta text-xs text-gray-600 dark:text-slate-300">
                          {$t('chat.mediaUnavailable')}
                      </div>
                  </div>
              {:else if decryptedUrl}

                 {#if isImageMime(fileType) || isImage(decryptedUrl)}
                     {#if hasBlurhashPlaceholder}
                         <div class="my-1 relative overflow-hidden rounded" style="max-width: {blurhashDisplayWidth}px;">
                             {#if !mediaLoaded}
                                 <canvas bind:this={blurhashCanvas} width={blurhashDisplayWidth} height={blurhashDisplayHeight} class="block w-full h-auto rounded"></canvas>
                             {/if}
                             {#if onImageClick}
                                 <button
                                     type="button"
                                     class="{mediaLoaded ? 'relative' : 'absolute inset-0'} block w-full h-full cursor-zoom-in"
                                     onclick={() => onImageClick?.(decryptedUrl!, fileUrl)}
                                 >
                                     <img src={decryptedUrl} alt="Attachment" class="w-full h-full object-contain rounded" loading={forceEagerLoad ? "eager" : "lazy"} onload={handleRealMediaLoad} />
                                 </button>
                             {:else}
                                 <a href={decryptedUrl} target="_blank" rel="noopener noreferrer" class="{mediaLoaded ? 'relative' : 'absolute inset-0'} block w-full h-full">
                                     <img src={decryptedUrl} alt="Attachment" class="w-full h-full object-contain rounded" loading={forceEagerLoad ? "eager" : "lazy"} onload={handleRealMediaLoad} />
                                 </a>
                             {/if}
                         </div>
                     {:else}
                      {#if onImageClick}
                          <button
                              type="button"
                              class="block my-1 cursor-zoom-in"
                              onclick={() => onImageClick?.(decryptedUrl!, fileUrl)}
                          >
                              <img src={decryptedUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading={forceEagerLoad ? "eager" : "lazy"} onload={() => onMediaLoad?.()} />
                          </button>

                     {:else}
                         <a href={decryptedUrl} target="_blank" rel="noopener noreferrer" class="block my-1">
                             <img src={decryptedUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading={forceEagerLoad ? "eager" : "lazy"} onload={() => onMediaLoad?.()} />
                         </a>
                     {/if}
                     {/if}
                 {:else if isVideoMime(fileType) || isVideo(decryptedUrl)}
                     <!-- svelte-ignore a11y_media_has_caption -->
                     {#if hasBlurhashPlaceholder}
                         <div class="my-1 relative overflow-hidden rounded" style="max-width: {blurhashDisplayWidth}px;">
                             {#if !mediaLoaded}
                                 <canvas bind:this={blurhashCanvas} width={blurhashDisplayWidth} height={blurhashDisplayHeight} class="block w-full h-auto rounded"></canvas>
                             {/if}
                             <video controls src={decryptedUrl} poster={videoPosterUrl || undefined} class="{mediaLoaded ? 'relative' : 'absolute inset-0'} w-full h-full rounded" preload="metadata" onloadedmetadata={handleRealMediaLoad}></video>
                         </div>
                     {:else}
                     <div class="my-1">
                         <video controls src={decryptedUrl} poster={videoPosterUrl || undefined} class="max-w-full rounded max-h-[300px]" preload="metadata" onloadedmetadata={() => onMediaLoad?.()}></video>
                     </div>
                     {/if}
              {:else if isAudioMime(fileType) || isAudio(decryptedUrl)}
                      <div class="mb-1">
                          <AudioWaveformPlayer url={decryptedUrl} isOwn={isOwn} />
                      </div>
                 {:else if isGenericFileMime(fileType)}
                     <GenericFileDisplay
                         fileType={fileType ?? 'application/octet-stream'}
                         fileSize={fileSize}
                         fileUrl={fileUrl}
                         decryptedUrl={decryptedUrl}
                         isDecrypting={false}
                         isOwn={isOwn}
                     />
                 {:else}
                     <a href={decryptedUrl} target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80 break-all">Download attachment</a>
                 {/if}
             {:else}
                 {#if hasBlurhashPlaceholder}
                     <div class="my-1 relative overflow-hidden rounded" style="max-width: {blurhashDisplayWidth}px;">
                         <canvas bind:this={blurhashCanvas} width={blurhashDisplayWidth} height={blurhashDisplayHeight} class="block w-full h-auto rounded"></canvas>
                         {#if isDecrypting}
                             <div class="absolute inset-0 flex items-center justify-center">
                                 <div class="typ-meta text-xs text-white/80 bg-black/30 px-2 py-1 rounded">Decrypting...</div>
                             </div>
                         {:else if decryptError}
                             <div class="absolute inset-0 flex items-center justify-center">
                                 <div class="typ-meta text-xs text-red-200 bg-black/30 px-2 py-1 rounded">{decryptError}</div>
                             </div>
                         {/if}
                     </div>
                 {:else if isGenericFileMime(fileType)}
                 <!-- Generic file display while decrypting -->
                 <GenericFileDisplay
                     fileType={fileType ?? 'application/octet-stream'}
                     fileSize={fileSize}
                     fileUrl={fileUrl}
                     decryptedUrl={null}
                     isDecrypting={isDecrypting}
                     isOwn={isOwn}
                     onDownload={() => {
                         decryptAbortController?.abort();
                         decryptAbortController = new AbortController();
                         void enqueueDecryption(decryptAbortController.signal);
                     }}
                 />
                 {#if decryptError}
                     <div class="typ-meta text-xs text-red-500 mt-1">{decryptError}</div>
                 {/if}
             {:else}
                 {#if isDecrypting}
                     <div class="typ-meta text-xs text-gray-500 dark:text-slate-400">Decrypting attachment...</div>
                 {:else if decryptError}
                     <div class="typ-meta text-xs text-red-500">{decryptError}</div>
                 {/if}
                 {/if}
             {/if}
         </div>
     {:else if fileUrl}
          <div class="space-y-2">
              {#if isLegacyNospeakUserMediaUrl(fileUrl)}
                  <div class="my-1 px-3 py-2 rounded-xl bg-gray-100/70 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/60">
                      <div class="typ-meta text-xs text-gray-600 dark:text-slate-300">
                          {$t('chat.mediaUnavailable')}
                      </div>
                  </div>
              {:else if isImageMime(fileType) || isImage(fileUrl)}
                 {#if hasBlurhashPlaceholder}
                     <div class="my-1 relative overflow-hidden rounded" style="max-width: {blurhashDisplayWidth}px;">
                         {#if !mediaLoaded}
                             <canvas bind:this={blurhashCanvas} width={blurhashDisplayWidth} height={blurhashDisplayHeight} class="block w-full h-auto rounded"></canvas>
                         {/if}
                         {#if onImageClick}
                             <button
                                 type="button"
                                 class="{mediaLoaded ? 'relative' : 'absolute inset-0'} block w-full h-full cursor-zoom-in"
                                 onclick={() => onImageClick?.(fileUrl!, fileUrl)}
                             >
                                 <img src={fileUrl} alt="Attachment" class="w-full h-full object-contain rounded" loading={forceEagerLoad ? "eager" : "lazy"} onload={handleRealMediaLoad} />
                             </button>
                         {:else}
                             <a href={fileUrl} target="_blank" rel="noopener noreferrer" class="{mediaLoaded ? 'relative' : 'absolute inset-0'} block w-full h-full">
                                 <img src={fileUrl} alt="Attachment" class="w-full h-full object-contain rounded" loading={forceEagerLoad ? "eager" : "lazy"} onload={handleRealMediaLoad} />
                             </a>
                         {/if}
                     </div>
                 {:else}
                 {#if onImageClick}
                     <button
                         type="button"
                         class="block my-1 cursor-zoom-in"
                         onclick={() => onImageClick?.(fileUrl!, fileUrl)}
                     >
                         <img src={fileUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading={forceEagerLoad ? "eager" : "lazy"} onload={() => onMediaLoad?.()} />
                     </button>
                 {:else}
                     <a href={fileUrl} target="_blank" rel="noopener noreferrer" class="block my-1">
                         <img src={fileUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading={forceEagerLoad ? "eager" : "lazy"} onload={() => onMediaLoad?.()} />
                     </a>
                 {/if}
                 {/if}
             {:else if isVideoMime(fileType) || isVideo(fileUrl)}
                 <!-- svelte-ignore a11y_media_has_caption -->
                 {#if hasBlurhashPlaceholder}
                     <div class="my-1 relative overflow-hidden rounded" style="max-width: {blurhashDisplayWidth}px;">
                         {#if !mediaLoaded}
                             <canvas bind:this={blurhashCanvas} width={blurhashDisplayWidth} height={blurhashDisplayHeight} class="block w-full h-auto rounded"></canvas>
                         {/if}
                         <video controls src={fileUrl} poster={videoPosterUrl || undefined} class="{mediaLoaded ? 'relative' : 'absolute inset-0'} w-full h-full rounded" preload="metadata" onloadedmetadata={handleRealMediaLoad}></video>
                     </div>
                 {:else}
                 <div class="my-1">
                     <video controls src={fileUrl} poster={videoPosterUrl || undefined} class="max-w-full rounded max-h-[300px]" preload="metadata" onloadedmetadata={() => onMediaLoad?.()}></video>
                 </div>
                 {/if}
              {:else if isAudioMime(fileType) || isAudio(fileUrl)}
                  <div class="mb-1">
                      <AudioWaveformPlayer url={fileUrl} isOwn={isOwn} />
                  </div>
             {:else if isGenericFileMime(fileType)}
                 <!-- Non-encrypted generic file (direct URL) -->
                 <GenericFileDisplay
                     fileType={fileType ?? 'application/octet-stream'}
                     fileSize={fileSize}
                     fileUrl={fileUrl}
                     decryptedUrl={fileUrl}
                     isDecrypting={false}
                     isOwn={isOwn}
                 />
             {:else}
                 <a href={fileUrl} target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80 break-all">Download attachment</a>
             {/if}
         </div>
     {:else}
         {#each parts as part, i}
              {#if part.match(/^https?:\/\//)}
                   {#if youTubeEmbed && youTubeEmbedsEnabled && i === youTubeEmbed.partIndex}
                       <YouTubeEmbed videoId={youTubeEmbed.videoId} />
                   {:else if isLegacyNospeakUserMediaUrl(part)}
                       <div class="my-1 px-3 py-2 rounded-xl bg-gray-100/70 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/60">
                           <div class="typ-meta text-xs text-gray-600 dark:text-slate-300">
                               {$t('chat.mediaUnavailable')}
                           </div>
                       </div>
                   {:else if isImage(part)}


                      {#if onImageClick}
                          <button
                              type="button"
                              class="block my-1 cursor-zoom-in"
                              onclick={() => onImageClick?.(part, part)}
                          >

                             <img src={part} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading={forceEagerLoad ? "eager" : "lazy"} onload={() => onMediaLoad?.()} />
                         </button>
                     {:else}
                         <a href={part} target="_blank" rel="noopener noreferrer" class="block my-1">
                             <img src={part} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading={forceEagerLoad ? "eager" : "lazy"} onload={() => onMediaLoad?.()} />
                         </a>
                     {/if}
                 {:else if isVideo(part)}
                     <!-- svelte-ignore a11y_media_has_caption -->
                     <div class="my-1">
                         <video controls src={part} class="max-w-full rounded max-h-[300px]" preload="metadata" onloadedmetadata={() => onMediaLoad?.()}></video>
                     </div>
                  {:else if isAudio(part)}
                      <div class="mb-1">
                          <AudioWaveformPlayer url={part} isOwn={isOwn} />
                      </div>
                 {:else}
                     <a href={part} target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80 break-all">{part}</a>
                 {/if}
             {:else}
                  <span>{@html applyHighlightToHtml(replaceNpubsWithMentions(parseMarkdown(part)), highlightNeedle)}</span>
             {/if}
         {/each}

         {#if preview}
            <div class="mt-2 mb-1 overflow-hidden break-anywhere">
                <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block w-full max-w-full focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 overflow-hidden rounded-xl bg-white/20 dark:bg-slate-800/50 md:bg-white/10 md:dark:bg-slate-800/30 md:backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 hover:bg-white/20 dark:hover:bg-slate-800/50 transition-colors"
                >
                    <div class="flex flex-col sm:flex-row gap-0 sm:gap-0 h-auto sm:h-28">
                        <div class="w-full sm:w-28 sm:shrink-0 h-32 sm:h-full bg-gray-100/50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden">
                            {#if preview.image}
                                <img src={preview.image} alt="" class="w-full h-full object-cover" loading={forceEagerLoad ? "eager" : "lazy"} onload={() => onMediaLoad?.()} />
                            {:else}
                                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                                </svg>
                            {/if}
                        </div>
                        <div class="min-w-0 p-3 flex flex-col justify-center overflow-hidden">
                             {#if preview.title}
                                 <h1 class="m-0 typ-section truncate text-gray-900 dark:text-white leading-tight mb-1">
                                     {preview.title}
                                 </h1>
                             {/if}
                             {#if preview.description}
                                 <p class={`m-0 typ-body leading-snug line-clamp-2 ${isOwn ? 'text-blue-100' : 'text-gray-600 dark:text-slate-300'}`}>
                                     {preview.description}
                                 </p>
                             {/if}
                             <div class={`typ-meta mt-1.5 opacity-70 truncate ${isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-slate-500'}`}>
                                 {preview.domain}
                             </div>
                         </div>
                     </div>
                 </a>
             </div>
         {:else if previewStatus === 'loading'}
            <!-- Skeleton placeholder: reserves space while URL preview loads -->
            <div class="mt-2 mb-1 overflow-hidden break-anywhere">
                <div class="block w-full max-w-full overflow-hidden rounded-xl bg-white/20 dark:bg-slate-800/50 md:bg-white/10 md:dark:bg-slate-800/30 md:backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
                    <div class="flex flex-col sm:flex-row gap-0 sm:gap-0 h-auto sm:h-28">
                        <div class="w-full sm:w-28 sm:shrink-0 h-32 sm:h-full bg-gray-200/50 dark:bg-slate-700/50 animate-pulse"></div>
                        <div class="min-w-0 p-3 flex flex-col justify-center gap-2 overflow-hidden">
                            <div class="h-4 w-3/4 rounded bg-gray-200/60 dark:bg-slate-700/60 animate-pulse"></div>
                            <div class="h-3 w-full rounded bg-gray-200/40 dark:bg-slate-700/40 animate-pulse"></div>
                            <div class="h-3 w-1/3 rounded bg-gray-200/30 dark:bg-slate-700/30 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
         {/if}
     {/if}
 </div>
