import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = '/home/ubuntu/spacemath';
const PORT = 5179;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/_smoke.html`); if (r.ok) return; } catch {}
    await sleep(300);
  }
  throw new Error('dev server did not start');
}

const cases = process.argv.slice(2);

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const c of cases) {
    const [tag, cam] = c.split(':');
    const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/_smoke.html?case=${tag}${cam ? `&cam=${cam}` : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await sleep(600);
    const info = await page.evaluate(() => window.__info);
    if (process.env.BALLS) console.log(JSON.stringify(await page.evaluate(() => window.__balls())));
    if (process.env.DUMP) console.log(JSON.stringify(await page.evaluate(() => window.__dump()), null, 0));
    await page.screenshot({ path: `${ROOT}/shots/_smoke-${tag}.png` });
    console.log(`${tag}: parts=${info.parts.length} errors=${errs.length}${errs.length ? ' ' + errs[0] : ''}`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
