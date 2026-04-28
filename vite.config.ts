import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

export default defineConfig(() => {
  return {
    test: {
      include: ['src/**/*.test.ts'],
    },
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['sql-js/**/*'],
        manifest: {
          name: 'Solo CEO',
          short_name: 'Solo CEO',
          description: 'All-in-one management tool for solo entrepreneurs',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: './',
          scope: './',
          icons: [
            { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // SVG peep illustrations (~1.7MB raw) moved from precache → runtime cache:
          // first visit downloads ~40% less, and swapping illustrations later won't
          // force every client to re-download the full precache manifest.
          globPatterns: ['**/*.{js,css,html,ico,png}'],
          runtimeCaching: [
            {
              urlPattern: /\.svg$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-svg',
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    define: {
      '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 400,
      rollupOptions: {
        output: {
          // The object form of manualChunks collapses silently when an entry's
          // module is also directly imported by another chunk's entry — which is
          // exactly what happened to `vendor-react` (generated an empty file while
          // ~130KB gzip of react + react-dom ended up in the main index bundle).
          // The function form runs per-module and is race-free.
          manualChunks(id: string) {
            if (id.includes('/node_modules/react/') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('/node_modules/scheduler/')) return 'vendor-react';
            if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
            if (id.includes('/node_modules/recharts')) return 'vendor-recharts';
            if (id.includes('/node_modules/@dnd-kit/')) return 'vendor-dnd';
            if (id.includes('/node_modules/motion')) return 'vendor-motion';
            if (id.includes('/node_modules/cmdk')) return 'vendor-cmdk';
            return undefined;
          },
        },
      },
    },
    server: {
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
