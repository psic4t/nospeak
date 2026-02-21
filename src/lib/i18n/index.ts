import { init, register, locale, getLocaleFromNavigator, t } from 'svelte-i18n';

export type Language = 'en' | 'de' | 'es' | 'pt' | 'fr' | 'it' | 'fa';

const SUPPORTED_LOCALES: Language[] = ['en', 'de', 'es', 'pt', 'fr', 'it', 'fa'];
const DEFAULT_LOCALE: Language = 'en';

const RTL_LOCALES: Language[] = ['fa'];
 
register('en', () => import('./locales/en.ts'));
register('de', () => import('./locales/de.ts'));
register('es', () => import('./locales/es.ts'));
register('pt', () => import('./locales/pt.ts'));
register('fr', () => import('./locales/fr.ts'));
register('it', () => import('./locales/it.ts'));
register('fa', () => import('./locales/fa.ts'));
 
export function initI18n(initial: Language = DEFAULT_LOCALE): void {
    init({
        fallbackLocale: DEFAULT_LOCALE,
        initialLocale: initial
    });
}

// Initialize i18n at module load so that `$t` can
// be safely used during SSR and in any context
// that imports `$lib/i18n`.
initI18n(DEFAULT_LOCALE);
 
export function setLocaleSafe(lang: Language): void {
    if (!SUPPORTED_LOCALES.includes(lang)) {
        return;
    }
 
    locale.set(lang);
}


export function detectNavigatorLocale(): Language {
    const nav = getLocaleFromNavigator() ?? DEFAULT_LOCALE;
    const lower = nav.toLowerCase();

    if (lower.startsWith('de')) {
        return 'de';
    }

    if (lower.startsWith('es')) {
        return 'es';
    }

    if (lower.startsWith('fa')) {
        return 'fa';
    }

    if (lower.startsWith('pt')) {
        return 'pt';
    }

    if (lower.startsWith('fr')) {
        return 'fr';
    }

    if (lower.startsWith('it')) {
        return 'it';
    }

    return 'en';
}

export function isRtlLanguage(lang: Language): boolean {
    return RTL_LOCALES.includes(lang);
}

export { t };
