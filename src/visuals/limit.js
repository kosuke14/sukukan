import * as THREE from 'three';
import { solidMat, lineBasic, edgesOf, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp, ease } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makeCurve, makePoint, Animated } from './common.js';

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const fmt1 = (v) => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : '-');

const MAXSEQ = 40;
const MAXBAR = 60;
const BAR_W = 0.34;    // 棒の幅
const BAR_H = 1.6;     // 棒の高さ 倍率
const BAR_X0 = -2.6;   // 一本目の棒の位置

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

/** x=a を中心とする帯。下側の子だけを動かせばポップインを妨げない。 */
function makeBand(color, opacity) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), solidMat(color, { opacity, roughness: 0.9, metalness: 0 }));
  const wire = edgesOf(new THREE.BoxGeometry(1, 1, 1), color, 0.55);
  g.add(box, wire);
  g.userData.setBox = (x0, x1, y0, y1, z0, z1) => {
    const sx = Math.abs(x1 - x0) || 1e-3;
    const sy = Math.abs(y1 - y0) || 1e-3;
    const sz = Math.abs(z1 - z0) || 1e-3;
    for (const o of g.children) {
      o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      o.scale.set(sx, sy, sz);
    }
  };
  return g;
}

/** f の x→target での極限を数値で求める。 */
function limitOf(fn, t) {
  const hs = [2e-3, 1e-3, 5e-4, 2e-4];
  let acc = 0, cnt = 0;
  for (const h of hs) {
    const v = (fn(t + h) + fn(t - h)) / 2;
    if (Number.isFinite(v)) { acc += v; cnt++; }
  }
  return cnt ? acc / cnt : 0;
}

/**
 * 極限の定義と収束の絵。
 * mode: eps(εとδ) | sequence(数列) | series(等比級数) | squeeze(はさみうち) | continuity(連続性)
 */
