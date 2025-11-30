<script lang="ts">
    import { contactRepo } from '$lib/db/ContactRepository';
    import { liveQuery } from 'dexie';
    import type { ContactItem } from '$lib/db/db';
    import { profileResolver } from '$lib/core/ProfileResolver';

    let { isOpen, close } = $props<{ isOpen: boolean, close: () => void }>();
    
    let newNpub = $state('');
    let contacts = $state<ContactItem[]>([]);
    let isAdding = $state(false);

    $effect(() => {
        const sub = liveQuery(() => contactRepo.getContacts()).subscribe(c => {
            contacts = c;
        });
        return () => sub.unsubscribe();
    });

    async function add() {
        if (newNpub.startsWith('npub')) {
            isAdding = true;
            try {
                await profileResolver.resolveProfile(newNpub, true);
                await contactRepo.addContact(newNpub);
                newNpub = '';
            } catch (e) {
                console.error('Failed to add contact:', e);
            } finally {
                isAdding = false;
            }
        }
    }

    function remove(npub: string) {
        contactRepo.removeContact(npub);
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 p-6 w-full h-full rounded-none md:w-96 md:h-auto md:max-h-[80vh] md:rounded-lg flex flex-col shadow-xl">
            <h2 class="text-xl font-bold mb-4 dark:text-white">Manage Contacts</h2>
            
            <div class="flex gap-2 mb-4">
                <input 
                    bind:value={newNpub}
                    placeholder="npub1..." 
                    class="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button 
                    onclick={add}
                    disabled={isAdding}
                    class="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    {isAdding ? 'Adding...' : 'Add'}
                </button>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2 mb-4 min-h-[200px]">
                {#if contacts.length === 0}
                    <div class="text-gray-500 text-center py-4">No contacts added</div>
                {/if}
                {#each contacts as contact}
                    <div class="flex justify-between items-center p-2 border rounded dark:border-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50">
                        <span class="truncate w-64">{contact.npub.slice(0, 12)}...{contact.npub.slice(-6)}</span>
                        <button 
                            onclick={() => remove(contact.npub)}
                            class="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded"
                        >
                            ✕
                        </button>
                    </div>
                {/each}
            </div>

            <button 
                onclick={close}
                class="w-full bg-gray-200 dark:bg-gray-700 dark:text-white p-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
                Close
            </button>
        </div>
    </div>
{/if}
