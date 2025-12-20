<script lang="ts">
    // Legacy modal: kept for reference; Android Amber login now uses NIP-55 intents directly and does not use this QR-based flow.
    import { onMount } from 'svelte';
    import QRCode from 'qrcode';
    import { t } from '$lib/i18n';
    import { copyTextToClipboard } from '$lib/utils/clipboard';
    import Button from '$lib/components/ui/Button.svelte';

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
            <Button 
                href={uri}
                variant="primary"
                class="w-full"
            >
                {$t('auth.amber.openInAmber')}
            </Button>
            
            <Button 
                onclick={copyUri}
                class="w-full"
            >
                {copied ? $t('auth.amber.copied') : $t('auth.amber.copyConnectionString')}
            </Button>

            <Button 
                onclick={onClose}
                variant="ghost"
                class="w-full"
            >
                {$t('common.cancel')}
            </Button>
        </div>
    </div>
</div>
