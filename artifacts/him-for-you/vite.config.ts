import { injectSeo, seoFilePath } from "../../scripts/seo-render.mjs";
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const localEnv = loadEnv(process.env.NODE_ENV || 'development', import.meta.dirname, '');
const rawPort = process.env.PORT || localEnv.PORT || '5000';

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || localEnv.BASE_PATH || '/';

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const seoTarget = process.env.API_TARGET || localEnv.API_TARGET || 'http://127.0.0.1:5001';
const seoSecret = process.env.API_PROXY_SECRET || localEnv.API_PROXY_SECRET || '';
async function fetchSeo(path: string) {
  return fetch(new URL(path, seoTarget), { headers: { 'x-api-proxy-secret': seoSecret }, signal: AbortSignal.timeout(10000) });
}

export default defineConfig({
  base: basePath,
  plugins: [
    {
      name: 'admin-seo',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = new URL(req.url || '/', 'http://localhost').pathname;
          const endpoint = seoFilePath(pathname);
          if (!endpoint || !['GET', 'HEAD'].includes(req.method || 'GET')) return next();
          try {
            const upstream = await fetchSeo(endpoint);
            res.statusCode = upstream.status;
            for (const header of ['content-type', 'content-security-policy', 'x-content-type-options']) {
              const value = upstream.headers.get(header); if (value) res.setHeader(header, value);
            }
            res.setHeader('Cache-Control', 'no-store');
            res.end(req.method === 'HEAD' ? undefined : await upstream.text());
          } catch { res.statusCode = 503; res.end('SEO service unavailable.'); }
        });
      },
      transformIndexHtml: {
        order: 'post',
        async handler(html, context) {
          if (!context.server) return html;
          const pathname = new URL(context.originalUrl || context.path, 'http://localhost').pathname;
          try {
            const response = await fetchSeo('/api/seo/page?path=' + encodeURIComponent(pathname));
            if (!response.ok) return html;
            return injectSeo(html, await response.json(), `http://localhost:${port}`);
          } catch { return html; }
        },
      },
    },
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      '/api': {
        target: process.env.API_TARGET || localEnv.API_TARGET || 'http://127.0.0.1:5001',
        changeOrigin: true,
        headers: (process.env.API_PROXY_SECRET || localEnv.API_PROXY_SECRET) ? {
          'x-api-proxy-secret': process.env.API_PROXY_SECRET || localEnv.API_PROXY_SECRET,
        } : undefined,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
