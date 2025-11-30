import chokidar from 'chokidar';
import { join } from 'node:path';
import { utimes } from 'node:fs/promises';

export class FileWatcherService {
    private watcher: import('chokidar').FSWatcher | null = null;
    private userMediaDir: string;

    constructor() {
        const isProduction = process.env.NODE_ENV === 'production';
        this.userMediaDir = join(process.cwd(), isProduction ? 'build/client' : 'static', 'user_media');
    }

    public start(): void {
        if (this.watcher) {
            console.log('File watcher already running');
            return;
        }

        console.log(`Starting file watcher for: ${this.userMediaDir}`);

        this.watcher = chokidar.watch(this.userMediaDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            depth: 1 // Only watch immediate files in user_media
        });

        this.watcher
            .on('add', (path: string) => {
                console.log(`New file detected: ${path}`);
                this.handleFileAdd(path);
            })
            .on('error', (error: unknown) => {
                console.error('File watcher error:', error);
            });
    }

    public stop(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('File watcher stopped');
        }
    }

    private async handleFileAdd(_filePath: string): Promise<void> {
        try {
            // Update directory timestamps to help adapter-node recognize new files
            const now = new Date();
            await utimes(this.userMediaDir, now, now);
            console.log(`Updated directory timestamp for: ${this.userMediaDir}`);
        } catch (error) {
            console.error('Failed to update directory timestamp:', error);
        }
    }
}

// Singleton instance
let fileWatcher: FileWatcherService | null = null;

export function getFileWatcher(): FileWatcherService {
    if (!fileWatcher) {
        fileWatcher = new FileWatcherService();
    }
    return fileWatcher;
}