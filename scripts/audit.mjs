#!/usr/bin/env node
/**
 * Content audit: verifies every lesson builds, references only real parts, and
 * has enough steps. Run after authoring content so typos surface as failures
 * instead of silently missing geometry.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.PORT ?? 4179);
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
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sukukan?.auditParts, null, { timeout: 30000 });

  const { report, count } = await page.evaluate(() => ({
    report: window.__sukukan.auditParts(),
    count: window.__sukukan.app.lesson ? 0 : document.querySelectorAll('.ms-unit').length,
  }));
  const total = await page.evaluate(() => Object.values(window.__sukukan.subjects).length);

  if (report.length) {
    console.error(`✖ ${report.length} 件の問題:\n` + report.map((r) => `  ${r.id}  ${r.problem}`).join('\n'));
  } else {
    console.log('✓ 全単元: ビルダーが存在し、parts 名もすべて有効');
  }
  if (errors.length) console.error('\n✖ 実行時エラー:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
  process.exitCode = report.length || errors.length ? 1 : 0;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