export function createLimit(params = {}) {
  const {
    fn = (x) => Math.sin(x) / x,
    target = 0,
    approach = 0.3,
    mode = 'eps',
    L = 1,
    r = 0.5,
    terms = 8,
    common = 0.5,
    accent = 0x6ee7ff,
    domain = [-6, 6],
    eps = 0.4,
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = {
    fn, target, approach, mode, L, r, terms, common, accent, domain, eps,
    yScale: 1, lim: limitOf(fn, target), seriesSum: 0, diverges: Math.abs(r) >= 1,
  };
  const givenL = L !== undefined && L !== null;
  P.lim = givenL ? L : limitOf(fn, target);
  P.L = P.lim;

  const f = (x) => P.fn(x);
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
  parts.curve = curveGroup;

  // ------------------------------------------------------- a の点と極限の点
  const aDot = makePoint(0x8fe8ff, { size: 0.1, halo: 0.7 });
  const aLabel = makeLabel('a', { height: 0.28, color: '#8fe8ff', bg: 'rgba(6,10,22,0.75)' });
  aLabel.position.y = 0.42;
  group.add(aDot, aLabel);
  parts.dot = aDot;

  const targetGroup = new THREE.Group();
  targetGroup.add(makePoint(0xffffff, { size: 0.14, halo: 1.1 }));
  group.add(targetGroup);
  parts.targetDot = targetGroup;

  const lLabel = makeLabel('L', { height: 0.34, color: '#ffffff', bg: 'rgba(6,10,22,0.84)', border: 'rgba(255,255,255,0.28)' });
  group.add(lLabel);
  parts.labelL = lLabel;

  // ---------------------------------------------------------- 動く点と垂線
  const moving = new THREE.Group();
  const mDot = makePoint(0xffd479, { size: 0.13, halo: 1.0 });
  const mHalo = mDot.children[1];
  const mLabel = makeLabel('x', { height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.82)' });
  const mFoot = makePoint(0xffd479, { size: 0.07, halo: 0.45 });
  moving.add(mDot, mLabel, mFoot);
  group.add(moving);
  parts.point = moving;

  const approachLine = makeSeg(0xffd479, 0.7);
  group.add(approachLine);
  parts.approachLine = approachLine;

  // ------------------------------------------------------------- ε と δ の帯
  const epsBand = makeBand(0x7cffb2, 0.13);
  group.add(epsBand);
  parts.epsBand = epsBand;

  const deltaBand = makeBand(0xff9f6e, 0.15);
  group.add(deltaBand);
  parts.deltaBand = deltaBand;

  const deltaLabel = makeLabel('', {
    height: 0.36, color: '#eaf6ff', bg: 'rgba(6,10,22,0.84)', border: 'rgba(255,159,110,0.35)',
  });
  deltaLabel.position.set(-2.6, 5.6, 0);
  group.add(deltaLabel);
  parts.labelDelta = deltaLabel;

  // ---------------------------------------------------------------- 数列
  const seqGroup = new THREE.Group();
  const seqMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.09, 12, 8),
    solidMat(0x6ee7ff, { opacity: 0.85, roughness: 0.3, metalness: 0.1 }),
    MAXSEQ
  );
  seqMesh.frustumCulled = false;
  seqMesh.count = 0;
  const seqLine = makeSeg(0x6ee7ff, 0.6);
  const seqNow = makePoint(0xffd479, { size: 0.13, halo: 1.0 });
  const seqNowLabel = makeLabel('', { height: 0.28, color: '#ffd479', bg: 'rgba(6,10,22,0.8)' });
  seqGroup.add(seqLine, seqMesh, seqNow, seqNowLabel);
  group.add(seqGroup);
  parts.sequencePoints = seqGroup;
  const seqDummy = new THREE.Object3D();

  // ------------------------------------------------------------- 等比級数
  const barGroup = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(1, 1, 1);
  barGeo.translate(0, 0.5, 0);
  const barMesh = new THREE.InstancedMesh(barGeo, solidMat(0x6ee7ff, { opacity: 0.45, roughness: 0.8, metalness: 0 }), MAXBAR);
  barMesh.frustumCulled = false;
  barMesh.count = 0;
  const sumLine = makeSeg(0xffd479, 0.95);
  const sumLabel = makeLabel('部分和', { height: 0.34, color: '#ffd479', bg: 'rgba(6,10,22,0.84)', border: 'rgba(255,212,121,0.3)' });
  barGroup.add(barMesh, sumLine, sumLabel);
  group.add(barGroup);
  parts.seriesBars = barGroup;
  parts.partialSum = sumLabel;
  const barDummy = new THREE.Object3D();

  // ------------------------------------------------------------ はさみうち
  const upperGroup = new THREE.Group();
  const upperCurve = makeCurve(() => new THREE.Vector3(), { samples: 200, color: 0x7cffb2, opacity: 0.8, glow: false });
  const upperLine = upperCurve.children[0];
  const upperFill = new THREE.Mesh(new THREE.BufferGeometry(), solidMat(0x7cffb2, { opacity: 0.1, roughness: 0.9, metalness: 0 }));
  upperFill.frustumCulled = false;
  const upperLabel = makeLabel('h(x)', { height: 0.3, color: '#7cffb2', bg: 'rgba(6,10,22,0.75)' });
  upperGroup.add(upperCurve, upperFill, upperLabel);
  group.add(upperGroup);
  parts.squeezeUpper = upperGroup;

  const lowerGroup = new THREE.Group();
  const lowerCurve = makeCurve(() => new THREE.Vector3(), { samples: 200, color: 0xff9f6e, opacity: 0.8, glow: false });
  const lowerLine = lowerCurve.children[0];
  const lowerLabel = makeLabel('g(x)', { height: 0.3, color: '#ff9f6e', bg: 'rgba(6,10,22,0.75)' });
  lowerGroup.add(lowerCurve, lowerLabel);
  group.add(lowerGroup);
  parts.squeezeLower = lowerGroup;

  // ------------------------------------------------------------ 跳び（穴）
  const jumpGroup = new THREE.Group();
  const jumpRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.035, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff6b9d, transparent: true, opacity: 0.95 })
  );
  const jumpLine = makeSeg(0xff6b9d, 0.7);
  const jumpLabel = makeLabel('とび', { height: 0.3, color: '#ff6b9d', bg: 'rgba(6,10,22,0.8)' });
  jumpGroup.add(jumpRing, jumpLine, jumpLabel);
  group.add(jumpGroup);
  parts.jumpPoint = jumpGroup;

  const anim = new Animated({ target, approach });

  // -------------------------------------------------------------- 再構築
  function fitScale() {
    let m = Math.abs(P.L) * 1.5 + 0.4;
    for (let i = 0; i <= 80; i++) m = Math.max(m, Math.abs(safeF(lerp(domain[0], domain[1], i / 80))));
    P.yScale = m > 1e-6 ? clamp(5.2 / m, 0.2, 2.5) : 1;
  }

  function rebuildCurve() {
    const [x0, x1] = domain;
    const arr = curveAttr.array;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = lerp(x0, x1, i / SAMPLES);
      const y = clamp(ys(safeF(x)), -3.2, 6.4);
      pathPts[i].set(x, y, 0);
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = 0;
    }
    curveAttr.needsUpdate = true;
    curveLine.geometry.computeBoundingSphere();
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts), SAMPLES, 0.05, 8, false);
  }

  function rebuildSqueeze() {
    const [x0, x1] = domain;
    const w = Math.max(P.common, 0.05);
    const N = 200;
    const ua = upperLine.geometry.attributes.position.array;
    const la = lowerLine.geometry.attributes.position.array;
    const pos = [];
    const idx = [];
    let upY = 0, loY = 0;
    for (let i = 0; i <= N; i++) {
      const x = lerp(x0, x1, i / N);
      const d = Math.abs(x - P.target) * w;
      const uy = clamp(ys(P.L + d), -3.2, 6.4);
      const ly = clamp(ys(P.L - d), -3.2, 6.4);
      ua[i * 3] = x; ua[i * 3 + 1] = uy; ua[i * 3 + 2] = 0;
      la[i * 3] = x; la[i * 3 + 1] = ly; la[i * 3 + 2] = 0;
      upY = uy; loY = ly;
      if (i < N) {
        const o = i * 2;
        pos.push(x, uy, 0, x + (x1 - x0) / N, uy, 0, x, ly, 0);
        pos.push(x + (x1 - x0) / N, uy, 0, x + (x1 - x0) / N, ly, 0, x, ly, 0);
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
    upperLine.geometry.attributes.position.needsUpdate = true;
    lowerLine.geometry.attributes.position.needsUpdate = true;
    upperLine.geometry.computeBoundingSphere();
    lowerLine.geometry.computeBoundingSphere();

    upperFill.geometry.dispose();
    const ug = new THREE.BufferGeometry();
    ug.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ug.setIndex(idx);
    upperFill.geometry = ug;

    const xq = clamp(P.target + 1.6, x0, x1);
    upperLabel.position.set(xq, upY + 0.42, 0);
    lowerLabel.position.set(xq, loY - 0.42, 0);
  }

  /** k 項まで積み上がるように各棒の長さを並べ替える。 */
  function layoutBars(k) {
    const count = barMesh.count;
    for (let i = 0; i < count; i++) {
      const t = Math.pow(P.r, i) * BAR_H;
      const on = i < k;
      barDummy.position.set(BAR_X0 + i * BAR_W, t >= 0 ? 0 : t, 0);
      barDummy.scale.set(BAR_W * 0.8, Math.max(Math.abs(t) * (on ? 1 : 0.06), 1e-3), on ? 1.2 : 1);
      barDummy.updateMatrix();
      barMesh.setMatrixAt(i, barDummy.matrix);
    }
    barMesh.instanceMatrix.needsUpdate = true;
  }

  function rebuildSeries() {
    const count = clamp(Math.round(P.terms), 1, MAXBAR);
    barMesh.count = count;
    P.diverges = Math.abs(P.r) >= 1;
    P.seriesX1 = BAR_X0 + (count - 1) * BAR_W;
    let sum = 0;
    for (let i = 0; i < count; i++) sum += Math.pow(P.r, i);
    P.seriesSum = sum;
    layoutBars(count);
  }

  function rebuildSequence() {
    const count = clamp(Math.round(P.terms) + 4, 4, MAXSEQ);
    seqMesh.count = count;
    P.seqPts = [];
    for (let i = 0; i < count; i++) {
      const n = i + 1;
      const d = 2.4 / n;                       // L からの距離
      const ang = n * 0.85;
      const x = P.target + d * Math.cos(ang) * 0.9;
      const y = ys(P.L) + d * P.yScale * 0.7;
      const z = d * Math.sin(ang) * 0.9;
      seqDummy.position.set(x, y, z);
      seqDummy.scale.setScalar(clamp(1.8 / n, 0.45, 1));
      seqDummy.updateMatrix();
      seqMesh.setMatrixAt(i, seqDummy.matrix);
      P.seqPts.push(new THREE.Vector3(x, y, z));
    }
    seqMesh.instanceMatrix.needsUpdate = true;
  }

  function applyMode() {
    const m = P.mode;
    const walk = m === 'eps' || m === 'squeeze' || m === 'continuity';
    moving.visible = walk;
    approachLine.visible = walk;
    epsBand.visible = m === 'eps' || m === 'squeeze';
    deltaBand.visible = m === 'eps';
    deltaLabel.visible = m === 'eps' || m === 'squeeze' || m === 'continuity';
    seqGroup.visible = m === 'sequence';
    barGroup.visible = m === 'series';
    upperGroup.visible = m === 'squeeze';
    lowerGroup.visible = m === 'squeeze';
    jumpGroup.visible = false;
    // 数列と級数は関数の曲線とは関係しないので、既定では隠す。
    curveGroup.visible = m !== 'series' && m !== 'sequence';
  }

  function rebuild() {
    fitScale();
    rebuildCurve();
    rebuildSqueeze();
    rebuildSeries();
    rebuildSequence();
    aDot.position.set(P.target, 0, 0);
    aLabel.position.set(P.target - 0.55, 0.42, 0);
    aLabel.userData.setText(`a = ${fmt(P.target, 1)}`);
    targetGroup.position.set(P.target, ys(P.L), 0);
    lLabel.position.set(P.target - 0.9, ys(P.L) + 0.5, 0);
    lLabel.userData.setText(`L = ${fmt(P.L)}`);
    applyMode();
  }

  function setParams(patch = {}) {
    if (patch.fn) P.fn = patch.fn;
    if (patch.target != null) P.target = patch.target;
    if (patch.approach != null) P.approach = patch.approach;
    if (patch.eps != null) P.eps = patch.eps;
    if (patch.common != null) P.common = patch.common;
    if (patch.r != null) P.r = patch.r;
    if (patch.terms != null) P.terms = patch.terms;
    if (patch.mode != null) P.mode = patch.mode;
    if (patch.domain) P.domain = patch.domain.slice();
    if (patch.accent != null) P.accent = patch.accent;
    if (patch.L != null) P.L = patch.L;
    anim.to({ target: P.target, approach: P.approach });
    rebuild();
  }

  // ------------------------------------------------------------------ 更新
  function say(txt) {
    if (txt !== P._txt) { P._txt = txt; deltaLabel.userData.setText(txt); }
  }

  function update(dt, elapsed) {
    const c = anim.update(dt, 4.5);
    P.target = c.target;
    const m = P.mode;

    if (m === 'eps' || m === 'squeeze' || m === 'continuity') {
      const t = (elapsed % 5.5) / 5.5;           // x が a へ寄る
      const d = lerp(3.4, 0.02, ease.inOutCubic(t));
      const x = P.target + d;
      const y = ys(clamp(safeF(x), -3.2, 6.4));
      mDot.position.set(x, y, 0);
      mFoot.position.set(x, 0, 0);
      mLabel.position.set(x + 0.62, y + 0.36, 0);
      setSeg(approachLine, x, 0, x, y);

      epsBand.userData.setBox(domain[0], domain[1], ys(P.L - P.eps), ys(P.L + P.eps), -0.35, 0.35);
      deltaBand.userData.setBox(P.target - d, P.target + d, -0.3, 0.3, -0.35, 0.35);

      if (m === 'eps') {
        const ok = Math.abs(safeF(x) - P.L) <= P.eps;
        say(ok
          ? `x と a の差が ${fmt(d)} 以下なら、f(x) と L の差が ${fmt1(P.eps)} 以下`
          : 'x を a へ近づける…');
      } else if (m === 'squeeze') {
        say(`g(x) <= f(x) <= h(x)   上下が ${fmt(P.L)} へ寄る`);
      } else {
        const fv = f(P.target);
        const cont = Number.isFinite(fv) && Math.abs(fv - P.L) < 1e-3;
        say(cont
          ? `連続: 関数の値は ${fmt(fv)}`
          : `不連続: 極限は ${fmt(P.L)} だが値は ${Number.isFinite(fv) ? fmt(fv) : 'ない'}`);
        jumpGroup.visible = !cont;
        if (!cont) {
          const fy = Number.isFinite(fv) ? ys(fv) : ys(P.L);
          jumpRing.position.set(P.target, ys(P.L), 0.01);
          setSeg(jumpLine, P.target, Math.min(ys(P.L), fy), P.target, Math.max(ys(P.L), fy));
          jumpLabel.position.set(P.target + 0.45, (ys(P.L) + fy) / 2, 0);
        }
      }
      const s = 1.05 + 0.08 * Math.sin(elapsed * 2.2);
      mHalo.scale.set(s, s, 1);
      return;
    }

    if (m === 'sequence' && P.seqPts && P.seqPts.length) {
      const cycle = 3.6;
      const k = clamp(Math.floor((elapsed % cycle) / cycle * P.seqPts.length), 0, P.seqPts.length - 1);
      const p = P.seqPts[k];
      const q = P.seqPts[Math.min(k + 1, P.seqPts.length - 1)];
      seqNow.position.copy(p);
      seqNowLabel.position.set(p.x + 0.6, p.y + 0.24, p.z);
      say(`第 ${k + 1} 項の値 = ${fmt(P.L + 2.4 / (k + 1))}`);
      setSeg(seqLine, p.x, p.y, q.x, q.y);
      return;
    }

    if (m === 'series') {
      const count = barMesh.count;
      const cycle = 4.5;
      const k = clamp(Math.floor((elapsed % cycle) / cycle * count) + 1, 1, count);
      let sum = 0;
      for (let i = 0; i < k; i++) sum += Math.pow(P.r, i);
      const draw = clamp(sum * BAR_H, -6, 6);
      layoutBars(k);
      setSeg(sumLine, BAR_X0 - 0.35, draw, P.seriesX1 + 0.45, draw);
      sumLabel.position.set((BAR_X0 + P.seriesX1) / 2, draw + 0.5, 0);
      if (P._bTxt !== draw) {
        P._bTxt = draw;
        sumLabel.userData.setText(P.diverges
          ? `部分和 ${fmt(sum)}  止まらず増える`
          : `部分和 ${fmt(sum)}   1/(1-r) = ${fmt(1 / (1 - P.r))}`);
      }
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose, f };
}
