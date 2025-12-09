<script lang="ts">
    import { onMount } from 'svelte';
    import { getUrlPreviewApiUrl } from '$lib/core/UrlPreviewApi';

    let { content, isOwn = false } = $props<{ content: string; isOwn?: boolean }>();

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

    function getFirstNonMediaUrl(text: string): string | null {
        const matches = text.match(urlRegex) ?? [];
        for (const candidate of matches) {
            if (!isImage(candidate) && !isVideo(candidate)) {
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
    let lastPreviewUrl: string | null = null;

    onMount(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!('IntersectionObserver' in window) || !container) {
            // Fallback: treat as visible so web behavior remains unchanged
            isVisible = true;
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === container) {
                    isVisible = entry.isIntersecting;
                }
            }
        });

        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    });
 
    $effect(() => {
        if (!previewUrl) {
            preview = null;
            lastPreviewUrl = null;
            return;
        }
        if (!getUrlPreviewsEnabled()) {
            preview = null;
            lastPreviewUrl = null;
            return;
        }
        if (typeof window === 'undefined') {
            preview = null;
            return;
        }
        if (!isVisible) {
            return;
        }
        if (lastPreviewUrl === previewUrl) {
            return;
        }

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
    });
</script>
 
<div bind:this={container} class={`whitespace-pre-wrap break-words leading-relaxed ${isSingleEmoji ? 'text-4xl' : ''}`}>

    {#each parts as part}
        {#if part.match(/^https?:\/\//)}
            {#if isImage(part)}
                <a href={part} target="_blank" rel="noopener noreferrer" class="block my-1">
                    <img src={part} alt="Attachment" class="max-w-full rounded max-h-[300px] object-contain" loading="lazy" />
                </a>
            {:else if isVideo(part)}
                <!-- svelte-ignore a11y_media_has_caption -->
                <div class="my-1">
                    <video controls src={part} class="max-w-full rounded max-h-[300px]" preload="metadata"></video>
                </div>
            {:else}
                <a href={part} target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80 break-all">{part}</a>
            {/if}
        {:else}
            <span>{@html parseMarkdown(part)}</span>
        {/if}
    {/each}

    {#if preview}
        <div class="mt-2 mb-1">
            <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                class="block focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 overflow-hidden rounded-xl bg-white/10 dark:bg-slate-800/30 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 hover:bg-white/20 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div class="flex flex-col sm:flex-row gap-0 sm:gap-0 h-auto sm:h-28">
                    <div class="shrink-0 w-full sm:w-28 h-32 sm:h-full bg-gray-100/50 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden">
                        {#if preview.image}
                            <img src={preview.image} alt="" class="w-full h-full object-cover" loading="lazy" />
                        {:else}
                            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                            </svg>
                        {/if}
                    </div>
                    <div class="min-w-0 p-3 flex flex-col justify-center">
                        {#if preview.title}
                            <h1 class="m-0 text-sm font-semibold truncate text-gray-900 dark:text-white leading-tight mb-1">
                                {preview.title}
                            </h1>
                        {/if}
                        {#if preview.description}
                            <p class={`m-0 text-xs leading-snug line-clamp-2 ${isOwn ? 'text-blue-100' : 'text-gray-600 dark:text-slate-300'}`}>
                                {preview.description}
                            </p>
                        {/if}
                        <div class={`text-[10px] mt-1.5 opacity-70 truncate ${isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-slate-500'}`}>
                            {preview.domain}
                        </div>
                    </div>
                </div>
            </a>
        </div>
    {/if}
</div>
