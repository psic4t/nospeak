<script lang="ts">
    import { fade } from 'svelte/transition';
    import { glassModal } from '$lib/utils/transitions';
    import { t } from '$lib/i18n';
    import { profileRepo } from '$lib/db/ProfileRepository';
    import { contactRepo } from '$lib/db/ContactRepository';
    import { addContactByNpub } from '$lib/core/ContactService';
    import Button from '$lib/components/ui/Button.svelte';

    let { isOpen, npub, close } = $props<{ isOpen: boolean; npub: string | null; close: () => void }>();

    let displayName = $state<string | null>(null);
    let picture = $state<string | null>(null);
    let isExistingContact = $state(false);
    let isLoading = $state(false);
    let errorMessage = $state<string | null>(null);
    let isAdding = $state(false);

    async function loadInfo(currentNpub: string): Promise<void> {
        isLoading = true;
        errorMessage = null;

        try {
            const contacts = await contactRepo.getContacts();
            isExistingContact = contacts.some((c) => c.npub === currentNpub);

            const cachedProfile = await profileRepo.getProfileIgnoreTTL(currentNpub);
            updateFromProfile(cachedProfile, currentNpub);

            try {
                const { profileResolver } = await import('$lib/core/ProfileResolver');
                await profileResolver.resolveProfile(currentNpub, true);
                const freshProfile = await profileRepo.getProfileIgnoreTTL(currentNpub);
                updateFromProfile(freshProfile, currentNpub);
            } catch (e) {
                console.error('ScanContactQrResultModal: failed to resolve profile', e);
            }
        } catch (error) {
            console.error('ScanContactQrResultModal: failed to load contact info', error);
            errorMessage = 'Failed to load contact details from QR.';
        } finally {
            isLoading = false;
        }
    }

    function updateFromProfile(profile: any, currentNpub: string): void {
        if (!profile || !profile.metadata) {
            const short =
                currentNpub.length <= 20
                    ? currentNpub
                    : `${currentNpub.slice(0, 12)}...${currentNpub.slice(-6)}`;
            if (!displayName) {
                displayName = short;
            }
            if (!picture) {
                picture = null;
            }
            return;
        }

        const short =
            currentNpub.length <= 20
                ? currentNpub
                : `${currentNpub.slice(0, 12)}...${currentNpub.slice(-6)}`;

        displayName =
            profile.metadata.name ||
            profile.metadata.display_name ||
            profile.metadata.displayName ||
            displayName ||
            short;
        picture = profile.metadata.picture || picture;
    }

    async function handleAdd(): Promise<void> {
        if (!npub || isExistingContact) {
            return;
        }

        isAdding = true;
        errorMessage = null;

        try {
            await addContactByNpub(npub);
            close();
        } catch (error) {
            console.error('ScanContactQrResultModal: failed to add contact from QR result', error);
            errorMessage = 'Failed to add contact from QR.';
        } finally {
            isAdding = false;
        }
    }

    $effect(() => {
        if (!isOpen || !npub) {
            return;
        }

        displayName = null;
        picture = null;
        isExistingContact = false;
        isLoading = false;
        errorMessage = null;
        isAdding = false;

        loadInfo(npub);
    });
</script>

{#if isOpen && npub}
    <div
        in:fade={{ duration: 130 }}
        out:fade={{ duration: 110 }}
        class="fixed inset-0 bg-black/35 md:bg-black/40 bg-gradient-to-br from-black/40 via-black/35 to-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div
            in:glassModal={{ duration: 200, scaleFrom: 0.92, blurFrom: 1 }}
            out:glassModal={{ duration: 150, scaleFrom: 0.92, blurFrom: 1 }}
            class="bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl w-full max-w-sm rounded-3xl flex flex-col shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden relative outline-none p-6"
        >
            <Button
                onclick={close}
                aria-label="Close modal"
                size="icon"
                class="absolute top-4 right-4 z-10"
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
            </Button>

            <div class="mb-4 text-center">
                <h2 class="typ-title dark:text-white">Contact from QR</h2>
            </div>

            <div class="flex flex-col items-center gap-3">
                <div class="w-16 h-16 rounded-full bg-slate-700/40 overflow-hidden flex items-center justify-center text-xl text-white">
                    {#if picture}
                        <img src={picture} alt={displayName || npub} class="w-full h-full object-cover" />
                    {:else}
                        <span>{(displayName || npub).slice(0, 2).toUpperCase()}</span>
                    {/if}
                </div>

                <div class="text-sm font-semibold text-gray-900 dark:text-slate-50">
                    {displayName || npub}
                </div>

                <div class="text-[11px] text-gray-500 dark:text-slate-400 break-all max-w-full">
                    {npub}
                </div>

                {#if isExistingContact}
                    <div class="mt-2 text-xs text-gray-700 dark:text-slate-200 text-center">
                        This contact is already in your contacts.
                    </div>
                {:else}
                    <div class="mt-2 text-xs text-gray-600 dark:text-slate-300 text-center">
                        Review the contact from the scanned QR before adding.
                    </div>
                {/if}

                {#if isLoading}
                    <div class="mt-1 text-[11px] text-gray-500 dark:text-slate-400 text-center">
                        Updating profile…
                    </div>
                {/if}

                {#if errorMessage}
                    <div class="mt-1 text-[11px] text-red-500 text-center">
                        {errorMessage}
                    </div>
                {/if}
            </div>

            <div class="mt-6 flex justify-end gap-3">
                <Button
                    size="sm"
                    onclick={close}
                >
                    Close
                </Button>

                {#if !isExistingContact}
                    <Button
                        variant="primary"
                        size="sm"
                        onclick={handleAdd}
                        disabled={isAdding}
                    >
                        Add contact
                    </Button>
                {/if}
            </div>
        </div>
    </div>
{/if}
