<script lang="ts">
    import type { Message } from '$lib/db/db';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import ProfileModal from './ProfileModal.svelte';
    import { messagingService } from '$lib/core/Messaging';
    import Avatar from './Avatar.svelte';
    import { currentUser } from '$lib/stores/auth';
    
    let { messages = [], partnerNpub } = $props<{ messages: Message[], partnerNpub?: string }>();
    let inputText = $state('');
    let partnerName = $state('');
    let partnerPicture = $state<string | undefined>(undefined);
    let myPicture = $state<string | undefined>(undefined);
    let isProfileOpen = $state(false);
    let profileModalNpub = $state<string | undefined>(undefined);
    let isSending = $state(false);
    let chatContainer: HTMLElement;
    let inputElement: HTMLInputElement;
    let currentTime = $state(Date.now());

    function openProfile(npub: string) {
        profileModalNpub = npub;
        isProfileOpen = true;
    }

    // Resolve profile info
    $effect(() => {
        if (partnerNpub) {
            profileRepo.getProfileIgnoreTTL(partnerNpub).then(p => {
                if (p && p.metadata) {
                    partnerName = p.metadata.name || p.metadata.display_name || p.metadata.displayName;
                    partnerPicture = p.metadata.picture;
                }
            });
        }
    });

    // Fetch current user's profile picture
    $effect(() => {
        if ($currentUser) {
            profileRepo.getProfileIgnoreTTL($currentUser.npub).then(p => {
                if (p && p.metadata) {
                    myPicture = p.metadata.picture;
                }
            });
        }
    });

    // Auto-scroll to bottom on new messages
    $effect(() => {
        // Dependency on messages length to trigger scroll
        messages.length; 
        scrollToBottom();
    });

    // Auto-focus input
    $effect(() => {
        partnerNpub; // Trigger on chat switch
        if (!isSending && inputElement) {
            inputElement.focus();
        }
    });

    // Update current time every minute to refresh relative times
    $effect(() => {
        const interval = setInterval(() => {
            currentTime = Date.now();
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    });

    function scrollToBottom() {
        if (chatContainer) {
            // Use timeout to ensure DOM has updated height
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 0);
        }
    }

    function getRelativeTime(timestamp: number): string {
        const now = currentTime;
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
        if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
        if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
        return `${years} year${years !== 1 ? 's' : ''} ago`;
    }

    async function send() {
        if (!partnerNpub || !inputText.trim()) return;
        
        const text = inputText;
        inputText = ''; // Clear immediately for UX
        isSending = true;
        
        try {
            await messagingService.sendMessage(partnerNpub, text);
            // The message will appear via reactive prop update from parent
        } catch (e) {
            console.error('Failed to send message:', e);
            alert('Failed to send message: ' + (e as Error).message);
            inputText = text; // Restore text on failure
        } finally {
            isSending = false;
        }
    }
</script>

<svelte:head>
    {#if partnerNpub}
        <title>nospeak: chat with {partnerName || partnerNpub.slice(0, 10) + '...'}</title>
    {/if}
</svelte:head>

<div class="flex flex-col h-full">
    {#if partnerNpub}
        <div class="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <button 
                onclick={() => partnerNpub && openProfile(partnerNpub)}
                class="font-bold hover:underline dark:text-white text-left"
            >
                {partnerName || partnerNpub.slice(0, 10) + '...'}
            </button>
        </div>
    {/if}

    <div 
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto p-4 space-y-4"
    >
        {#if messages.length === 0}
            <div class="text-center text-gray-400 mt-10">No messages yet</div>
        {/if}
        
        {#each messages as msg}
            <div class={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {#if msg.direction === 'received' && partnerNpub}
                    <button class="mb-1 hover:opacity-80 transition-opacity cursor-pointer" onclick={() => partnerNpub && openProfile(partnerNpub)}>
                        <Avatar npub={partnerNpub} src={partnerPicture} size="sm" />
                    </button>
                {/if}
                
                <div 
                    class={`max-w-[70%] p-3 rounded-lg shadow-sm
                        ${msg.direction === 'sent' 
                            ? 'bg-blue-500 text-white rounded-br-none' 
                            : 'bg-white dark:bg-gray-700 dark:text-white border dark:border-gray-600 rounded-bl-none'
                        }`}
                >
                    <div class="whitespace-pre-wrap break-words">{msg.message}</div>
                    <div 
                        class={`text-[10px] mt-1 text-right ${msg.direction === 'sent' ? 'text-blue-100' : 'text-gray-400'} cursor-help`}
                        title={new Date(msg.sentAt).toLocaleString()}
                    >
                        {getRelativeTime(msg.sentAt)}
                    </div>
                </div>

                {#if msg.direction === 'sent' && $currentUser}
                    <button class="mb-1 hover:opacity-80 transition-opacity cursor-pointer" onclick={() => $currentUser && openProfile($currentUser.npub)}>
                        <Avatar npub={$currentUser.npub} src={myPicture} size="sm" />
                    </button>
                {/if}
            </div>
        {/each}
    </div>

    <div class="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <form onsubmit={(e) => { e.preventDefault(); send(); }} class="flex gap-3 items-end">
            {#if $currentUser}
                <button class="flex-shrink-0 h-10 hover:opacity-80 transition-opacity cursor-pointer" onclick={() => $currentUser && openProfile($currentUser.npub)}>
                    <Avatar npub={$currentUser.npub} src={myPicture} size="md" />
                </button>
            {/if}
            <div class="flex-1 flex gap-2">
                <input 
                    bind:this={inputElement}
                    bind:value={inputText} 
                    disabled={isSending}
                    class="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type a message..."
                />
                <button 
                    type="submit" 
                    disabled={isSending || !inputText.trim()}
                    class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors"
                >
                    {isSending ? '...' : 'Send'}
                </button>
            </div>
        </form>
    </div>
</div>

{#if partnerNpub || profileModalNpub}
    <ProfileModal isOpen={isProfileOpen} close={() => isProfileOpen = false} npub={profileModalNpub || partnerNpub || ''} />
{/if}
