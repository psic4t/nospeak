<script lang="ts">
    import { contacts as contactsStore, type Contact } from '$lib/stores/contacts';
    import ConnectionStatus from './ConnectionStatus.svelte';
    import { authService } from '$lib/core/AuthService';
    import ManageContactsModal from './ManageContactsModal.svelte';
    import { contactRepo } from '$lib/db/ContactRepository';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { liveQuery } from 'dexie';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import Avatar from './Avatar.svelte';
    import SettingsModal from './SettingsModal.svelte';
    import { softVibrate } from '$lib/utils/haptics';
    
    let isModalOpen = $state(false);
    let isSettingsOpen = $state(false);

    // Sync contacts from DB to store
    $effect(() => {
        const sub = liveQuery(async () => {
            const dbContacts = await contactRepo.getContacts();
            
            // Map with async profile resolution
            const contactsData = await Promise.all(dbContacts.map(async (c) => {
                const profile = await profileRepo.getProfileIgnoreTTL(c.npub);
                const lastMsgs = await messageRepo.getMessages(c.npub, 1);
                const lastMsgTime = lastMsgs.length > 0 ? lastMsgs[0].sentAt : 0;

                let name = c.npub.slice(0, 10) + '...';
                let picture = undefined;
                
                if (profile && profile.metadata) {
                     // Prioritize name fields
                     name = profile.metadata.name || profile.metadata.display_name || profile.metadata.displayName || name;
                     picture = profile.metadata.picture;
                }
                return {
                    npub: c.npub,
                    name: name,
                    picture: picture,
                    hasUnread: false, // TODO: Implement unread logic
                    lastMessageTime: lastMsgTime
                };
            }));
            
            return contactsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        }).subscribe(mapped => {
            contactsStore.set(mapped);
        });
        return () => sub.unsubscribe();
    });

    function selectContact(npub: string) {
        softVibrate();
        goto(`/chat/${npub}`, { invalidateAll: true }); 
    }
</script>

<div class="flex flex-col h-full bg-gray-50 dark:bg-gray-800 border-r dark:border-gray-700">
    <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
        <div class="font-bold dark:text-white">Contacts</div>
        <div class="flex gap-2">
            <button 
                onclick={() => {
                    softVibrate();
                    isSettingsOpen = true;
                }} 
                class="text-xs text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                aria-label="Open settings"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
            </button>
        </div>
    </div>
    
    <div class="flex-1 overflow-y-auto">
        {#if $contactsStore.length === 0}
            <div class="text-gray-500 text-center py-10 text-sm">
                No contacts yet.<br/>
                Click Manage below to add.
            </div>
        {/if}
        {#each $contactsStore as contact}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
                onclick={() => selectContact(contact.npub)}
                class={`p-3 cursor-pointer flex items-center gap-3 ${
                    page.url.pathname.includes(contact.npub) 
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
                <Avatar 
                    npub={contact.npub} 
                    src={contact.picture} 
                    size="md" 
                    class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-200"
                />
                
                <div class="flex-1 min-w-0">
                    <div class="font-medium dark:text-gray-200 truncate">{contact.name}</div>
                    <!-- <div class="text-xs text-gray-500">{new Date(contact.lastMessageTime || 0).toLocaleTimeString()}</div> -->
                </div>
                {#if contact.hasUnread}
                    <div class="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                {/if}
            </div>
        {/each}
    </div>

    <div class="p-2 border-t dark:border-gray-700">
        <button 
            onclick={() => {
                softVibrate();
                isModalOpen = true;
            }}
            class="w-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 py-1 px-2 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-800"
        >
            Manage Contacts
        </button>
    </div>

    <ConnectionStatus />
</div>

<ManageContactsModal isOpen={isModalOpen} close={() => isModalOpen = false} />
<SettingsModal isOpen={isSettingsOpen} close={() => isSettingsOpen = false} />
