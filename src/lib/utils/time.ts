import { t } from '$lib/i18n';
import { get } from 'svelte/store';

/**
 * Returns a human-readable relative time string for a given timestamp.
 * Uses i18n translations from `chat.relative.*` keys.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param now - Current time in milliseconds (pass a reactive value for live updates)
 */
export function getRelativeTime(timestamp: number, now: number): string {
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    const translate = get(t) as (key: string, vars?: Record<string, unknown>) => string;

    if (seconds < 60) return translate('chat.relative.justNow');

    if (minutes < 60) {
        const key = minutes === 1 ? 'chat.relative.minutes' : 'chat.relative.minutesPlural';
        return translate(key, { values: { count: minutes } });
    }

    if (hours < 24) {
        const key = hours === 1 ? 'chat.relative.hours' : 'chat.relative.hoursPlural';
        return translate(key, { values: { count: hours } });
    }

    if (days < 7) {
        const key = days === 1 ? 'chat.relative.days' : 'chat.relative.daysPlural';
        return translate(key, { values: { count: days } });
    }

    if (weeks < 4) {
        const key = weeks === 1 ? 'chat.relative.weeks' : 'chat.relative.weeksPlural';
        return translate(key, { values: { count: weeks } });
    }

    if (months < 12) {
        const key = months === 1 ? 'chat.relative.months' : 'chat.relative.monthsPlural';
        return translate(key, { values: { count: months } });
    }

    const key = years === 1 ? 'chat.relative.years' : 'chat.relative.yearsPlural';
    return translate(key, { values: { count: years } });
}
