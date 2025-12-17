<script lang="ts">
    import { contacts as contactsStore, type Contact } from '$lib/stores/contacts';
    import { currentUser } from '$lib/stores/auth';
    import ConnectionStatus from './ConnectionStatus.svelte';
    import { authService } from '$lib/core/AuthService';
    import { contactRepo } from '$lib/db/ContactRepository';
    import { messageRepo } from '$lib/db/MessageRepository';
    import { liveQuery } from 'dexie';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import type { ContactItem } from '$lib/db/db';
    import { goto } from '$app/navigation';
     import { page } from '$app/state';
     import Avatar from './Avatar.svelte';
       import { hapticSelection } from '$lib/utils/haptics';
       import { onMount } from 'svelte';


       import * as modals from '$lib/stores/modals';
       import { t } from '$lib/i18n';
       import { get } from 'svelte/store';
       import { isAndroidNative } from '$lib/core/NativeDialogs';
    import Button from '$lib/components/ui/Button.svelte';

      
 
 
 
     const isAndroidApp = isAndroidNative();
     let myPicture = $state<string | undefined>(undefined);
     let canScanQr = $state(false);


    $effect(() => {
        if (!$currentUser) {
            myPicture = undefined;
            return;
        }

        const npub = $currentUser.npub;

        const sub = liveQuery(() => profileRepo.getProfileIgnoreTTL(npub)).subscribe((p) => {
            if (p && p.metadata) {
                myPicture = p.metadata.picture;
            } else {
                myPicture = undefined;
            }
        });

        return () => {
            sub.unsubscribe();
        };
    });

    async function refreshContacts(dbContacts: ContactItem[]): Promise<void> {
        console.log('ContactList: Processing contacts from DB:', dbContacts.length);
        
             const contactsData = await Promise.all(dbContacts.map(async (c) => {
                 const profile = await profileRepo.getProfileIgnoreTTL(c.npub);
                 const lastMsgs = await messageRepo.getMessages(c.npub, 1);
                 const lastMsg = lastMsgs[0];
                 const lastMsgTime = lastMsg ? lastMsg.sentAt : 0;
                 const lastActivityTime = Math.max(lastMsgTime || 0, c.lastActivityAt || 0);

             const rawLastMessageText = lastMsg ? lastMsg.message : '';
 
             let lastMessageText = rawLastMessageText
                 .replace(/\s+/g, ' ')
                 .trim();
 
             if (lastMessageText && lastMsg && lastMsg.direction === 'sent') {
                 lastMessageText = `${get(t)('contacts.youPrefix') || 'You'}: ${lastMessageText}`;
             }


             let name = c.npub.slice(0, 10) + '...';
             let picture = undefined;
             let nip05: string | undefined = undefined;
             let nip05Status: 'valid' | 'invalid' | 'unknown' | undefined = undefined;
             
             if (profile && profile.metadata) {
                  // Prioritize name fields
                  name = profile.metadata.name || profile.metadata.display_name || profile.metadata.displayName || name;
                  picture = profile.metadata.picture;
                  nip05 = profile.metadata.nip05 || undefined;
                  nip05Status = profile.nip05Status;
             }
                 return {
                     npub: c.npub,
                     name: name,
                     picture: picture,
                     hasUnread: lastActivityTime > (c.lastReadAt || 0),
                     lastMessageTime: lastMsgTime,
                     nip05,
                     nip05Status,
                     lastMessageText: lastMessageText || undefined
                 };
             }));


        
        const sortedContacts = contactsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        console.log('ContactList: Updating store with', sortedContacts.length, 'contacts');
        contactsStore.set(sortedContacts);
    }

    // Sync contacts from DB to store
    // Use onMount instead of $effect to avoid infinite loop when updating store
    onMount(() => {
        console.log('ContactList: Setting up liveQuery subscription');
        
        // Watch contacts table changes for reactivity
        const sub = liveQuery(() => {
            console.log('ContactList: liveQuery triggered - contacts table changed');
            return contactRepo.getContacts();
        }).subscribe(async (dbContacts) => {
            await refreshContacts(dbContacts as ContactItem[]);
        });

        const handleNewMessage = async () => {
            try {
                const dbContacts = await contactRepo.getContacts();
                await refreshContacts(dbContacts as ContactItem[]);
            } catch (e) {
                console.error('ContactList: Failed to refresh after new message', e);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('nospeak:new-message', handleNewMessage as EventListener);
        }

        if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            canScanQr = true;
        }
        
        return () => {
            console.log('ContactList: Cleaning up liveQuery subscription');
            sub.unsubscribe();
            if (typeof window !== 'undefined') {
                window.removeEventListener('nospeak:new-message', handleNewMessage as EventListener);
            }
        };
    });

    function selectContact(npub: string) {
        hapticSelection();
        goto(`/chat/${npub}`, { invalidateAll: true }); 
    }
</script>

