import { defineConfig } from 'vite';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { buildContent } from './scripts/content.mjs';
import { engineRoot, contentRoot, generatedRoot, outputRoot, loadSite, siteTokens } from './scripts/site-config.mjs';

const mimeTypes = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', woff2: 'font/woff2', woff: 'font/woff', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', xml: 'application/xml' };
async function copyOptional(source, destination) {
  try { await cp(source, destination, { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export default defineConfig({
  root: engineRoot,
  appType: 'mpa',
  build: { outDir: outputRoot },
  server: { strictPort: true, watch: { usePolling: true, interval: 500, ignored: ['**/.generated/**', '**/.git/**', '**/node_modules/**', '**/dist/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  plugins: [{
    name: 'rhine-lab-content',
    async buildStart() { await buildContent(); },
    async transformIndexHtml(html) {
      return siteTokens(html, await loadSite()).replace('<!-- SITE_CATALOGUE -->', await readFile(join(generatedRoot, 'catalogue.html'), 'utf8'));
    },
    configureServer(server) {
      server.watcher.add(contentRoot);
      let rebuild = Promise.resolve();
      const refresh = file => {
        const path = relative(contentRoot, file);
        if (path.startsWith('..') || path.split(/[\\/]/).some(part => part.startsWith('.') || part.startsWith('_') || ['node_modules', 'dist', 'src', 'scripts', 'public'].includes(part))) return;
        rebuild = rebuild.then(() => buildContent()).then(() => server.ws.send({ type: 'full-reload' })).catch(error => server.config.logger.error(String(error)));
      };
      server.watcher.on('change', refresh).on('add', refresh).on('unlink', refresh).on('addDir', refresh).on('unlinkDir', refresh);
      server.middlewares.use(async (req, res, next) => {
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
        catch { return next(); }
        const dataAsset = pathname.startsWith('/static/') || ['/CNAME', '/favicon.ico'].includes(pathname);
        const root = dataAsset ? contentRoot : pathname.startsWith('/katex/') ? join(engineRoot, 'node_modules') : join(generatedRoot, 'pages');
        const requestPath = pathname.startsWith('/katex/') ? pathname.replace('/katex/', '/katex/dist/') : pathname;
        const file = resolve(root, '.' + (requestPath.endsWith('/') ? requestPath + 'index.html' : requestPath));
        if (!file.startsWith(root + '/')) return next();
        for (const candidate of [file, file + '/index.html']) {
          try {
            const data = await readFile(candidate);
            res.setHeader('Content-Type', mimeTypes[candidate.split('.').pop()] || 'application/octet-stream');
            res.end(data);
            return;
          } catch (error) { if (!['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) return next(error); }
        }
        next();
      });
    },
    async closeBundle() {
      await mkdir(outputRoot, { recursive: true });
      await cp(join(generatedRoot, 'pages'), outputRoot, { recursive: true });
      await copyOptional(join(contentRoot, 'static'), join(outputRoot, 'static'));
      for (const file of ['CNAME', 'favicon.ico']) await copyOptional(join(contentRoot, file), join(outputRoot, file));
      await cp(join(engineRoot, 'node_modules/katex/dist'), join(outputRoot, 'katex'), { recursive: true });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/' && !url.pathname.split('/').at(-1).includes('.')) req.url = url.pathname.replace(/\/$/, '') + '/index.html' + url.search;
        next();
      });
    },
  }],
});
