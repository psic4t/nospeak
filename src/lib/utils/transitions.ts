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
         scaleFrom = 0.98,
         blurFrom = 2
     } = options;
 
     return {
         duration,
         css: (t: number) => {
             const eased = easing(t);
             const scale = scaleFrom + (1 - scaleFrom) * eased;
             const blur = blurFrom * (1 - eased);
             const opacity = eased;
 
             return `
                 opacity: ${opacity};
                 transform: scale(${scale});
                 ${blurFrom > 0 ? `filter: blur(${blur}px);` : ''}
             `;
         }
     };
 }

