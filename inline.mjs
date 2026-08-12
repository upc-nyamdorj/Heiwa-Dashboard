/**
 * Fold the static export into one self-contained HTML file so the dashboard can
 * be opened, emailed or archived as a single document.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const OUT = new URL('./out/', import.meta.url).pathname;
let html = readFileSync(join(OUT, 'index.html'), 'utf8');

const read = (src) => {
  const rel = src.replace(/^\.?\//, '');
  const p = join(OUT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

// 1. inline stylesheets, and remember a data: URL for each one
const cssDataUrl = new Map();
html = html.replace(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?>/g, (m, href) => {
  const css = read(href);
  if (!css) return '';
  cssDataUrl.set(href, `data:text/css;base64,${Buffer.from(css, 'utf8').toString('base64')}`);
  return `<style>${css}</style>`;
});

// 2. drop preloads — everything is inline, so they would 404
html = html.replace(/<link[^>]+rel="preload"[^>]*\/?>/g, '');

// 3. inline scripts, preserving order and the async/defer semantics Next relies on
html = html.replace(/<script([^>]*?)src="([^"]+)"([^>]*)><\/script>/g, (m, a, src, b) => {
  const js = read(src);
  if (!js) return '';
  const attrs = `${a} ${b}`;
  const type = /type="module"/.test(attrs) ? ' type="module"' : '';
  return `<script${type}>${js}</script>`;
});

// 4. Next's client router re-injects a <link> for the route stylesheet during
//    hydration, using the path baked into the build manifest. Point those at the
//    inlined data: URL so the single file never touches the filesystem.
for (const [href, dataUrl] of cssDataUrl) {
  const bare = href.replace(/^\.?\//, '');
  for (const needle of [href, `./${bare}`, `/${bare}`, bare]) {
    html = html.split(JSON.stringify(needle).slice(1, -1)).join(dataUrl);
  }
}

writeFileSync(new URL('./heiwa-dashboard.html', import.meta.url).pathname, html);
console.log('wrote heiwa-dashboard.html', (html.length / 1024 / 1024).toFixed(2), 'MB');