<div class="relative flex flex-col h-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-r border-gray-200/50 dark:border-slate-700/70 overflow-hidden">
    <div class="absolute top-0 left-0 right-0 z-20 flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-700/70 shadow-sm transition-all duration-200">
        <div class="p-2 h-16 flex items-center justify-between relative">
             {#if $currentUser}
                 <div class="flex items-center gap-2">
                     <button 
                         onclick={() => {
                             hapticSelection();
                              modals.openProfileModal($currentUser.npub);

                         }}
                         class="flex items-center"
                         aria-label="Open profile"
                     >
                        <Avatar 
                            npub={$currentUser.npub}
                            src={myPicture}
                            size="md"
                            class="!w-11 !h-11 transition-all duration-150 ease-out"
                        />
                     </button>
 
                     <Button
                         onclick={() => {
                             hapticSelection();
                              modals.showUserQrModal.set(true);

                         }}
                         variant="glass"
                         size="icon"
                         aria-label="Show nostr QR code"
                     >
                         <svg
                             class="w-6 h-6"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"


                         >
                             <rect x="3" y="3" width="6" height="6"></rect>
                             <rect x="15" y="3" width="6" height="6"></rect>
                             <rect x="3" y="15" width="6" height="6"></rect>
                             <path d="M15 15h2v2h-2z"></path>
                             <path d="M19 15h2v2h-2z"></path>
                             <path d="M15 19h2v2h-2z"></path>
                         </svg>
                     </Button>
                 </div>
             {/if}


            <span class="absolute left-1/2 -translate-x-1/2 typ-section text-gray-900 dark:text-white tracking-tight pointer-events-none">
                nospeak
            </span>
            <Button 
                onclick={() => {
                    hapticSelection();
                     modals.showSettingsModal.set(true);

                }} 
                variant="glass"
                size="icon"
                aria-label="Open settings"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
            </Button>
        </div>
        <div class="px-4 pb-3 flex justify-between items-center">
             <div class="flex items-center gap-2">
                 <div class="typ-section dark:text-white">{$t('contacts.title')}</div>

                     {#if canScanQr}
                     <Button
                         onclick={() => {
                             hapticSelection();
                             (modals as any).showScanContactQrModal.set(true);

                         }}
                         variant="glass"
                         size="icon"
                         aria-label={$t('contacts.scanQrAria')}
                     >
                         <svg
                             class="w-5 h-5"
                             viewBox="0 0 24 24"
                             fill="none"
                             stroke="currentColor"
                             stroke-width="2"
                             stroke-linecap="round"
                             stroke-linejoin="round"
                         >
                             <line x1="12" y1="5" x2="12" y2="19" />
                             <line x1="5" y1="12" x2="19" y2="12" />
                         </svg>
                     </Button>
                 {/if}
             </div>

            <Button 
                onclick={() => {
                    hapticSelection();
                    modals.showManageContactsModal.set(true);
                }}
                variant="glass"
            >
                {$t('contacts.manage')}
            </Button>
        </div>


    </div>
    
    <div class="flex-1 overflow-y-auto custom-scrollbar pt-[116px] pb-16">
        {#if $contactsStore.length === 0}
            <div class="space-y-3 p-3 animate-pulse">
                {#each Array(5) as _}
                    <div class="flex items-center gap-3 p-3 rounded-2xl bg-white/20 dark:bg-slate-800/20">
                        <div class="w-12 h-12 rounded-full bg-gray-200/50 dark:bg-slate-700/50"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-gray-200/50 dark:bg-slate-700/50 rounded w-2/3"></div>
                            <div class="h-3 bg-gray-200/50 dark:bg-slate-700/50 rounded w-1/3"></div>
                        </div>
                    </div>
                {/each}
                <div class="text-center text-sm text-gray-500 mt-4">
                    {$t('contacts.emptyHint')}
                </div>
            </div>
        {/if}
        {#each $contactsStore as contact}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
                onclick={() => selectContact(contact.npub)}
                class={`p-3 mx-3 my-1.5 rounded-2xl cursor-pointer flex items-center gap-3 transition-all duration-150 ease-out group border border-white/20 dark:border-white/10 active:scale-[0.98] ${
                    page.url.pathname.includes(contact.npub) 
                    ? 'bg-blue-50/20 dark:bg-blue-900/50 shadow-sm' 
                    : 'bg-white/10 dark:bg-slate-800/40 hover:bg-white/20 dark:hover:bg-slate-800/70 hover:shadow-lg'
                }`}
            >
                <Avatar 
                    npub={contact.npub} 
                    src={contact.picture} 
                    size="md" 
                    class="!w-14 !h-14 md:!w-10 md:!h-10 transition-all duration-150 ease-out"
                />
                
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1 min-w-0">
                        <span class="font-bold text-gray-800 dark:text-slate-100 truncate text-[15px]">{contact.name}</span>
                        {#if contact.nip05Status === 'valid'}
                            <svg
                                class="shrink-0 text-green-500"
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                <path d="m9 12 2 2 4-4"></path>
                            </svg>
                        {/if}
                    </div>
                    {#if contact.lastMessageText}
                        <div class="text-xs text-gray-800 dark:text-slate-300 truncate md:hidden">
                            {contact.lastMessageText}
                        </div>
                    {/if}
                </div>
                {#if contact.hasUnread}
                    <div class="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                {/if}
            </div>
        {/each}
    </div>

    <ConnectionStatus />
</div>
