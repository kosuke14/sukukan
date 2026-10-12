import * as THREE from 'three';
import { lineBasic, basicMat, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { makeAxes, makeGridPlane, makeArrow, makePoint, accentOf } from './common.js';

/**
 * 平面上の点と直線、円の式。2点を通る直線と傾き・切片、点と直線の距離、
 * 内分点・外分点、円の方程式、円周角の定理、接線と半径の垂直を
 * 同じ xy 平面の上で切り替える。台本は camera を flatAxes に合わせて
 * cam.pos を [x, y, 12〜18] にすると真上から図が読める。
 */
export function createLines3D(params = {}) {
  const {
    mode = 'line',
    a = [-2, 1],
    b = [3, 2],
    c = [1, -1],
    radius = 2.4,
    center = [0, 0],
    point = [2, 1],
    ratio = 2,
    accent = 0x6ee7ff,
  } = params;

  let ACC = accentOf(accent);
  const AMBER = 0xffd479;
  const MINT = 0x7cffb2;
  const PINK = 0xff6b9d;
  const BOX = 5;
  const ARC_PTS = 97;

  const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const group = new THREE.Group();
  const parts = {};
  const P = {
    mode, a: [...a], b: [...b], c: [...c], point: [...point],
    center: [...center], radius, ratio, spin: 1, t: 0,
  };

  // ---------------------------------------------------------- 共通の小部品
  function flatAxes() {
    const ax = makeAxes({ size: BOX * 2, ticks: BOX, accent: ACC, labels: ['x', 'y', ''] });
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

  /** n 点の折れ線を確保し、以降は頂点配列だけを書き換える。 */
  function dynamicLine(n, color, opacity = 0.9) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const line = new THREE.Line(geo, lineBasic(color, opacity));
    line.frustumCulled = false;
    return line;
  }

  function put(line, i, x, y, z = 0) {
    line.geometry.attributes.position.setXYZ(i, x, y, z);
  }

  function flush(line, n) {
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.setDrawRange(0, n);
    line.geometry.computeBoundingSphere();
  }

  function writeSeg(line, ax, ay, bx, by, z = 0) {
    put(line, 0, ax, ay, z);
    put(line, 1, bx, by, z);
    flush(line, 2);
  }

  function writeArc(line, cx, cy, r, a0, a1, z = 0) {
    const attr = line.geometry.attributes.position;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / (n - 1);
      attr.setXYZ(i, cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    }
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  /** 名前付きの点（球 + ラベル）。 */
  function namedPoint(color, name, h = 0.32) {
    const g = new THREE.Group();
    g.add(makePoint(color, { size: 0.12, halo: 0.95 }));
    const l = makeLabel(name, { height: h, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)' });
    l.position.set(0, 0.42, 0);
    g.userData.label = l;
    g.add(l);
    return g;
  }

  // ----------------------------------------------------------------- 背景
  const axes = flatAxes();
  group.add(axes);
  parts.axes = axes;

  const grid = makeGridPlane({ size: BOX * 2, div: BOX * 2, color: 0x2f4a7a, opacity: 0.4, plane: 'xy' });
  group.add(grid);
  parts.grid = grid;

  // ------------------------------------------------------------------ 点
  const pointA = namedPoint(ACC, 'A');
  const pointB = namedPoint(ACC, 'B');
  const pointC = namedPoint(PINK, 'C');
  const footDot = namedPoint(0xffffff, 'H');
  const midDot = namedPoint(MINT, 'M');
  const extPoint = namedPoint(AMBER, 'N');
  const centerDot = namedPoint(0xffffff, 'O');
  const pointOnCircle = namedPoint(AMBER, 'P');
  group.add(pointA, pointB, pointC, footDot, midDot, extPoint, centerDot, pointOnCircle);
  parts.pointA = pointA; parts.pointB = pointB; parts.pointC = pointC;
  parts.footDot = footDot; parts.midDot = midDot; parts.extPoint = extPoint;
  parts.centerDot = centerDot; parts.pointOnCircle = pointOnCircle;

  // ----------------------------------------------------------------- 線
  const lineAB = new THREE.Group();
  const abLine = dynamicLine(2, ACC, 0.9);
  lineAB.add(abLine);
  group.add(lineAB);
  parts.lineAB = lineAB;

  const lineC = new THREE.Group();
  const cLine = dynamicLine(2, PINK, 0.8);
  lineC.add(cLine);
  group.add(lineC);
  parts.lineC = lineC;

  const normalLine = new THREE.Group();
  const normSeg = dynamicLine(2, MINT, 0.95);
  normalLine.add(normSeg);
  const normLabel = makeLabel('d = 0', { height: 0.34, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)' });
  normalLine.add(normLabel);
  group.add(normalLine);
  parts.normalLine = normalLine;

  const tangentLine = new THREE.Group();
  const tanLine = dynamicLine(2, AMBER, 0.95);
  tangentLine.add(tanLine);
  group.add(tangentLine);
  parts.tangentLine = tangentLine;

  // ------------------------------------------------- ベクトル・長さ・目盛
  const vectorAB = new THREE.Group();
  group.add(vectorAB);
  parts.vectorAB = vectorAB;

  const lengthBar = new THREE.Group();
  const lenSeg = dynamicLine(2, 0xffffff, 0.8);
  const lenTicks = dynamicLine(12, 0xffffff, 0.6);
  const lenLabel = makeLabel('|AB| = 0', { height: 0.32, color: '#ffffff', bg: 'rgba(6,10,22,0.8)' });
  lengthBar.add(lenSeg, lenTicks, lenLabel);
  group.add(lengthBar);
  parts.lengthBar = lengthBar;

  const normalBar = new THREE.Group();
  const nbSeg = dynamicLine(2, 0xffffff, 0.85);
  const nbSquare = dynamicLine(4, 0xffffff, 0.8);
  const nbLabel = makeLabel('r', { height: 0.3, color: '#ffffff', bg: 'rgba(6,10,22,0.8)' });
  normalBar.add(nbSeg, nbSquare, nbLabel);
  group.add(normalBar);
  parts.normalBar = normalBar;

  const radiusBar = new THREE.Group();
  const radSeg = dynamicLine(2, MINT, 0.9);
  const radLabel = makeLabel('r = 0', { height: 0.32, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)' });
  radiusBar.add(radSeg, radLabel);
  group.add(radiusBar);
  parts.radiusBar = radiusBar;

  // 内分点・外分点につける線分（円周角モードでは弦 PA, PB になる）
  const segments = new THREE.Group();
  const segLine = dynamicLine(4, MINT, 0.9);
  const segArc = dynamicLine(25, 0xffffff, 0.85);
  const segLabel = makeLabel('AP : PB', { height: 0.32, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)' });
  const segTicks = dynamicLine(24, 0xffffff, 0.55);
  segments.add(segLine, segTicks, segArc, segLabel);
  group.add(segments);
  parts.segments = segments;

  // ------------------------------------------------------------------ 円
  const circle = new THREE.Group();
  const ring = dynamicLine(ARC_PTS, ACC, 0.95);
  const faceMesh = new THREE.Mesh(new THREE.BufferGeometry(), basicMat(ACC, 0.1));
  faceMesh.frustumCulled = false;
  circle.add(ring, faceMesh);
  group.add(circle);
  parts.circle = circle;

  const area = new THREE.Group();
  const areaFill = new THREE.Mesh(new THREE.BufferGeometry(), basicMat(0x6ee7ff, 0.12));
  areaFill.frustumCulled = false;
  const areaRing = dynamicLine(ARC_PTS, 0x6ee7ff, 0.6);
  const areaLabel = makeLabel('S = 0', { height: 0.34, color: '#eaf6ff', bg: 'rgba(6,10,22,0.82)' });
  area.add(areaFill, areaRing, areaLabel);
  group.add(area);
  parts.area = area;

  // ---------------------------------------------------------------- 式
  const equation = makeLabel('', { height: 0.42, color: '#eaf6ff', bg: 'rgba(6,10,22,0.88)', border: 'rgba(110,231,255,0.35)' });
  equation.position.set(-BOX * 0.95, -BOX * 0.95 + 0.5, 0);
  group.add(equation);
  parts.equation = equation;

  // ------------------------------------------------------------ 再構築
  const state = { t: 0, circleA: 0, circleB: 0, circleP: 0, inscribed: 0 };

  function writeRing(line, cx, cy, r) {
    const attr = line.geometry.attributes.position;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / (n - 1);
      attr.setXYZ(i, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
    }
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  function writeDisk(mesh, cx, cy, r) {
    mesh.geometry.dispose();
    const g = new THREE.CircleGeometry(r, 96);
    g.translate(cx, cy, -0.02);
    mesh.geometry = g;
  }

  function rebuild() {
    const A = P.a, B = P.b, C = P.c;
    const m = P.mode;
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / len, uy = dy / len;          // AB 方向の単位ベクトル
    const nx = -uy, ny = ux;                     // 垂直方向

    pointA.position.set(A[0], A[1], 0.05);
    pointB.position.set(B[0], B[1], 0.05);
    pointC.position.set(C[0], C[1], 0.05);
    footDot.visible = false;
    extPoint.visible = false;

    // 直線 AB（枠まで伸ばす）
    const span = BOX * 2.6;
    writeSeg(abLine, A[0] - ux * span, A[1] - uy * span, A[0] + ux * span, A[1] + uy * span, -0.03);
    // C を通り AB に平行な直線
    writeSeg(cLine, C[0] - ux * span, C[1] - uy * span, C[0] + ux * span, C[1] + uy * span, -0.03);

    // ベクトル AB と長さ
    resetGroup(vectorAB);
    vectorAB.add(makeArrow(v3(A[0], A[1], 0.12), v3(B[0], B[1], 0.12), { color: ACC, headSize: 0.17, shaft: 0.022 }));
    writeSeg(lenSeg, A[0], A[1], B[0], B[1], 0.06);
    lenLabel.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 0.38, 0);
    lenLabel.userData.setText(`|AB| = ${f(len)}`);

    // 傾きと切片
    const slope = dx !== 0 ? dy / dx : Infinity;
    const intercept = A[1] - slope * A[0];

    // 点 C から直線 AB への垂線（距離）
    const t = (C[0] - A[0]) * ux + (C[1] - A[1]) * uy;
    const hx = A[0] + ux * t, hy = A[1] + uy * t;
    const dist = Math.abs((C[0] - A[0]) * nx + (C[1] - A[1]) * ny);
    footDot.position.set(hx, hy, 0.1);
    writeSeg(normSeg, hx, hy, C[0], C[1], 0.1);
    normLabel.position.set((hx + C[0]) / 2 + 0.3, (hy + C[1]) / 2, 0);
    normLabel.userData.setText(`d = ${f(dist)}`);

    // 内分点・外分点（AP : PB = ratio : 1）
    const m0 = P.ratio, n0 = 1;
    const ip = [A[0] + (m0 * B[0]) / (m0 + n0), A[1] + (m0 * B[1]) / (m0 + n0)];
    const ep = [A[0] - (m0 * B[0]) / (m0 - n0), A[1] - (m0 * B[1]) / (m0 - n0)];
    midDot.position.set(ip[0], ip[1], 0.12);
    midDot.userData.label.userData.setText(m0 === n0 ? 'M（中点）' : 'P（内分点）');
    extPoint.position.set(Number.isFinite(ep[0]) ? ep[0] : A[0], Number.isFinite(ep[1]) ? ep[1] : A[1], 0.12);

    put(segLine, 0, A[0], A[1], 0.1);
    put(segLine, 1, ip[0], ip[1], 0.1);
    put(segLine, 2, ip[0], ip[1], 0.1);
    put(segLine, 3, B[0], B[1], 0.1);
    flush(segLine, 4);
    // 比を表す目盛（AP を m0 等分、PB を n0 等分した位置に刻む）
    const TA_ = Math.max(1, Math.round(m0)), TB = Math.max(1, Math.round(n0));
    const marks = [];
    for (let i = 1; i < TA_ && marks.length < 10; i++) {
      const s = i / TA_;
      marks.push([A[0] + (ip[0] - A[0]) * s, A[1] + (ip[1] - A[1]) * s]);
    }
    for (let i = 1; i < TB && marks.length < 10; i++) {
      const s = i / TB;
      marks.push([ip[0] + (B[0] - ip[0]) * s, ip[1] + (B[1] - ip[1]) * s]);
    }
    marks.push(ip);
    for (let i = 0; i < 24; i++) {
      const q = marks[i >> 1];
      if (!q) { put(segTicks, i, ip[0], ip[1], 0.1); continue; }
      put(segTicks, i, q[0] + nx * 0.15, q[1] + ny * 0.15, 0.1);
    }
    flush(segTicks, 24);
    segLabel.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 0.55, 0);
    segLabel.userData.setText(`AP : PB = ${f(m0)} : ${f(n0)}`);
    segArc.visible = false;

    // 円
    const cx = P.center[0], cy = P.center[1], rr = P.radius;
    centerDot.position.set(cx, cy, 0.1);
    writeRing(ring, cx, cy, rr);
    writeDisk(faceMesh, cx, cy, rr);
    writeSeg(radSeg, cx, cy, cx + rr, cy, 0.14);
    radLabel.position.set(cx + rr * 0.5, cy - 0.42, 0);
    radLabel.userData.setText(`r = ${f(rr)}`);

    // 接点 T と接線（半径と垂直）
    const tx = P.point[0], ty = P.point[1];
    const td = Math.hypot(tx - cx, ty - cy) || 1e-6;
    const ox = (tx - cx) / td, oy = (ty - cy) / td;
    const ox2 = cx + ox * rr, oy2 = cy + oy * rr;       // 中心から見て半径の上の点
    pointOnCircle.position.set(ox2, oy2, 0.14);
    pointOnCircle.userData.label.userData.setText(m === 'tangent' ? 'T（接点）' : 'P');
    writeSeg(tanLine, ox2 - oy * span, oy2 + ox * span, ox2 + oy * span, oy2 - ox * span, 0.1);
    writeSeg(nbSeg, cx, cy, ox2, oy2, 0.16);
    // 接点の直角記号（接線方向と半径方向に組む小さな正方形）
    const sq = 0.34;
    const T1x = ox2 - oy * sq, T1y = oy2 + ox * sq;
    const T2x = T1x - ox * sq, T2y = T1y - oy * sq;
    const T3x = ox2 - ox * sq, T3y = oy2 - oy * sq;
    put(nbSquare, 0, ox2, oy2, 0.16);
    put(nbSquare, 1, T1x, T1y, 0.16);
    put(nbSquare, 2, T2x, T2y, 0.16);
    put(nbSquare, 3, T3x, T3y, 0.16);
    flush(nbSquare, 4);
    nbLabel.position.set((cx + ox2) / 2 - 0.45, (cy + oy2) / 2, 0);
    nbLabel.userData.setText('r');

    // 円の面積
    writeDisk(areaFill, cx, cy, rr);
    writeRing(areaRing, cx, cy, rr);
    areaLabel.position.set(cx, cy - 0.5, 0);
    areaLabel.userData.setText(`S = πr² = ${f(Math.PI * rr * rr)}`);

    // 円周角モード：3点とも円周上に置く
    if (m === 'circlePoint') {
      const onCircle = (pt, ang, off = 0) => {
        const d = Math.hypot(pt[0] - cx, pt[1] - cy);
        if (d < 1e-6) return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
        return [cx + ((pt[0] - cx) / d) * rr, cy + ((pt[1] - cy) / d) * rr];
      };
      const aa = onCircle(A, 0);
      const bb = onCircle(B, Math.PI * 0.8);
      pointA.position.set(aa[0], aa[1], 0.05);
      pointB.position.set(bb[0], bb[1], 0.05);
      state.circleA = Math.atan2(aa[1] - cy, aa[0] - cx);
      state.circleB = Math.atan2(bb[1] - cy, bb[0] - cx);
      let arcAB = Math.abs(state.circleB - state.circleA) % (Math.PI * 2);
      if (arcAB > Math.PI) arcAB = Math.PI * 2 - arcAB;
      state.inscribed = arcAB / 2;                       // 円周角は中心角の半分
      state.midArc = (state.circleA + state.circleB) / 2 + Math.PI;   // P は反対側の弧を動く
    }

    // モードごとの既定表示
    const on = (o, flag) => { o.visible = flag; };
    on(pointA, true); on(pointB, true);
    on(pointC, m === 'distance');
    on(footDot, m === 'distance');
    on(lineC, m === 'line' || m === 'distance');
    on(normalLine, m === 'distance');
    on(vectorAB, m === 'line' || m === 'midpoint' || m === 'distance');
    on(lengthBar, m !== 'circle' && m !== 'tangent');
    on(midDot, m === 'midpoint');
    on(extPoint, m === 'midpoint' && P.ratio !== 1);
    on(segments, m === 'midpoint' || m === 'circlePoint');
    on(circle, m === 'circle' || m === 'circlePoint' || m === 'tangent');
    on(centerDot, m === 'circle' || m === 'circlePoint' || m === 'tangent');
    on(radiusBar, m === 'circle' || m === 'tangent');
    on(pointOnCircle, m === 'circlePoint' || m === 'tangent');
    on(tangentLine, m === 'tangent');
    on(normalBar, m === 'tangent');
    on(area, m === 'circle');
    equation.visible = true;

    const text = {
      line: Number.isFinite(slope) ? `y = ${f(slope)}x ${intercept < 0 ? '−' : '+'} ${f(Math.abs(intercept))}` : 'x = 定数',
      distance: `d = ${f(dist)} = |Ax₀ + By₀ + C| / √(A²+B²)`,
      midpoint: `AP : PB = ${f(m0)} : ${f(n0)}`,
      circle: `(x − ${f(cx)})² + (y − ${f(cy)})² = ${f(rr)}²`,
      circlePoint: `∠APB = ${f((state.inscribed * 180) / Math.PI)}°（一定）`,
      tangent: '半径 ⟂ 接線',
    }[m] ?? '';
    equation.userData.setText(text);
  }

  function setParams(patch = {}) {
    if (patch.a) P.a = [patch.a[0] ?? P.a[0], patch.a[1] ?? P.a[1]];
    if (patch.b) P.b = [patch.b[0] ?? P.b[0], patch.b[1] ?? P.b[1]];
    if (patch.c) P.c = [patch.c[0] ?? P.c[0], patch.c[1] ?? P.c[1]];
    if (patch.point) P.point = [patch.point[0] ?? P.point[0], patch.point[1] ?? P.point[1]];
    if (patch.center) P.center = [patch.center[0] ?? P.center[0], patch.center[1] ?? P.center[1]];
    if (patch.radius != null) P.radius = Math.max(0.2, patch.radius);
    if (patch.ratio != null) P.ratio = patch.ratio;
    if (patch.mode) P.mode = patch.mode;
    if (patch.accent != null) ACC = accentOf(patch.accent);
    if (patch.spin != null) P.spin = patch.spin;
    if (patch.equation) equation.userData.setText(patch.equation);
    rebuild();
  }

  function update(dt, elapsed) {
    // 円周角モード：P が円周上を動いても ∠APB は変わらない
    if (P.mode === 'circlePoint' && parts.circle.visible) {
      const spanA = state.midArc - state.inscribed * 1.02;
      state.circleP = spanA + ((elapsed * 0.35 * P.spin) % (state.inscribed * 2.04));
      const px = P.center[0] + Math.cos(state.circleP) * P.radius;
      const py = P.center[1] + Math.sin(state.circleP) * P.radius;
      pointOnCircle.position.set(px, py, 0.14);
      const ax = pointA.position.x, ay = pointA.position.y;
      const bx = pointB.position.x, by = pointB.position.y;
      put(segLine, 0, px, py, 0.1);
      put(segLine, 1, ax, ay, 0.1);
      put(segLine, 2, px, py, 0.1);
      put(segLine, 3, bx, by, 0.1);
      flush(segLine, 4);
      segArc.visible = true;
      let a1 = Math.atan2(ay - py, ax - px);
      let a2 = Math.atan2(by - py, bx - px);
      if (a2 - a1 > Math.PI) a2 -= Math.PI * 2;
      if (a1 - a2 > Math.PI) a2 += Math.PI * 2;
      writeArc(segArc, px, py, 0.45, a1, a2, 0.1);
      segLabel.position.set(px, py - 0.6, 0);
      segLabel.userData.setText(`∠APB = ${f((state.inscribed * 180) / Math.PI)}°`);
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}

const f = (x) => (Math.abs(x) < 1e-9 ? '0' : String(Math.round(x * 1000) / 1000));
