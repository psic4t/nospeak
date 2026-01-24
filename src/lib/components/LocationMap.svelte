<script lang="ts">
    import { onMount } from 'svelte';
    import { t } from '$lib/i18n';
    import 'leaflet/dist/leaflet.css';
    import {
        type LocationPoint,
        MAP_TILE_URL,
        MAP_ATTRIBUTION,
        MAP_ZOOM,
        MAP_HEIGHT_BUBBLE,
        buildOsmOpenUrl
    } from '$lib/core/MapUtils';
    import { isAndroidNative } from '$lib/core/NativeDialogs';

    interface Props {
        latitude: number;
        longitude: number;
        height?: number;
        interactive?: boolean;
    }

    let { latitude, longitude, height = MAP_HEIGHT_BUBBLE, interactive = true }: Props = $props();

    let mapContainer: HTMLDivElement | undefined = $state();
    let map: L.Map | undefined = $state();
    const isAndroidNativeEnv = $derived(isAndroidNative());
    // On Android, map starts non-interactive to avoid interfering with message list scrolling.
    // User must tap once to activate panning/zooming. Auto-deactivates after 5s of no touch.
    let activated: boolean = $state(false);
    let deactivateTimer: ReturnType<typeof setTimeout> | undefined = $state();

    const point: LocationPoint = $derived({ latitude, longitude });
    const openMapUrl = $derived(buildOsmOpenUrl(point));

    function activateMap() {
        if (!interactive || !isAndroidNativeEnv || activated) return;
        activated = true;
        enableMapInteractions();
        resetDeactivateTimer();
    }

    function enableMapInteractions() {
        if (!map) return;
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
    }

    function disableMapInteractions() {
        if (!map) return;
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
    }

    function resetDeactivateTimer() {
        if (deactivateTimer) {
            clearTimeout(deactivateTimer);
        }
        deactivateTimer = setTimeout(() => {
            activated = false;
            disableMapInteractions();
        }, 5000);
    }

    function handleMapTouchStart() {
        if (activated) {
            resetDeactivateTimer();
        }
    }

    onMount(() => {
        if (!mapContainer) return;

        // Dynamic import to avoid SSR issues with Leaflet (it accesses `window`)
        import('leaflet').then((L) => {
            if (!mapContainer) return;

            // On Android with interactive=true, start non-interactive (user must tap to activate)
            const startInteractive = interactive && !isAndroidNativeEnv;

            map = L.map(mapContainer, {
                zoomControl: startInteractive,
                dragging: startInteractive,
                touchZoom: startInteractive,
                scrollWheelZoom: startInteractive,
                doubleClickZoom: startInteractive,
                boxZoom: startInteractive,
                keyboard: startInteractive,
                attributionControl: false
            }).setView([latitude, longitude], MAP_ZOOM);

            L.tileLayer(MAP_TILE_URL, {
                attribution: MAP_ATTRIBUTION,
                maxZoom: 19
            }).addTo(map);

            // Fix default marker icon path issue with bundlers
            const defaultIcon = L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            L.marker([latitude, longitude], { icon: defaultIcon }).addTo(map);
        });

        return () => {
            if (deactivateTimer) {
                clearTimeout(deactivateTimer);
            }
            if (map) {
                map.remove();
                map = undefined;
            }
        };
    });
</script>

<div class="location-map-wrapper">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="relative rounded-xl overflow-hidden bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60"
        style="width: 100%; height: {height}px;"
        ontouchstart={handleMapTouchStart}
    >
        <div
            bind:this={mapContainer}
            class="w-full h-full"
        ></div>
        {#if isAndroidNativeEnv && interactive && !activated}
            <!-- Transparent overlay that captures first tap to activate map interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="absolute inset-0 z-[1000]"
                style="touch-action: pan-y;"
                onclick={activateMap}
            ></div>
        {/if}
    </div>
    {#if openMapUrl}
        <a
            href={openMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="typ-meta text-xs underline hover:opacity-80"
        >
            {$t('modals.locationPreview.openInOpenStreetMap')}
        </a>
    {/if}
</div>

<style>
    .location-map-wrapper :global(.leaflet-container) {
        font-family: inherit;
        border-radius: 0.75rem;
    }


</style>
