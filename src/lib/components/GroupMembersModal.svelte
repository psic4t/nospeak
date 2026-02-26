<script lang="ts">
    import { isAndroidNative, isMobileWeb } from '$lib/core/NativeDialogs';
    import { blur } from '$lib/utils/platform';
    import { hapticSelection } from '$lib/utils/haptics';
    import { fade } from 'svelte/transition';
    import { glassModal } from '$lib/utils/transitions';
    import { t } from '$lib/i18n';
    import Button from '$lib/components/ui/Button.svelte';
    import BottomSheetHandle from '$lib/components/ui/BottomSheetHandle.svelte';
    import { bottomSheet } from '$lib/actions/bottomSheet';
    import Avatar from './Avatar.svelte';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { resolveDisplayName } from '$lib/core/nameUtils';
    import { currentUser } from '$lib/stores/auth';

    let { isOpen, close, participants, onMemberClick } = $props<{
        isOpen: boolean;
        close: () => void;
        participants: string[];
        onMemberClick?: (npub: string) => void;
    }>();

    const isAndroidApp = isAndroidNative();
    const isMobile = isAndroidApp || isMobileWeb();

    let overlayElement: HTMLDivElement | undefined = $state();

    // Member display data
    let members = $state<{ npub: string; name: string; picture?: string; isCurrentUser: boolean }[]>([]);
    let loading = $state(false);

    function shortenNpub(npub: string): string {
        if (npub.length <= 20) return npub;
        return `${npub.slice(0, 12)}...${npub.slice(-6)}`;
    }

    $effect(() => {
        if (isOpen && participants.length > 0) {
            void loadMembers();
        }
    });

    async function loadMembers(): Promise<void> {
        loading = true;
        try {
            const memberData = await Promise.all(
                participants.map(async (npub: string) => {
                    const profile = await profileRepo.getProfileIgnoreTTL(npub);
                    const isCurrentUser = $currentUser?.npub === npub;

                    let name = shortenNpub(npub);
                    let picture: string | undefined = undefined;

                    if (profile?.metadata) {
                        name = resolveDisplayName(profile.metadata, npub);
                        picture = profile.metadata.picture;
                    }

                    return {
                        npub,
                        name,
                        picture,
                        isCurrentUser
                    };
                })
            );

            // Sort: current user first, then alphabetically
            members = memberData.sort((a, b) => {
                if (a.isCurrentUser) return -1;
                if (b.isCurrentUser) return 1;
                return a.name.localeCompare(b.name);
            });
        } finally {
            loading = false;
        }
    }

    function handleMemberClick(npub: string): void {
        hapticSelection();
        if (onMemberClick) {
            onMemberClick(npub);
        }
    }


</script>

{#if isOpen}
    <div
        bind:this={overlayElement}
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class={`fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 ${blur('sm')} z-50 flex justify-center ${
            isMobile ? 'items-end' : 'items-center p-4'
        }`}
        class:android-safe-area-top={isAndroidApp}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => { if (e.target === e.currentTarget) { hapticSelection(); close(); } }}
        onkeydown={(e) => { if (e.key === 'Escape') { hapticSelection(); close(); } }}
    >
        <div
            use:bottomSheet={{ enabled: isMobile, onClose: () => { hapticSelection(); close(); }, overlay: overlayElement }}
            in:glassModal={{ duration: 200, scaleFrom: 0.92 }}
            out:glassModal={{ duration: 150, scaleFrom: 0.92 }}
            class={`bg-white/95 dark:bg-slate-900/80 ${blur('xl')} shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden relative outline-none ${
                isMobile
                    ? 'w-full rounded-t-3xl rounded-b-none max-h-[90vh] p-6'
                    : 'w-full max-w-lg max-h-[80vh] rounded-3xl p-8'
            }`}
            class:android-safe-area-bottom={isAndroidApp}
        >
            {#if isMobile}
                <BottomSheetHandle />
            {/if}

            {#if !isMobile}
                <Button
                    onclick={close}
                    aria-label="Close modal"
                    size="icon"
                    class="absolute top-4 right-4 z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </Button>
            {/if}

            <div class={isMobile ? 'flex flex-col mb-6 mt-8 w-full max-w-2xl mx-auto' : 'flex justify-between items-center mb-6 px-1'}>
                <h2 class="typ-title dark:text-white">{$t('chat.group.membersTitle')}</h2>
            </div>

            <div class={`flex-1 overflow-y-auto mb-2 custom-scrollbar native-scroll ${isMobile ? 'px-0' : 'pr-1'}`}>
                <div class={`space-y-1 ${isMobile ? 'max-w-2xl mx-auto w-full' : ''}`}>
                    {#if loading}
                        <!-- Loading skeleton -->
                        {#each Array(3) as _}
                            <div class="flex items-center gap-3 p-3 animate-pulse">
                                <div class="w-12 h-12 bg-gray-200 dark:bg-slate-700 rounded-full flex-shrink-0"></div>
                                <div class="flex-1 space-y-2">
                                    <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3"></div>
                                    <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
                                </div>
                            </div>
                        {/each}
                    {:else if members.length === 0}
                        <div class="text-gray-500 text-center py-8 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                            No members
                        </div>
                    {:else}
                        {#each members as member (member.npub)}
                            <button
                                type="button"
                                class="flex items-center gap-3 p-3 w-full rounded-2xl transition-all duration-200 ease-out cursor-pointer hover:bg-[rgb(var(--color-lavender-rgb)/0.12)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.16)] active:scale-[0.98]"
                                onclick={() => handleMemberClick(member.npub)}
                            >
                                <Avatar
                                    npub={member.npub}
                                    src={member.picture}
                                    size="md"
                                    class="!w-12 !h-12 flex-shrink-0"
                                />
                                <div class="flex flex-col min-w-0 text-start">
                                    <span class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px]">
                                        {member.name}
                                        {#if member.isCurrentUser}
                                            <span class="font-normal text-gray-500 dark:text-slate-400"> ({$t('contacts.youPrefix')})</span>
                                        {/if}
                                    </span>
                                    <span class="typ-meta text-gray-500 dark:text-slate-400 truncate font-mono opacity-75">
                                        {shortenNpub(member.npub)}
                                    </span>
                                </div>
                            </button>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}
