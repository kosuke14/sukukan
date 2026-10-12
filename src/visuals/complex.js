import * as THREE from 'three';
import { lineBasic, basicMat, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { TAU } from '../engine/MathUtil.js';
import {
  makeAxes, makeGridPlane, makeCurve, makeArrow, makePoint, makeOrbit, accentOf,
} from './common.js';

/**
 * 複素数平面。直交形式 a+bi と極形式 r(cosθ + i sinθ) の往復、回転、積、
 * n 乗根、直線 y = x に関する鏡像（逆関数の図用）、複素指数関数の螺線を
 * 1枚の平面上に重ねる。台本の順番で mode を切り替えると、同じ座標の上に
 * 別の見方が立ち上がる。
 */
export function createComplex(params = {}) {
  const {
    z1 = { a: 3, b: 2 },
    z2 = { a: 1, b: -1 },
    n = 1,
    mode = 'polar',
    accent = 0x6ee7ff,
    radius = 4,
  } = params;

  let ACC = accentOf(accent);
  const AMBER = 0xffd479;
  const PINK = 0xff6b9d;
  const MINT = 0x7cffb2;

  const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const group = new THREE.Group();
  const parts = {};
  const P = {
    z1: { a: z1.a, b: z1.b }, z2: { a: z2.a, b: z2.b },
    n, mode, radius, spin: 1,
  };

  // ---------------------------------------------------------- 共通の小部品
  /** x-y 平面だけを使う図なので、正面から重なる z 軸は隠す。 */
  function flatAxes() {
    const ax = makeAxes({ size: P.radius * 2, ticks: P.radius, accent: ACC, labels: ['Re', 'Im', ''] });
    ax.traverse((o) => {
      if (o.isLine && o.geometry?.attributes?.position?.count === 2) {
        const p = o.geometry.attributes.position;
        if (p.getX(0) === 0 && p.getY(0) === 0) o.visible = false;
      }
      if (o.isMesh && o.position.x === 0 && o.position.y === 0 && o.position.z !== 0) o.visible = false;
    });
    ax.children[ax.children.length - 1].visible = false;
    return ax;
  }

  function resetGroup(g) {
    for (const c of [...g.children]) { disposeObject(c); g.remove(c); }
  }

  function dynamicLine(n, color, opacity = 0.9) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const line = new THREE.Line(geo, lineBasic(color, opacity));
    line.frustumCulled = false;
    return line;
  }

  function writeArc(line, r, a0, a1, z = 0) {
    const attr = line.geometry.attributes.position;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / (n - 1);
      attr.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, z);
    }
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  function writeSeg(line, ax, ay, bx, by, z = 0) {
    const attr = line.geometry.attributes.position;
    attr.setXYZ(0, ax, ay, z);
    attr.setXYZ(1, bx, by, z);
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  /** 三角形・四角形を xy 平面上に塗る（z 方向は描かない）。 */
  function flatPoly(pts, { color, opacity = 0.24, edge = color, edgeOpacity = 0.85 } = {}) {
    const g = new THREE.Group();
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), basicMat(color, opacity)));
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map((p) => v(p[0], p[1], 0))), lineBasic(edge, edgeOpacity)));
    return g;
  }

  function arrowInto(g, from, to, color, opts = {}) {
    resetGroup(g);
    if (from.distanceTo(to) > 1e-5) g.add(makeArrow(from, to, { color, ...opts }));
  }

  // ----------------------------------------------------------------- 背景
  const backdrop = new THREE.Group();
  group.add(backdrop);
  const plane = new THREE.Group();
  const unitGrid = new THREE.Group();
  const axes = new THREE.Group();
  backdrop.add(plane, unitGrid, axes);
  parts.plane = plane;
  parts.unitGrid = unitGrid;
  parts.axes = axes;

  function buildBackdrop() {
    resetGroup(plane);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(P.radius * 2 + 2, P.radius * 2 + 2),
      basicMat(0x0a1428, 0.16)
    );
    face.position.z = -0.08;
    plane.add(face);
    plane.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        v(-P.radius, -P.radius, -0.07), v(P.radius, -P.radius, -0.07),
        v(P.radius, P.radius, -0.07), v(-P.radius, P.radius, -0.07),
      ]),
      lineBasic(ACC, 0.5)
    ));
    resetGroup(unitGrid);
    unitGrid.add(makeGridPlane({
      size: P.radius * 2, div: P.radius * 2, color: 0x2f4a7a, opacity: 0.4, plane: 'xy',
    }));
    resetGroup(axes);
    axes.add(flatAxes());
  }

  const unitCircle = new THREE.Group();
  const ring = makeOrbit(1, { color: 0xffffff, opacity: 0.5 });
  ring.rotation.x = Math.PI / 2;
  unitCircle.add(ring);
  group.add(unitCircle);
  parts.unitCircle = unitCircle;

  // ------------------------------------------------------------- 複素数点
  const dot1 = makePoint(ACC, { size: 0.13, halo: 1.0 });
  const z1Group = new THREE.Group();
  z1Group.add(dot1);
  group.add(z1Group);
  parts.z1 = z1Group;

  const dot2 = makePoint(AMBER, { size: 0.13, halo: 1.0 });
  const z2Group = new THREE.Group();
  z2Group.add(dot2);
  group.add(z2Group);
  parts.z2 = z2Group;

  // ------------------------------------------------------------ ベクトル
  const vecA = new THREE.Group();
  const vecB = new THREE.Group();
  const sumVec = new THREE.Group();
  const diffVec = new THREE.Group();
  const prodVec = new THREE.Group();
  group.add(vecA, vecB, sumVec, diffVec, prodVec);
  parts.vecA = vecA; parts.vecB = vecB;
  parts.sumVec = sumVec; parts.diffVec = diffVec; parts.prodVec = prodVec;

  // 絶対値 r と偏角 θ
  const radiusA = new THREE.Group();
  const radiusB = new THREE.Group();
  group.add(radiusA, radiusB);
  parts.radiusA = radiusA; parts.radiusB = radiusB;

  const angleArc = new THREE.Group();
  const arcLine = dynamicLine(49, AMBER, 0.95);
  angleArc.add(arcLine);
  const arcSpan = new THREE.Group();   // 2π/n の等分角（roots モードで使い回す）
  const spanLine = dynamicLine(25, MINT, 0.9);
  arcSpan.add(spanLine);
  group.add(angleArc, arcSpan);
  parts.angleArc = angleArc;
  parts.arcSpan = arcSpan;

  // ----------------------------------------------------------------- 根
  const roots = new THREE.Group();
  group.add(roots);
  parts.roots = roots;

  // -------------------------------------------------------------- ラベル
  const labels = new THREE.Group();
  const lab1 = makeLabel('z₁', { height: 0.34, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)', border: 'rgba(110,231,255,0.4)' });
  const lab2 = makeLabel('z₂', { height: 0.34, color: '#ffd479', bg: 'rgba(6,10,22,0.8)', border: 'rgba(255,212,121,0.4)' });
  const labR = makeLabel('r = 0', { height: 0.32, color: '#ffffff', bg: 'rgba(6,10,22,0.82)' });
  const labT = makeLabel('θ = 0', { height: 0.32, color: '#ffd479', bg: 'rgba(6,10,22,0.82)' });
  const labProd = makeLabel('αβ', { height: 0.34, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)', border: 'rgba(124,255,178,0.4)' });
  const labEq = makeLabel('z = a + bi', { height: 0.36, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)', border: 'rgba(110,231,255,0.35)' });
  const labRoot = makeLabel('n乗根', { height: 0.3, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)' });
  labels.add(lab1, lab2, labR, labT, labProd, labEq, labRoot);
  group.add(labels);
  parts.labels = labels;

  // ------------------------------------------------- 逆関数の図（鏡像）
  const fInv = (x) => 0.16 * x * x * x + 0.5 * x + 0.7;   // 狭義単調増加 → 逆関数がある
  const curve = new THREE.Group();
  curve.add(makeCurve((u) => {
    const x = -2.4 + 4.8 * u;
    return v(x, fInv(x), 0);
  }, { samples: 140, color: ACC }));
  const pDot = makePoint(0xffffff, { size: 0.1, halo: 0.9 });
  curve.add(pDot);
  group.add(curve);
  parts.curve = curve;

  const mirror = new THREE.Group();
  const diag = dynamicLine(2, 0xffffff, 0.55);
  writeSeg(diag, -P.radius, -P.radius, P.radius, P.radius, -0.02);
  mirror.add(diag);
  mirror.add(makeCurve((u) => {
    const x = -2.4 + 4.8 * u;
    return v(fInv(x), x, 0);
  }, { samples: 140, color: MINT }));
  const pDot2 = makePoint(MINT, { size: 0.1, halo: 0.9 });
  mirror.add(pDot2);
  group.add(mirror);
  parts.mirror = mirror;

  const labMirror = makeLabel('y = x', { height: 0.32, color: '#ffffff', bg: 'rgba(6,10,22,0.8)' });
  labMirror.position.set(P.radius * 0.72, P.radius * 0.72, 0);
  group.add(labMirror);
  parts.mirrorLabel = labMirror;

  // ------------------------------------------- 複素指数関数の螺線 e^{(a+bi)t}
  const expSpiral = new THREE.Group();
  const spiralCoef = { a: 0.34, b: 0.9 };
  const spiralPts = [];
  for (let i = 0; i <= 260; i++) {
    const t = (i / 260) * 1.9;
    const r = Math.exp(spiralCoef.a * P.z1.a * t);
    spiralPts.push(v(Math.cos(spiralCoef.b * P.z1.b * t) * r, Math.sin(spiralCoef.b * P.z1.b * t) * r, 0));
  }
  expSpiral.add(makeCurve((u) => {
    const p = spiralPts[Math.min(Math.round(u * 260), 260)];
    return v(p.x, p.y, 0);
  }, { samples: 260, color: MINT, opacity: 0.95 }));
  const spiralDot = makePoint(0xffffff, { size: 0.1, halo: 0.9 });
  expSpiral.add(spiralDot);
  const labSpiral = makeLabel('z = e^(at)·e^(ibt)', { height: 0.32, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)' });
  expSpiral.add(labSpiral);
  group.add(expSpiral);
  parts.expSpiral = expSpiral;

  // ------------------------------------------------------------ 再構築
  let builtRadius = 0;
  function rebuild() {
    const a1 = P.z1.a, b1 = P.z1.b, a2 = P.z2.a, b2 = P.z2.b;
    const r1 = Math.hypot(a1, b1), th1 = Math.atan2(b1, a1);
    const r2 = Math.hypot(a2, b2), th2 = Math.atan2(b2, a2);

    // 平面・軸・グリッド（半径が変わったときだけ作り直す）
    if (P.radius !== builtRadius) { builtRadius = P.radius; buildBackdrop(); }

    // 複素数の点
    dot1.position.set(a1, b1, 0.12);
    dot2.position.set(a2, b2, -0.12);
    lab1.position.set(a1 + 0.3, b1 + 0.34, 0);
    lab2.position.set(a2 + 0.3, b2 - 0.5, 0);
    lab1.userData.setText(`z₁ = ${fmt(a1)} ${b1 < 0 ? '−' : '+'} ${fmt(Math.abs(b1))}i`);
    lab2.userData.setText(`z₂ = ${fmt(a2)} ${b2 < 0 ? '−' : '+'} ${fmt(Math.abs(b2))}i`);

    // 複素数をベクトルとして描く
    arrowInto(vecA, v(0, 0, 0.1), v(a1, b1, 0.1), ACC, { headSize: 0.17, shaft: 0.022 });
    arrowInto(vecB, v(0, 0, -0.1), v(a2, b2, -0.1), AMBER, { headSize: 0.17, shaft: 0.022 });

    // 積 αβ（偏角は和、長さは積）
    const pr = a1 * a2 - b1 * b2;
    const pi = a1 * b2 + b1 * a2;
    const pm = Math.hypot(pr, pi);
    const pScale = pm > P.radius * 1.15 ? (P.radius * 1.15) / pm : 1;
    arrowInto(prodVec, v(0, 0, 0.06), v(pr * pScale, pi * pScale, 0.06), MINT, { headSize: 0.19, shaft: 0.024 });
    labProd.position.set(pr * pScale * 0.55, pi * pScale * 0.55 - 0.5, 0);
    labProd.userData.setText(
      `αβ = ${fmt(pr)} ${pi < 0 ? '−' : '+'} ${fmt(Math.abs(pi))}i` + (pScale < 1 ? `  (×${fmt(pScale)})` : '')
    );

    // 和と差（平行四辺形つき）
    resetGroup(sumVec);
    if (r1 > 1e-6 && r2 > 1e-6) {
      sumVec.add(flatPoly([[0, 0], [a1, b1], [a1 + a2, b1 + b2], [a2, b2]], { color: PINK, opacity: 0.18 }));
      sumVec.add(makeArrow(v(0, 0, 0.02), v(a1 + a2, b1 + b2, 0.02), { color: PINK, headSize: 0.16, shaft: 0.02 }));
    }
    resetGroup(diffVec);
    if (r1 > 1e-6 && r2 > 1e-6) {
      diffVec.add(flatPoly([[0, 0], [a1, b1], [a1 - a2, b1 - b2], [-a2, -b2]], { color: 0x9db4ff, opacity: 0.16 }));
      diffVec.add(makeArrow(v(0, 0, 0.02), v(a1 - a2, b1 - b2, 0.02), { color: 0x9db4ff, headSize: 0.16, shaft: 0.02 }));
    }

    // 絶対値（原点から複素数点までの線分）
    resetGroup(radiusA);
    if (r1 > 1e-6) {
      radiusA.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([v(0, 0, 0.3), v(a1, b1, 0.3)]),
        lineBasic(0xffffff, 0.75)
      ));
    }
    resetGroup(radiusB);
    if (r2 > 1e-6) {
      radiusB.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([v(0, 0, -0.3), v(a2, b2, -0.3)]),
        lineBasic(0xffffff, 0.55)
      ));
    }
    labR.position.set(a1 * 0.5, b1 * 0.5 + 0.42, 0);
    labR.userData.setText(`r = ${fmt(r1)}`);
    labT.userData.setText(`θ = ${fmt(deg(th1))}°`);

    // 偏角の弧
    const arcR = Math.min(1.5, Math.max(0.7, r1 * 0.55));
    writeArc(arcLine, arcR, 0, th1, 0.02);
    labT.position.set(arcR * Math.cos(th1 * 0.5) + 0.25, arcR * Math.sin(th1 * 0.5) + 0.25, 0);
    labT.userData.setText(`θ = ${fmt(deg(th1))}°`);

    // n 乗根
    resetGroup(roots);
    const nn = Math.max(1, Math.round(P.n));
    const rootR = Math.pow(Math.max(r1, 1e-6), 1 / nn);
    for (let k = 0; k < nn; k++) {
      const ang = (th1 + (TAU * k) / nn) / nn;
      const px = Math.cos(ang) * rootR, py = Math.sin(ang) * rootR;
      roots.add(makePoint(k === 0 ? ACC : MINT, { size: 0.1, halo: 0.8 }));
      roots.children[roots.children.length - 1].position.set(px, py, 0.1);
      roots.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([v(0, 0, 0.05), v(px, py, 0.05)]),
        lineBasic(MINT, 0.5)
      ));
      const lk = makeLabel(`ω${sub(k)}`, { height: 0.26, color: '#7cffb2', bg: 'rgba(6,10,22,0.7)' });
      lk.position.set(px * 1.16, py * 1.16, 0);
      roots.add(lk);
    }
    const span = TAU / nn;
    writeArc(spanLine, rootR * 0.8, 0, span, 0.06);
    labRoot.position.set(rootR * 0.8 * Math.cos(span * 0.5), rootR * 0.8 * Math.sin(span * 0.5) - 0.45, 0);
    labRoot.userData.setText(`2π/${nn} = ${fmt(deg(span))}°`);

    // 螺線の係数（z = e^{(a+bi)t}）
    spiralCoef.a = 0.34;
    spiralCoef.b = 0.9;
    for (let i = 0; i <= 260; i++) {
      const t = (i / 260) * 1.9;
      const r = Math.exp(spiralCoef.a * a1 * t);
      const ang = spiralCoef.b * b1 * t;
      spiralPts[i].set(Math.cos(ang) * r, Math.sin(ang) * r, 0);
    }
    const spiralMax = Math.max(...spiralPts.map((p) => Math.hypot(p.x, p.y)), 1e-6);
    const sScale = Math.min(1, P.radius / spiralMax);
    expSpiral.scale.setScalar(sScale);
    labSpiral.position.copy(spiralPts[260]).multiplyScalar(0.9);
    labSpiral.userData.setText('z = e^(at) · e^(ibt)');

    labEq.position.set(-P.radius * 0.92, P.radius * 0.9, 0);
    labEq.userData.setText(`z₁ = ${fmt(a1)} ${b1 < 0 ? '−' : '+'} ${fmt(Math.abs(b1))}i`);
    labMirror.visible = P.mode === 'inverse';

    // モードごとの既定表示
    const on = (obj, flag) => { obj.visible = flag; };
    const isPolar = P.mode === 'polar';
    const isProduct = P.mode === 'product';
    const isRoots = P.mode === 'roots' || P.mode === 'deMoivre';
    const isInverse = P.mode === 'inverse';
    on(plane, !isInverse);
    on(unitGrid, !isInverse);
    on(axes, !isInverse);
    on(unitCircle, isPolar || isRoots);
    on(z1Group, !isInverse);
    on(z2Group, isProduct);
    on(vecA, !isInverse);
    on(vecB, isProduct);
    on(sumVec, false);
    on(diffVec, false);
    on(prodVec, isProduct);
    on(radiusA, isPolar || isProduct || isRoots);
    on(radiusB, isProduct);
    on(angleArc, isPolar || isProduct || isRoots);
    on(arcSpan, isRoots);
    on(roots, isRoots);
    on(curve, isInverse);
    on(mirror, isInverse);
    on(expSpiral, P.mode === 'deMoivre');
    on(labRoot, isRoots);
    on(labels, !isInverse);
    on(lab1, !isInverse);
    on(lab2, isProduct);
    on(labR, isPolar || isProduct || isRoots);
    on(labT, isPolar || isProduct || isRoots);
    on(labProd, isProduct);
  }

  function setParams(patch = {}) {
    if (patch.z1) P.z1 = { a: patch.z1.a ?? P.z1.a, b: patch.z1.b ?? P.z1.b };
    if (patch.z2) P.z2 = { a: patch.z2.a ?? P.z2.a, b: patch.z2.b ?? P.z2.b };
    if (patch.n != null) P.n = Math.max(1, Math.round(patch.n));
    if (patch.mode) P.mode = patch.mode;
    if (patch.radius != null) P.radius = Math.max(1, patch.radius);
    if (patch.accent != null) ACC = accentOf(patch.accent);
    if (patch.spin != null) P.spin = patch.spin;
    if (patch.equation) labEq.userData.setText(patch.equation);
    rebuild();
  }

  function update(dt, elapsed) {
    if (P.mode === 'deMoivre') {
      roots.rotation.z = -elapsed * 0.45 * P.spin;
      arcSpan.rotation.z = 0;
    } else if (P.mode === 'roots') {
      roots.rotation.z = 0;
    }
    if (P.mode === 'inverse') {
      const s = 0.5 + 0.44 * Math.sin(elapsed * 0.3);
      const x = -2.1 + 4.2 * s;
      const y = fInv(x);
      pDot.position.set(x, y, 0.12);
      pDot2.position.set(y, x, 0.12);
    }
    if (P.mode === 'deMoivre' && expSpiral.visible) {
      const t = (elapsed * 0.28) % 1.9;
      const i = Math.min(259, Math.round((t / 1.9) * 260));
      spiralDot.position.copy(spiralPts[i]);
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}

const fmt = (x) => (Math.abs(x) < 1e-9 ? '0' : (Math.round(x * 1000) / 1000).toFixed(2).replace(/\.?0+$/, '') || '0');
const deg = (r) => (r * 180) / Math.PI;
const SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const sub = (k) => String(k).split('').map((d) => SUBS[+d]).join('');
