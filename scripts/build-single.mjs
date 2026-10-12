#!/usr/bin/env node
/**
 * Bundles the app into one self-contained HTML file that opens straight from
 * the filesystem — no server, no port, no network.
 *
 *   node scripts/build-single.mjs
 *   → dist-single/su-kukan.html
 *
 * Fonts are kept as woff2 only (dropping the woff/ttf fallbacks roughly halves
 * the size; every browser that can run WebGL2 reads woff2).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'dist-single');
const TARGET = join(OUT_DIR, 'su-kukan.html');

console.log('› 単一ファイル向けにビルド中…');
execFileSync('npx', ['vite', 'build', '--config', 'vite.single.config.js'], { cwd: ROOT, stdio: 'inherit' });

const mime = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', svg: 'image/svg+xml' };
const asDataUri = (file) => `data:${mime[file.split('.').pop()]};base64,${readFileSync(file).toString('base64')}`;

/** Replace every font url() with an inline data URI, keeping woff2 only. */
function inlineFonts(css, dir) {
  return css.replace(/url\((["']?)\.\/([^)'"]+)\1\)/g, (whole, _q, file) => {
    const path = join(dir, file);
    if (!existsSync(path)) return whole;
    if (file.endsWith('.woff') || file.endsWith('.ttf')) return 'DROP_ME';
    return `url("${asDataUri(path)}")`;
  }).replace(/,[^;}]*DROP_ME/g, () => '')   // drop the trailing fallback entries
    .replace(/DROP_ME/g, () => '');
}

const html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8');
const js = readFileSync(join(OUT_DIR, 'app.js'), 'utf8');
const css = readFileSync(join(OUT_DIR, 'app.css'), 'utf8');

// Vite already inlined everything under the (very large) asset limit, so this
// pass is normally a no-op — it still covers anything that slipped through.
const assetDir = join(OUT_DIR, 'assets');
const inlinedCss = inlineFonts(css, existsSync(assetDir) ? assetDir : join(OUT_DIR, 'missing'));

// NOTE: the replacements must use function form. Minified JS is full of `$&`
// and `$$`, which String.replace would expand against the match itself and
// silently corrupt the bundle.
const out = html
  .replace(/<link[^>]+rel="stylesheet"[^>]*>/g, '')
  .replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '')
  .replace(/<script[^>]+src="[^"]*app\.js"[^>]*><\/script>/g, '')
  .replace('</head>', () => `  <style>\n${inlinedCss}\n  </style>\n</head>`)
  .replace('</body>', () => `  <script type="module">\n${js}\n  </script>\n</body>`);

writeFileSync(TARGET, out);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const leftover = existsSync(join(OUT_DIR, 'assets'))
  ? readdirSync(join(OUT_DIR, 'assets')).filter((f) => f.endsWith('.woff2'))
  : [];
const embedded = (css.match(/data:font\//g) ?? []).length;
console.log(`✓ ${TARGET}`);
console.log(`  サイズ ${mb(Buffer.byteLength(out))}（埋め込み済みフォント ${embedded} 種）`);
console.log('  これをダウンロードしてブラウザで直接開けば動作します（サーバー不要・オフライン可）。');
