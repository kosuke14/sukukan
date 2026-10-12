#!/usr/bin/env node
/** Per-step screenshots for one lesson: node scripts/steps.mjs <id> [outdir] */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = new URL('../shots/steps/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4188);
const id = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
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

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-lcd-text'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sukukan, null, { timeout: 30000 });
  await page.evaluate((u) => window.__sukukan.openLesson(u), id);
  await sleep(1500);
  const n = await page.evaluate(() => window.__sukukan.app.sequencer.count);
  for (let i = 0; i < n; i++) {
    if (only && !only.includes(i)) continue;
    await page.evaluate((k) => {
      const s = window.__sukukan.app.sequencer;
      s.playing = false;
      s.goTo(k);
    }, i);
    await sleep(1800);
    await page.screenshot({ path: `${OUT}${id}-s${i + 1}.png` });
    console.log(`✓ ${id}-s${i + 1}`);
  }
  if (errors.length) console.error('pageerror:', [...new Set(errors)].join(' | '));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
