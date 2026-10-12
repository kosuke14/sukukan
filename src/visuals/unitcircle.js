import * as THREE from 'three';
import { disposeObject, lineBasic } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { TAU } from '../engine/MathUtil.js';
import { Animated, makeArrow, makeAxes, makeGridPlane, makePoint } from './common.js';

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
// 更新中に使い回しの作業領域（毎フレーム new を作らない）
const W = {
  o: new THREE.Vector3(),
  p: new THREE.Vector3(),
  fx: new THREE.Vector3(),
  fz: new THREE.Vector3(),
  t: new THREE.Vector3(),
  u: new THREE.Vector3(),
  v: new THREE.Vector3(),
};

function dropNode(node) {
  node.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

function setText(sprite, text) {
  if (sprite.userData.text === text) return;
  sprite.userData.text = text;
  sprite.userData.setText(text);
}

/** 長さ1で作って、あとから position と scale だけで伸縮する矢印。 */
function makeRotArrow(color, headSize, shaft) {
  const g = makeArrow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), { color, headSize, shaft });
  return { g, body: g.children[0], head: g.children[1], base: 1 - headSize * 1.4, headSize };
}

function aimArrow(ar, from, to) {
  if (!ar.body || !ar.head) return;
  _dir.subVectors(to, from);
  const len = _dir.length();
  if (len < 1e-4) { ar.g.visible = false; return; }
  ar.g.visible = true;
  _dir.divideScalar(len);
  const shaftLen = Math.max(len - ar.headSize * 1.4, 1e-3);
  ar.body.scale.y = shaftLen / ar.base;
  ar.body.position.copy(from).addScaledVector(_dir, shaftLen / 2);
  ar.body.quaternion.setFromUnitVectors(UP, _dir);
  ar.head.position.copy(from).addScaledVector(_dir, Math.max(len - ar.headSize * 1.2, 0));
  ar.head.quaternion.copy(ar.body.quaternion);
}

/** 2点の線。更新のたびに作り直さず座標配列だけを書く。 */
function makeSegment(color, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const line = new THREE.Line(geo, lineBasic(color, opacity));
  line.frustumCulled = false;
  line.userData.set = (from, to) => {
    const arr = geo.attributes.position.array;
    arr[0] = from.x; arr[1] = from.y; arr[2] = from.z;
    arr[3] = to.x; arr[4] = to.y; arr[5] = to.z;
    geo.attributes.position.needsUpdate = true;
  };
  return line;
}

const TUBULAR = 168;
const RADIAL = 8;

/** 全周分を用意し、drawRange で 0 から theta までを書き出す円弧。 */
function makeArcPair(r, color) {
  const build = (sign) => {
    const pts = [];
    for (let i = 0; i <= TUBULAR; i++) {
      const t = (i / TUBULAR) * TAU * sign;
      pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), TUBULAR, 0.05, RADIAL, false);
    g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.frustumCulled = false;
    m.renderOrder = 4;
    return m;
  };
  const ccw = build(1);
  const cw = build(-1);
  const g = new THREE.Group();
  g.add(ccw, cw);
  g.pick = (ang) => {
    const a = ((ang % TAU) + TAU) % TAU;
    const k = Math.floor((a / TAU) * TUBULAR) * RADIAL * 6;
    ccw.geometry.setDrawRange(0, ang >= 0 ? k : 0);
    cw.geometry.setDrawRange(0, ang < 0 ? k : 0);
  };
  return g;
}

function ringLine(r, color, opacity, seg = 220) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * TAU;
    pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(color, opacity));
}

/**
 * 単位円: 円周上の点 P と角 theta から sin / cos / tan を組み立てる。
 * 半径1の円は xy 平面に立てた垂直円（y が高さ、x が cos 側）。
 * 表示上の大きさは radius 倍に掛ける。
 */
