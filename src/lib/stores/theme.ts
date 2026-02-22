export type Theme = 'latte' | 'frappe' | 'macchiato' | 'mocha';
export type ThemeMode = 'system' | 'light' | 'dark' | 'cypher';

export interface ThemeColors {
	rosewater: string;
	flamingo: string;
	pink: string;
	mauve: string;
	red: string;
	maroon: string;
	peach: string;
	yellow: string;
	green: string;
	teal: string;
	sky: string;
	sapphire: string;
	blue: string;
	lavender: string;
	text: string;
	subtext1: string;
	subtext0: string;
	overlay2: string;
	overlay1: string;
	overlay0: string;
	surface2: string;
	surface1: string;
	surface0: string;
	base: string;
	mantle: string;
	crust: string;
}

import { syncAndroidStatusBarTheme } from '$lib/core/StatusBar';

export const catppuccinThemes: Record<Theme, ThemeColors> = {
	latte: {
		rosewater: '#dc8a78',
		flamingo: '#dd7878',
		pink: '#ea76cb',
		mauve: '#8839ef',
		red: '#d20f39',
		maroon: '#e64553',
		peach: '#fe640b',
		yellow: '#df8e1d',
		green: '#40a02b',
		teal: '#179299',
		sky: '#04a5e5',
		sapphire: '#209fb5',
		blue: '#1e66f5',
		lavender: '#7287fd',
		text: '#4c4f69',
		subtext1: '#5c5f77',
		subtext0: '#6c6f85',
		overlay2: '#7c7f93',
		overlay1: '#8c8fa1',
		overlay0: '#9ca0b0',
		surface2: '#acb0be',
		surface1: '#bcc0cc',
		surface0: '#ccd0da',
		base: '#eff1f5',
		mantle: '#e6e9ef',
		crust: '#dce0e8'
	},
	frappe: {
		rosewater: '#f2d5cf',
		flamingo: '#eebebe',
		pink: '#f4b8e4',
		mauve: '#ca9ee6',
		red: '#e78284',
		maroon: '#ea999c',
		peach: '#ef9f76',
		yellow: '#e5c890',
		green: '#a6d189',
		teal: '#81c8be',
		sky: '#99d1db',
		sapphire: '#85c1dc',
		blue: '#8caaee',
		lavender: '#babbf1',
		text: '#c6d0f5',
		subtext1: '#b5bfe2',
		subtext0: '#a5adce',
		overlay2: '#949cbb',
		overlay1: '#838ba7',
		overlay0: '#737994',
		surface2: '#626880',
		surface1: '#51576d',
		surface0: '#414559',
		base: '#303446',
		mantle: '#292c3c',
		crust: '#232634'
	},
	macchiato: {
		rosewater: '#f4dbd6',
		flamingo: '#f0c6c6',
		pink: '#f5bde6',
		mauve: '#c6a0f6',
		red: '#ed8796',
		maroon: '#ee99a0',
		peach: '#f5a97f',
		yellow: '#eed49f',
		green: '#a6da95',
		teal: '#8bd5ca',
		sky: '#91d7e3',
		sapphire: '#7dc4e4',
		blue: '#8aadf4',
		lavender: '#b7bdf8',
		text: '#cad3f5',
		subtext1: '#b8c0e0',
		subtext0: '#a5adc6',
		overlay2: '#939ab7',
		overlay1: '#8087a2',
		overlay0: '#6e738d',
		surface2: '#5b6078',
		surface1: '#494d64',
		surface0: '#363a4f',
		base: '#24273a',
		mantle: '#1e2030',
		crust: '#181926'
	},
	mocha: {
		rosewater: '#f5e0dc',
		flamingo: '#f2cdcd',
		pink: '#f5c2e7',
		mauve: '#cba6f7',
		red: '#f38ba8',
		maroon: '#eba0ac',
		peach: '#fab387',
		yellow: '#f9e2af',
		green: '#a6e3a1',
		teal: '#94e2d5',
		sky: '#89dceb',
		sapphire: '#74c7ec',
		blue: '#89b4fa',
		lavender: '#b4befe',
		text: '#cdd6f4',
		subtext1: '#bac2de',
		subtext0: '#a6adc8',
		overlay2: '#9399b2',
		overlay1: '#7f849c',
		overlay0: '#6c7086',
		surface2: '#585b70',
		surface1: '#45475a',
		surface0: '#313244',
		base: '#1e1e2e',
		mantle: '#181825',
		crust: '#11111b'
	}
};

