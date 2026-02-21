<script lang="ts">
     import { t } from '$lib/i18n';
 
    let {
        onFileTypeSelect,
        showCameraOption = false,
        onTakePhoto,
        showLocationOption = false,
        onShareLocation,
        allowedTypes = ['image', 'video', 'file']
    } = $props<{
        onFileTypeSelect: (type: 'image' | 'video' | 'audio' | 'file') => void;
        showCameraOption?: boolean;
        onTakePhoto?: () => void;
        showLocationOption?: boolean;
        onShareLocation?: () => void;
        allowedTypes?: ('image' | 'video' | 'audio' | 'file')[];
    }>();

    let showImage = $derived(allowedTypes.includes('image'));
    let showVideo = $derived(allowedTypes.includes('video'));
    let showAudio = $derived(allowedTypes.includes('audio'));
    let showFile = $derived(allowedTypes.includes('file'));
 
     function handleImageClick() {
         onFileTypeSelect('image');
     }
 
     function handleVideoClick() {
         onFileTypeSelect('video');
     }
 
    function handleAudioClick() {
        onFileTypeSelect('audio');
    }

    function handleFileClick() {
        onFileTypeSelect('file');
    }

    function handleTakePhotoClick() {
         if (onTakePhoto) {
             onTakePhoto();
         }
     }

     function handleShareLocationClick() {
         if (onShareLocation) {
             onShareLocation();
         }
     }
 </script>


<div class="py-1">
    {#if showCameraOption && onTakePhoto}
        <button
            type="button"
            onclick={handleTakePhotoClick}
            class="w-full text-start px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-gray-600 dark:text-gray-300"
            >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{$t('chat.mediaMenu.takePhoto')}</span>
        </button>
    {/if}
    {#if showLocationOption && onShareLocation}
        <button
            type="button"
            onclick={handleShareLocationClick}
            class="w-full text-start px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-gray-600 dark:text-gray-300"
            >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{$t('chat.mediaMenu.location')}</span>
        </button>
    {/if}
    {#if showImage}
    <button
        type="button"
        onclick={handleImageClick}
        class="w-full text-start px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
    >
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-gray-600 dark:text-gray-300"
        >
            <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
            <circle cx="8" cy="10" r="2" />
            <path d="M21 15l-4-4-6 6" />
        </svg>
        <span>{$t('chat.mediaMenu.image')}</span>
    </button>
    {/if}
    {#if showVideo}
    <button
        type="button"
        onclick={handleVideoClick}
        class="w-full text-start px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
    >
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-gray-600 dark:text-gray-300"
        >
            <rect x="3" y="6" width="13" height="12" rx="2" ry="2" />
            <polygon points="16 10 21 7 21 17 16 14" />
        </svg>
        <span>{$t('chat.mediaMenu.video')}</span>
    </button>
    {/if}
    {#if showAudio}
    <button
        type="button"
        onclick={handleAudioClick}
        class="w-full text-start px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
    >
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-gray-600 dark:text-gray-300"
        >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </svg>
        <span>{$t('chat.mediaMenu.audio')}</span>
    </button>
    {/if}
    {#if showFile}
    <button
        type="button"
        onclick={handleFileClick}
        class="w-full text-start px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
    >
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-gray-600 dark:text-gray-300"
        >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span>{$t('chat.mediaMenu.file')}</span>
    </button>
    {/if}
</div>
