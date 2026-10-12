#!/usr/bin/env node
/**
 * Renders the app in headless Chromium and writes screenshots to shots/.
 *
 *   node scripts/shoot.mjs [unitId ...]
 *
 * With no ids it only captures the star map; naming a unit also captures the
 * first and 60% steps of that lesson.
 *
 * Console errors and page errors are fatal — a silent Three.js failure would
 * otherwise produce a black screenshot that looks like a styling problem.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = new URL('../shots/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4178);
const units = process.argv.slice(2);
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('preview server did not start');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-lcd-text'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const base = `http://localhost:${PORT}/`;

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sukukan, null, { timeout: 30000 });
  await sleep(3500);
  await page.screenshot({ path: `${OUT}00-starmap.png` });
  console.log('✓ shots/00-starmap.png');

  // No ids given: the star map only. Pass ids to render specific lessons.
  for (const id of units) {
    await page.evaluate((u) => window.__sukukan.openLesson(u), id);
    await sleep(1200);
    await page.screenshot({ path: `${OUT}lesson-${id}-a.png` });
    await page.evaluate(() => { const s = window.__sukukan.app.sequencer; s.goTo(Math.floor(s.count * 0.6)); });
    await sleep(2600);
    await page.screenshot({ path: `${OUT}lesson-${id}-b.png` });
    console.log(`✓ lesson-${id}`);
  }

  if (errors.length) {
    console.error('\n✖ ページエラー:\n' + errors.slice(0, 20).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('\n✓ コンソールエラーなし');
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