export const cypherTheme: ThemeColors = {
	rosewater: '#00ffff',
	flamingo: '#00ffff',
	pink: '#00ffff',
	mauve: '#00ffff',
	red: '#00ffff',
	maroon: '#00ffff',
	peach: '#00ffff',
	yellow: '#00ffff',
	green: '#00ffff',
	teal: '#00ffff',
	sky: '#00ffff',
	sapphire: '#00ffff',
	blue: '#00ffff',
	lavender: '#00ffff',
	text: '#ffffff',
	subtext1: '#b3b3b3',
	subtext0: '#999999',
	overlay2: '#00ffff',
	overlay1: '#00ffff',
	overlay0: '#00ffff',
	surface2: '#000000',
	surface1: '#000000',
	surface0: '#000000',
	base: '#000000',
	mantle: '#000000',
	crust: '#000000'
};

export const themeNames: Record<Theme, string> = {
	latte: 'Catppuccin Latte',
	frappe: 'Catppuccin Frappé',
	macchiato: 'Catppuccin Macchiato',
	mocha: 'Catppuccin Mocha'
};

function hexToRgb(hex: string): string | null {
	const normalized = hex.replace('#', '');

	if (normalized.length !== 6) {
		return null;
	}

	const numeric = parseInt(normalized, 16);
	const r = (numeric >> 16) & 255;
	const g = (numeric >> 8) & 255;
	const b = numeric & 255;

	return `${r} ${g} ${b}`;
}

const STORAGE_KEY = 'nospeak-theme';
const THEME_MODE_STORAGE_KEY = 'nospeak-theme-mode';

export function getStoredTheme(): Theme {
	if (typeof window === 'undefined') return 'mocha';
	const stored = localStorage.getItem(STORAGE_KEY);
	return (stored as Theme) || 'mocha';
}

export function setStoredTheme(theme: Theme) {
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, theme);
	}
}

export function getStoredThemeMode(): ThemeMode {
	if (typeof window === 'undefined') return 'system';
	const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY) as ThemeMode | null;
	return stored ?? 'system';
}

export function setThemeMode(mode: ThemeMode) {
	if (typeof window !== 'undefined') {
		localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
		applyThemeMode(mode);
	}
}

export function getEffectiveThemeForMode(mode: ThemeMode): Theme | 'cypher' {
	if (typeof window === 'undefined') {
		return mode === 'dark' ? 'frappe' : mode === 'cypher' ? 'cypher' : 'latte';
	}

	const prefersDark =
		window.matchMedia &&
		window.matchMedia('(prefers-color-scheme: dark)').matches;

	if (mode === 'light') return 'latte';
	if (mode === 'dark') return 'frappe';
	if (mode === 'cypher') return 'cypher';

	return prefersDark ? 'frappe' : 'latte';
}

export function applyTheme(theme: Theme | 'cypher') {
	const colors = theme === 'cypher' ? cypherTheme : catppuccinThemes[theme as Theme];
	const root = document.documentElement;

	Object.entries(colors).forEach(([key, value]) => {
		root.style.setProperty(`--color-${key}`, value);

		const rgb = hexToRgb(value);

		if (rgb) {
			root.style.setProperty(`--color-${key}-rgb`, rgb);
		}
	});

	// Set data attribute for CSS targeting
	root.setAttribute('data-theme', theme);

	const isDark = theme === 'frappe' || theme === 'macchiato' || theme === 'mocha' || theme === 'cypher';

	if (isDark) {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}

	if (typeof window !== 'undefined') {
		void syncAndroidStatusBarTheme(isDark);
	}
}

export function applyThemeMode(mode: ThemeMode) {
	const theme = getEffectiveThemeForMode(mode);
	
	if (theme !== 'cypher') {
		setStoredTheme(theme);
	}
	applyTheme(theme);

	if (typeof window === 'undefined') {
		return;
	}

	if (!window.matchMedia) {
		return;
	}

	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

	const handleChange = (event: MediaQueryListEvent) => {
		if (mode !== 'system') {
			return;
		}

		const nextTheme: Theme = event.matches ? 'frappe' : 'latte';
		setStoredTheme(nextTheme);
		applyTheme(nextTheme);
	};

	// Remove existing listeners and add new one for system mode
	mediaQuery.removeEventListener('change', handleChange);
	
	if (mode === 'system') {
		mediaQuery.addEventListener('change', handleChange);
	}
}
