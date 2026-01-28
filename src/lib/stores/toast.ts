import { writable } from 'svelte/store';

export type ToastType = 'info' | 'success' | 'error';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
    onClick?: () => void;
}

const { subscribe, update } = writable<Toast[]>([]);

export const toasts = { subscribe };

export function showToast(message: string, type: ToastType = 'info', duration: number = 4000, onClick?: () => void): string {
    const id = crypto.randomUUID();
    update(t => [...t, { id, message, type, duration, onClick }]);
    if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
    }
    return id;
}

export function dismissToast(id: string): void {
    update(t => t.filter(toast => toast.id !== id));
}
