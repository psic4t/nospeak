import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AndroidLocationPlugin {
    getCurrentPosition(): Promise<{ latitude: number; longitude: number }>;
}

export const AndroidLocation = Capacitor.getPlatform() === 'android'
    ? registerPlugin<AndroidLocationPlugin>('AndroidLocation')
    : null;