export function createUnitCircle(params = {}) {
  const {
    theta = Math.PI / 3,
    theta2 = Math.PI / 2,
    radius = 2.6,
    showSweep = 0,
    showTangent = 0,
    showSecond = 0,
    spin = 0,
    accent = 0x6ee7ff,
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { theta, theta2, radius, showSweep, showTangent, showSecond, spin, accent };
  const anim = new Animated({ theta });

  const C_COS = 0x6ef0c8;
  const C_SIN = 0xffd166;
  const C_TAN = 0xff8fb1;
  let lastTick = -1;

  // ------------------------------------------------------------ 背景
  let grid = null;
  let axes = null;

  function buildBackdrop() {
    if (grid) { group.remove(grid); dropNode(grid); }
    if (axes) { group.remove(axes); dropNode(axes); }
    grid = makeGridPlane({ size: P.radius * 5.2, div: 18, color: 0x2f4a7a, opacity: 0.4 });
    grid.position.y = -P.radius * 1.45;
    group.add(grid);
    parts.grid = grid;
    axes = makeAxes({ size: P.radius * 4.1, ticks: 4, accent: P.accent, labels: ['x', 'y', 'z'] });
    group.add(axes);
    parts.axes = axes;
  }

  // ---------------------------------------------------- 円本体と円弧
  let circle = null;
  let arcGroup = null;
  const unitTick = makePoint(0xffffff, { size: 0.075, halo: 0.5 });

  function buildBody() {
    if (circle) { group.remove(circle); dropNode(circle); }
    circle = new THREE.Group();
    circle.add(ringLine(P.radius, P.accent, 0.8));
    circle.add(ringLine(P.radius, 0xffffff, 0.12, 72));
    unitTick.position.set(P.radius, 0, 0);
    circle.add(unitTick);
    group.add(circle);
    parts.circle = circle;

    if (arcGroup) { group.remove(arcGroup); dropNode(arcGroup); }
    arcGroup = makeArcPair(P.radius, C_SIN);
    group.add(arcGroup);
    parts.sweepArc = arcGroup;
  }

  // ------------------------------------------------------- 点と垂線
  const pointP = makePoint(0xffffff, { size: 0.14, halo: 1.0 });
  const footX = makePoint(C_COS, { size: 0.1, halo: 0.7 });
  const footZ = new THREE.Group();
  const footZDot = makePoint(C_SIN, { size: 0.1, halo: 0.7 });
  const footZLine = makeSegment(C_SIN, 0.4);
  footZ.add(footZDot, footZLine);
  group.add(pointP, footX, footZ);
  parts.pointP = pointP;
  parts.footX = footX;
  parts.footZ = footZ;

  const arCos = makeRotArrow(C_COS, 0.15, 0.021);
  const arSin = makeRotArrow(C_SIN, 0.15, 0.021);
  const arTan = makeRotArrow(C_TAN, 0.16, 0.024);
  const arRad = makeRotArrow(0xffffff, 0.17, 0.028);
  group.add(arCos.g, arSin.g, arTan.g, arRad.g);
  parts.legCos = arCos.g;
  parts.legSin = arSin.g;
  parts.legTan = arTan.g;
  parts.radius = arRad.g;

  const tangent = makeSegment(0xff9f6e, 0.9);
  group.add(tangent);
  parts.tangent = tangent;

  // 直角三角形の塗り
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const triFill = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({
    color: P.accent, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  }));
  triFill.frustumCulled = false;
  triFill.renderOrder = 1;
  group.add(triFill);
  parts.triFill = triFill;

  // ------------------------------------------- 2つ目の円（角の加算）
  const secondRoot = new THREE.Group();
  const pointP2 = makePoint(0xffffff, { size: 0.12, halo: 0.9 });
  secondRoot.add(pointP2);
  group.add(secondRoot);
  parts.unitCircle2 = secondRoot;
  parts.pointP2 = pointP2;
  let ring2 = null;
  let arc2 = null;

  function buildSecond() {
    if (ring2) { secondRoot.remove(ring2); dropNode(ring2); }
    if (arc2) { secondRoot.remove(arc2); dropNode(arc2); }
    const r2 = P.radius * 0.6;
    secondRoot.position.set(-P.radius * 2.05, 0, 0);
    ring2 = ringLine(r2, 0x8fe8ff, 0.6, 160);
    arc2 = makeArcPair(r2, 0xff9f6e);
    secondRoot.add(ring2, arc2);
  }

  // ------------------------------------------------------------ ラベル
  const labels = new THREE.Group();
  group.add(labels);
  parts.labels = labels;

  const mkLabel = (text, color, h = 0.36) => {
    const l = makeLabel(text, {
      height: h, color, bg: 'rgba(6,10,22,0.72)', border: 'rgba(160,200,255,0.25)',
    });
    labels.add(l);
    return l;
  };
  const lCos = mkLabel('cos θ', '#6ef0c8');
  const lSin = mkLabel('sin θ', '#ffd166');
  const lTan = mkLabel('tan θ', '#ff8fb1');
  const lRad = mkLabel('1 (半径)', '#ffffff', 0.32);
  const lTheta = mkLabel('0°', '#ffffff', 0.5);
  const lOne = mkLabel('1', '#ffffff', 0.3);
  const lVal = mkLabel('', '#eaf6ff', 0.42);
  const lP2 = mkLabel("θ'", '#ff9f6e', 0.42);

  buildBackdrop();
  buildBody();
  buildSecond();

  // ------------------------------------------------------------ 更新
  const deg = (r) => Math.round((r * 180) / Math.PI);
  const f2 = (v) => v.toFixed(2);

  function update(dt, elapsed) {
    const a = anim.update(dt, 6);
    P.theta = a.theta;
    const R = P.radius;
    const ang = P.spin !== 0 ? P.theta + P.spin * elapsed : P.theta;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);

    W.o.set(0, 0, 0);
    W.p.set(ca * R, sa * R, 0.03);
    W.fx.set(ca * R, 0, 0.03);
    W.fz.set(0, sa * R, 0.03);
    pointP.position.copy(W.p);
    footX.position.copy(W.fx);
    footZDot.position.copy(W.fz);
    footZLine.userData.set(W.fz, W.p);

    // tan は cos が 0 に近づくと画面から飛び出すので 2.6 半径で止める
    const lim = R * 2.6;
    const showTan = Math.abs(ca) > 0.08;
    const ty = showTan ? Math.max(-lim, Math.min(lim, (sa / ca) * R)) : 0;
    W.t.set(W.fx.x, ty, 0.03);

    aimArrow(arCos, W.o, W.fx);
    aimArrow(arSin, W.fx, W.p);
    aimArrow(arRad, W.o, W.p);
    if (showTan) aimArrow(arTan, W.fx, W.t);
    else arTan.g.visible = false;

    const tarr = triGeo.attributes.position.array;
    tarr[0] = 0; tarr[1] = 0; tarr[2] = 0;
    tarr[3] = W.fx.x; tarr[4] = W.fx.y; tarr[5] = W.fx.z;
    tarr[6] = W.p.x; tarr[7] = W.p.y; tarr[8] = W.p.z;
    triGeo.attributes.position.needsUpdate = true;

    tangent.visible = P.showTangent > 0.02;
    if (tangent.visible) {
      tangent.userData.set(
        W.u.set(ca * R - sa * R * 0.45, sa * R + ca * R * 0.45, 0.05),
        W.v.set(ca * R + sa * R * 1.8, sa * R - ca * R * 1.8, 0.05),
      );
    }

    arcGroup.visible = P.showSweep > 0.02;
    if (arcGroup.visible) arcGroup.pick(ang);

    // 2つ目の円
    const on2 = P.showSecond > 0.02;
    secondRoot.visible = on2;
    lP2.visible = on2;
    if (on2) {
      const r2 = R * 0.6;
      const a2 = P.theta2 + (P.spin !== 0 ? P.spin * elapsed : 0);
      pointP2.position.set(Math.cos(a2) * r2, Math.sin(a2) * r2, 0.04);
      arc2.pick(a2);
      lP2.position.set(Math.cos(a2) * r2 * 0.6, Math.sin(a2) * r2 * 0.6, 0.12);
      setText(lP2, `θ' = ${deg(a2)}°`);
    }

    // ラベル
    lCos.position.set(W.fx.x * 0.5, -0.46, 0.12);
    lSin.position.set(W.fx.x + 0.62, W.p.y * 0.5, 0.12);
    lRad.position.set(W.p.x * 0.5, W.p.y * 0.5 + 0.4, 0.12);
    lTheta.position.set(Math.cos(ang * 0.5) * R * 0.3, Math.sin(ang * 0.5) * R * 0.3, 0.12);
    lOne.position.set(R, -0.46, 0);
    lVal.position.set(0, -R * 1.95, 0);
    lTan.visible = showTan;
    if (showTan) {
      lTan.position.set(W.fx.x - 0.62, ty * 0.55, 0.12);
      setText(lTan, `tan θ = ${f2(sa / ca)}`);
    }
    setText(lCos, `cos θ = ${f2(ca)}`);
    setText(lSin, `sin θ = ${f2(sa)}`);
    setText(lTheta, `${deg(ang)}°`);

    // 数字の更新は毎秒 3 回だけ（ラベルのテクスチャ生成を抑える）
    const tick = Math.floor(elapsed * 3);
    if (tick !== lastTick) {
      lastTick = tick;
      setText(lVal, `θ = ${deg(ang)}°    sin = ${f2(sa)}    cos = ${f2(ca)}    tan = ${showTan ? f2(sa / ca) : '—'}`);
    }
  }

  function setParams(patch) {
    if (patch.radius != null && Math.abs(patch.radius - P.radius) > 1e-6) {
      P.radius = patch.radius;
      buildBackdrop();
      buildBody();
      buildSecond();
    }
    if (patch.theta != null) { P.theta = patch.theta; anim.to({ theta: patch.theta }); }
    if (patch.theta2 != null) P.theta2 = patch.theta2;
    if (patch.accent != null) P.accent = patch.accent;
    if (patch.showSweep != null) P.showSweep = patch.showSweep;
    if (patch.showTangent != null) P.showTangent = patch.showTangent;
    if (patch.showSecond != null) P.showSecond = patch.showSecond;
    if (patch.spin != null) P.spin = patch.spin;
  }

  function dispose() { disposeObject(group); }

  return { group, parts, params: P, setParams, update, dispose };
}
