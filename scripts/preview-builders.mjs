#!/usr/bin/env node
/**
 * Renders every registered builder with its default parameters and writes one
 * screenshot per builder. Content is not required, so this catches geometry
 * that builds without error but renders empty or off-screen.
 *
 *   node scripts/preview-builders.mjs [builderName ...]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = new URL('../shots/builders/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4250);
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore',
});
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return; } catch { /* retry */ }
    await sleep(300);
  }
  throw new Error('preview server did not start');
}

const only = process.argv.slice(2);
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 880 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sukukan, null, { timeout: 30000 });

  const names = await page.evaluate(() => window.__sukukan.builderNames());
  const list = only.length ? names.filter((n) => only.includes(n)) : names;

  // Report how much of the scene is actually drawn, so an "empty" builder
  // shows up as a number instead of only as a black rectangle.
  const coverage = async (name) => page.evaluate(async (n) => {
    const { app, mountBuilder } = window.__sukukan;
    const info = mountBuilder(n);
    if (info?.error) return { error: info.error };
    await new Promise((r) => setTimeout(r, 900));
    const b = new window.__THREE.Box3().setFromObject(app.builder.group);
    const c = info.parts;
    let visible = 0;
    for (const k of Object.keys(c ?? {})) if (c[k]?.visible) visible++;
    return {
      parts: Object.keys(c ?? {}).length,
      visible,
      size: b.isEmpty() ? 0 : +b.getSize(new window.__THREE.Vector3()).length().toFixed(2),
      tris: app.renderer.info.render.triangles,
    };
  }, name);

  const rows = [];
  for (const n of list) {
    const r = await coverage(n);
    rows.push([n, r]);
    await page.screenshot({ path: `${OUT}${n}.png` });
  }

  console.log('builder            parts  shown  size   tris');
  for (const [n, r] of rows) {
    if (r.error) { console.log(`${n.padEnd(18)} ERROR ${r.error}`); continue; }
    const bad = r.size === 0 || r.parts === 0;
    console.log(
      `${n.padEnd(18)} ${String(r.parts).padStart(4)}  ${String(r.visible).padStart(4)}  ` +
      `${String(r.size).padStart(5)}  ${String(r.tris).padStart(6)}${bad ? '   ← 要確認' : ''}`
    );
  }
  if (errors.length) {
    console.error('\n✖ ページエラー:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('\n✓ ページエラーなし');
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
