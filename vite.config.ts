import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
    port: 1420,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: ['es2022', 'chrome105', 'safari15'],
    sourcemap: true,
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll(String.fromCharCode(92), '/');
          if (normalizedId.includes('/node_modules/three/examples/')) return 'three-webgpu';
          if (normalizedId.includes('/node_modules/three/')) return 'three-core';
          return undefined;
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CORE: Nuclear',
        short_name: 'CORE Nuclear',
        description: 'A cross-platform nuclear power plant operations simulator.',
        theme_color: '#08121b',
        background_color: '#08121b',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
