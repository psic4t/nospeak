export class ResizeObserverManager {
    private observer: ResizeObserver | null = null;
    private callbacks = new Map<Element, (entry: ResizeObserverEntry) => void>();

    private static instance: ResizeObserverManager;

    static getInstance(): ResizeObserverManager {
        if (!this.instance) {
            this.instance = new ResizeObserverManager();
        }
        return this.instance;
    }

    observe(element: Element, callback: (entry: ResizeObserverEntry) => void) {
        if (typeof window === 'undefined') return;

        if (!this.observer) {
            this.observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const cb = this.callbacks.get(entry.target);
                    if (cb) cb(entry);
                }
            });
        }

        this.callbacks.set(element, callback);
        this.observer.observe(element);
    }

    unobserve(element: Element) {
        if (!this.observer) return;
        
        this.observer.unobserve(element);
        this.callbacks.delete(element);

        if (this.callbacks.size === 0) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

export class IntersectionObserverManager {
    private observer: IntersectionObserver | null = null;
    private callbacks = new Map<Element, (entry: IntersectionObserverEntry) => void>();

    private static instance: IntersectionObserverManager;

    static getInstance(): IntersectionObserverManager {
        if (!this.instance) {
            this.instance = new IntersectionObserverManager();
        }
        return this.instance;
    }

    observe(element: Element, callback: (entry: IntersectionObserverEntry) => void) {
        if (typeof window === 'undefined') return;

        if (!this.observer) {
            this.observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    const cb = this.callbacks.get(entry.target);
                    if (cb) cb(entry);
                }
            });
        }

        this.callbacks.set(element, callback);
        this.observer.observe(element);
    }

    unobserve(element: Element) {
        if (!this.observer) return;

        this.observer.unobserve(element);
        this.callbacks.delete(element);

        if (this.callbacks.size === 0) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}
