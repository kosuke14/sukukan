import * as THREE from 'three';
import { solidMat, lineBasic, edgesOf, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makeCurve, makePoint, Animated } from './common.js';

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const MAXROOTS = 8;
const MAXBALLS = 8;

const polyNum = (v) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

function makeSeg(color, opacity) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  return new THREE.Line(g, lineBasic(color, opacity));
}
function setSeg(line, ax, ay, bx, by, z = 0) {
  const arr = line.geometry.attributes.position.array;
  arr[0] = ax; arr[1] = ay; arr[2] = z;
  arr[3] = bx; arr[4] = by; arr[5] = z;
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

const cleanCoeffs = (c) => {
  const out = (Array.isArray(c) ? c : [c]).map((v) => (Number.isFinite(+v) ? +v : 0));
  while (out.length > 1 && Math.abs(out[out.length - 1]) < 1e-12) out.pop();
  if (!out.length) out.push(1);
  return out;
};

/** 降べきの係数配列から多項式を評価する。 */
function evaluate(coeffs, x) {
  let v = 0;
  for (const c of coeffs) v = v * x + c;
  return v;
}

/** (x-a) で割った商の係数（筆算と同じ畳み込み）。 */
function quotientBy(coeffs, a) {
  const q = [coeffs[0]];
  for (let i = 1; i < coeffs.length - 1; i++) q.push(q[i - 1] * a + coeffs[i]);
  return q;
}

/** 区間 [lo,hi] の実数解。符号の変化を細かく追う。 */
function realRoots(coeffs, lo, hi, samples = 1400) {
  const roots = [];
  let prevX = lo;
  let prevY = evaluate(coeffs, lo);
  if (Math.abs(prevY) < 1e-9) roots.push(lo);
  for (let i = 1; i <= samples; i++) {
    const x = lerp(lo, hi, i / samples);
    const y = evaluate(coeffs, x);
    if (Math.abs(y) < 1e-9) {
      if (!roots.length || Math.abs(roots[roots.length - 1] - x) > 1e-6) roots.push(x);
    } else if (prevY * y < 0) {
      let a = prevX, b = x;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if (evaluate(coeffs, a) * evaluate(coeffs, m) <= 0) b = m; else a = m;
      }
      const r = (a + b) / 2;
      if (!roots.length || Math.abs(roots[roots.length - 1] - r) > 1e-4) roots.push(r);
    }
    prevX = x; prevY = y;
  }
  return roots.slice(0, MAXROOTS);
}

/**
 * 剰余の定理・因数定理・恒等式・高次方程式を3Dで。
 * coeffs は降べきの係数配列（x^2-1 は [1,0,-1]）。
 * mode: remainder | factor | identity | roots
 */
