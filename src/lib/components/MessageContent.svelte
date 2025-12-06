<script lang="ts">
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

    $effect(() => {
        if (!previewUrl) {
            preview = null;
            return;
        }
        if (!getUrlPreviewsEnabled()) {
            preview = null;
            return;
        }
        if (typeof window === 'undefined') {
            preview = null;
            return;
        }

        (async () => {
            try {
                const response = await fetch(`/api/url-preview?url=${encodeURIComponent(previewUrl)}`);
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

<div class={`whitespace-pre-wrap break-words leading-relaxed ${isSingleEmoji ? 'text-4xl' : ''}`}>
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
        <div class="mt-1 mb-1 border-t border-gray-200/70 dark:border-slate-800/70"></div>
        <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            class="block focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70"
        >
            <div class="flex gap-3 items-start">
                <div class="shrink-0 w-28 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    {#if preview.image}
                        <img src={preview.image} alt="" class="w-full h-full object-cover" loading="lazy" />
                    {/if}
                </div>
                <div class="min-w-0">
                    {#if preview.title}
                        <h1 class={`m-0 text-lg leading-tight font-semibold truncate ${isOwn ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            {preview.title}
                        </h1>
                    {/if}
                    {#if preview.description}
                        <p class={`mt-0 text-xs leading-snug overflow-hidden max-h-16 ${isOwn ? 'text-blue-50' : 'text-gray-600 dark:text-slate-300'}`}>
                            {preview.description}
                        </p>
                    {/if}
                </div>
            </div>
        </a>
    {/if}
</div>
