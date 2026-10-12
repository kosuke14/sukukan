import * as THREE from 'three';
import { solidMat, lineBasic, edgesOf, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp, ease } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makeCurve, makeArrow, makePoint, Animated } from './common.js';

const Y_TOP = 6.2;

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
/** 動く値は小数1桁に丸める。texture キャッシュの膨張を防ぐため。 */
const fmt1 = (v) => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : '-');

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

/** 端点が動く矢印。作り直さず姿勢と長さだけ変える。 */
function sizedArrow(color) {
  const g = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(0.026, 0.026, 1, 8);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, solidMat(color, { opacity: 0.9, roughness: 0.3, emissiveIntensity: 0.4 }));
  const headGeo = new THREE.ConeGeometry(0.085, 0.2, 14);
  headGeo.translate(0, 0.1, 0);
  const head = new THREE.Mesh(headGeo, solidMat(color, { opacity: 0.95, roughness: 0.3, emissiveIntensity: 0.5 }));
  g.add(shaft, head);
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  g.userData.set = (from, to) => {
    dir.subVectors(to, from);
    const len = dir.length();
    if (len < 0.04) { g.scale.setScalar(0.0001); return; }
    g.scale.setScalar(1);
    g.position.copy(from);
    dir.multiplyScalar(1 / len);
    g.quaternion.setFromUnitVectors(up, dir);
    const body = Math.max(len - 0.18, 0.02);
    shaft.scale.set(1, body, 1);
    head.position.set(0, body, 0);
  };
  return g;
}

/** 作り直した子だけを解放する。ラベルの texture は共有なので残す。 */
function clearMeshes(g) {
  for (const c of [...g.children]) {
    if (c.geometry) c.geometry.dispose();
    const mats = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
    for (const m of mats) {
      if (m.userData?.shared) continue;
      if (m.map && !m.map.userData?.shared) m.map.dispose();
      m.dispose();
    }
    g.remove(c);
  }
}

/**
 * 微分係数・接線・増減・積分・面積・体積を1つのビルダーにまとめる。
 * mode: tangent(接線) | slope(傾き) | integral(Riemann和) | area(面積) | volume(体積)
 */
