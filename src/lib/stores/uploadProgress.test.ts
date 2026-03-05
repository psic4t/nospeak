import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
    uploadProgress,
    setUploadPhase,
    setUploadPercent,
    clearUploadProgress,
    type UploadPhase,
} from './uploadProgress';

describe('uploadProgress store', () => {
    it('starts empty', () => {
        expect(get(uploadProgress).size).toBe(0);
    });

    it('setUploadPhase creates an entry with phase and 0 percent', () => {
        setUploadPhase('opt:1', 'encrypting');
        const entry = get(uploadProgress).get('opt:1');
        expect(entry).toEqual({ phase: 'encrypting', percent: 0 });
        clearUploadProgress('opt:1');
    });

    it('setUploadPercent updates percent for existing entry', () => {
        setUploadPhase('opt:2', 'uploading');
        setUploadPercent('opt:2', 42);
        const entry = get(uploadProgress).get('opt:2');
        expect(entry).toEqual({ phase: 'uploading', percent: 42 });
        clearUploadProgress('opt:2');
    });

    it('setUploadPercent is a no-op for unknown id', () => {
        setUploadPercent('unknown', 50);
        expect(get(uploadProgress).has('unknown')).toBe(false);
    });

    it('clearUploadProgress removes the entry', () => {
        setUploadPhase('opt:3', 'delivering');
        clearUploadProgress('opt:3');
        expect(get(uploadProgress).has('opt:3')).toBe(false);
    });

    it('setUploadPhase updates phase for existing entry and resets percent', () => {
        setUploadPhase('opt:4', 'uploading');
        setUploadPercent('opt:4', 75);
        setUploadPhase('opt:4', 'delivering');
        const entry = get(uploadProgress).get('opt:4');
        expect(entry).toEqual({ phase: 'delivering', percent: 0 });
        clearUploadProgress('opt:4');
    });
});
