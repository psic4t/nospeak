<script lang="ts">
    import QRCode from 'qrcode';
    import { currentUser } from '$lib/stores/auth';
     import { profileRepo } from '$lib/db/ProfileRepository';
     import Avatar from '$lib/components/Avatar.svelte';
     import { fade } from 'svelte/transition';
     import { glassModal } from '$lib/utils/transitions';
     import { isAndroidNative } from '$lib/core/NativeDialogs';
     import { t } from '$lib/i18n';
     import { hapticSelection } from '$lib/utils/haptics';


    let { isOpen, close } = $props<{
        isOpen: boolean;
        close: () => void;
    }>();

    const isAndroidApp = isAndroidNative();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let qrValue = $state<string>('');
    let displayName = $state<string>('');
    let picture = $state<string | undefined>(undefined);
    let loading = $state(false);

    async function loadProfileAndQr() {
        const user = $currentUser;
        if (!user?.npub || !canvas) {
            return;
        }

        loading = true;

        try {
            const profile = await profileRepo.getProfileIgnoreTTL(user.npub);

            if (profile?.metadata) {
                displayName =
                    profile.metadata.name ||
                    profile.metadata.display_name ||
                    (profile.metadata as any).displayName ||
                    user.npub.slice(0, 10) + '...';
                picture = profile.metadata.picture;
            } else {
                displayName = user.npub.slice(0, 10) + '...';
                picture = undefined;
            }

            qrValue = `nostr:${user.npub}`;

            await QRCode.toCanvas(canvas, qrValue, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        } catch (e) {
            console.error('Failed to prepare user QR modal:', e);
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        if (isOpen) {
            loadProfileAndQr();
        } else {
            qrValue = '';
            loading = false;
        }
    });

    function handleOverlayClick(e: MouseEvent) {
         if (e.target === e.currentTarget) {
             hapticSelection();
             close();
         }
     }

     function handleKeydown(e: KeyboardEvent) {
         if (e.key === 'Escape') {
             hapticSelection();
             close();
         }
     }

</script>

{#if isOpen}
    <div
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class="fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        class:android-safe-area-top={isAndroidApp}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <div
            in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }}
            out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
            class="bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl w-full max-w-sm rounded-3xl flex flex-col shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden relative outline-none px-6 pb-6 pt-14"
        >
            <button
                 onclick={() => { hapticSelection(); close(); }}
                 aria-label="Close modal"

                class="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            <div class="flex items-center gap-3 mb-6">
                <Avatar
                    npub={$currentUser?.npub || ''}
                    src={picture}
                    size="md"
                    class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
                />
                <div class="flex flex-col">
                    <div class="text-base font-semibold text-gray-900 dark:text-white">
                        {displayName || $currentUser?.npub?.slice(0, 10) + '...'}
                    </div>
                    {#if $currentUser?.npub}
                        <div class="text-[11px] text-gray-500 dark:text-slate-400 font-mono break-all select-all">
                            nostr:{$currentUser.npub}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="flex justify-center mb-2">
                <div class="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-inner border border-gray-200/70 dark:border-slate-700/70">
                    <canvas bind:this={canvas}></canvas>
                </div>

            </div>

            {#if loading}
                <div class="mt-4 text-xs text-center text-gray-500 dark:text-slate-400">
                    {$t('modals.userQr.preparing')}
                </div>
            {/if}
        </div>
    </div>
{/if}
