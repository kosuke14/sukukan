import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 4300;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* wait */ } await sleep(300); }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sukukan, null, { timeout: 30000 });
for (const id of process.argv.slice(2)) {
  await page.evaluate((u) => window.__sukukan.openLesson(u), id);
  await sleep(500);
  const out = await page.evaluate((arg) => {
    const s = window.__sukukan.app.sequencer;
    const b = window.__sukukan.app.builder;
    const rows = [];
    for (let i = 0; i < s.count; i++) {
      s.goTo(i);
      rows.push({ i, vis: Object.entries(b.parts).filter(([, v]) => v.visible).map(([k]) => k).join(' ') });
    }
    const det = {};
    for (const k of arg.parts ?? []) {
      const p = b.parts[k];
      det[k] = p ? {
        scale: p.scale.toArray().map((v) => +v.toFixed(3)),
        kids: p.children.map((c) => `${c.type}/${c.visible}/${c.scale.x.toFixed(2)}`),
      } : 'missing';
    }
    return { n: s.count, rows, det };
  }, { parts: process.argv[3] ? process.argv[3].split(',') : [] });
  console.log('==', id, 'steps=' + out.n);
  out.rows.forEach((r) => console.log(' ', r.i, '->', r.vis));
  for (const [k, v] of Object.entries(out.det)) console.log('  DETAIL', k, JSON.stringify(v));
}
await browser.close();
server.kill('SIGTERM');
