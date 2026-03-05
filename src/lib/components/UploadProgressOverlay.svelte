<script lang="ts">
    import { uploadProgress } from '$lib/stores/uploadProgress';
    import CircularProgress from '$lib/components/ui/CircularProgress.svelte';

    interface Props {
        eventId: string;
    }

    let { eventId }: Props = $props();

    let progress = $derived($uploadProgress.get(eventId));
    let label = $derived.by(() => {
        if (!progress) return '';
        switch (progress.phase) {
            case 'encrypting': return 'Encrypting...';
            case 'uploading': return `Uploading ${progress.percent}%`;
            case 'delivering': return 'Delivering...';
        }
    });
    let progressValue = $derived(
        progress?.phase === 'uploading' ? progress.percent : undefined
    );
</script>

{#if progress}
    <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 rounded-lg">
        <CircularProgress
            size={48}
            strokeWidth={4}
            value={progressValue}
            class="text-white"
        />
        <span class="mt-2 text-xs font-medium text-white/90 drop-shadow">
            {label}
        </span>
    </div>
{/if}
