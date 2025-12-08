/// <reference types="@capacitor/local-notifications" />
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
      keystorePath: './nospeak-key.jks',
      keystorePassword: 'Ruberg-123',
      keystoreAlias: 'nospeak-key',
      keystoreAliasPassword: 'Ruberg-123',
    },
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_nospeak',
    },
  },
};

export default config;
