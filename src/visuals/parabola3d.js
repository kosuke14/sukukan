import * as THREE from 'three';
import { solidMat, lineBasic, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { lerp } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makeCurve, makePoint, Animated } from './common.js';

const Y_TOP = 6.2;   // 見せる上端
const Y_BOT = -2.6;  // 見せる下端

const fmt = (v) => {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, '');
};

/** 2点の線分を捨てずに描き直す。 */
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

/** 長さや向きが変わっても作り直さない矢印。 */
function sizedArrow(color) {
  const g = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 8);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, solidMat(color, { opacity: 0.92, roughness: 0.3, emissiveIntensity: 0.4 }));
  const headGeo = new THREE.ConeGeometry(0.09, 0.22, 14);
  headGeo.translate(0, 0.11, 0);
  const head = new THREE.Mesh(headGeo, solidMat(color, { opacity: 0.95, roughness: 0.3, emissiveIntensity: 0.5 }));
  g.add(shaft, head);
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  g.userData.set = (from, to) => {
    dir.subVectors(to, from);
    const len = dir.length();
    if (len < 0.05) { g.scale.setScalar(0.0001); return; }
    g.scale.setScalar(1);
    g.position.copy(from);
    dir.multiplyScalar(1 / len);
    g.quaternion.setFromUnitVectors(up, dir);
    const body = Math.max(len - 0.2, 0.02);
    shaft.scale.set(1, body, 1);
    head.position.set(0, body, 0);
  };
  return g;
}

/**
 * 放物線 y = a(x-p)^2 + q の3D表示。
 * 頂点・対称軸・平行移動・完成平方の変形を補助線で見せる。
 * transform: 0=そのまま 1=頂点の平行移動 2=軸平行移動 3=完成平方
 */
