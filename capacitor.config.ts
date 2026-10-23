import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.core.nuclear',
  appName: 'CORE: Nuclear',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    minWebViewVersion: 60,
    backgroundColor: '#08121b',
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08121b',
      overlaysWebView: false,
    },
    Haptics: { enabled: true },
  },
};

export default config;
