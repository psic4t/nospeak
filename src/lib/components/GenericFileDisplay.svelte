<script lang="ts">
    import { getFileIconInfo, getFileExtension, formatFileSize } from '$lib/utils/fileIcons';
    import { extractBlossomSha256FromUrl } from '$lib/core/BlossomRetrieval';
    import { t } from '$lib/i18n';

    let {
        fileType,
        fileSize,
        fileUrl = null,
        decryptedUrl = null,
        isDecrypting = false,
        isOwn = false,
        onDownload
    } = $props<{
        fileType: string;
        fileSize?: number;
        fileUrl?: string | null;
        decryptedUrl?: string | null;
        isDecrypting?: boolean;
        isOwn?: boolean;
        onDownload?: () => void;
    }>();

    const iconInfo = $derived(getFileIconInfo(fileType));
    const extension = $derived(getFileExtension(fileType) || '.file');
    const sizeLabel = $derived(fileSize ? formatFileSize(fileSize) : '');

    // Extract SHA256 hash from Blossom URL for download filename
    const downloadFilename = $derived.by(() => {
        if (fileUrl) {
            const extracted = extractBlossomSha256FromUrl(fileUrl);
            if (extracted) {
                // Use the hash as filename, with extension from MIME type or URL
                return `${extracted.sha256}${extracted.extension || extension}`;
            }
        }
        return `file${extension}`;
    });

    function handleDownload() {
        if (!decryptedUrl) {
            // Trigger decryption if not yet decrypted
            onDownload?.();
            return;
        }

        // Trigger download using the decrypted blob URL
        const a = document.createElement('a');
        a.href = decryptedUrl;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
</script>

<div class="flex items-center gap-3 p-3 rounded-xl {isOwn ? 'bg-blue-500/10 dark:bg-blue-400/10' : 'bg-gray-100/80 dark:bg-slate-800/60'} border {isOwn ? 'border-blue-300/30 dark:border-blue-500/20' : 'border-gray-200/60 dark:border-slate-700/60'}">
    <!-- File icon -->
    <div class="w-12 h-12 rounded-lg {iconInfo.color} flex items-center justify-center flex-shrink-0">
        {@html iconInfo.svg}
    </div>

    <!-- File info -->
    <div class="flex-1 min-w-0">
        <div class="typ-section font-medium {isOwn ? 'text-blue-100' : 'text-gray-800 dark:text-gray-200'} uppercase">
            {iconInfo.label}
        </div>
        {#if sizeLabel}
            <div class="typ-meta {isOwn ? 'text-blue-200/70' : 'text-gray-500 dark:text-gray-400'}">
                {sizeLabel}
            </div>
        {/if}
    </div>

    <!-- Download button -->
    <button
        type="button"
        onclick={handleDownload}
        disabled={isDecrypting}
        class="flex-shrink-0 px-3 py-2 rounded-lg {isOwn ? 'bg-blue-400/20 hover:bg-blue-400/30 text-blue-100' : 'bg-gray-200/80 dark:bg-slate-700/80 hover:bg-gray-300/80 dark:hover:bg-slate-600/80 text-gray-700 dark:text-gray-200'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {#if isDecrypting}
            <span class="typ-meta">{$t('chat.fileUpload.decrypting')}</span>
        {:else}
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        {/if}
    </button>
</div>
