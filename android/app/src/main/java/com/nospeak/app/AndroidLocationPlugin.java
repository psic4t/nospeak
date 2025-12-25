package com.nospeak.app;

import android.Manifest;
import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
    name = "AndroidLocation",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = AndroidLocationPlugin.FINE),
        @Permission(strings = { Manifest.permission.ACCESS_COARSE_LOCATION }, alias = AndroidLocationPlugin.COARSE)
    }
)
public class AndroidLocationPlugin extends Plugin {

    static final String FINE = "fine";
    static final String COARSE = "coarse";

    private static final long TIMEOUT_MS = 10_000;
    private static final long LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (!hasAnyLocationPermission()) {
            requestAllPermissions(call, "permissionsCallback");
            return;
        }

        fetchLocation(call);
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        if (!hasAnyLocationPermission()) {
            call.reject("Location permission denied");
            return;
        }

        fetchLocation(call);
    }

    private boolean hasAnyLocationPermission() {
        return getPermissionState(FINE) == PermissionState.GRANTED || getPermissionState(COARSE) == PermissionState.GRANTED;
    }

    private void fetchLocation(PluginCall call) {
        final LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) {
            call.reject("Location manager is not available");
            return;
        }

        final boolean hasFine = getPermissionState(FINE) == PermissionState.GRANTED;
        final boolean hasCoarse = getPermissionState(COARSE) == PermissionState.GRANTED;

        final boolean gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        final boolean networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);

        final boolean canUseGps = hasFine && gpsEnabled;
        final boolean canUseNetwork = (hasFine || hasCoarse) && networkEnabled;

        if (!canUseGps && !canUseNetwork) {
            call.reject("No location provider is available");
            return;
        }

        try {
            Location bestLastKnown = null;

            if (canUseGps) {
                bestLastKnown = pickBetterLocation(bestLastKnown, locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER));
            }

            if (canUseNetwork) {
                bestLastKnown = pickBetterLocation(bestLastKnown, locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER));
            }

            if (bestLastKnown != null) {
                long ageMs = Math.max(0, System.currentTimeMillis() - bestLastKnown.getTime());
                if (ageMs <= LAST_KNOWN_MAX_AGE_MS) {
                    resolveLocation(call, bestLastKnown);
                    return;
                }
            }

            final Handler handler = new Handler(Looper.getMainLooper());
            final AtomicBoolean finished = new AtomicBoolean(false);

            final LocationListener listener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    if (location == null) {
                        return;
                    }
                    if (!finished.compareAndSet(false, true)) {
                        return;
                    }
                    handler.removeCallbacksAndMessages(null);
                    try {
                        locationManager.removeUpdates(this);
                    } catch (SecurityException ignored) {
                        // ignore
                    }
                    resolveLocation(call, location);
                }

                @Override
                public void onProviderEnabled(String provider) {
                    // ignore
                }

                @Override
                public void onProviderDisabled(String provider) {
                    // ignore
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {
                    // ignore (deprecated)
                }
            };

            Runnable timeout = () -> {
                if (!finished.compareAndSet(false, true)) {
                    return;
                }
                try {
                    locationManager.removeUpdates(listener);
                } catch (SecurityException ignored) {
                    // ignore
                }
                call.reject("Location timeout");
            };

            handler.postDelayed(timeout, TIMEOUT_MS);

            if (canUseGps) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, listener, Looper.getMainLooper());
            }

            if (canUseNetwork) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, listener, Looper.getMainLooper());
            }
        } catch (SecurityException e) {
            call.reject("Location permission denied", e);
        } catch (Exception e) {
            call.reject("Failed to get location", e);
        }
    }

    private Location pickBetterLocation(Location a, Location b) {
        if (b == null) {
            return a;
        }
        if (a == null) {
            return b;
        }

        if (b.getTime() > a.getTime()) {
            return b;
        }

        return a;
    }

    private void resolveLocation(PluginCall call, Location location) {
        JSObject result = new JSObject();
        result.put("latitude", location.getLatitude());
        result.put("longitude", location.getLongitude());
        call.resolve(result);
    }
}
