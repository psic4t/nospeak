<script lang="ts">
  import FileTypeDropdown from './FileTypeDropdown.svelte';

  let { onFileSelect, inline = false } = $props<{
    onFileSelect: (file: File, type: 'image' | 'video', url?: string) => void;
    inline?: boolean;
  }>();

  let showDropdown = $state(false);
  let dropdownElement = $state<HTMLElement | undefined>();
  let buttonElement = $state<HTMLElement | undefined>();
  let isUploading = $state(false);
  let uploadProgress = $state(0);

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function closeDropdown() {
    showDropdown = false;
  }

  function handleFileTypeSelect(type: 'image' | 'video') {
    closeDropdown();
    openFileSelector(type);
  }

  async function uploadFile(file: File, type: 'image' | 'video') {
    isUploading = true;
    uploadProgress = 0;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

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

      xhr.open('POST', '/api/upload');
      xhr.send(formData);

      const fileUrl = await uploadPromise;
      return fileUrl;
    } finally {
      isUploading = false;
      uploadProgress = 0;
    }
  }

  async function openFileSelector(type: 'image' | 'video') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' 
      ? 'image/jpeg,image/png,image/gif,image/webp'
      : 'video/mp4,video/webm,video/quicktime';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const fileUrl = await uploadFile(file, type);
          onFileSelect(file, type, fileUrl);
        } catch (error) {
          console.error('Upload failed:', error);
          alert(`Upload failed: ${(error as Error).message}`);
        }
      }
    };
    
    input.click();
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
      ? "flex-shrink-0 h-8 w-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
      : "flex-shrink-0 h-10 w-10 hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"}
    title={isUploading ? `Uploading... ${uploadProgress}%` : "Upload media"}
  >
    {#if isUploading}
      <div class="absolute inset-0 bg-blue-500 opacity-20" style="width: {uploadProgress}%"></div>
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
      class="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded-lg overflow-hidden z-50 min-w-[120px]"
    >
      <FileTypeDropdown onFileTypeSelect={handleFileTypeSelect} />
    </div>
  {/if}
</div>