export function getDisplayedNip05(raw: string): string {
    if (typeof raw !== 'string') return '';
    const value = raw.trim();
    if (!value) {
        return '';
    }

    const match = value.match(/^_@(.+)$/);
    if (match) {
        return match[1];
    }

    return value;
}
