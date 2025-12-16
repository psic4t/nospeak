declare module '@capacitor/filesystem' {
    export enum Directory {
        Documents = 'DOCUMENTS',
        Data = 'DATA',
        Cache = 'CACHE',
        External = 'EXTERNAL',
        ExternalStorage = 'EXTERNAL_STORAGE'
    }

    export interface WriteFileOptions {
        path: string;
        data: string;
        directory?: Directory;
        recursive?: boolean;
    }

    export interface DeleteFileOptions {
        path: string;
        directory?: Directory;
    }

    export interface ReaddirOptions {
        path: string;
        directory?: Directory;
    }

    export interface ReaddirResultEntry {
        name: string;
        type?: 'file' | 'directory';
    }

    export interface ReaddirResult {
        files: ReaddirResultEntry[];
    }

    export interface WriteFileResult {
        uri?: string;
        path?: string;
    }

    export const Filesystem: {
        writeFile(options: WriteFileOptions): Promise<WriteFileResult>;
        deleteFile(options: DeleteFileOptions): Promise<void>;
        readdir(options: ReaddirOptions): Promise<ReaddirResult>;
    };
}
