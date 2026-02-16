import { quintOut } from 'svelte/easing';
 
 export type EasingFn = (t: number) => number;
 
 export interface GlassModalOptions {
     duration?: number;
     easing?: EasingFn;
     scaleFrom?: number;
     blurFrom?: number;
 }
 
export function glassModal(_node: Element, options: GlassModalOptions = {}) {
    const {
        duration = 150,
        easing = quintOut,
        scaleFrom = 1
    } = options;

    return {
        duration,
        css: (t: number) => {
            const eased = easing(t);
            const scale = scaleFrom + (1 - scaleFrom) * eased;

            return `
                opacity: ${eased};
                transform: scale(${scale});
            `;
        }
    };
}

