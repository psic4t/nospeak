/// <reference types="@capacitor/local-notifications" />
/// <reference types="@capacitor/app" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nospeak.app',
  appName: 'nospeak',
  webDir: 'build/android',
  server: {
    androidScheme: 'https'
  },
  android: {
    // Automatisches Signing für Release-Builds
    buildOptions: {
      keystorePath: './nospeak-release.jks',
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keystoreAlias: 'nospeak-key',
      keystoreAliasPassword: process.env.ANDROID_KEYSTORE_ALIAS_PASSWORD,
    },
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_nospeak',
    },
    App: {
      disableBackButtonHandler: false,
    },
    AndroidUnifiedPush: {},
  },
};

export default config;
