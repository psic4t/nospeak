<script lang="ts">
    import { get } from 'svelte/store';

    import FileTypeDropdown from './FileTypeDropdown.svelte';
    import { buildUploadAuthHeader, CANONICAL_UPLOAD_URL } from '$lib/core/Nip98Auth';
    import { uploadToBlossomServers, sha256HexFromBlob } from '$lib/core/BlossomUpload';
    import { getStoredUploadBackend } from '$lib/core/MediaUploadSettings';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { currentUser } from '$lib/stores/auth';
    import { isAndroidNative, isMobileWeb, nativeDialogService } from '$lib/core/NativeDialogs';
    import { hapticSelection } from '$lib/utils/haptics';
    import { t } from '$lib/i18n';



    let { onFileSelect, inline = false, allowedTypes = ['image', 'video'], dmEncrypted = false } = $props<{
        onFileSelect: (file: File, type: 'image' | 'video' | 'audio', url?: string) => void;
        inline?: boolean;
        allowedTypes?: ('image' | 'video' | 'audio')[];
        dmEncrypted?: boolean; // when true, caller handles encryption/upload (DM attachments)
    }>();

    let showDropdown = $state(false);
    let dropdownElement = $state<HTMLElement | undefined>();
    let buttonElement = $state<HTMLElement | undefined>();
    let isUploading = $state(false);
    let uploadProgress = $state(0);

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

     function handleFileTypeSelect(type: 'image' | 'video' | 'audio') {
         closeDropdown();
         hapticSelection();
         openFileSelector(type);
     }


    async function uploadFile(file: File, type: 'image' | 'video' | 'audio') {
        isUploading = true;
        uploadProgress = 0;

        try {
            const backend = getStoredUploadBackend();

            if (backend === 'blossom') {
                const user = get(currentUser);
                if (user) {
                    const profile = await profileRepo.getProfileIgnoreTTL(user.npub);
                    const servers = (profile as any)?.mediaServers ?? [];

                    if (servers.length > 0) {
                        const mimeType = file.type || (type === 'image'
                            ? 'image/jpeg'
                            : type === 'video'
                                ? 'video/mp4'
                                : 'audio/mpeg');

                        const sha256 = await sha256HexFromBlob(file);

                        const result = await uploadToBlossomServers({
                            servers,
                            body: file,
                            mimeType,
                            sha256,
                            onProgress: (percent) => (uploadProgress = percent)
                        });

                        return result.url;
                    }
                }
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            const authHeader = await buildUploadAuthHeader();
            if (!authHeader) {
                throw new Error('You must be logged in to upload media');
            }

            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    uploadProgress = Math.round((e.loaded / e.total) * 100);
                }
            });

            // Set timeout for upload (30 seconds)
            const uploadTimeout = setTimeout(() => {
                xhr.abort();
                throw new Error('Upload timeout - please try again');
            }, 30000);

            // Return a promise that resolves when upload is complete
            const uploadPromise = new Promise<string>((resolve, reject) => {
                xhr.onload = () => {
                    clearTimeout(uploadTimeout);
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            if (response.success) {
                                resolve(response.url);
                            } else {
                                reject(new Error(response.error || 'Upload failed'));
                            }
                        } catch (e) {
                            reject(new Error('Invalid response from server'));
                        }
                    } else if (xhr.status === 413) {
                        reject(new Error('File too large'));
                    } else if (xhr.status === 400) {
                        reject(new Error('Invalid file type or size'));
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                };

                xhr.onerror = () => {
                    clearTimeout(uploadTimeout);
                    reject(new Error('Network error during upload'));
                };

                xhr.onabort = () => {
                    clearTimeout(uploadTimeout);
                    reject(new Error('Upload was cancelled'));
                };
            });

            xhr.open('POST', CANONICAL_UPLOAD_URL);
            xhr.setRequestHeader('Authorization', authHeader);
            xhr.send(formData);

            const fileUrl = await uploadPromise;
            return fileUrl;
        } finally {
            isUploading = false;
            uploadProgress = 0;
        }
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

    async function openFileSelector(type: 'image' | 'video' | 'audio') {
        const input = document.createElement('input');
        input.type = 'file';

        if (type === 'image') {
            input.accept = 'image/jpeg,image/png,image/gif,image/webp';
        } else if (type === 'video') {
            input.accept = 'video/mp4,video/webm,video/quicktime';
        } else {
            input.accept = 'audio/mpeg';
        }

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    if (dmEncrypted) {
                        // For DM attachments, let the caller handle encryption and upload
                        onFileSelect(file, type);
                    } else {
                        const fileUrl = await uploadFile(file, type);
                        onFileSelect(file, type, fileUrl);
                    }
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
                if (dmEncrypted) {
                    onFileSelect(resizedFile, 'image');
                } else {
                    const fileUrl = await uploadFile(resizedFile, 'image');
                    onFileSelect(resizedFile, 'image', fileUrl);
                }
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
                if (dmEncrypted) {
                    onFileSelect(resizedFile, 'image');
                } else {
                    const fileUrl = await uploadFile(resizedFile, 'image');
                    onFileSelect(resizedFile, 'image', fileUrl);
                }
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
        disabled={isUploading}
        class={inline
            ? "flex-shrink-0 h-8 w-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden active:scale-90 transition-transform duration-100 ease-out"
            : "flex-shrink-0 h-10 w-10 hover:opacity-80 cursor-pointer flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden active:scale-90 transition-all duration-100 ease-out"}
        title={
             isUploading
                 ? `${$t('chat.mediaMenu.uploadMediaTooltip')}... ${uploadProgress}%`
                 : $t('chat.mediaMenu.uploadMediaTooltip')
         }
    >
        {#if isUploading}
            <div class="absolute inset-0 bg-blue-500 opacity-20" style={`width: ${uploadProgress}%`}></div>
            <div class="relative z-10 text-xs font-bold text-gray-700 dark:text-gray-300">
                {uploadProgress}%
            </div>
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
                class="text-gray-600 dark:text-gray-300"
            >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        {/if}
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
                allowedTypes={allowedTypes}
            />
        </div>
    {/if}
</div>
