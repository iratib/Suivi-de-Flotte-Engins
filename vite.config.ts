import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/Suivi-de-Flotte-Engins/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'images/logo.png',
          'icons/icon-192x192.png',
          'icons/icon-512x512.png',
          'icons/icon-512x512-maskable.png',
          'screenshots/screenshot-desktop.png',
          'screenshots/screenshot-mobile.png',
        ],
        manifest: {
          id: '/Suivi-de-Flotte-Engins/',
          name: 'Suivi de Flotte Engins',
          short_name: 'Flotte Engins',
          description: "Gestion et suivi de la flotte d'engins en temps réel",
          theme_color: '#1e293b',
          background_color: '#0f172a',
          display: 'standalone',
          scope: '/Suivi-de-Flotte-Engins/',
          start_url: '/Suivi-de-Flotte-Engins/',
          orientation: 'any',
          lang: 'fr',
          icons: [
            {
              src: 'icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: 'screenshots/screenshot-desktop.png',
              sizes: '1280x800',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Tableau de bord principal',
            },
            {
              src: 'screenshots/screenshot-mobile.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Vue mobile',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/docs\.google\.com\/spreadsheets\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gsheets-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 300,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
