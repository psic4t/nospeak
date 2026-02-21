import { init, register, locale, getLocaleFromNavigator, t } from 'svelte-i18n';

export type Language = 'en' | 'ar' | 'de' | 'es' | 'fa' | 'fr' | 'he' | 'hi' | 'it' | 'ja' | 'ko' | 'nl' | 'pl' | 'pt' | 'ru' | 'tr' | 'ur' | 'zh';

const SUPPORTED_LOCALES: Language[] = ['en', 'ar', 'de', 'es', 'fa', 'fr', 'he', 'hi', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'ur', 'zh'];
const DEFAULT_LOCALE: Language = 'en';

const RTL_LOCALES: Language[] = ['ar', 'fa', 'he', 'ur'];

register('en', () => import('./locales/en.ts'));
register('ar', () => import('./locales/ar.ts'));
register('de', () => import('./locales/de.ts'));
register('es', () => import('./locales/es.ts'));
register('fa', () => import('./locales/fa.ts'));
register('fr', () => import('./locales/fr.ts'));
register('he', () => import('./locales/he.ts'));
register('hi', () => import('./locales/hi.ts'));
register('it', () => import('./locales/it.ts'));
register('ja', () => import('./locales/ja.ts'));
register('ko', () => import('./locales/ko.ts'));
register('nl', () => import('./locales/nl.ts'));
register('pl', () => import('./locales/pl.ts'));
register('pt', () => import('./locales/pt.ts'));
register('ru', () => import('./locales/ru.ts'));
register('tr', () => import('./locales/tr.ts'));
register('ur', () => import('./locales/ur.ts'));
register('zh', () => import('./locales/zh.ts'));
 
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

    if (lower.startsWith('ar')) {
        return 'ar';
    }

    if (lower.startsWith('de')) {
        return 'de';
    }

    if (lower.startsWith('es')) {
        return 'es';
    }

    if (lower.startsWith('fa')) {
        return 'fa';
    }

    if (lower.startsWith('fr')) {
        return 'fr';
    }

    if (lower.startsWith('he')) {
        return 'he';
    }

    if (lower.startsWith('hi')) {
        return 'hi';
    }

    if (lower.startsWith('it')) {
        return 'it';
    }

    if (lower.startsWith('ja')) {
        return 'ja';
    }

    if (lower.startsWith('ko')) {
        return 'ko';
    }

    if (lower.startsWith('nl')) {
        return 'nl';
    }

    if (lower.startsWith('pl')) {
        return 'pl';
    }

    if (lower.startsWith('pt')) {
        return 'pt';
    }

    if (lower.startsWith('ru')) {
        return 'ru';
    }

    if (lower.startsWith('tr')) {
        return 'tr';
    }

    if (lower.startsWith('ur')) {
        return 'ur';
    }

    if (lower.startsWith('zh')) {
        return 'zh';
    }

    return 'en';
}

export function isRtlLanguage(lang: Language): boolean {
    return RTL_LOCALES.includes(lang);
}

export { t };