export function createAlgebra3D(params = {}) {
  const {
    coeffs = [1, 0, -1],
    divisor = 2,
    rootGuess = 1,
    mode = 'remainder',
    accent = 0x6ee7ff,
    domain = [-4, 4],
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = {
    coeffs: cleanCoeffs(coeffs), divisor, rootGuess, mode, accent, domain,
    yScale: 1, roots: [], remainder: 0, quotient: [],
  };

  const f = (x) => evaluate(P.coeffs, x);
  const ys = (y) => y * P.yScale;
  const safeF = (x) => { const v = f(x); return Number.isFinite(v) ? v : 0; };

  // ------------------------------------------------------------------ 舞台
  parts.axes = makeAxes({ size: 11, ticks: 11, accent, labels: ['x', 'y', 'z'] });
  group.add(parts.axes);
  parts.grid = makeGridPlane({ size: 12, div: 24, color: 0x2f4a7a, opacity: 0.4 });
  group.add(parts.grid);

  // ------------------------------------------------------------------ 曲線
  const SAMPLES = 320;
  const curveGroup = makeCurve(() => new THREE.Vector3(), { samples: SAMPLES, color: accent, glow: true, glowWidth: 0.05 });
  const curveLine = curveGroup.children[0];
  const tube = curveGroup.children[1];
  const curveAttr = curveLine.geometry.attributes.position;
  const pathPts = [];
  for (let i = 0; i <= SAMPLES; i++) pathPts.push(new THREE.Vector3());
  group.add(curveGroup);
  parts.poly = curveGroup;

  // 商の曲線（因数分解の右辺）
  const Q_SAMPLES = 220;
  const qGroup = makeCurve(() => new THREE.Vector3(), { samples: Q_SAMPLES, color: 0x7cffb2, glow: false });
  const qLine = qGroup.children[0];
  const qAttr = qLine.geometry.attributes.position;
  group.add(qGroup);
  parts.productCurve = qGroup;

  // ------------------------------------------------------------ 割る直線
  const divGroup = new THREE.Group();
  const divLine = makeSeg(0xff9f6e, 0.9);
  const divLabel = makeLabel('x = a', { height: 0.32, color: '#ff9f6e', bg: 'rgba(6,10,22,0.82)' });
  divGroup.add(divLine, divLabel);
  group.add(divGroup);
  parts.divisorLine = divGroup;

  // ------------------------------------------------------------- 余りの点
  const remGroup = new THREE.Group();
  const remDot = makePoint(0xffffff, { size: 0.14, halo: 1.1 });
  const remLabel = makeLabel('余り', { height: 0.34, color: '#ffffff', bg: 'rgba(6,10,22,0.84)', border: 'rgba(255,255,255,0.28)' });
  remLabel.position.set(0.5, 0.42, 0);
  const remDrop = makeSeg(0xffffff, 0.45);
  remGroup.add(remDot, remLabel, remDrop);
  group.add(remGroup);
  parts.remainderPoint = remGroup;

  // ------------------------------------------------------------- 実数解
  const zeros = new THREE.Group();
  const rootMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.14, 14, 10),
    solidMat(0xffd479, { opacity: 0.9, roughness: 0.25, metalness: 0.1 }),
    MAXROOTS
  );
  rootMesh.frustumCulled = false;
  rootMesh.count = 0;
  group.add(rootMesh);
  parts.rootDots = rootMesh;

  const rootLabels = [];
  for (let i = 0; i < MAXROOTS; i++) {
    const l = makeLabel('x', { height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.82)' });
    l.visible = false;
    zeros.add(l);
    rootLabels.push(l);
  }
  const axisMark = makeSeg(0xffd479, 0.5);
  const countLabel = makeLabel('', { height: 0.34, color: '#ffd479', bg: 'rgba(6,10,22,0.84)', border: 'rgba(255,212,121,0.3)' });
  zeros.add(axisMark, countLabel);
  group.add(zeros);
  parts.zeros = zeros;

  // ------------------------------------------------------ 縦線 x = t の位置
  const tGroup = new THREE.Group();
  const tLine = makeSeg(0x6ee7ff, 0.8);
  const tLabel = makeLabel('x = t', { height: 0.3, color: '#6ee7ff', bg: 'rgba(6,10,22,0.8)' });
  const tDot = makePoint(0x6ee7ff, { size: 0.11, halo: 0.85 });
  const tDrop = makeSeg(0x6ee7ff, 0.4);
  tGroup.add(tLine, tLabel, tDot, tDrop);
  group.add(tGroup);
  parts.tLine = tGroup;

  // --------------------------------------------------------------- 係数の玉
  const balls = new THREE.Group();
  const ballMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    solidMat(0x8fe8ff, { opacity: 0.9, roughness: 0.3, metalness: 0.15 }),
    MAXBALLS
  );
  ballMesh.frustumCulled = false;
  ballMesh.count = 0;
  const ballLabels = [];
  for (let i = 0; i < MAXBALLS; i++) {
    const l = makeLabel('', { height: 0.28, color: '#8fe8ff', bg: 'rgba(6,10,22,0.8)' });
    l.visible = false;
    balls.add(l);
    ballLabels.push(l);
  }
  const ballEq = makeLabel('', {
    height: 0.4, color: '#eaf6ff', bg: 'rgba(6,10,22,0.84)', border: 'rgba(110,231,255,0.3)',
  });
  ballEq.position.set(0, 5.5, 0);
  balls.add(ballMesh, ballEq);
  group.add(balls);
  parts.coeffBalls = balls;

  // -------------------------------------------------------- 恒等式のパネル
  const identity = new THREE.Group();
  const idLeft = makeLabel('左辺 f(x)', { height: 0.32, color: '#6ee7ff', bg: 'rgba(6,10,22,0.82)' });
  const idRight = makeLabel('右辺 (x-a)g(x)', { height: 0.32, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)' });
  const idZero = makeSeg(0xffffff, 0.85);
  const idMatch = new THREE.LineSegments(new THREE.BufferGeometry(), lineBasic(0xffffff, 0.35));
  const idZeroLabel = makeLabel('差はつねに 0', { height: 0.32, color: '#ffffff', bg: 'rgba(6,10,22,0.84)', border: 'rgba(255,255,255,0.25)' });
  identity.add(idLeft, idRight, idZero, idMatch, idZeroLabel);
  group.add(identity);
  parts.identityPanel = identity;

  // ---------------------------------------------------------------- 拡大
  const blow = new THREE.Group();
  const B_SAMPLES = 200;
  const bGroup = makeCurve(() => new THREE.Vector3(), { samples: B_SAMPLES, color: 0xffd479, glow: false });
  const bLine = bGroup.children[0];
  const bAttr = bLine.geometry.attributes.position;
  const frame = edgesOf(new THREE.PlaneGeometry(1, 1), 0xffd479, 0.5);
  const bLabel = makeLabel('拡大', { height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.82)' });
  blow.add(bGroup, frame, bLabel);
  blow.position.set(-3.1, 2.4, -1.9);   // 主図の左上に置く
  group.add(blow);
  parts.blowUp = blow;

  const anim = new Animated({ divisor, rootGuess });
  const dummy = new THREE.Object3D();

  // -------------------------------------------------------------- 再構築
  function fitScale() {
    let m = 0;
    for (let i = 0; i <= 100; i++) m = Math.max(m, Math.abs(safeF(lerp(domain[0], domain[1], i / 100))));
    m = Math.max(m, Math.abs(safeF(P.divisor)), 1);
    P.yScale = m > 1e-6 ? clamp(5.4 / m, 0.12, 3) : 1;
  }

  /** 係数配列を f(x) = ax^2 - bx + c の形の文字列にする。 */
  function polyText(cs) {
    const num = polyNum;
    let s = '';
    cs.forEach((c, i) => {
      const deg = cs.length - 1 - i;
      if (Math.abs(c) < 1e-9) return;
      const sign = s === '' ? (c < 0 ? '-' : '') : (c < 0 ? ' - ' : ' + ');
      const mag = Math.abs(c);
      if (deg === 0) { s += `${sign}${num(mag)}`; return; }
      const head = Math.abs(mag - 1) < 1e-9 ? '' : num(mag);
      s += `${sign}${head}x${deg > 1 ? `^${deg}` : ''}`;
    });
    return s === '' ? '0' : s;
  }

  function rebuildPoly() {
    const [x0, x1] = domain;
    const arr = curveAttr.array;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = lerp(x0, x1, i / SAMPLES);
      const y = clamp(ys(safeF(x)), -3.4, 6.6);
      pathPts[i].set(x, y, 0);
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = 0;
    }
    curveAttr.needsUpdate = true;
    curveLine.geometry.computeBoundingSphere();
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts), SAMPLES, 0.05, 8, false);
  }

  function rebuildQuotient() {
    const [x0, x1] = domain;
    const arr = qAttr.array;
    for (let i = 0; i <= Q_SAMPLES; i++) {
      const x = lerp(x0, x1, i / Q_SAMPLES);
      const v = Math.abs(x - P.divisor) < 1e-9 ? 0 : safeF(x) / (x - P.divisor);
      arr[i * 3] = x; arr[i * 3 + 1] = clamp(ys(v), -3.4, 6.6); arr[i * 3 + 2] = 0;
    }
    qAttr.needsUpdate = true;
    qLine.geometry.computeBoundingSphere();
  }

  function rebuildRoots() {
    P.roots = realRoots(P.coeffs, domain[0], domain[1]);
    const n = P.roots.length;
    rootMesh.count = n;
    let xMin = domain[1];
    let xMax = domain[0];
    for (let i = 0; i < n; i++) {
      const r = P.roots[i];
      dummy.position.set(r, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      rootMesh.setMatrixAt(i, dummy.matrix);
      const l = rootLabels[i];
      l.visible = true;
      l.position.set(r, 0.5, 0);
      l.userData.setText(`x = ${fmt(r)}`);
      xMin = Math.min(xMin, r);
      xMax = Math.max(xMax, r);
    }
    for (let i = n; i < MAXROOTS; i++) rootLabels[i].visible = false;
    rootMesh.instanceMatrix.needsUpdate = true;
    setSeg(axisMark, xMin, 0, xMax, 0);
    countLabel.position.set(0, -3.1, 0);
    countLabel.userData.setText(n ? `実数解は ${n} 個` : '実数解はない');
  }

  function rebuildBalls() {
    const cs = P.coeffs;
    const count = Math.min(cs.length, MAXBALLS);
    const span = Math.min(domain[1] - domain[0] - 0.6, count * 1.2);
    for (let i = 0; i < count; i++) {
      const x = -span / 2 + (span * i) / Math.max(count - 1, 1);
      const m = Math.max(Math.abs(cs[i]), 0.4);
      dummy.position.set(x, -1.7, 0);
      dummy.scale.setScalar(clamp(m * 0.45, 0.5, 1.3));
      dummy.updateMatrix();
      ballMesh.setMatrixAt(i, dummy.matrix);
      const deg = count - 1 - i;
      const l = ballLabels[i];
      l.visible = true;
      l.position.set(x, -2.4 - m * 0.22, 0);
      l.userData.setText(`a${deg} = ${polyNum(cs[i])}`);
    }
    for (let i = count; i < MAXBALLS; i++) ballLabels[i].visible = false;
    ballMesh.count = count;
    ballMesh.instanceMatrix.needsUpdate = true;
    ballEq.userData.setText(`f(x) = ${polyText(cs)}`);
  }

  function rebuildDivisor() {
    const a = P.divisor;
    const fa = ys(clamp(safeF(a), -3.4, 6.6));
    setSeg(divLine, a, -3.4, a, 6.6);
    divLabel.position.set(a + 0.55, 6.0, 0);
    divLabel.userData.setText(`x = ${fmt(a, 1)}`);

    remDot.position.set(a, fa, 0);
    remLabel.position.set(a + 0.5, fa + 0.42, 0);
    remLabel.userData.setText(`余り ${fmt(P.remainder)}`);
    setSeg(remDrop, a, 0, a, fa);

    // 恒等式：両辺の一致を x 軸との間に縦線で示す
    setSeg(idZero, domain[0], 0, domain[1], 0);
    idLeft.position.set(domain[0] + 0.9, 6.0, 0);
    idRight.position.set(domain[1] - 1.3, 6.0, 0);
    const match = [];
    const lo = Math.min(domain[0], P.divisor);
    const hi = Math.max(domain[1], P.divisor);
    for (const x of [lerp(lo, hi, 0.15), lerp(lo, hi, 0.4), P.divisor, lerp(lo, hi, 0.75)]) {
      const y = ys(clamp(safeF(x), -3.4, 6.6));
      match.push(x, 0, 0, x, y, 0);
    }
    idMatch.geometry.dispose();
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(match, 3));
    idMatch.geometry = mg;
    idZeroLabel.position.set((domain[0] + domain[1]) / 2, 0.7, 0);
  }

  function rebuildTrial() {
    const t = clamp(P.rootGuess, domain[0], domain[1]);
    const ft = ys(clamp(safeF(t), -3.4, 6.6));
    setSeg(tLine, t, -3.4, t, 6.6);
    setSeg(tDrop, t, 0, t, ft);
    tDot.position.set(t, ft, 0);
    tLabel.position.set(t - 0.75, 6.0, 0);
    tLabel.userData.setText(`x = t = ${fmt(t, 1)}`);
  }

  function rebuildBlow() {
    const t = clamp(P.rootGuess, domain[0], domain[1]);
    const half = 1.0;
    const scale = 1.6;
    const arr = bAttr.array;
    for (let i = 0; i <= B_SAMPLES; i++) {
      const x = t - half + (2 * half * i) / B_SAMPLES;
      const y = clamp(ys(safeF(x)), -3.4, 6.6);
      arr[i * 3] = (x - t) * scale;
      arr[i * 3 + 1] = clamp(y * scale * 0.7, -2, 2);
      arr[i * 3 + 2] = 0;
    }
    bAttr.needsUpdate = true;
    bLine.geometry.computeBoundingSphere();
    frame.scale.set(half * 2 * scale + 0.2, 4.2, 1);
    frame.position.set(0, 0, -0.02);
    bLabel.position.set(0, 2.45, 0);
    bLabel.userData.setText(`x = ${fmt(t, 1)} のまわりを ${scale} 倍に拡大`);
  }

  function applyMode() {
    const m = P.mode;
    qGroup.visible = m === 'factor' || m === 'identity';
    divGroup.visible = m !== 'roots';
    remGroup.visible = m === 'remainder' || m === 'factor';
    zeros.visible = m === 'roots';
    tGroup.visible = m === 'roots';
    identity.visible = m === 'identity';
    blow.visible = m === 'roots';
    balls.visible = true;
  }

  function rebuild() {
    fitScale();
    P.remainder = safeF(P.divisor);
    P.quotient = quotientBy(P.coeffs, P.divisor);
    rebuildPoly();
    rebuildQuotient();
    rebuildRoots();
    rebuildBalls();
    rebuildDivisor();
    rebuildTrial();
    rebuildBlow();
    applyMode();
  }

  function setParams(patch = {}) {
    if (patch.coeffs) P.coeffs = cleanCoeffs(patch.coeffs);
    if (patch.divisor != null) P.divisor = patch.divisor;
    if (patch.rootGuess != null) P.rootGuess = patch.rootGuess;
    if (patch.mode != null) P.mode = patch.mode;
    if (patch.domain) P.domain = patch.domain.slice();
    if (patch.accent != null) P.accent = patch.accent;
    if (patch.identity != null) identity.visible = patch.identity;
    if (patch.remainder != null) remGroup.visible = patch.remainder;
    if (patch.coeffBalls != null) balls.visible = patch.coeffBalls;
    anim.to({ divisor: P.divisor, rootGuess: P.rootGuess });
    rebuild();
  }

  function update(dt) {
    const c = anim.update(dt, 5);
    P.divisor = c.divisor;
    P.rootGuess = c.rootGuess;
    if (Math.abs(P.divisor - anim.target.divisor) > 1e-4
      || Math.abs(P.rootGuess - anim.target.rootGuess) > 1e-4) {
      P.remainder = safeF(P.divisor);
      rebuildQuotient();
      rebuildDivisor();
      rebuildTrial();
      rebuildBlow();
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose, f, roots: () => P.roots.slice() };
}
