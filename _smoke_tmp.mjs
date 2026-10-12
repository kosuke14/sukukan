import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = '/home/ubuntu/spacemath';
const PORT = 5179;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch {}
    await sleep(300);
  }
  throw new Error('dev server did not start');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sukukan, null, { timeout: 30000 });
  await sleep(1500);

  const report = await page.evaluate(async () => {
    const app = window.__sukukan.app;
    const out = [];
    const mods = {
      parabola3d: { path: '/src/visuals/parabola3d.js', fn: 'createParabola3D', cases: [
        {}, { a: -0.6, p: 1.4, q: 3, transform: 1 }, { a: 0.4, p: -1, q: -2, transform: 2 },
        { a: 1, p: 0, q: 0, transform: 3, showFocus: true },
        { a: 2, p: 0, q: 1.5, transform: 0, showVertex: false, showAxis: false },
      ] },
      calculus: { path: '/src/visuals/calculus.js', fn: 'createCalculus', cases: [
        { mode: 'tangent' }, { mode: 'slope', a: 1, b: 3 }, { mode: 'integral', a: 0, b: 3, n: 40 },
        { mode: 'area', a: 0, b: 3 }, { mode: 'volume', a: 0, b: 3 },
        { mode: 'integral', fn: (x) => Math.sin(x), a: -0.5, b: 3.2, n: 12, domain: [-1, 4] },
      ] },
      limit: { path: '/src/visuals/limit.js', fn: 'createLimit', cases: [
        { mode: 'eps' }, { mode: 'sequence', terms: 8 }, { mode: 'series', r: 0.5, terms: 8 },
        { mode: 'series', r: 1.4, terms: 6 }, { mode: 'squeeze' }, { mode: 'continuity' },
        { mode: 'eps', fn: (x) => (x * x * x) / (x * x), target: 2, domain: [-1, 5] },
      ] },
      algebra3d: { path: '/src/visuals/algebra3d.js', fn: 'createAlgebra3D', cases: [
        { mode: 'remainder', coeffs: [1, 0, -1], divisor: 2 },
        { mode: 'factor', coeffs: [1, 0, -4], divisor: 2 },
        { mode: 'identity', coeffs: [1, -3, 2], divisor: 1 },
        { mode: 'roots', coeffs: [1, -6, 11, -6], rootGuess: 1 },
        { mode: 'roots', coeffs: [1, 0, 1], rootGuess: 0 },
        { mode: 'remainder', coeffs: [1, 0, 0, 0, -16], divisor: 2, domain: [-4, 4] },
      ] },
    };

    for (const [name, spec] of Object.entries(mods)) {
      let mod;
      try { mod = await import(spec.path); } catch (e) { out.push(`${name}: IMPORT FAIL ${e.message}`); continue; }
      for (let ci = 0; ci < spec.cases.length; ci++) {
        const label = `${name}#${ci}`;
        let b;
        try {
          b = mod[spec.fn](spec.cases[ci]);
        } catch (e) { out.push(`${label}: BUILD FAIL ${e.message}`); continue; }
        try {
          app.clearWorld();
          app.stage.world.add(b.group);
          let t = 0;
          for (let i = 0; i < 90; i++) { t += 0.033; b.update(0.033, t, 0.5); }
          b.setParams({});                                   // 未知キー無しの再構築
          if (name === 'parabola3d') b.setParams({ a: 1.5, p: 1, q: 1, transform: 3 });
          if (name === 'calculus') b.setParams({ n: 120, a: -1, b: 2 });
          if (name === 'limit') b.setParams({ target: 0.2, approach: 0.1, terms: 10, r: 0.3 });
          if (name === 'algebra3d') b.setParams({ coeffs: [1, 1, -6], divisor: -3, mode: 'roots' });
          for (let i = 0; i < 60; i++) { t += 0.033; b.update(0.033, t, 0.7); }
          // NaN 検査
          let nan = 0;
          b.group.traverse((o) => {
            const p = o.position;
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) nan++;
            if (!Number.isFinite(o.scale.x) || !Number.isFinite(o.scale.y) || !Number.isFinite(o.scale.z)) nan++;
            if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
              const arr = o.geometry.attributes.position.array;
              for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { nan++; break; }
            }
          });
          const parts = Object.keys(b.parts);
          const missing = parts.filter((k) => !b.parts[k]);
          out.push(`${label}: ok parts=${parts.length} nan=${nan} missing=${missing.join(',') || '-'}`);
          b.dispose();
        } catch (e) {
          out.push(`${label}: RUN FAIL ${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join(' | ')}`);
        }
      }
    }
    app.clearWorld();
    return out;
  });

  console.log(report.join('\n'));

  // 代表絵を撮って目視する
  const shots = [
    ['parabola3d', 'createParabola3D', { a: 1, p: 1, q: 2, transform: 3, showFocus: true }, 'parabola'],
    ['calculus', 'createCalculus', { mode: 'volume', a: 0, b: 3 }, 'calculus-volume'],
    ['limit', 'createLimit', { mode: 'eps' }, 'limit-eps'],
    ['algebra3d', 'createAlgebra3D', { mode: 'roots', coeffs: [1, -6, 11, -6] }, 'algebra-roots'],
  ];
  for (const [name, fn, params, tag] of shots) {
    const p2 = await browser.newPage({ viewport: { width: 1200, height: 760 } });
    await p2.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await p2.waitForFunction(() => window.__sukukan, null, { timeout: 30000 });
    await sleep(800);
    await p2.evaluate(async ({ name, fn, params }) => {
      const app = window.__sukukan.app;
      const mod = await import(`/src/visuals/${name}.js`);
      app.clearWorld();
      const b = mod[fn](params);
      app.stage.world.add(b.group);
      app.builder = b;
      app.rig.set({ pos: [6, 4.4, 14], look: [0, 0.6, 0] }, { immediate: true });
    }, { name, fn, params });
    await sleep(1500);
    await p2.screenshot({ path: `${ROOT}/shots/_smoke-${tag}.png` });
    await p2.close();
    console.log(`shot ${tag}`);
  }

  const mine = errors.filter((e) => /parabola3d|calculus|limit\.js|algebra3d/.test(e));
  console.log(`\npage errors(total)=${errors.length} mine=${mine.length}`);
  if (mine.length) console.log(mine.slice(0, 10).join('\n'));
  if (report.some((r) => /FAIL/.test(r) || /nan=[1-9]/.test(r))) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
