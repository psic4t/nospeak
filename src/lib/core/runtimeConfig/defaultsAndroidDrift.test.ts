/**
 * Drift-detection test for the Android compile-time mirror of
 * {@code defaults.ts} {@code iceServers}.
 *
 * Background: the Android FGS resolves iceServers via a 3-tier chain
 * (intent extra → SharedPreferences snapshot → BuildConfig default).
 * The BuildConfig default is sourced from
 * {@code android/app/src/main/res/raw/default_ice_servers.json} which
 * MUST stay byte-equivalent (after canonical serialization) to the JS
 * defaults. Otherwise a cold-start call on a fresh Android install
 * (no JS calls yet, no prefs snapshot) would use stale iceServers and
 * we would not even notice.
 *
 * If this test fails, regenerate the JSON file by running
 * {@code serializeIceServers(DEFAULT_RUNTIME_CONFIG.iceServers)} and
 * writing the result, without trailing newline, to
 * {@code android/app/src/main/res/raw/default_ice_servers.json}. The
 * Gradle build reads that file at configure time via
 * {@code .getText('UTF-8').trim()}, so trailing whitespace is
 * tolerated but unnecessary.
 *
 * Part of {@code fix-android-ice-servers-from-runtime-config}.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { DEFAULT_RUNTIME_CONFIG } from './defaults';
import { serializeIceServers } from './store';

const ANDROID_DEFAULT_JSON = resolve(
    __dirname,
    '../../../../android/app/src/main/res/raw/default_ice_servers.json'
);

describe('Android default_ice_servers.json drift detection', () => {
    it('exists at the expected path', () => {
        expect(existsSync(ANDROID_DEFAULT_JSON)).toBe(true);
    });

    it('is byte-equivalent (after trim) to serializeIceServers(DEFAULT_RUNTIME_CONFIG.iceServers)', () => {
        const onDisk = readFileSync(ANDROID_DEFAULT_JSON, 'utf-8').trim();
        const fromJs = serializeIceServers(DEFAULT_RUNTIME_CONFIG.iceServers);
        expect(onDisk).toBe(fromJs);
    });
});
