import * as THREE from 'three';
import { solidMat, lineBasic, dotTexture, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp, seededRandom } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makePoint, makeArrow, Animated, accentOf } from './common.js';

/**
 * 数学的帰納法を塔にする。
 * 第1段階を土台に据え、「n 段階で成り立つなら n+1 段階でも成り立つ」という
 * ひと区切りの操作を積み上げて、n 段目まで矛盾なく届く姿を見せる。
 */
export function createInduction(params = {}) {
  const {
    n = 6, a = 2, mode = 'tower',
    accent = 0x6ee7ff,
    formula = '1+2+…+n=n(n+1)/2',
  } = params;

  const col = accentOf(accent);
  const group = new THREE.Group();
  const parts = {};
  const P = { n, a, mode, formula, count: 1, glow: 0, values: [], heights: [] };

  const GOLD = 0xffd166;
  const MINT = 0x7cffb2;
  const SKY = 0x9fd8ff;
  const STEP_W = 1.5, STEP_H = 0.62, STEP_D = 1.5;
  const CAP = 90;

  function vessel(name) {
    const g = new THREE.Group();
    group.add(g);
    parts[name] = g;
    return g;
  }
  /** 器に入れた幾何とマテリアルを解放してから空にする。 */
  function emptyOf(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (m.userData?.shared) continue;
          if (m.map && m.map !== dotTexture() && !m.map.userData?.shared) m.map.dispose();
          m.dispose();
        }
      }
    });
    g.clear();
  }

  const grid = makeGridPlane({ size: 14, div: 28, color: 0x2f4a7a, opacity: 0.4 });
  group.add(grid);
  parts.grid = grid;
  const axes = makeAxes({ size: 13, ticks: 10, accent: col, labels: ['x', 'y', 'z'] });
  group.add(axes);
  parts.axes = axes;

  const stair = vessel('stair');
  const steps = vessel('steps');
  const base = vessel('base');
  const inductiveStep = vessel('inductiveStep');
  const nMark = vessel('nMark');
  const assumptionGroup = vessel('assumptionGroup');
  const conclusion = vessel('conclusion');
  const brace = vessel('brace');
  const ladder = vessel('ladder');
  const particles = vessel('particles');

  const anim = new Animated({ count: 1, glow: 0 });
  const formulaLabel = makeLabel(formula, {
    height: 0.5, color: '#eaf6ff', bg: 'rgba(6,10,22,0.82)', border: 'rgba(110,231,255,0.32)',
  });
  formulaLabel.position.set(0, 1.4, 3.6);
  group.add(formulaLabel);
  parts.formulaLabel = formulaLabel;

  const factorial = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };

  /** 各段が表す量。上端の高さに比例させる。 */
  function stepValues() {
    const cnt = clamp(Math.round(P.n), 1, 24);
    const v = [];
    for (let k = 1; k <= cnt; k++) {
      if (P.mode === 'sum') v.push((k * (k + 1)) / 2);
      else if (P.mode === 'inequality') v.push(factorial(k));
      else v.push(P.a * (k - 1) * (k - 1) + P.a);   // 上へいくほど操作が増える
    }
    return v;
  }

  const yTop = (k) => (k - 1) * STEP_H;
  const xOf = (k) => (k - 1) * STEP_W;

  // ---------------------------------------------------------- 作り直し
  function rebuild() {
    for (const key of ['stair', 'steps', 'base', 'inductiveStep', 'nMark',
      'assumptionGroup', 'conclusion', 'brace', 'ladder', 'particles']) emptyOf(parts[key]);

    const V = stepValues();
    P.values = V;
    const s = 2.2 / Math.max(...V, 1);
    P.heights = V.map((v) => Math.max(v * s, 0.12));
    const cnt = V.length;
    formulaLabel.userData.setText(P.formula);
    formulaLabel.position.set(xOf(cnt) * 0.5, -1.4, 2.8);

    // --- 各段
    for (let k = 1; k <= cnt; k++) {
      const h = P.heights[k - 1];
      const bottom = yTop(k) - h;
      const m = new THREE.Mesh(new THREE.BoxGeometry(STEP_W, 1, STEP_D), solidMat(col, { opacity: 0.34 }));
      m.position.set(xOf(k), bottom + h / 2, 0);
      m.userData.noReveal = true;
      m.userData.idx = k - 1;
      m.userData.h = h;
      m.userData.bottom = bottom;
      m.scale.y = h;
      steps.add(m);

      const rim = new THREE.Mesh(new THREE.BoxGeometry(STEP_W * 1.06, 0.07, STEP_D * 1.08), solidMat(GOLD, { opacity: 0.75 }));
      rim.position.set(xOf(k), yTop(k), 0);
      rim.userData.noReveal = true;
      rim.userData.idx = k - 1;
      rim.userData.h = h;
      rim.userData.bottom = bottom;
      rim.userData.rim = true;
      steps.add(rim);
    }

    // --- 第1段階（光る土台）
    const h0 = P.heights[0];
    const b = new THREE.Mesh(new THREE.BoxGeometry(STEP_W * 1.08, h0, STEP_D * 1.08), solidMat(GOLD, { opacity: 0.55 }));
    b.position.set(xOf(1), yTop(1) - h0 / 2, 0);
    b.userData.noReveal = true;
    base.add(b);
    const bl = makeLabel('第1段階', { height: 0.36, color: '#ffd166' });
    bl.position.set(xOf(1), yTop(1) + 0.62, 0);
    base.add(bl);
    const bp = makePoint(0xffffff, { size: 0.11, halo: 0.9 });
    bp.position.set(xOf(1), yTop(1) + 0.2, 0);
    base.add(bp);
    // 土台を照らす輪（自分のマテリアルなので脈動させてよい）
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5 + i * 0.36, 0.02, 6, 44),
        new THREE.MeshBasicMaterial({
          color: GOLD, transparent: true, opacity: 0.4 - i * 0.11,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(xOf(1), yTop(1) - h0 / 2, 0);
      ring.userData.ring = i;
      base.add(ring);
    }

    // --- 帰納段（第 k 段目から第 k+1 段目へ）
    for (let k = 1; k < cnt; k++) {
      const from = new THREE.Vector3(xOf(k) + STEP_W * 0.3, yTop(k) - 0.2, 0);
      const to = new THREE.Vector3(xOf(k + 1) - STEP_W * 0.3, yTop(k + 1) - 0.2, 0);
      inductiveStep.add(makeArrow(from, to, { color: SKY, headSize: 0.14, shaft: 0.013 }));
      const lb = makeLabel(`${k} 段 -> ${k + 1} 段`, { height: 0.24, color: '#9fd8ff' });
      lb.position.set((from.x + to.x) / 2, (from.y + to.y) / 2 - 0.32, 0.3);
      inductiveStep.add(lb);
    }
    const il = makeLabel('帰納段', { height: 0.34, color: '#9fd8ff' });
    il.position.set(xOf(cnt) * 0.5, 0.4, 1.5);
    inductiveStep.add(il);

    // --- 仮定 hyp(n) を hyp(n+1) へ写す矢印
    for (let k = 1; k < cnt; k++) {
      const y0 = yTop(k) + 0.18, y1 = yTop(k + 1) + 0.18;
      assumptionGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(xOf(k), y0, 1.3),
          new THREE.Vector3(xOf(k), y0 + 0.5, 1.3),
          new THREE.Vector3(xOf(k + 1), y1 + 0.5, 1.3),
          new THREE.Vector3(xOf(k + 1), y1, 1.3),
        ]),
        lineBasic(MINT, 0.8)
      ));
      const lb = makeLabel(`仮定 ${k}`, { height: 0.22, color: '#7cffb2' });
      lb.position.set(xOf(k), y0 + 0.8, 1.3);
      assumptionGroup.add(lb);
    }
    const hl = makeLabel('仮定を次へ', { height: 0.3, color: '#7cffb2' });
    hl.position.set(xOf(cnt) * 0.5, yTop(cnt) + 1.5, 1.3);
    assumptionGroup.add(hl);

    // --- n 段目の印
    const xn = xOf(cnt), yn = yTop(cnt);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.05, 8, 48),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(xn, yn + 0.2, 0);
    nMark.add(halo);
    const np = makePoint(0xffffff, { size: 0.13, halo: 1.1 });
    np.position.set(xn, yn + 0.2, 0);
    nMark.add(np);
    const nl = makeLabel(`n = ${cnt}`, { height: 0.4, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)', border: 'rgba(110,231,255,0.35)' });
    nl.position.set(xn, yn + 1.0, 0);
    nMark.add(nl);

    // --- 塔の輪郭
    const outline = [new THREE.Vector3(0, 0, 0)];
    for (let k = 1; k <= cnt; k++) outline.push(new THREE.Vector3(xOf(k), yTop(k), 0));
    stair.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, false, 'catmullrom', 0.02), cnt * 12, 0.05, 8, false),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    ));
    const sl = makeLabel('成り立つ高さ', { height: 0.3, color: '#cfe0ff' });
    sl.position.set(xOf(cnt) * 0.5, yTop(cnt) + 1.9, 0);
    stair.add(sl);
    for (let k = 1; k <= cnt; k++) {
      const lb = makeLabel(`${k}`, { height: 0.26, color: '#8fb2e6' });
      lb.position.set(xOf(k), -0.5, STEP_D * 0.72);
      stair.add(lb);
    }

    // --- 上がり線
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, yn + 0.7, 0.07), solidMat(GOLD, { opacity: 0.85 }));
    post.position.set(xn, (yn + 0.7) / 2, 0);
    brace.add(post);
    for (const dx of [-0.24, 0.24]) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.07), solidMat(GOLD, { opacity: 0.85 }));
      tick.position.set(xn + dx, yn + 0.7, 0);
      brace.add(tick);
    }
    const bl2 = makeLabel(`第 ${cnt} 段まで`, { height: 0.34, color: '#ffd166' });
    bl2.position.set(xn + 1.5, yn * 0.55, 0);
    brace.add(bl2);

    // --- 結論
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.045, 8, 52),
      new THREE.MeshBasicMaterial({
        color: MINT, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(xn, yn + 0.2, 0);
    conclusion.add(ring);
    conclusion.add(makeArrow(new THREE.Vector3(xn, yn + 1.5, 0), new THREE.Vector3(xn, yn + 0.7, 0), { color: MINT, headSize: 0.13 }));
    const cl = makeLabel(conclusionText(cnt), {
      height: 0.38, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)', border: 'rgba(124,255,178,0.35)',
    });
    cl.position.set(xn, yn + 1.9, 0);
    conclusion.add(cl);

    // --- 段と段をつなぐ梯子
    for (let k = 1; k < cnt; k++) {
      ladder.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(xOf(k + 1) - 0.22, yTop(k) + 0.45, 2.0),
          new THREE.Vector3(xOf(k + 1) + 0.22, yTop(k + 1) + 0.45, 2.0),
        ]),
        lineBasic(0xff8fb1, 0.5)
      ));
    }
    const ll = makeLabel('ひと区切りの操作で次へ', { height: 0.3, color: '#ff8fb1' });
    ll.position.set(xOf(cnt) * 0.5, yTop(cnt) * 0.5, 2.2);
    ladder.add(ll);

    // --- 登る光
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(CAP * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffe6a8, size: 0.1, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    pts.frustumCulled = false;
    particles.add(pts);
    const rand = seededRandom(5);
    P.seeds = [];
    for (let i = 0; i < CAP; i++) {
      P.seeds.push({ t: rand(), sp: 0.35 + rand() * 0.6, dx: (rand() - 0.5) * STEP_W * 0.8, dz: (rand() - 0.5) * STEP_D * 0.8 });
    }
  }

  function conclusionText(cnt) {
    if (P.mode === 'sum') return `1+2+…+${cnt} = ${(cnt * (cnt + 1)) / 2}`;
    if (P.mode === 'inequality') return `${cnt}! = ${factorial(cnt)} > 2^${cnt} = ${Math.pow(2, cnt)}`;
    return `${cnt} 段まで問題なし`;
  }

  function setParams(patch) {
    let dirty = false;
    for (const k of ['n', 'a', 'mode', 'formula']) {
      if (patch[k] !== undefined) { P[k] = patch[k]; dirty = true; }
    }
    if (patch.count !== undefined) anim.to({ count: patch.count });
    if (patch.glow !== undefined) anim.to({ glow: patch.glow });
    Object.assign(P, patch);
    if (dirty) rebuild();
  }

  function update(dt, elapsed) {
    const a = anim.update(dt, 4.0);
    P.count = a.count;
    P.glow = a.glow;
    const cnt = P.values.length;
    const shown = a.count * cnt;

    // 段が下から 1 段ずつ積み上がる
    for (const m of steps.children) {
      const i = m.userData.idx;
      if (i === undefined) continue;
      const t = clamp(shown - i, 0, 1);
      m.visible = t > 0.02;
      if (!m.visible) continue;
      if (m.userData.rim) {
        m.position.y = m.userData.bottom + m.userData.h * t;
        continue;
      }
      const h = m.userData.h;
      m.scale.y = Math.max(h * t, 1e-3);
      m.position.y = m.userData.bottom + (h * t) / 2;
    }

    // 第1段階の輪が脈動する
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2);
    const lit = clamp(a.glow + 0.45, 0, 1);
    for (const o of base.children) {
      if (o.userData.ring === undefined) continue;
      o.material.opacity = (0.34 - o.userData.ring * 0.09) * lit * (0.7 + 0.3 * pulse);
      o.rotation.z = elapsed * 0.35;
    }

    // 登る粒子
    const pts = particles.children[0];
    if (pts && P.seeds) {
      const pos = pts.geometry.attributes.position.array;
      for (let k = 0; k < P.seeds.length; k++) {
        const s = P.seeds[k];
        const u = (s.t + elapsed * s.sp * 0.3) % 1;
        const fi = u * (cnt - 1);
        const i0 = Math.min(cnt - 1, Math.floor(fi));
        const i1 = Math.min(cnt - 1, i0 + 1);
        pos[k * 3] = lerp(xOf(i0 + 1), xOf(i1 + 1), fi - i0) + s.dx;
        pos[k * 3 + 1] = lerp(i0 * STEP_H, i1 * STEP_H, fi - i0) + 0.28;
        pos[k * 3 + 2] = s.dz;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pts.material.opacity = 0.85 * clamp(shown / Math.max(cnt, 1), 0, 1);
    }
  }

  function dispose() {
    disposeObject(group);
  }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
