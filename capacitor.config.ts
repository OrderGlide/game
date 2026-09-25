import type { CapacitorConfig } from '@capacitor/cli';

// appId must be unique on Google Play — change it before the first upload.
const config: CapacitorConfig = {
  appId: 'com.orderglide.stackisland',
  appName: 'Frost Camp',
  webDir: 'dist',
  android: { backgroundColor: '#dde8f3' },
};

export default config;
