import {
	getStoredThemeMode,
	setThemeMode as baseSetThemeMode,
	applyThemeMode
} from './theme';
import type { ThemeMode } from './theme';

let currentThemeMode = $state<ThemeMode>(getStoredThemeMode());

export function getCurrentThemeMode(): ThemeMode {
	return currentThemeMode;
}

export function setThemeMode(mode: ThemeMode) {
	currentThemeMode = mode;
	baseSetThemeMode(mode);
}

// Apply theme mode on initialization
if (typeof window !== 'undefined') {
	applyThemeMode(currentThemeMode);
}
