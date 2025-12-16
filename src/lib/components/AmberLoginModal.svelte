<script lang="ts">
    // Legacy modal: kept for reference; Android Amber login now uses NIP-55 intents directly and does not use this QR-based flow.
    import { onMount } from 'svelte';
    import QRCode from 'qrcode';
    import { t } from '$lib/i18n';
    import { copyTextToClipboard } from '$lib/utils/clipboard';

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

    async function copyUri() {
        await copyTextToClipboard(uri);
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
</script>

<div class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white/20 dark:border-white/10 outline-none">
        <h2 class="typ-title mb-6 text-center dark:text-white">{$t('auth.amber.title')}</h2>
        
        <div class="flex justify-center mb-6 bg-white p-2 rounded-xl shadow-inner">
            <canvas bind:this={canvas}></canvas>
        </div>

        <p class="typ-body text-gray-600 dark:text-slate-300 mb-6 text-center">
            {$t('auth.amber.helper')}
        </p>

        <div class="space-y-3">
            <a 
                href={uri}
                class="block w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white text-center p-3 rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all font-medium"
            >
                {$t('auth.amber.openInAmber')}
            </a>
            
            <button 
                onclick={copyUri}
                class="block w-full bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 p-3 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors font-medium border border-transparent dark:border-slate-700"
            >
                {copied ? $t('auth.amber.copied') : $t('auth.amber.copyConnectionString')}
            </button>

            <button 
                onclick={onClose}
                class="block w-full text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 p-2 font-medium"
            >
                {$t('common.cancel')}
            </button>
        </div>
    </div>
</div>
