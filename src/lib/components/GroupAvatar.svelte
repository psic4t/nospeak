<script lang="ts">
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { onMount } from 'svelte';

    let { 
        participants = [],
        size = 'md',
        class: className = ''
    } = $props<{ 
        participants: string[];
        size?: 'sm' | 'md' | 'lg';
        class?: string;
    }>();

    // Size configurations for the container and individual avatars
    const sizeConfig = {
        sm: { container: 'w-8 h-8', avatar: 'w-5 h-5', offset: '-ml-2' },
        md: { container: 'w-10 h-10', avatar: 'w-6 h-6', offset: '-ml-2' },
        lg: { container: 'w-16 h-16', avatar: 'w-9 h-9', offset: '-ml-3' }
    };

    // Show up to 3 avatars
    const maxAvatars = 3;
    let displayParticipants = $derived(participants.slice(0, maxAvatars));
    let remainingCount = $derived(Math.max(0, participants.length - maxAvatars));

    // Profile pictures for participants
    let pictures = $state<Map<string, string | undefined>>(new Map());

    function getRobotUrl(npub: string): string {
        return `https://robohash.org/${npub.slice(-10)}.png?set=set1&bgset=bg2`;
    }

    // Fetch profile pictures for participants
    $effect(() => {
        const npubs = displayParticipants;
        if (npubs.length === 0) return;

        for (const npub of npubs) {
            profileRepo.getProfileIgnoreTTL(npub).then((profile) => {
                if (profile?.metadata?.picture) {
                    pictures.set(npub, profile.metadata.picture);
                    pictures = new Map(pictures); // Trigger reactivity
                }
            });
        }
    });

    let imgErrors = $state<Set<string>>(new Set());

    function handleImgError(npub: string) {
        imgErrors.add(npub);
        imgErrors = new Set(imgErrors);
    }

    function getSrc(npub: string): string {
        if (imgErrors.has(npub)) {
            return getRobotUrl(npub);
        }
        return pictures.get(npub) || getRobotUrl(npub);
    }

    const config = $derived(sizeConfig[size as keyof typeof sizeConfig]);
</script>

<div class={`${config.container} ${className} relative flex items-center justify-center`}>
    {#if displayParticipants.length === 0}
        <!-- Empty group placeholder -->
        <div class="w-full h-full rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
            <svg class="w-1/2 h-1/2 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
        </div>
    {:else if displayParticipants.length === 1}
        <!-- Single participant - show full avatar -->
        <div class="w-full h-full rounded-full ring-2 ring-white/50 dark:ring-white/10 overflow-hidden bg-gray-200 dark:bg-slate-700 shadow-sm">
            <img 
                src={getSrc(displayParticipants[0])} 
                alt="Group member" 
                class="w-full h-full object-cover"
                onerror={() => handleImgError(displayParticipants[0])}
            />
        </div>
    {:else}
        <!-- Multiple participants - stacked layout -->
        <div class="flex items-center pl-1">
            {#each displayParticipants as npub, i}
                <div 
                    class={`${config.avatar} rounded-full ring-2 ring-white dark:ring-slate-900 overflow-hidden bg-gray-200 dark:bg-slate-700 shadow-sm ${i > 0 ? config.offset : ''}`}
                    style="z-index: {displayParticipants.length - i}"
                >
                    <img 
                        src={getSrc(npub)} 
                        alt="Group member" 
                        class="w-full h-full object-cover"
                        onerror={() => handleImgError(npub)}
                    />
                </div>
            {/each}
            {#if remainingCount > 0}
                <div 
                    class={`${config.avatar} rounded-full ring-2 ring-white dark:ring-slate-900 bg-gray-300 dark:bg-slate-600 shadow-sm ${config.offset} flex items-center justify-center`}
                    style="z-index: 0"
                >
                    <span class="text-[10px] font-bold text-gray-600 dark:text-slate-300">+{remainingCount}</span>
                </div>
            {/if}
        </div>
    {/if}
</div>
