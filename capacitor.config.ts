import type { CapacitorConfig } from '@capacitor/cli';

// appId must be unique on Google Play — change it before the first upload.
const config: CapacitorConfig = {
  appId: 'com.orderglide.stackisland',
  appName: 'Stack Island',
  webDir: 'dist',
  android: { backgroundColor: '#2b8fd6' },
};

export default config;
