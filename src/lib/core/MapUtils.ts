/**
 * Shared map utilities and configuration for location sharing.
 */

export interface LocationPoint {
    latitude: number;
    longitude: number;
}

/** Default zoom level for external map links */
export const MAP_ZOOM = 15;

/** Tile server URL template for Leaflet */
export const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/** OSM tile attribution (required by OSM usage policy) */
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Default map height in message bubbles (px) */
export const MAP_HEIGHT_BUBBLE = 220;

/** Default map height in preview modals (px) */
export const MAP_HEIGHT_PREVIEW = 300;

/**
 * Build an OpenStreetMap URL to open the location in a new tab.
 */
export function buildOsmOpenUrl(point: LocationPoint): string {
    return `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}&zoom=${MAP_ZOOM}`;
}
