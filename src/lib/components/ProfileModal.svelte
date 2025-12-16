<script lang="ts">
    import { profileRepo } from '$lib/db/ProfileRepository';
    import type { Profile } from '$lib/db/db';
     import Avatar from './Avatar.svelte';
     import { getDisplayedNip05 } from '$lib/core/Nip05Display';
     import { isAndroidNative } from "$lib/core/NativeDialogs";
     import { fade } from 'svelte/transition';
     import { glassModal } from '$lib/utils/transitions';
     import { t } from '$lib/i18n';
     import { get } from 'svelte/store';
 
      let { isOpen, close, npub } = $props<{ isOpen: boolean, close: () => void, npub: string }>();
      const isAndroidApp = isAndroidNative();


    
    let profile = $state<Profile | undefined>(undefined);
    let loading = $state(false);

    $effect(() => {
        if (isOpen && npub) {
            loadProfile();
        }
    });

    async function loadProfile() {
        loading = true;
        profile = await profileRepo.getProfileIgnoreTTL(npub);
        loading = false;
    }

    function formatRelays(relays: string[]) {
        if (!relays || relays.length === 0) return get(t)('modals.profile.noRelays') as string;
        return relays.join(', ');
    }

    function formatUrl(url: string) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `https://${url}`;
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
        onclick={(e) => { if(e.target === e.currentTarget) close(); }}
        onkeydown={(e) => { if(e.key === 'Escape') close(); }}
    >
        <div 
            in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }} 
            out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
            class="bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl w-full max-w-xl h-auto max-h-[85vh] rounded-3xl flex flex-col shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden relative outline-none">
            
            <button onclick={close} aria-label="Close modal" class="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            {#if loading}
                <div class="p-6 animate-pulse flex-1 overflow-y-auto">
                    <!-- Banner Skeleton -->
                    <div class="w-full h-32 bg-gray-200 dark:bg-slate-800 rounded-xl mb-12"></div>
                    
                    <!-- Header Skeleton -->
                    <div class="px-2 mb-8 relative">
                        <div class="absolute -top-16 left-2 w-24 h-24 bg-gray-300 dark:bg-slate-700 rounded-full border-4 border-white dark:border-slate-900"></div>
                        <div class="mt-10 space-y-3">
                            <div class="h-8 bg-gray-200 dark:bg-slate-800 rounded-lg w-3/4"></div>
                            <div class="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/3"></div>
                        </div>
                    </div>

                    <!-- Content Skeleton -->
                    <div class="px-2 space-y-6">
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 dark:bg-slate-800 rounded w-16"></div>
                            <div class="h-20 bg-gray-200 dark:bg-slate-800 rounded-xl w-full"></div>
                        </div>
                        <div class="h-12 bg-gray-200 dark:bg-slate-800 rounded-xl w-full"></div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="h-24 bg-gray-200 dark:bg-slate-800 rounded-xl w-full"></div>
                            <div class="h-24 bg-gray-200 dark:bg-slate-800 rounded-xl w-full"></div>
                        </div>
                    </div>
                </div>
            {:else if profile}
                <div class="overflow-y-auto flex-1 custom-scrollbar">
                    <!-- Banner -->
                    <div class="w-full h-32 bg-gray-200 dark:bg-slate-700 relative">
                        {#if profile.metadata?.banner}
                            <img src={profile.metadata.banner} alt="Banner" class="w-full h-full object-cover" />
                        {/if}
                    </div>

                    <!-- Profile Header -->
                    <div class="px-6 relative">
                        <div class="-mt-16 mb-3 inline-block rounded-2xl p-1 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                             <Avatar npub={npub} src={profile.metadata?.picture} size="2xl" class="rounded-xl" />
                        </div>

                        <div class="flex flex-col mb-4">
                            <h3 class="text-2xl font-bold dark:text-white break-words">
                                {profile.metadata?.name || profile.metadata?.display_name || $t('modals.profile.unknownName')}
                            </h3>
                            {#if profile.metadata?.nip05}
                                <div class="text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                                    {#if profile.nip05Status === 'valid'}
                                        <svg
                                            class="shrink-0 text-green-500"
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                            <path d="m9 12 2 2 4-4"></path>
                                        </svg>
                                    {:else if profile.nip05Status === 'invalid'}
                                        <svg
                                            class="shrink-0 text-yellow-500"
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="8" x2="12" y2="12"></line>
                                            <circle cx="12" cy="16" r="1"></circle>
                                        </svg>
                                    {/if}
                                    <span>{getDisplayedNip05(profile.metadata.nip05)}</span>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="px-6 pb-8 space-y-6">
                        
                        <!-- About -->
                        {#if profile.metadata?.about}
                            <div>
                                <h4 class="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">{$t('modals.profile.about')}</h4>
                                <div class="dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed break-words">
                                    {profile.metadata.about}
                                </div>
                            </div>
                        {/if}

                        <!-- Links & Info -->
                        {#if profile.metadata?.website || profile.metadata?.lud16}
                            <div class="grid grid-cols-1 gap-3 pt-6 border-t border-gray-100 dark:border-slate-800/50">
                                {#if profile.metadata?.website}
                                    <div class="flex items-center gap-2 overflow-hidden group">
                                        <div class="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shrink-0">
                                            <svg class="text-blue-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                        </div>
                                        <a href={formatUrl(profile.metadata.website)} target="_blank" rel="noopener noreferrer" class="text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate text-sm font-medium transition-colors">
                                            {profile.metadata.website}
                                        </a>
                                    </div>
                                {/if}

                                {#if profile.metadata?.lud16}
                                    <div class="flex items-center gap-2 overflow-hidden">
                                        <div class="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center shrink-0">
                                            <svg class="text-yellow-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                        </div>
                                        <span class="dark:text-gray-200 text-sm truncate select-all font-medium">{profile.metadata.lud16}</span>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Technical Details -->
                        <div class="pt-6 border-t border-gray-100 dark:border-slate-800/50 space-y-5">
                            <div>
                                <div class="font-bold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">{$t('modals.profile.publicKey')}</div>
                                <div class="dark:text-slate-300 font-mono text-xs break-all bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-slate-800 select-all text-gray-600 shadow-inner">
                                    {npub}
                                </div>
                            </div>

                            <div class="grid grid-cols-1 gap-4">
                                <div>
                                    <div class="font-bold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">{$t('modals.profile.messagingRelays')}</div>
                                    <div class="text-xs text-gray-600 dark:text-slate-300 break-words leading-relaxed bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-slate-800 select-all shadow-inner">
                                        {formatRelays(profile.messagingRelays || [])}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            {:else}
                 <div class="p-8 text-center dark:text-slate-300">{$t('modals.profile.notFound')}</div>
            {/if}
        </div>
    </div>
{/if}
