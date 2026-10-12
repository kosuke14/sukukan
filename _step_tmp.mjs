import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = 4221;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('.', import.meta.url).pathname, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* retry */ } await sleep(300); }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sukukan, null, { timeout: 30000 });
for (const [id, idx] of process.argv.slice(2).map((v) => v.split(':'))) {
  await page.evaluate((u) => window.__sukukan.openLesson(u), id);
  await sleep(900);
  await page.evaluate((i) => { const s = window.__sukukan.app.sequencer; s.goTo(Number(i), { autoplay: false }); }, idx);
  await sleep(1800);
  await page.screenshot({ path: new URL(`./shots/step-${id}-${idx}.png`, import.meta.url).pathname });
  console.log('ok', id, idx);
}
await browser.close(); server.kill('SIGTERM');
