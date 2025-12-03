<script lang="ts">
    let { progress = 0 } = $props<{ progress: number }>();
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 mx-4 max-w-sm w-full shadow-xl">
        <div class="flex flex-col items-center gap-4">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div class="text-center">
                <div class="text-lg font-medium dark:text-white">Syncing messages...</div>
                <div class="text-gray-500 dark:text-gray-400 mt-1">({progress} fetched)</div>
            </div>
        </div>
    </div>
</div>