export function createParabola3D(params = {}) {
  const {
    a = 1, p = 0, q = 0,
    accent = 0x6ee7ff,
    showVertex = true,
    showFocus = false,
    showAxis = true,
    transform = 0,
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { a, p, q, accent, showVertex, showFocus, showAxis, transform, focus: 0.25, area: 0 };

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

  const projGeo = new THREE.BufferGeometry().setFromPoints(pathPts.map(() => new THREE.Vector3()));
  const projAttr = projGeo.attributes.position;
  const projection = new THREE.Line(projGeo, lineBasic(accent, 0.3));
  group.add(projection);
  parts.projection = projection;

  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SAMPLES + 1) * 6), 3));
  const cIdx = [];
  for (let i = 0; i < SAMPLES; i++) { const o = i * 2; cIdx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  curtainGeo.setIndex(cIdx);
  const curtain = new THREE.Mesh(curtainGeo, solidMat(accent, { opacity: 0.1, roughness: 1, metalness: 0 }));
  curtain.frustumCulled = false;
  group.add(curtain);
  parts.curtain = curtain;

  // ------------------------------------------------------------------ 頂点
  const vertexGroup = new THREE.Group();
  const vDot = makePoint(0xffffff, { size: 0.15, halo: 1.0 });
  const vHalo = vDot.children[1];
  const vLabel = makeLabel('V', { height: 0.34, color: '#ffffff', bg: 'rgba(6,10,22,0.82)', border: 'rgba(255,255,255,0.28)' });
  vLabel.position.y = 0.58;
  vertexGroup.add(vDot, vLabel);
  group.add(vertexGroup);
  parts.vertex = vertexGroup;

  // 焦点（+ 準線）
  const focusGroup = new THREE.Group();
  const fDot = makePoint(0xffd479, { size: 0.13, halo: 0.9 });
  const fLabel = makeLabel('F', { height: 0.32, color: '#ffd479', bg: 'rgba(6,10,22,0.8)' });
  fLabel.position.y = 0.44;
  const directrix = makeSeg(0xffd479, 0.55);
  const dirLabel = makeLabel('準線', { height: 0.28, color: '#ffd479', bg: 'rgba(6,10,22,0.7)' });
  focusGroup.add(fDot, fLabel, directrix, dirLabel);
  group.add(focusGroup);
  parts.focus = focusGroup;
  focusGroup.visible = showFocus;

  // -------------------------------------------------------------- 対称軸
  const axisGroup = new THREE.Group();
  const axisLine = makeSeg(0x9fb8e8, 0.6);
  const axisLabel = makeLabel('x = p', { height: 0.3, color: '#cfe0ff', bg: 'rgba(6,10,22,0.7)' });
  axisGroup.add(axisLine, axisLabel);
  group.add(axisGroup);
  parts.axisLine = axisGroup;
  axisGroup.visible = showAxis;

  // --------------------------------------------- 頂点の座標を拾う2本の線
  const hGroup = new THREE.Group();
  hGroup.add(makeSeg(0x8fe8ff, 0.75));
  const hLabel = makeLabel('y = q', { height: 0.28, color: '#8fe8ff', bg: 'rgba(6,10,22,0.75)' });
  hGroup.add(hLabel);
  group.add(hGroup);
  parts.hLine = hGroup;

  const vGroup = new THREE.Group();
  vGroup.add(makeSeg(0xffb37a, 0.75));
  const vValLabel = makeLabel('q', { height: 0.28, color: '#ffb37a', bg: 'rgba(6,10,22,0.75)' });
  vGroup.add(vValLabel);
  group.add(vGroup);
  parts.vLine = vGroup;

  // ------------------------------------------------------ 平行移動の矢印
  const translateGroup = new THREE.Group();
  const arrowX = sizedArrow(0x8fe8ff);
  const arrowY = sizedArrow(0xffb37a);
  const tLabelX = makeLabel('p', { height: 0.3, color: '#8fe8ff', bg: 'rgba(6,10,22,0.75)' });
  const tLabelY = makeLabel('q', { height: 0.3, color: '#ffb37a', bg: 'rgba(6,10,22,0.75)' });
  translateGroup.add(arrowX, arrowY, tLabelX, tLabelY);
  group.add(translateGroup);
  parts.translate = translateGroup;

  const oDot = makePoint(0x8fa8e0, { size: 0.08, halo: 0.5 });
  const oLabel = makeLabel('O', { height: 0.26, color: '#8fa8e0', bg: null });
  oLabel.position.y = 0.4;
  translateGroup.add(oDot, oLabel);

  // ---------------------------------------------------------- 左右対称
  const equalGroup = new THREE.Group();
  const eqL = makeSeg(0xffd479, 0.9);
  const eqR = makeSeg(0xffd479, 0.9);
  const eqLdot = makePoint(0xffd479, { size: 0.08, halo: 0.5 });
  const eqRdot = makePoint(0xffd479, { size: 0.08, halo: 0.5 });
  const eqLabel = makeLabel('左右対称', { height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.75)' });
  equalGroup.add(eqL, eqR, eqLdot, eqRdot, eqLabel);
  group.add(equalGroup);
  parts.equalLines = equalGroup;

  // ---------------------------------------------------------- 接線と割線
  const tangentGroup = new THREE.Group();
  const tLine = makeSeg(0xffffff, 0.7);
  const tLineLabel = makeLabel('接線', { height: 0.28, color: '#ffffff', bg: 'rgba(6,10,22,0.75)' });
  tangentGroup.add(tLine, tLineLabel);
  group.add(tangentGroup);
  parts.tangent = tangentGroup;

  const secantGroup = new THREE.Group();
  const sLine = makeSeg(0x7cffb2, 0.85);
  const sLineLabel = makeLabel('割線', { height: 0.28, color: '#7cffb2', bg: 'rgba(6,10,22,0.75)' });
  secantGroup.add(sLine, sLineLabel);
  group.add(secantGroup);
  parts.secant = secantGroup;

  // ------------------------------------------------------------- 完成平方
  const completed = new THREE.Group();
  const ghost = makeCurve(() => new THREE.Vector3(), { samples: SAMPLES, color: 0x8fa8e0, opacity: 0.32, glow: false });
  const ghostLine = ghost.children[0];
  const ghostAttr = ghostLine.geometry.attributes.position;
  const legH = makeSeg(0x8fe8ff, 0.9);
  const legV = makeSeg(0xffb37a, 0.9);
  const legHLabel = makeLabel('x - p', { height: 0.28, color: '#8fe8ff', bg: 'rgba(6,10,22,0.75)' });
  const legVLabel = makeLabel('a(x-p)^2', { height: 0.28, color: '#ffb37a', bg: 'rgba(6,10,22,0.75)' });
  const ghostLabel = makeLabel('y = a x^2', { height: 0.3, color: '#8fa8e0', bg: 'rgba(6,10,22,0.7)' });
  completed.add(ghost, legH, legV, legHLabel, legVLabel, ghostLabel);
  group.add(completed);
  parts.completed = completed;

  // ----------------------------------------------------------------- 面積
  const areaGroup = new THREE.Group();
  const areaMesh = new THREE.Mesh(new THREE.BufferGeometry(), solidMat(accent, { opacity: 0.26, roughness: 0.9, metalness: 0 }));
  const areaEdge = new THREE.LineLoop(new THREE.BufferGeometry(), lineBasic(accent, 0.85));
  const areaLabel = makeLabel('面積', { height: 0.32, color: '#eaf6ff', bg: 'rgba(6,10,22,0.82)', border: 'rgba(110,231,255,0.3)' });
  areaGroup.add(areaMesh, areaEdge, areaLabel);
  group.add(areaGroup);
  parts.area = areaGroup;

  // 式のラベル
  const formula = makeLabel('y = x^2', {
    height: 0.44, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)', border: 'rgba(110,231,255,0.3)',
  });
  formula.position.set(-2.6, Y_TOP - 0.5, 0);
  group.add(formula);
  parts.formula = formula;

  // ------------------------------------------------------------ 再構築
  const anim = new Animated({ a, p, q });

  function f(x, A, Pp, Q) { return A * (x - Pp) * (x - Pp) + Q; }
  function fv(x) { return f(x, P.a, P.p, P.q); }

  function spanFor(A, Pp, Q) {
    const k = Math.abs(A) < 1e-3 ? 1e-3 : Math.abs(A);
    let r;
    if (A > 0) r = Math.sqrt(Math.max((Y_TOP - Q) / k, 0.3));
    else r = Math.sqrt(Math.max((Q - Y_BOT) / k, 0.3));
    r = Math.min(r, 6);
    return [Pp - r, Pp + r];
  }

  function rebuild() {
    const A = P.a, Pp = P.p, Q = P.q;
    const [x0, x1] = spanFor(A, Pp, Q);
    const cArr = curveAttr.array;
    const pArr = projAttr.array;
    const kArr = curtainGeo.attributes.position.array;

    for (let i = 0; i <= SAMPLES; i++) {
      const x = lerp(x0, x1, i / SAMPLES);
      const y = f(x, A, Pp, Q);
      pathPts[i].set(x, y, 0);
      cArr[i * 3] = x; cArr[i * 3 + 1] = y; cArr[i * 3 + 2] = 0;
      pArr[i * 3] = x; pArr[i * 3 + 1] = 0.004; pArr[i * 3 + 2] = 0;
      kArr[i * 6] = x; kArr[i * 6 + 1] = y; kArr[i * 6 + 2] = 0;
      kArr[i * 6 + 3] = x; kArr[i * 6 + 4] = 0; kArr[i * 6 + 5] = 0;
    }
    curveAttr.needsUpdate = true;
    curveLine.geometry.computeBoundingSphere();
    projAttr.needsUpdate = true;
    projLineBounding();
    curtainGeo.attributes.position.needsUpdate = true;

    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts), SAMPLES, 0.05, 8, false);

    // 平行移動前の放物線
    const gArr = ghostAttr.array;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = lerp(x0, x1, i / SAMPLES);
      gArr[i * 3] = x; gArr[i * 3 + 1] = f(x, A, 0, 0); gArr[i * 3 + 2] = 0;
    }
    ghostAttr.needsUpdate = true;
    ghostLine.geometry.computeBoundingSphere();

    // 頂点・焦点・軸
    vertexGroup.position.set(Pp, Q, 0);
    vLabel.userData.setText(`V(${fmt(Pp)}, ${fmt(Q)})`);
    P.focus = Math.abs(A) < 1e-3 ? 0 : 1 / (4 * A);
    fDot.position.set(0, Q + P.focus, 0);
    fLabel.position.set(0, Q + P.focus + 0.44, 0);
    dirLabel.position.set(x0 + 1.2, Q - P.focus, 0);
    setSeg(directrix, x0, Q - P.focus, x1, Q - P.focus);
    focusGroup.visible = showFocus;

    setSeg(axisLine, Pp, Y_BOT, Pp, Y_TOP);
    axisLabel.position.set(Pp + 0.75, Y_TOP - 0.35, 0);
    axisGroup.visible = showAxis;
    vertexGroup.visible = showVertex;

    // 頂点の座標
    setSeg(hGroup.children[0], Pp - 2.6, Q, Pp + 2.6, Q);
    hLabel.position.set(Pp + 2.9, Q, 0);
    setSeg(vGroup.children[0], Pp, 0, Pp, Q);
    vValLabel.position.set(Pp + 0.35, Q / 2, 0);

    // 平行移動の矢印
    arrowX.userData.set(new THREE.Vector3(0, -0.32, 0), new THREE.Vector3(Pp, -0.32, 0));
    arrowY.userData.set(new THREE.Vector3(Pp, 0, 0), new THREE.Vector3(Pp, Q, 0));
    tLabelX.position.set(Pp / 2, -0.72, 0);
    tLabelY.position.set(Pp + 0.42, Q / 2, 0);
    oDot.position.set(0, 0, 0);
    oLabel.position.set(0, 0.42, 0);

    // 左右対称（頂点から距離 s の2点）
    const s = 1.3;
    const ys = f(Pp + s, A, Pp, Q);
    setSeg(eqL, Pp, ys, Pp - s, ys);
    setSeg(eqR, Pp, ys, Pp + s, ys);
    eqLdot.position.set(Pp - s, ys, 0);
    eqRdot.position.set(Pp + s, ys, 0);
    eqLabel.position.set(Pp, ys + 0.45, 0);

    // 接線（頂点での接線は水平）と割線
    setSeg(tLine, x0, Q, x1, Q);
    tLineLabel.position.set(x1 - 0.9, Q + 0.4, 0);
    const sx = Pp + s;
    const sy = f(sx, A, Pp, Q);
    setSeg(sLine, Pp - s * 0.5, Q - (sy - Q) * 0.5, sx + s * 0.35, sy + (sy - Q) * 0.35);
    sLineLabel.position.set(sx + 0.6, sy + 0.4, 0);

    // 完成平方の直角三角形
    const ux = Pp + s;
    const uy = f(ux, A, Pp, Q);
    setSeg(legH, Pp, Q, ux, Q);
    setSeg(legV, ux, Q, ux, uy);
    legHLabel.position.set((Pp + ux) / 2, Q - 0.42, 0);
    legVLabel.position.set(ux + 0.85, (Q + uy) / 2, 0);
    ghostLabel.position.set(x0 + 1.5, f(x0 + 1.5, A, 0, 0) + 0.55, 0);

    // 面積（曲線と x 軸）
    rebuildArea(x0, x1, A, Pp, Q);

    // 式
    const ax = Math.abs(A - 1) < 1e-6 ? '' : `${fmt(A)}`;
    const px = Math.abs(Pp) < 1e-6 ? 'x' : (Pp > 0 ? `x - ${fmt(Pp)}` : `x + ${fmt(-Pp)}`);
    const qx = Math.abs(Q) < 1e-6 ? '' : (Q > 0 ? ` + ${fmt(Q)}` : ` - ${fmt(-Q)}`);
    const axq = ax && qx ? ` + ${ax}` : ax;
    formula.userData.setText(`y = ${axq}${px ? `(${px})` : ''}${qx}`);

    applyTransform();
  }

  function projLineBounding() { projGeo.computeBoundingSphere(); }

  function rebuildArea(x0, x1, A, Pp, Q) {
    const N = 160;
    const top = [];
    const loop = [];
    let sum = 0;
    for (let i = 0; i <= N; i++) {
      const x = lerp(x0, x1, i / N);
      const y = f(x, A, Pp, Q);
      if (y > 0) {
        if (!top.length) loop.push(new THREE.Vector2(x, 0));
        top.push(new THREE.Vector2(x, y));
        loop.push(new THREE.Vector2(x, y));
        const xPrev = x0 + ((i - 1) * (x1 - x0)) / N;
        const yPrev = Math.max(f(xPrev, A, Pp, Q), 0);
        sum += ((y + yPrev) / 2) * (x - xPrev);
      } else if (top.length) {
        loop.push(new THREE.Vector2(x, 0));
        top.length = 0;
      }
    }
    P.area = sum;
    if (loop.length < 3) {
      areaMesh.geometry.dispose();
      areaMesh.geometry = new THREE.BufferGeometry();
      areaEdge.geometry.dispose();
      areaEdge.geometry = new THREE.BufferGeometry();
      areaLabel.visible = false;
      return;
    }
    areaLabel.visible = true;
    const shape = new THREE.Shape();
    shape.moveTo(loop[0].x, loop[0].y);
    for (let i = 1; i < loop.length; i++) shape.lineTo(loop[i].x, loop[i].y);
    shape.closePath();
    areaMesh.geometry.dispose();
    areaMesh.geometry = new THREE.ShapeGeometry(shape);
    areaEdge.geometry.dispose();
    areaEdge.geometry = new THREE.BufferGeometry().setFromPoints(loop.map((v) => new THREE.Vector3(v.x, v.y, 0.01)));
    areaLabel.userData.setText(`面積 = ${fmt(sum)}`);
    let bx = 0, by = 0;
    for (const v of loop) { bx += v.x; by += v.y; }
    areaLabel.position.set(bx / loop.length, by / loop.length + 0.6, 0);
  }

  /** transform の値から補助線の既定の表示を決める。 */
  function applyTransform() {
    const t = P.transform;
    parts.translate.visible = t === 1 || t === 2;
    parts.hLine.visible = t >= 2;
    parts.vLine.visible = t >= 2;
    parts.completed.visible = t === 3;
  }

  function setParams(patch = {}) {
    if (patch.accent != null) P.accent = patch.accent;
    const shapeKeys = ['a', 'p', 'q'].filter((k) => patch[k] != null);
    if (shapeKeys.length) {
      if (patch.a != null) P.a = patch.a;
      if (patch.p != null) P.p = patch.p;
      if (patch.q != null) P.q = patch.q;
      anim.to({ a: P.a, p: P.p, q: P.q });
    }
    if (patch.transform != null) P.transform = patch.transform;
    if (patch.showVertex != null) { P.showVertex = patch.showVertex; parts.vertex.visible = patch.showVertex; }
    if (patch.showFocus != null) { P.showFocus = patch.showFocus; parts.focus.visible = patch.showFocus; }
    if (patch.showAxis != null) { P.showAxis = patch.showAxis; parts.axisLine.visible = patch.showAxis; }
    if (patch.equal != null) parts.equalLines.visible = patch.equal;
    if (patch.area != null) parts.area.visible = patch.area;
    if (patch.secant != null) parts.secant.visible = patch.secant;
    if (patch.tangent != null) parts.tangent.visible = patch.tangent;
    if (patch.formula != null) { formula.userData.setText(patch.formula); formula.visible = true; }
    if (patch.hideFormula) formula.visible = false;
  }

  function update(dt, elapsed) {
    const c = anim.update(dt, 4.6);
    const moving = Math.abs(c.a - anim.target.a) > 1e-4
      || Math.abs(c.p - anim.target.p) > 1e-4
      || Math.abs(c.q - anim.target.q) > 1e-4;
    P.a = c.a; P.p = c.p; P.q = c.q;
    if (moving) rebuild();

    const s = 1.05 + 0.06 * Math.sin(elapsed * 2.1);
    vHalo.scale.set(s, s, 1);
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose, f: (x) => f(x, P.a, P.p, P.q) };
}
