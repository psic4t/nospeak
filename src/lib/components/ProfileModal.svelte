<script lang="ts">
    import { profileRepo } from '$lib/db/ProfileRepository';
    import type { Profile } from '$lib/db/db';
    import Avatar from './Avatar.svelte';

    let { isOpen, close, npub } = $props<{ isOpen: boolean, close: () => void, npub: string }>();
    
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
        if (!relays || relays.length === 0) return 'None';
        return relays.join(', ');
    }

    function formatUrl(url: string) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `https://${url}`;
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
        <!-- Close on click outside could be added here -->
        <div class="bg-white dark:bg-gray-800 w-full h-full rounded-none md:max-w-xl md:h-auto md:max-h-[85vh] md:rounded-lg flex flex-col shadow-xl overflow-hidden relative">
            
            <button onclick={close} aria-label="Close modal" class="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            {#if loading}
                <div class="p-8 text-center dark:text-gray-300">Loading...</div>
            {:else if profile}
                <div class="overflow-y-auto flex-1">
                    <!-- Banner -->
                    <div class="w-full h-32 bg-gray-200 dark:bg-gray-700 relative">
                        {#if profile.metadata?.banner}
                            <img src={profile.metadata.banner} alt="Banner" class="w-full h-full object-cover" />
                        {/if}
                    </div>

                    <!-- Profile Header -->
                    <div class="px-6 relative">
                        <div class="-mt-16 mb-3 inline-block rounded-lg p-1 bg-white dark:bg-gray-800 shadow-sm">
                             <Avatar npub={npub} src={profile.metadata?.picture} size="2xl" />
                        </div>

                        <div class="flex flex-col mb-4">
                            <h3 class="text-2xl font-bold dark:text-white break-words">
                                {profile.metadata?.name || profile.metadata?.display_name || 'Unknown'}
                            </h3>
                            {#if profile.metadata?.nip05}
                                <div class="text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                                    {profile.metadata.nip05}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="px-6 pb-6 space-y-5">
                        
                        <!-- About -->
                        {#if profile.metadata?.about}
                            <div>
                                <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">About</h4>
                                <div class="dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed break-words">
                                    {profile.metadata.about}
                                </div>
                            </div>
                        {/if}

                        <!-- Links & Info -->
                        {#if profile.metadata?.website || profile.metadata?.lud16}
                            <div class="grid grid-cols-1 gap-3 py-3 border-t border-gray-100 dark:border-gray-700">
                                {#if profile.metadata?.website}
                                    <div class="flex items-center gap-2 overflow-hidden">
                                        <svg class="text-gray-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                        <a href={formatUrl(profile.metadata.website)} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline truncate text-sm">
                                            {profile.metadata.website}
                                        </a>
                                    </div>
                                {/if}

                                {#if profile.metadata?.lud16}
                                    <div class="flex items-center gap-2 overflow-hidden">
                                        <svg class="text-yellow-500 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                        <span class="dark:text-gray-200 text-sm truncate select-all">{profile.metadata.lud16}</span>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Technical Details -->
                        <div class="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                            <div>
                                <div class="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Public Key</div>
                                <div class="dark:text-gray-200 font-mono text-xs break-all bg-gray-50 dark:bg-gray-900/50 p-2 rounded border dark:border-gray-700 select-all text-gray-700">
                                    {npub}
                                </div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <div class="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Read Relays</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-300 break-words">
                                        {formatRelays(profile.readRelays)}
                                    </div>
                                </div>
                                <div>
                                    <div class="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Write Relays</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-300 break-words">
                                        {formatRelays(profile.writeRelays)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            {:else}
                 <div class="p-8 text-center dark:text-gray-300">Profile not found</div>
            {/if}
        </div>
    </div>
{/if}
