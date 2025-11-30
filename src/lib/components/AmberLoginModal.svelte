<script lang="ts">
    import { onMount } from 'svelte';
    import QRCode from 'qrcode';

    let { uri, onClose } = $props<{ uri: string, onClose: () => void }>();
    
    let canvas: HTMLCanvasElement;
    let copied = $state(false);

    onMount(async () => {
        if (canvas) {
            await QRCode.toCanvas(canvas, uri, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        }
    });

    function copyUri() {
        navigator.clipboard.writeText(uri);
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
        <h2 class="text-xl font-bold mb-4 text-center dark:text-white">Login with Amber</h2>
        
        <div class="flex justify-center mb-4 bg-white p-2 rounded">
            <canvas bind:this={canvas}></canvas>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4 text-center">
            Scan this QR code with Amber or use the buttons below.
        </p>

        <div class="space-y-3">
            <a 
                href={uri}
                class="block w-full bg-orange-500 text-white text-center p-2 rounded hover:bg-orange-600 transition-colors"
            >
                Open in Amber
            </a>
            
            <button 
                onclick={copyUri}
                class="block w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white p-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
                {copied ? 'Copied!' : 'Copy Connection String'}
            </button>

            <button 
                onclick={onClose}
                class="block w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2"
            >
                Cancel
            </button>
        </div>
    </div>
</div>
