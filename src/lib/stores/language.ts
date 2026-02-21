import { writable, type Writable } from 'svelte/store';
import { detectNavigatorLocale, initI18n, setLocaleSafe, type Language } from '$lib/i18n';

const STORAGE_KEY = 'nospeak-language';

function readStoredLanguage(): Language | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === 'en' || stored === 'de' || stored === 'es' || stored === 'pt' || stored === 'fr' || stored === 'it' || stored === 'fa') {
        return stored;
    }

    return null;
}

function persistLanguage(lang: Language): void {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.setItem(STORAGE_KEY, lang);
}

const DEFAULT_LANGUAGE: Language = 'en';

export const language: Writable<Language> = writable<Language>(DEFAULT_LANGUAGE);

export function initLanguage(): void {
    if (typeof window === 'undefined') {
        // Server-side: i18n is already initialized with the default language
        // at module load time in `$lib/i18n`.
        return;
    }
 
    const stored = readStoredLanguage();
    const effective = stored ?? detectNavigatorLocale();
 
    language.set(effective);
    setLocaleSafe(effective);
    persistLanguage(effective);
}


export function setLanguage(lang: Language): void {
    language.set(lang);
    persistLanguage(lang);
    setLocaleSafe(lang);
}
