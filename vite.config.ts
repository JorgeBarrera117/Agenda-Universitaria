import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * En desarrollo Vite inyecta scripts inline (React Refresh), por eso index.html conserva
 * 'unsafe-inline'. En el build de producción se sustituye script-src por 'self' más el hash
 * SHA-256 de cada script inline, de modo que un HTML inyectado (p. ej. en un apunte) no pueda
 * ejecutar manejadores on* ni bloques <script>.
 */
function strictScriptCsp(): Plugin {
  return {
    name: 'strict-script-csp',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          ([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`
        );
        const scriptSrc = ["script-src 'self'", ...hashes].join(' ');
        const updated = html.replace(/script-src [^;]*;/, `${scriptSrc};`);
        if (updated === html) {
          throw new Error('strict-script-csp: no se encontró la directiva script-src en index.html');
        }
        return updated;
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    strictScriptCsp(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Agenda Universitaria',
        short_name: 'AgendaUni',
        description: 'PWA Offline-First para horarios de clases, profesores y apuntes clasificados',
        theme_color: '#0F224C',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}']
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            if (id.includes('dexie')) return 'db';
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
            if (id.includes('react-markdown') || id.includes('remark-gfm')) return 'markdown';
          }
        }
      }
    }
  }
});