export function createCalculus(params = {}) {
  const {
    fn = (x) => x * x,
    a = 0, b = 3,
    mode = 'tangent',
    h = 0.001,
    n = 60,
    accent = 0x6ee7ff,
    domain = [-1, 4],
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { fn, a, b, mode, h, hNow: h, n, accent, domain, yScale: 1, sum: 0, mean: 0 };

  const f = (x) => P.fn(x);
  const ys = (y) => y * P.yScale;                       // 画面上の高さ
  const safeF = (x) => { const v = f(x); return Number.isFinite(v) ? v : 0; };
  const COL_POS = new THREE.Color(accent);
  const COL_NEG = new THREE.Color(0xff6b9d);

  // ------------------------------------------------------------------ 舞台
  parts.axes = makeAxes({ size: 11, ticks: 11, accent, labels: ['x', 'y', 'z'] });
  group.add(parts.axes);
  parts.grid = makeGridPlane({ size: 12, div: 24, color: 0x2f4a7a, opacity: 0.4 });
  group.add(parts.grid);

  // ------------------------------------------------------------------ 曲線
  const SAMPLES = 300;
  const curveGroup = makeCurve(() => new THREE.Vector3(), { samples: SAMPLES, color: accent, glow: true, glowWidth: 0.05 });
  const curveLine = curveGroup.children[0];
  const tube = curveGroup.children[1];
  const curveAttr = curveLine.geometry.attributes.position;
  const pathPts = [];
  for (let i = 0; i <= SAMPLES; i++) pathPts.push(new THREE.Vector3());
  group.add(curveGroup);
  parts.curve = curveGroup;

  // ------------------------------------------------------------ 点 A と点 B
  const pointGroup = new THREE.Group();
  const dotA = makePoint(0xffffff, { size: 0.13, halo: 0.95 });
  const dotB = makePoint(0xffd479, { size: 0.12, halo: 0.95 });
  const lblA = makeLabel('A', { height: 0.3, color: '#ffffff', bg: 'rgba(6,10,22,0.82)' });
  const lblB = makeLabel('B', { height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.82)' });
  lblA.position.y = 0.46;
  lblB.position.y = 0.5;
  pointGroup.add(dotA, dotB, lblA, lblB);
  group.add(pointGroup);
  parts.movingPoint = pointGroup;

  // ------------------------------------------------------------- 割線と接線
  const secantGroup = new THREE.Group();
  const secantLine = makeSeg(0x8fe8ff, 0.95);
  const runArrow = sizedArrow(0x7cffb2);
  const riseArrow = sizedArrow(0xff9f6e);
  const secantLabel = makeLabel('割線', { height: 0.28, color: '#8fe8ff', bg: 'rgba(6,10,22,0.78)' });
  secantGroup.add(secantLine, runArrow, riseArrow, secantLabel);
  group.add(secantGroup);
  parts.secant = secantGroup;

  const tangentGroup = new THREE.Group();
  const tangentLine = makeSeg(0xffd479, 0.95);
  const tangentLabel = makeLabel('接線', { height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.8)' });
  tangentGroup.add(tangentLine, tangentLabel);
  group.add(tangentGroup);
  parts.tangent = tangentGroup;

  // 幅 h の水平線
  const hGroup = new THREE.Group();
  const hLine = makeSeg(0x7cffb2, 0.8);
  const hLabel = makeLabel('h', { height: 0.28, color: '#7cffb2', bg: 'rgba(6,10,22,0.75)' });
  hGroup.add(hLine, hLabel);
  group.add(hGroup);
  parts.hLine = hGroup;

  // 傾きの読み値
  const readout = makeLabel('', {
    height: 0.38, color: '#eaf6ff', bg: 'rgba(6,10,22,0.84)', border: 'rgba(110,231,255,0.3)',
  });
  readout.position.set(-3.1, Y_TOP - 0.5, 0);
  group.add(readout);
  parts.derivativeReadout = readout;

  // ------------------------------------------------------- 積分区間 [a, b]
  const abGroup = new THREE.Group();
  const abArrow = new THREE.Group();
  const abLabel = makeLabel('区間 [a, b]', { height: 0.3, color: '#cfe0ff', bg: 'rgba(6,10,22,0.78)' });
  const lblA2 = makeLabel('a', { height: 0.28, color: '#8fe8ff', bg: 'rgba(6,10,22,0.7)' });
  const lblB2 = makeLabel('b', { height: 0.28, color: '#8fe8ff', bg: 'rgba(6,10,22,0.7)' });
  abGroup.add(abArrow, abLabel, lblA2, lblB2);
  group.add(abGroup);
  parts.arrowAB = abGroup;

  // 底辺（x 軸上の線分）
  const baseLine = makeSeg(accent, 0.9);
  group.add(baseLine);
  parts.baseLine = baseLine;

  // ------------------------------------------------------------ Riemann 和
  const MAXN = 320;
  const columns = new THREE.Group();
  const colGeo = new THREE.BoxGeometry(1, 1, 1);
  colGeo.translate(0, 0.5, 0);
  const colMesh = new THREE.InstancedMesh(colGeo, solidMat(accent, { opacity: 0.3, roughness: 0.8, metalness: 0 }), MAXN);
  colMesh.frustumCulled = false;
  colMesh.count = 0;
  columns.add(colMesh);

  const markBox = new THREE.BoxGeometry(1, 1, 1);
  const colMark = new THREE.Group();
  colMark.add(
    new THREE.Mesh(markBox, solidMat(0xffffff, { opacity: 0.1, roughness: 0.5 })),
    edgesOf(markBox, 0xffffff, 0.9)
  );
  colMark.visible = false;
  columns.add(colMark);
  group.add(columns);
  parts.columns = columns;
  parts.columnMesh = colMesh;
  const dummy = new THREE.Object3D();

  // ------------------------------------------------------------- 面積（面と板）
  const filled = new THREE.Mesh(new THREE.BufferGeometry(), solidMat(accent, { opacity: 0.34, roughness: 0.9, metalness: 0 }));
  const slab = new THREE.Mesh(new THREE.BufferGeometry(), solidMat(accent, { opacity: 0.17, roughness: 0.9, metalness: 0 }));
  group.add(filled, slab);
  parts.filled = filled;
  parts.areaSlab = slab;

  // ---------------------------------------------------------------- 回転体
  // 回転体は毎フレーム濃さを変えたいため、共有マテリアルではなく専用のものを使う。
  const solidMatLocal = new THREE.MeshStandardMaterial({
    color: 0x7cffb2, roughness: 0.7, metalness: 0, transparent: true,
    opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, emissive: new THREE.Color(0x0d3a24), emissiveIntensity: 0.6,
  });
  const solid = new THREE.Mesh(new THREE.BufferGeometry(), solidMatLocal);
  solid.rotation.z = -Math.PI / 2;  // LatheGeometry の y 軸を x 軸に立てる。
  group.add(solid);
  parts.solidOfRevolution = solid;

  // -------------------------------------------------------------- 平均値
  const avgGroup = new THREE.Group();
  const avgLine = makeSeg(0xffd479, 0.85);
  const avgLabel = makeLabel('平均', { height: 0.32, color: '#ffd479', bg: 'rgba(6,10,22,0.8)' });
  avgGroup.add(avgLine, avgLabel);
  group.add(avgGroup);
  parts.avgValue = avgGroup;

  const anim = new Animated({ a, b, h });

  // -------------------------------------------------------------- 再構築
  function fitScale() {
    const x0 = Math.min(domain[0], P.a);
    const x1 = Math.max(domain[1], P.b);
    let m = 0;
    for (let i = 0; i <= 80; i++) m = Math.max(m, Math.abs(safeF(lerp(x0, x1, i / 80))));
    P.yScale = m > 1e-6 ? clamp(5 / m, 0.12, 3) : 1;
  }

  function rebuildCurve() {
    const [x0, x1] = domain;
    const arr = curveAttr.array;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = lerp(x0, x1, i / SAMPLES);
      const y = clamp(ys(safeF(x)), -3.4, Y_TOP + 1);
      pathPts[i].set(x, y, 0);
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = 0;
    }
    curveAttr.needsUpdate = true;
    curveLine.geometry.computeBoundingSphere();
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts), SAMPLES, 0.05, 8, false);
  }

  /** 区間 [a,b] で曲線と x 軸に挟まれた領域の輪郭。 */
  function regionShape() {
    const N = 110;
    const lo = Math.min(P.a, P.b);
    const hi = Math.max(P.a, P.b);
    const loop = [];
    for (let i = 0; i <= N; i++) { const x = lerp(lo, hi, i / N); loop.push(new THREE.Vector2(x, Math.max(ys(safeF(x)), 0))); }
    for (let i = N; i >= 0; i--) { const x = lerp(lo, hi, i / N); loop.push(new THREE.Vector2(x, 0)); }
    const shape = new THREE.Shape();
    shape.moveTo(loop[0].x, loop[0].y);
    for (let i = 1; i < loop.length; i++) shape.lineTo(loop[i].x, loop[i].y);
    shape.closePath();
    return shape;
  }

  function rebuildArea() {
    const shape = regionShape();
    filled.geometry.dispose();
    filled.geometry = new THREE.ShapeGeometry(shape);
    slab.geometry.dispose();
    slab.geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
    slab.position.z = -0.35;
  }

  function rebuildVolume() {
    const N = 96;
    const lo = Math.min(P.a, P.b);
    const hi = Math.max(P.a, P.b);
    const prof = [];
    // LatheGeometry は (半径, 軸方向の位置) の点列を y 軸まわりに回す。
    for (let i = 0; i <= N; i++) {
      const x = lerp(lo, hi, i / N);
      prof.push(new THREE.Vector2(Math.max(ys(safeF(x)), 0), x));
    }
    solid.geometry.dispose();
    solid.geometry = new THREE.LatheGeometry(prof, 64);
  }

  function rebuildInterval() {
    setSeg(baseLine, P.a, 0, P.b, 0);
    clearMeshes(abArrow);
    abArrow.add(makeArrow(new THREE.Vector3(P.a, -0.9, 0), new THREE.Vector3(P.b, -0.9, 0),
      { color: accent, headSize: 0.15, shaft: 0.02 }));
    lblA2.position.set(P.a, -1.32, 0);
    lblB2.position.set(P.b, -1.32, 0);
    abLabel.position.set((P.a + P.b) / 2, -1.85, 0);
    abLabel.userData.setText(`区間 [${fmt(P.a, 1)}, ${fmt(P.b, 1)}]`);
  }

  /** 分割数 n の長方形を setMatrixAt で並べる。作り直さない。 */
  function rebuildColumns() {
    const lo = Math.min(P.a, P.b);
    const hi = Math.max(P.a, P.b);
    const count = Math.max(1, Math.min(MAXN, Math.round(P.n)));
    const w = (hi - lo) / count;
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const x = lo + (i + 1) * w;              // 右端点で近似
      const hgt = ys(safeF(x));
      sum += hgt * w;
      dummy.position.set(x - w / 2, hgt >= 0 ? 0 : hgt, 0);
      dummy.scale.set(Math.abs(w) * 0.88, Math.max(Math.abs(hgt), 1e-4), 1);
      dummy.updateMatrix();
      colMesh.setMatrixAt(i, dummy.matrix);
      colMesh.setColorAt(i, hgt >= 0 ? COL_POS : COL_NEG);
    }
    colMesh.count = count;
    colMesh.instanceMatrix.needsUpdate = true;
    if (colMesh.instanceColor) colMesh.instanceColor.needsUpdate = true;
    P.sum = sum;
    P.mean = sum / (hi - lo);
    setSeg(avgLine, lo, P.mean, hi, P.mean);
    avgLabel.position.set((lo + hi) / 2, P.mean + 0.42, 0);
    avgLabel.userData.setText(`平均 = ${fmt(P.mean / P.yScale)}`);
    return { lo, hi, count, w };
  }

  function applyMode() {
    const m = P.mode;
    const diff = m === 'tangent' || m === 'slope';
    pointGroup.visible = diff;
    secantGroup.visible = diff;
    tangentGroup.visible = diff;
    hGroup.visible = diff;
    readout.visible = diff;
    runArrow.visible = m === 'slope';
    riseArrow.visible = m === 'slope';
    columns.visible = m === 'integral';
    filled.visible = m === 'area';
    slab.visible = m === 'area';
    solid.visible = m === 'volume';
    abGroup.visible = m === 'integral' || m === 'area' || m === 'volume';
    baseLine.visible = m === 'integral' || m === 'area' || m === 'volume';
    avgGroup.visible = m === 'integral';
  }

  function rebuild() {
    fitScale();
    rebuildCurve();
    rebuildInterval();
    if (P.mode === 'area') rebuildArea();
    if (P.mode === 'volume') rebuildVolume();
    if (P.mode === 'integral') span = rebuildColumns();
    applyMode();
  }

  function setParams(patch = {}) {
    if (patch.fn) P.fn = patch.fn;
    if (patch.a != null) P.a = patch.a;
    if (patch.b != null) P.b = patch.b;
    if (patch.h != null) { P.h = patch.h; anim.to({ h: patch.h }); }
    if (patch.n != null) P.n = clamp(Math.round(patch.n), 1, MAXN);
    if (patch.mode != null) P.mode = patch.mode;
    if (patch.domain) P.domain = patch.domain.slice();
    if (patch.accent != null) P.accent = patch.accent;
    if (patch.tangent != null) tangentGroup.visible = patch.tangent;
    if (patch.secant != null) secantGroup.visible = patch.secant;
    if (patch.readout != null) readout.userData.setText(patch.readout);
    anim.to({ a: P.a, b: P.b, h: P.h });

    const heavy = patch.fn || patch.a != null || patch.b != null || patch.mode || patch.domain;
    if (heavy) rebuild();
    else if (P.mode === 'integral') span = rebuildColumns();   // スライダー操作は軽い更新
  }

  // ------------------------------------------------------------------ 更新
  const tA = new THREE.Vector3();
  const tB = new THREE.Vector3();
  let lastText = '';
  let lastA = '';
  let span = rebuildColumns();

  function placePoints(hNow) {
    const xa = P.a;
    const xb = xa + hNow;
    const ya = ys(safeF(xa));
    const yb = ys(safeF(xb));
    dotA.position.set(xa, ya, 0);
    dotB.position.set(xb, yb, 0);
    lblA.position.set(xa - 0.55, ya + 0.16, 0);
    lblB.position.set(xb + 0.35, yb + 0.18, 0);
    const aTxt = `A(${fmt(xa, 1)}, ${fmt(f(xa), 1)})`;
    if (aTxt !== lastA) { lastA = aTxt; lblA.userData.setText(aTxt); }

    const d = safeF(xb) - safeF(xa);
    const secSlope = d / hNow;
    const der = (safeF(xa + 1e-4) - safeF(xa - 1e-4)) / 2e-4;
    const ySlope = secSlope * P.yScale;          // 割線の画面上の傾き

    setSeg(secantLine, xa - 0.25, ya - ySlope * 0.25, xb + 0.35, yb + ySlope * 0.35);
    secantLabel.position.set((xa + xb) / 2 + 0.1, (ya + yb) / 2 + 0.45, 0);

    const x0 = Math.min(domain[0], xa) - 0.6;
    const x1 = Math.max(domain[1], xa + hNow) + 0.6;
    const yDer = der * P.yScale;                 // 接線の画面上の傾き
    setSeg(tangentLine, x0, ya + yDer * (x0 - xa), x1, ya + yDer * (x1 - xa));
    tangentLabel.position.set(x0 + 0.45, ya + yDer * (x0 + 0.45 - xa) + 0.42, 0);

    setSeg(hLine, xa, ya, xb, ya);
    hLabel.position.set((xa + xb) / 2, ya + 0.34, 0);

    runArrow.userData.set(tA.set(xa, ya - 0.45, 0), tB.set(xb, ya - 0.45, 0));
    riseArrow.userData.set(tA.set(xb, ya, 0), tB.set(xb, yb, 0));

    const txt = P.mode === 'slope'
      ? `横 ${fmt1(hNow)}  縦 ${fmt1(d)}  傾き ${fmt1(secSlope)}`
      : `h = ${fmt1(hNow)}  割線の傾き ${fmt1(secSlope)}  f'(${fmt(xa, 1)}) = ${fmt(der)}`;
    if (txt !== lastText) { lastText = txt; readout.userData.setText(txt); }
  }

  function update(dt, elapsed) {
    const c = anim.update(dt, 5);
    P.a = c.a; P.b = c.b; P.hNow = c.h;

    if (P.mode === 'tangent' || P.mode === 'slope') {
      const width = Math.abs(P.b - P.a) || 1;
      const hStart = Math.max(clamp(30 * P.h, 0.4, width * 0.45), P.h * 3);
      const hMin = Math.max(P.h, 0.02);
      const t = (elapsed % 6.5) / 6.5;
      const u = t < 0.5 ? t * 2 : 2 - t * 2;
      P.hNow = lerp(hStart, hMin, ease.inOutCubic(u));
      placePoints(P.hNow);
      return;
    }

    if (P.mode === 'integral' && span) {
      const { lo, hi, w } = span;
      const t = (elapsed * 0.4) % 1;
      const x = lo + (hi - lo) * t;
      const hgt = ys(safeF(x));
      colMark.visible = true;
      colMark.position.set(x, hgt / 2, 0);
      colMark.scale.set(Math.abs(w) * 0.96, Math.max(Math.abs(hgt), 0.05), 1.15);
      return;
    }

    if (P.mode === 'volume') {
      solidMatLocal.opacity = 0.24 * (0.8 + 0.2 * Math.sin(elapsed * 1.1));
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose, f, yAt: (x) => ys(safeF(x)) };
}
