import { Capacitor } from '@capacitor/core';

import { AndroidLocation } from './AndroidLocation';

export interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

export async function getCurrentPosition(): Promise<LocationCoordinates> {
    if (typeof window === 'undefined') {
        throw new Error('Geolocation is not available in this environment.');
    }

    if (Capacitor.getPlatform() === 'android') {
        if (!AndroidLocation) {
            throw new Error('Android location is not available.');
        }

        const position = await AndroidLocation.getCurrentPosition();
        return {
            latitude: position.latitude,
            longitude: position.longitude
        };
    }

    if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser.');
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => reject(error),
            {
                enableHighAccuracy: true,
                timeout: 10000
            }
        );
    });
}
