import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Keep in sync with the Content-Security-Policy header in the root vercel.json.
// Applying it to `vite preview` makes the E2E run exercise the production policy.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

// The licenses of the packages the app redistributes, and the privacy note, published with it.
// tools/third-party-licenses.mjs checks after the build that the notices match what was shipped.
const notices: Plugin = {
  name: 'vidopix-notices',
  apply: 'build',
  generateBundle() {
    const published = {
      'third-party-licenses.txt': 'THIRD_PARTY_LICENSES.md',
      'privacy.txt': 'PRIVACY.md',
    };
    for (const [fileName, source] of Object.entries(published)) {
      const text = readFileSync(new URL(`../../${source}`, import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName, source: text });
    }
  },
};

export default defineConfig({
  plugins: [
    react(),
    notices,
    VitePWA({
      // The page asks before updating, so a new version never reloads the editor mid-drawing.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Vidopix',
        short_name: 'Vidopix',
        description:
          'A pixel art editor with a built-in palette generator that runs in your browser.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#111318',
        theme_color: '#111318',
        categories: ['graphics', 'design', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything the editor needs to run offline. Fonts for scripts other than Latin are
        // fetched (and kept) only when a page actually uses them.
        globPatterns: [
          '**/*.{js,css,html,svg,png,webmanifest}',
          '**/*-latin-wght-normal-*.woff2',
          '**/*-latin-ext-wght-normal-*.woff2',
        ],
        runtimeCaching: [
          {
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: { target: 'es2023', sourcemap: true, assetsInlineLimit: 0 },
  preview: { headers: { 'Content-Security-Policy': contentSecurityPolicy } },
});
