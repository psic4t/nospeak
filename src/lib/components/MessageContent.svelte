<script lang="ts">
    import { onMount } from 'svelte';
    import { getUrlPreviewApiUrl } from '$lib/core/UrlPreviewApi';
    import { IntersectionObserverManager } from '$lib/utils/observers';
    import AudioWaveformPlayer from './AudioWaveformPlayer.svelte';
    import YouTubeEmbed from './YouTubeEmbed.svelte';
    import { extractYouTubeVideoId, isYouTubeUrl } from '$lib/core/YouTube';
    import { decryptAesGcmToBytes } from '$lib/core/FileEncryption';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { profileResolver } from '$lib/core/ProfileResolver';
    import { buildBlossomCandidateUrls, extractBlossomSha256FromUrl } from '$lib/core/BlossomRetrieval';
    import { t } from '$lib/i18n';

    let {
        content,
        highlight = undefined,
        isOwn = false,
        onImageClick,
        fileUrl = undefined,
        fileType = undefined,
        fileEncryptionAlgorithm = undefined,
        fileKey = undefined,
        fileNonce = undefined,
        authorNpub = undefined,
        onMediaLoad = undefined
    } = $props<{
        content: string;
        highlight?: string;
        isOwn?: boolean;
        onImageClick?: (url: string, originalUrl?: string | null) => void;
        fileUrl?: string;
        fileType?: string;
        fileEncryptionAlgorithm?: string;
        fileKey?: string;
        fileNonce?: string;
        authorNpub?: string;
        onMediaLoad?: () => void;
    }>();

    const urlRegex = /(https?:\/\/[^\s]+)/g;

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
 
    function parseMarkdown(text: string) {

        // Process citations (> text)
        text = text.replace(/^> (.+)$/gm, '<div class="border-l-2 border-gray-300 pl-3 italic">$1</div>');
        
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
    let previewUrl = $derived(getFirstNonMediaUrl(content));
 
     let container: HTMLElement | null = null;
     let isVisible = $state(false);
     const youTubeEmbedsEnabled = $derived(typeof window !== 'undefined' && getUrlPreviewsEnabled() && isVisible);
     let lastPreviewUrl: string | null = null;
     let fetchTimeout: number | null = null;

     let decryptedUrl = $state<string | null>(null);
     let isDecrypting = $state(false);
     let decryptError = $state<string | null>(null);
 
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
        };
    });
 
    $effect(() => {
        if (!previewUrl) {
            preview = null;
            lastPreviewUrl = null;
            if (fetchTimeout) clearTimeout(fetchTimeout);
            return;
        }
        if (!getUrlPreviewsEnabled()) {
            preview = null;
            lastPreviewUrl = null;
            if (fetchTimeout) clearTimeout(fetchTimeout);
            return;
        }
        if (typeof window === 'undefined') {
            preview = null;
            return;
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
                } catch {
                    preview = null;
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

    async function fetchCiphertextWithBlossomFallback(originalUrl: string): Promise<Uint8Array> {
        const primaryUrl = originalUrl;

        try {
            return await fetchCiphertext(primaryUrl);
        } catch (e) {
            const extracted = extractBlossomSha256FromUrl(originalUrl);
            if (!extracted) {
                throw e;
            }

            const servers = await getAuthorMediaServers();
            if (servers.length === 0) {
                throw e;
            }

            const candidatesWithExtension = buildBlossomCandidateUrls({
                servers,
                sha256: extracted.sha256,
                extension: extracted.extension
            });
            const candidatesWithoutExtension = extracted.extension
                ? buildBlossomCandidateUrls({ servers, sha256: extracted.sha256, extension: '' })
                : [];

            const candidates = Array.from(
                new Set([
                    ...candidatesWithExtension,
                    ...candidatesWithoutExtension
                ])
            ).filter((candidate) => candidate !== primaryUrl);

            let lastError: unknown = e;
            for (const candidate of candidates) {
                try {
                    return await fetchCiphertext(candidate);
                } catch (inner) {
                    lastError = inner;
                }
            }

            throw lastError;
        }
    }

    // Auto-decrypt encrypted attachments when the message is visible in the viewport
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
            return;
        }
        // Fire and forget; errors are captured inside decryptAttachment
        void decryptAttachment();
    });

    async function decryptAttachment() {
        if (!fileUrl || fileEncryptionAlgorithm !== 'aes-gcm' || !fileKey || !fileNonce) {
            return;
        }
        if (isLegacyNospeakUserMediaUrl(fileUrl)) {
            return;
        }

        try {
            isDecrypting = true;
            decryptError = null;

            const ciphertextBuffer = await fetchCiphertextWithBlossomFallback(fileUrl);
            const plainBytes = await decryptAesGcmToBytes(ciphertextBuffer, fileKey, fileNonce);

            const blob = new Blob([plainBytes.buffer as ArrayBuffer], { type: fileType || 'application/octet-stream' });
            if (decryptedUrl) {
                URL.revokeObjectURL(decryptedUrl);
            }
            decryptedUrl = URL.createObjectURL(blob);
        } catch (e) {
            decryptError = (e as Error).message;
        } finally {
            isDecrypting = false;
        }
    }
 </script>
 
 <div bind:this={container} class={`whitespace-pre-wrap break-words leading-relaxed ${isSingleEmoji ? 'text-4xl' : ''}`}>

     {#if fileUrl && fileEncryptionAlgorithm === 'aes-gcm' && fileKey && fileNonce}
          <div class="space-y-2">
              {#if isLegacyNospeakUserMediaUrl(fileUrl)}
                  <div class="my-1 px-3 py-2 rounded-xl bg-gray-100/70 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/60">
                      <div class="typ-meta text-xs text-gray-600 dark:text-slate-300">
                          {$t('chat.mediaUnavailable')}
                      </div>
                  </div>
              {:else if decryptedUrl}

                 {#if isImageMime(fileType) || isImage(decryptedUrl)}
                      {#if onImageClick}
                          <button
                              type="button"
                              class="block my-1 cursor-zoom-in"
                              onclick={() => onImageClick?.(decryptedUrl!, fileUrl)}
                          >
                              <img src={decryptedUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading="lazy" onload={() => onMediaLoad?.()} />
                          </button>

                     {:else}
                         <a href={decryptedUrl} target="_blank" rel="noopener noreferrer" class="block my-1">
                             <img src={decryptedUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading="lazy" onload={() => onMediaLoad?.()} />
                         </a>
                     {/if}
                 {:else if isVideoMime(fileType) || isVideo(decryptedUrl)}
                     <!-- svelte-ignore a11y_media_has_caption -->
                     <div class="my-1">
                         <video controls src={decryptedUrl} class="max-w-full rounded max-h-[300px]" preload="metadata" onloadedmetadata={() => onMediaLoad?.()}></video>
                     </div>
                 {:else if isAudioMime(fileType) || isAudio(decryptedUrl)}
                     <div class="mt-2 mb-1">
                         <AudioWaveformPlayer url={decryptedUrl} isOwn={isOwn} />
                     </div>
                 {:else}
                     <a href={decryptedUrl} target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80 break-all">Download attachment</a>
                 {/if}
             {:else}
                 {#if isDecrypting}
                     <div class="typ-meta text-xs text-gray-500 dark:text-slate-400">Decrypting attachment...</div>
                 {:else if decryptError}
                     <div class="typ-meta text-xs text-red-500">{decryptError}</div>
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

                 {#if onImageClick}
                     <button
                         type="button"
                         class="block my-1 cursor-zoom-in"
                         onclick={() => onImageClick?.(fileUrl, fileUrl)}
                     >
                         <img src={fileUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading="lazy" onload={() => onMediaLoad?.()} />
                     </button>
                 {:else}
                     <a href={fileUrl} target="_blank" rel="noopener noreferrer" class="block my-1">
                         <img src={fileUrl} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading="lazy" onload={() => onMediaLoad?.()} />
                     </a>
                 {/if}
             {:else if isVideoMime(fileType) || isVideo(fileUrl)}
                 <!-- svelte-ignore a11y_media_has_caption -->
                 <div class="my-1">
                     <video controls src={fileUrl} class="max-w-full rounded max-h-[300px]" preload="metadata" onloadedmetadata={() => onMediaLoad?.()}></video>
                 </div>
             {:else if isAudioMime(fileType) || isAudio(fileUrl)}
                 <div class="mt-2 mb-1">
                     <AudioWaveformPlayer url={fileUrl} isOwn={isOwn} />
                 </div>
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

                             <img src={part} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading="lazy" onload={() => onMediaLoad?.()} />
                         </button>
                     {:else}
                         <a href={part} target="_blank" rel="noopener noreferrer" class="block my-1">
                             <img src={part} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading="lazy" onload={() => onMediaLoad?.()} />
                         </a>
                     {/if}
                 {:else if isVideo(part)}
                     <!-- svelte-ignore a11y_media_has_caption -->
                     <div class="my-1">
                         <video controls src={part} class="max-w-full rounded max-h-[300px]" preload="metadata" onloadedmetadata={() => onMediaLoad?.()}></video>
                     </div>
                 {:else if isAudio(part)}
                     <div class="mt-2 mb-1">
                         <AudioWaveformPlayer url={part} isOwn={isOwn} />
                     </div>
                 {:else}
                     <a href={part} target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80 break-all">{part}</a>
                 {/if}
             {:else}
                  <span>{@html applyHighlightToHtml(parseMarkdown(part), highlightNeedle)}</span>
             {/if}
         {/each}

         {#if preview}
            <div class="mt-2 mb-1 overflow-hidden">
                <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block w-full max-w-full focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 overflow-hidden rounded-xl bg-white/20 dark:bg-slate-800/50 md:bg-white/10 md:dark:bg-slate-800/30 md:backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 hover:bg-white/20 dark:hover:bg-slate-800/50 transition-colors"
                >
                    <div class="flex flex-col sm:flex-row gap-0 sm:gap-0 h-auto sm:h-28">
                        <div class="w-full sm:w-28 sm:shrink-0 h-32 sm:h-full bg-gray-100/50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden">
                            {#if preview.image}
                                <img src={preview.image} alt="" class="w-full h-full object-cover" loading="lazy" onload={() => onMediaLoad?.()} />
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
         {/if}
     {/if}
 </div>
