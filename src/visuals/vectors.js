import * as THREE from 'three';
import { lineBasic, basicMat, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { makeAxes, makeGridPlane, makeArrow, makePoint, accentOf } from './common.js';

/**
 * 2次元のベクトル。内積を平行四辺形の面積、外積を z 方向の長さ、正射影を
 * 共線成分と垂直成分に分けた形で見せる。台本の「内積→射影→外積」の順番に
 * 同じ u, v を差し替えずに mode だけ変える。
 */
export function createVectors(params = {}) {
  const {
    u = [3, 1],
    v = [1, 4],
    w = [2, 3],
    mode = 'dot',
    accent = 0x6ee7ff,
  } = params;

  let ACC = accentOf(accent);
  const AMBER = 0xffd479;
  const MINT = 0x7cffb2;
  const PINK = 0xff6b9d;
  const BOX = 5;

  const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const group = new THREE.Group();
  const parts = {};
  const P = { u: [...u], v: [...v], w: [...w], mode, spin: 1 };

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

  function writeLine(line, pts) {
    const attr = line.geometry.attributes.position;
    const n = Math.min(pts.length, attr.count);
    for (let i = 0; i < n; i++) attr.setXYZ(i, pts[i].x, pts[i].y, pts[i].z ?? 0);
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  function flatPoly(pts, { color, opacity = 0.24, edge = color, edgeOpacity = 0.85 } = {}) {
    const g = new THREE.Group();
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), basicMat(color, opacity)));
    g.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts.map((p) => v3(p[0], p[1], 0))),
      lineBasic(edge, edgeOpacity)
    ));
    return g;
  }

  /** 名前つきのベクトル（矢印 + 文字）を into に置く。 */
  function vectorInto(into, x, y, color, name, { z = 0, size = 0.16 } = {}) {
    resetGroup(into);
    if (Math.hypot(x, y) < 1e-6) return;
    into.add(makeArrow(v3(0, 0, z), v3(x, y, z), { color, headSize: size, shaft: 0.022 }));
    const l = makeLabel(name, { height: 0.34, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)' });
    l.position.set(x * 0.55, y * 0.55, z + 0.4);
    into.add(l);
  }

  // ----------------------------------------------------------------- 背景
  const axes = flatAxes();
  group.add(axes);
  parts.axes = axes;

  const grid = makeGridPlane({ size: BOX * 2, div: BOX * 2, color: 0x2f4a7a, opacity: 0.4, plane: 'xy' });
  group.add(grid);
  parts.grid = grid;

  // ------------------------------------------------------------ ベクトル群
  const gU = new THREE.Group();
  const gV = new THREE.Group();
  const gW = new THREE.Group();
  const gSum = new THREE.Group();
  const gDiff = new THREE.Group();
  const gProjU = new THREE.Group();
  const gProjV = new THREE.Group();
  const gResU = new THREE.Group();
  const gResV = new THREE.Group();
  const gParallel = new THREE.Group();
  const gArea = new THREE.Group();
  const gAngle = new THREE.Group();
  group.add(gU, gV, gW, gSum, gDiff, gProjU, gProjV, gResU, gResV, gParallel, gArea, gAngle);
  parts.u = gU; parts.v = gV; parts.w = gW;
  parts.sum = gSum; parts.difference = gDiff;
  parts.projU = gProjU; parts.projV = gProjV;
  parts.resU = gResU; parts.resV = gResV;
  parts.parallelogram = gParallel;
  parts.areaRect = gArea;
  parts.angleArc = gAngle;

  // 射影の足
  const footDot = new THREE.Group();
  const footP = makePoint(0xffffff, { size: 0.1, halo: 0.85 });
  footDot.add(footP);
  const footL = makeLabel('H', { height: 0.3, color: '#ffffff', bg: 'rgba(6,10,22,0.8)' });
  footL.position.set(0, 0.42, 0);
  footDot.add(footL);
  group.add(footDot);
  parts.footDot = footDot;

  const footDot2 = new THREE.Group();
  const footP2 = makePoint(0xffffff, { size: 0.1, halo: 0.85 });
  footDot2.add(footP2);
  const footL2 = makeLabel('K', { height: 0.3, color: '#ffffff', bg: 'rgba(6,10,22,0.8)' });
  footL2.position.set(0, 0.42, 0);
  footDot2.add(footL2);
  group.add(footDot2);
  parts.footDot2 = footDot2;

  // 平行四辺形や長方形の中の補助線（塗りは別グループに置き、再構築から守る）
  const parallelFill = new THREE.Group();
  gParallel.add(parallelFill);
  const areaFill = new THREE.Group();
  gArea.add(areaFill);
  const spanLine = dynamicLine(2, 0xffffff, 0.4);
  gParallel.add(spanLine);
  const heightLine = dynamicLine(2, MINT, 0.7);
  gArea.add(heightLine);

  // ---------------------------------------------------------------- ラベル
  const labels = new THREE.Group();
  const areaLabel = makeLabel('S = 0', { height: 0.36, color: '#7cffb2', bg: 'rgba(6,10,22,0.82)', border: 'rgba(124,255,178,0.4)' });
  const dotReadout = makeLabel('u・v = 0', { height: 0.44, color: '#eaf6ff', bg: 'rgba(6,10,22,0.85)', border: 'rgba(110,231,255,0.35)' });
  labels.add(areaLabel, dotReadout);
  group.add(labels);
  parts.areaLabel = areaLabel;
  parts.dotReadout = dotReadout;

  // ------------------------------------------------------------ 再構築
  function rebuild() {
    const [ux, uy] = P.u;
    const [vx, vy] = P.v;
    const [wx, wy] = P.w;
    const uu = ux * ux + uy * uy;
    const vv = vx * vx + vy * vy;
    const uv = ux * vx + uy * vy;
    const cross = ux * vy - uy * vx;
    const lu = Math.sqrt(uu), lv = Math.sqrt(vv);
    const cos = lu > 1e-9 && lv > 1e-9 ? uv / (lu * lv) : 0;
    const thU = Math.atan2(uy, ux);
    const thV = Math.atan2(vy, vx);

    vectorInto(gU, ux, uy, ACC, 'u', { z: 0.05 });
    vectorInto(gV, vx, vy, AMBER, 'v', { z: -0.05 });

    // 和と差
    vectorInto(gSum, ux + vx, uy + vy, MINT, 'u+v');
    vectorInto(gDiff, ux - vx, uy - vy, PINK, 'u−v');

    // u, v が作る平行四辺形（内積・外積の舞台）
    resetGroup(parallelFill);
    if (lu > 1e-6 && lv > 1e-6) {
      parallelFill.add(flatPoly(
        [[0, 0], [ux, uy], [ux + vx, uy + vy], [vx, vy]],
        { color: uv >= 0 ? ACC : PINK, opacity: 0.2, edge: uv >= 0 ? ACC : PINK, edgeOpacity: 0.8 }
      ));
    }
    writeLine(spanLine, [v3(ux, uy, 0.03), v3(vx, vy, 0.03)]);   // u と v の間の平行線

    // 正射影（v を u に落とす / u を v に落とす）
    const pv = uu > 1e-9 ? uv / uu : 0;
    const pu = vv > 1e-9 ? uv / vv : 0;
    const projVv = [ux * pv, uy * pv];                 // v の u 上への射影
    const projUu = [vx * pu, vy * pu];                 // u の v 上への射影
    vectorInto(gProjV, projVv[0], projVv[1], MINT, '射影', { z: 0.12, size: 0.13 });
    vectorInto(gProjU, projUu[0], projUu[1], MINT, '射影', { z: -0.12, size: 0.13 });
    vectorInto(gResV, vx - projVv[0], vy - projVv[1], PINK, '垂直成分', { z: 0.12, size: 0.13 });
    vectorInto(gResU, ux - projUu[0], uy - projUu[1], PINK, '垂直成分', { z: -0.12, size: 0.13 });

    footP.position.set(projVv[0], projVv[1], 0.2);
    footL.position.set(projVv[0], projVv[1] + 0.42, 0);
    footP2.position.set(projUu[0], projUu[1], -0.2);
    footL2.position.set(projUu[0], projUu[1] + 0.42, 0);

    // 外積：面積 S を z 方向の長さとして立てる
    resetGroup(areaFill);
    const area = Math.abs(cross);
    const zScale = area > BOX * 0.8 ? (BOX * 0.8) / area : 1;
    const h = lu > 1e-6 ? area / lu : 0;
    const ox = lu > 1e-6 ? (-uy / lu) * 0.5 : 0;
    const oy = lu > 1e-6 ? (ux / lu) * 0.5 : 0;
    if (lu > 1e-6 && h > 1e-6) {
      // 立ち上げた長方形（底辺 |u|、高さ |u×v|/|u|）を u と z の張る平面上に組む
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        ox, oy, 0.05, ux + ox, uy + oy, 0.05,
        ux + ox, uy + oy, 0.05, ox, oy, h + 0.05,
        ox, oy, h + 0.05, ux + ox, uy + oy, h + 0.05,
      ], 3));
      g.computeVertexNormals();
      areaFill.add(new THREE.LineSegments(g, lineBasic(MINT, 0.8)));
      areaFill.add(new THREE.Mesh(g, basicMat(MINT, 0.14)));
    }
    if (area > 1e-6) {
      areaFill.add(makeArrow(v3(0, 0, 0), v3(0, 0, area * zScale), { color: MINT, headSize: 0.17, shaft: 0.022 }));
    }
    writeLine(heightLine, [v3(ux * 0.5, uy * 0.5, 0.06), v3(ux * 0.5, uy * 0.5, h + 0.06)]);
    areaLabel.position.set(0.35, 0.35, Math.max(area * zScale, h) + 0.4);
    areaLabel.userData.setText(`|u×v| = ${f(area)}${zScale < 1 ? ` (×${f(zScale)})` : ''}`);

    // 角と余弦
    resetGroup(gAngle);
    const arc = dynamicLine(41, 0xffffff, 0.85);
    gAngle.add(arc);
    const arcR = Math.min(1.4, Math.max(0.6, Math.min(lu, lv) * 0.45));
    const lo = Math.min(thU, thV), hi = Math.max(thU, thV);
    writeArc(arc, arcR, lo, hi, 0.05);
    const arcL = makeLabel('θ', { height: 0.34, color: '#ffffff', bg: 'rgba(6,10,22,0.8)' });
    arcL.position.set(arcR * Math.cos((lo + hi) / 2), arcR * Math.sin((lo + hi) / 2), 0);
    gAngle.add(arcL);

    // 基底分解：w = αu + βv
    vectorInto(gW, wx, wy, 0xffffff, 'w', { z: 0.1, size: 0.18 });
    resetGroup(gProjU);
    resetGroup(gResU);
    let alpha = 0, beta = 0, wx2 = wx, wy2 = wy;
    if (uu > 1e-9) {
      alpha = (wx * ux + wy * uy) / uu;
      wx2 = wx - alpha * ux;
      wy2 = wy - alpha * uy;
    }
    let gamma = 0, zx = wx, zy = wy;
    if (vv > 1e-9) {
      gamma = (wx * vx + wy * vy) / vv;
      zx = wx - gamma * vx;
      zy = wy - gamma * vy;
    }
    beta = (wx2 * vx + wy2 * vy) / Math.max(vv, 1e-9);
    vectorInto(gProjU, alpha * ux, alpha * uy, MINT, `αu (${f(alpha)})`, { z: 0.12, size: 0.13 });
    vectorInto(gResU, wx2, wy2, PINK, '残り', { z: 0.12, size: 0.13 });
    vectorInto(gProjV, beta * vx, beta * vy, 0x9db4ff, `βv (${f(beta)})`, { z: -0.12, size: 0.13 });
    vectorInto(gResV, zx, zy, 0xff9f6e, '残り', { z: -0.12, size: 0.13 });

    // 数値の読み取り
    const readout = {
      dot: `u・v = ${f(uv)}   |u||v| = ${f(lu * lv)}`,
      projection: `射影 = ${f(uv / Math.max(lu, 1e-9))}   垂直 = ${f(Math.sqrt(Math.max(lv * lv - (uv * uv) / Math.max(uu, 1e-9), 0)))}`,
      cross: `|u×v| = ${f(area)} = |u||v| sinθ`,
      decompose: `w = ${f(alpha)}u + ${f(beta)}v`,
      angle: `θ = ${f(((hi - lo) * 180) / Math.PI)}°   cos θ = ${f(cos)}`,
    }[P.mode] ?? `u・v = ${f(uv)}`;
    dotReadout.userData.setText(readout);
    dotReadout.position.set(-BOX * 0.92, -BOX * 0.92 + 0.45, 0);

    // モードごとの既定表示
    const on = (o, flag) => { o.visible = flag; };
    const m = P.mode;
    on(gU, true); on(gV, true); on(gW, m === 'decompose');
    on(gSum, m === 'sum' || m === 'decompose'); on(gDiff, m === 'diff');
    on(gParallel, m === 'dot' || m === 'cross' || m === 'decompose');
    on(gArea, m === 'cross');
    on(gAngle, m === 'angle' || m === 'projection' || m === 'decompose');
    on(footDot, m === 'projection' || m === 'decompose');
    on(footDot2, m === 'decompose');
    on(gProjV, m === 'projection' || m === 'decompose');
    on(gResV, m === 'projection' || m === 'decompose');
    on(gProjU, m === 'decompose');
    on(gResU, m === 'decompose');
    areaLabel.visible = m === 'cross';
  }

  function setParams(patch = {}) {
    if (patch.u) P.u = [patch.u[0] ?? P.u[0], patch.u[1] ?? P.u[1]];
    if (patch.v) P.v = [patch.v[0] ?? P.v[0], patch.v[1] ?? P.v[1]];
    if (patch.w) P.w = [patch.w[0] ?? P.w[0], patch.w[1] ?? P.w[1]];
    if (patch.mode) P.mode = patch.mode;
    if (patch.accent != null) ACC = accentOf(patch.accent);
    if (patch.spin != null) P.spin = patch.spin;
    if (patch.readout) dotReadout.userData.setText(patch.readout);
    rebuild();
  }

  function update(dt, elapsed) {
    if (P.mode === 'angle' && gAngle.visible) {
      gAngle.scale.setScalar(1 + 0.02 * Math.sin(elapsed * 2 * P.spin));
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}

const f = (x) => (Math.abs(x) < 1e-9 ? '0' : String(Math.round(x * 1000) / 1000));
