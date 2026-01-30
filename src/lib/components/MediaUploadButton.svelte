<script lang="ts">
    import { get } from 'svelte/store';

    import FileTypeDropdown from './FileTypeDropdown.svelte';

    import { isAndroidNative, isMobileWeb, nativeDialogService } from '$lib/core/NativeDialogs';
    import { hapticSelection } from '$lib/utils/haptics';
    import { t } from '$lib/i18n';
    import { detectMediaType, validateFileSize, MAX_FILE_SIZE } from '$lib/utils/fileIcons';



    type Variant = 'chat' | 'default';

    let { onFileSelect, onShareLocation, showLocationOption = false, inline, variant: variantProp = 'default', allowedTypes = ['image', 'video', 'file'] } = $props<{
        onFileSelect: (file: File, type: 'image' | 'video' | 'audio' | 'file') => void;
        onShareLocation?: () => void;
        showLocationOption?: boolean;
        inline?: boolean;
        variant?: Variant;
        allowedTypes?: ('image' | 'video' | 'audio' | 'file')[];
    }>();

    const variant: Variant = $derived(inline === true ? 'chat' : (inline === false ? 'default' : variantProp));

    let showDropdown = $state(false);
    let dropdownElement = $state<HTMLElement | undefined>();
    let buttonElement = $state<HTMLElement | undefined>();

    const MAX_WIDTH = 2048;
    const MAX_HEIGHT = 2048;
    const JPEG_QUALITY = 0.8;

     const isAndroidNativeEnv = typeof window !== 'undefined' && isAndroidNative();
     const isMobileWebEnv = typeof window !== 'undefined' && isMobileWeb();
 
     function toggleDropdown() {
         const opening = !showDropdown;
         showDropdown = !showDropdown;
         if (opening) {
             hapticSelection();
         }
     }


    function closeDropdown() {
        showDropdown = false;
    }

      function handleFileTypeSelect(type: 'image' | 'video' | 'audio' | 'file') {
          closeDropdown();
          hapticSelection();
          openFileSelector(type);
      }

      function handleShareLocation() {
          if (!onShareLocation) {
              return;
          }

          closeDropdown();
          hapticSelection();
          onShareLocation();
      }



    function resizeImageBlobToFile(blob: Blob, filenameBase: string): Promise<File> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                URL.revokeObjectURL(url);

                const width = img.width;
                const height = img.height;

                const ratio = Math.min(
                    MAX_WIDTH / width || 1,
                    MAX_HEIGHT / height || 1,
                    1
                );

                const targetWidth = Math.round(width * ratio);
                const targetHeight = Math.round(height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Canvas not supported'));
                    return;
                }

                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                canvas.toBlob(
                    (result) => {
                        if (!result) {
                            const fallbackFile = new File(
                                [blob],
                                `${filenameBase}.jpg`,
                                { type: blob.type || 'image/jpeg' }
                            );
                            resolve(fallbackFile);
                            return;
                        }

                        const file = new File(
                            [result],
                            `${filenameBase}.jpg`,
                            { type: 'image/jpeg' }
                        );
                        resolve(file);
                    },
                    'image/jpeg',
                    JPEG_QUALITY
                );
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image for resizing'));
            };

            img.src = url;
        });
    }

    async function openFileSelector(type: 'image' | 'video' | 'audio' | 'file') {
        const input = document.createElement('input');
        input.type = 'file';

        if (type === 'image') {
            input.accept = 'image/jpeg,image/png,image/gif,image/webp';
        } else if (type === 'video') {
            input.accept = 'video/mp4,video/webm,video/quicktime';
        } else if (type === 'audio') {
            input.accept = 'audio/mpeg,audio/webm,audio/ogg';
        } else {
            // Generic file - accept all types
            input.accept = '*/*';
        }

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    // For generic file uploads, auto-detect if it's actually media
                    if (type === 'file') {
                        const detectedType = detectMediaType(file);

                        // If it's media, route to the existing media handlers
                        if (detectedType !== 'file') {
                            onFileSelect(file, detectedType);
                            return;
                        }

                        // Validate file size for generic files (10 MB max)
                        if (!validateFileSize(file)) {
                            alert(get(t)('chat.fileUpload.fileTooLarge'));
                            return;
                        }
                    }

                    onFileSelect(file, type);
                } catch (error) {
                    console.error('Upload failed:', error);
                    alert(`Upload failed: ${(error as Error).message}`);
                }
            }
        };

        input.click();
    }

    async function openCameraCaptureInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        (input as HTMLInputElement & { capture?: string }).capture = 'environment';

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
                return;
            }

            try {
                const baseName = file.name && file.name.includes('.')
                    ? file.name.slice(0, file.name.lastIndexOf('.'))
                    : file.name || 'photo';

                const resizedFile = await resizeImageBlobToFile(file, baseName);
                onFileSelect(resizedFile, 'image');
            } catch (error) {
                console.error('Upload failed:', error);
                alert(`Upload failed: ${(error as Error).message}`);
            }
        };

        input.click();
    }

     async function handleTakePhoto() {
         closeDropdown();
         hapticSelection();
 
         if (isAndroidNativeEnv) {

            try {
                const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

                const photo = await Camera.getPhoto({
                    source: CameraSource.Camera,
                    resultType: CameraResultType.Uri,
                    quality: 80,
                    allowEditing: false,
                    saveToGallery: false
                });

                if (!photo.webPath) {
                    throw new Error('No photo returned from camera');
                }

                const response = await fetch(photo.webPath);
                const blob = await response.blob();

                const resizedFile = await resizeImageBlobToFile(blob, `photo-${Date.now()}`);
                onFileSelect(resizedFile, 'image');
            } catch (error) {
                console.error('Camera capture failed:', error);
                await nativeDialogService.alert({
                    title: get(t)('chat.mediaErrors.cameraErrorTitle') as string,
                    message:
                        (error as Error).message ||
                        ((get(t)('chat.mediaErrors.cameraErrorMessage') as string))
                });
            }

            return;
        }

        if (isMobileWebEnv) {
            await openCameraCaptureInput();
            return;
        }

        openFileSelector('image');
    }

    // Close dropdown when clicking outside
    function handleClickOutside(e: MouseEvent) {
        if (showDropdown &&
            dropdownElement &&
            buttonElement &&
            !dropdownElement.contains(e.target as Node) &&
            !buttonElement.contains(e.target as Node)) {
            closeDropdown();
        }
    }

    $effect(() => {
        if (showDropdown) {
            document.addEventListener('click', handleClickOutside);
        } else {
            document.removeEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    });
</script>

<div class="relative">
    <button
        bind:this={buttonElement}
        type="button"
        onclick={toggleDropdown}
        class={variant === 'chat'
            ? "flex-shrink-0 h-8 w-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden active:scale-90 transition-transform duration-100 ease-out"
            : "flex-shrink-0 h-11 w-11 p-0 flex items-center justify-center rounded-full bg-[rgb(var(--color-lavender-rgb)/0.20)] dark:bg-[rgb(var(--color-lavender-rgb)/0.24)] text-[rgb(var(--color-text-rgb)/0.92)] shadow-sm hover:bg-[rgb(var(--color-lavender-rgb)/0.26)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.30)] hover:shadow active:bg-[rgb(var(--color-lavender-rgb)/0.32)] dark:active:bg-[rgb(var(--color-lavender-rgb)/0.36)] disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden transition-all duration-200 ease-out"}
        title={$t('chat.mediaMenu.uploadMediaTooltip')}
    >
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-gray-600 dark:text-gray-300"
        >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
    </button>

    {#if showDropdown}
        <div
            bind:this={dropdownElement}
            class="absolute bottom-full mb-2 left-0 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden z-50 min-w-[120px]"
        >
            <FileTypeDropdown
                onFileTypeSelect={handleFileTypeSelect}
                showCameraOption={isAndroidNativeEnv || isMobileWebEnv}
                onTakePhoto={handleTakePhoto}
                showLocationOption={showLocationOption}
                onShareLocation={handleShareLocation}
                allowedTypes={allowedTypes}
            />
        </div>
    {/if}
</div>
