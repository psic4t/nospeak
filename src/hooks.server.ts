import { getFileWatcher } from '$lib/core/FileWatcherService';
import { sequence } from '@sveltejs/kit/hooks';

const fileWatcher = getFileWatcher();

// Initialize file watcher only in production
if (process.env.NODE_ENV === 'production') {
    fileWatcher.start();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down file watcher...');
    fileWatcher.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down file watcher...');
    fileWatcher.stop();
    process.exit(0);
});

export const handle = sequence(async ({ event, resolve }) => {
    return resolve(event);
});