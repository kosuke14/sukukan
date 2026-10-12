import * as THREE from 'three';
import { disposeObject, lineBasic } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { TAU, clamp, ease } from '../engine/MathUtil.js';
import { makeArrow, makeCurve, makePoint } from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _mid = new THREE.Vector3();
const TARGET = 11.5;
const TUBULAR = 140;
const RADIAL = 8;

/** 全周分を用意し、drawRange で 0 から t までを切り出す円弧。 */
function makeArc(r, color, radius = 0.06) {
  const pts = [];
  for (let i = 0; i <= TUBULAR; i++) {
    const t = (i / TUBULAR) * TAU;
    pts.push(V(Math.cos(t) * r, Math.sin(t) * r, 0));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), TUBULAR, radius, RADIAL, false);
  geo.setDrawRange(0, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.frustumCulled = false;
  m.pick = (t) => { m.geometry.setDrawRange(0, Math.floor((clamp(t, 0, TAU) / TAU) * TUBULAR) * RADIAL * 6); };
  m.pick(TAU);
  return m;
}

function seedRand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * 実数直線を 3D に置いて絶対値・平方根・不等式・有理数を表す。
 * 数直線は x 軸、その上にグラフ・区間・弧を描く。
 */
export function createNumberLine(params = {}) {
  const {
    mode = 'abs',
    value = 3,
    from = -6,
    to = 6,
    a = 1,
    b = 4,
    strict = 0,
    accent = 0x6ee7ff,
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { mode, value, from, to, a, b, strict, accent };

  const C_LEFT = 0x8fe8ff;
  const C_RIGHT = 0xffd166;
  const C_TRUE = 0x6ef0c8;
  const C_FALSE = 0xff8fb1;

  const stage = new THREE.Group();
  group.add(stage);

  const mk = (name) => {
    const g = new THREE.Group();
    stage.add(g);
    if (name) parts[name] = g;
    return g;
  };
  const axisLine = mk('axisLine');
  const ticks = mk('ticks');
  const tickLabels = mk('tickLabels');
  const marker = mk('marker');
  const bar = mk('bar');
  const sqrtCurve = mk('sqrtCurve');
  const areaLeft = mk('areaLeft');
  const areaRight = mk('areaRight');
  const bracket = mk('bracket');
  const solutionDots = mk('solutionDots');
  const jump = mk('jump');

  const allParts = [axisLine, ticks, tickLabels, marker, bar, sqrtCurve, areaLeft, areaRight,
    bracket, solutionDots, jump];

  const lbl = (s, { height = 0.42, color = '#eaf6ff' } = {}) => {
    const sp = makeLabel(s, { height, color, bg: 'rgba(6,10,22,0.72)', border: 'rgba(150,190,255,0.22)' });
    sp.position.set(0, 0, 0);
    return sp;
  };
  const put = (g, sprite, x, y, z = 0) => { sprite.position.set(x, y, z); g.add(sprite); return sprite; };

  /** 立ち上がる多角形（xy 平面）。 */
  function wall(g, pts, color, opacity) {
    const pos = [];
    for (const p of pts) pos.push(p.x, p.y, p.z);
    const idx = [];
    for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
    })));
    return geo;
  }

  /** 数直線に沿った縦の長方形（x0 から x1、高さ h）。 */
  function band(g, x0, x1, h, color, opacity) {
    const w = Math.max(Math.abs(x1 - x0), 1e-4);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.position.set((x0 + x1) / 2, h / 2 + 0.02, 0);
    g.add(m);
  }

  function frameLayout() {
    stage.scale.setScalar(1);
    stage.position.set(0, 0, 0);
    _box.makeEmpty();
    _box.setFromObject(stage);
    if (_box.isEmpty()) return;
    _box.getSize(_size);
    _box.getCenter(_mid);
    const k = clamp(TARGET / Math.max(_size.x, 0.001), 0.2, 2.4);
    stage.scale.setScalar(k);
    stage.position.set(-_mid.x * k, -_mid.y * k, 0);
  }

  // ------------------------------------------------------------ 骨架
  function buildAxis() {
    const f = P.from;
    const t = P.to;
    const pad = (t - f) * 0.04;
    axisLine.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      V(f - pad, 0, 0), V(t + pad, 0, 0)]), lineBasic(0xffffff, 0.85)));
    axisLine.add(makeArrow(V(f - pad, 0, 0), V(t + pad + 0.2, 0, 0), { color: 0xffffff, headSize: 0.18, shaft: 0.022 }));
    axisLine.add(makeArrow(V(t + pad, 0, 0), V(f - pad - 0.2, 0, 0), { color: 0xffffff, headSize: 0.18, shaft: 0.022 }));
    const zero = makePoint(0xffffff, { size: 0.09, halo: 0.6 });
    zero.position.set(0, 0, 0);
    axisLine.add(zero);

    const step = (t - f) > 26 ? 5 : 1;
    const pos = [];
    for (let v = Math.ceil(f / step) * step; v <= t; v += step) {
      const long = Math.abs(v % 5) < 1e-6 || step !== 1;
      pos.push(v, 0, 0, v, -0.26, 0, v, 0, 0, v, long ? 0.2 : 0.12, 0);
      if (v !== 0) put(tickLabels, lbl(String(v), { height: 0.4, color: '#cfe0ff' }), v, -0.85, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ticks.add(new THREE.LineSegments(geo, lineBasic(0xbcd4ff, 0.55)));
    put(tickLabels, lbl('0', { height: 0.44 }), 0, -0.85, 0);
  }

  function buildMarker() {
    const v = P.value;
    const dot = makePoint(0xffffff, { size: 0.12, halo: 0.9 });
    dot.position.set(v, 0, 0.1);
    marker.add(dot);
    marker.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(v, 0, 0), V(v, 1.15, 0)]),
      lineBasic(0xffffff, 0.4)));
    put(marker, lbl(`${v}`, { height: 0.46 }), v, 1.45, 0);
  }

  // -------------------------------------------------------------- abs
  function buildAbs() {
    const v = P.value;
    const u = Math.abs(v);
    // 折れ線 y = |x| と柱
    bar.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      V(P.from, Math.abs(P.from), 0), V(P.to, Math.abs(P.to), 0),
    ]), lineBasic(P.accent, 0.95)));
    const lo = Math.floor(P.from);
    const hi = Math.floor(P.to);
    for (let i = lo; i <= hi; i++) {
      if (i === 0) continue;
      const h = Math.abs(i);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.72, h), new THREE.MeshBasicMaterial({
        color: P.accent, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false,
      }));
      m.position.set(i, h / 2, 0);
      bar.add(m);
    }
    put(bar, lbl('y = |x|', { height: 0.46, color: '#6ee7ff' }), P.to * 0.8, P.to * 0.8 + 0.55, 0);
    // 左右の距離（面積として表す）
    wall(areaLeft, [V(0, 0, 0), V(-u, 0, 0), V(-u, u, 0)], C_LEFT, 0.24);
    wall(areaRight, [V(0, 0, 0), V(u, 0, 0), V(u, u, 0)], C_RIGHT, 0.24);
    for (const s of [-1, 1]) {
      const g = s < 0 ? areaLeft : areaRight;
      const a = V(0, 0.4, 0.1);
      const b = V(s * u, 0.4, 0.1);
      g.add(makeArrow(a, b, { color: s < 0 ? C_LEFT : C_RIGHT, headSize: 0.16, shaft: 0.02 }));
      g.add(makeArrow(b, a, { color: s < 0 ? C_LEFT : C_RIGHT, headSize: 0.16, shaft: 0.02 }));
      put(g, lbl(`|x| = ${u.toFixed(2)}`, { height: 0.44, color: s < 0 ? '#8fe8ff' : '#ffd166' }),
        (s * u) / 2, 0.95, 0);
    }
    // 跳ぶ弧
    const hop = makeArc(u / 2 + 1e-3, C_RIGHT, 0.05);
    hop.position.set(v / 2, 0, 0);
    jump.add(hop);
    const ball = makePoint(0xffffff, { size: 0.1, halo: 0.8 });
    jump.add(ball);
    jump.userData = { ball, v };
  }

  // ------------------------------------------------------------- sqrt
  function buildSqrt() {
    const v = Math.max(0, P.value);
    const top = Math.max(0.6, Math.min(P.to, v || 1));
    sqrtCurve.add(makeCurve((t) => V(t * top, Math.sqrt(t * top), 0),
      { samples: 90, color: C_TRUE, glow: true, glowWidth: 0.05 }));
    put(sqrtCurve, lbl('y = √x', { height: 0.46, color: '#6ef0c8' }), top * 0.5, Math.sqrt(top * 0.5) + 0.55, 0);
    band(areaLeft, P.from, 0, Math.max(0.2, Math.sqrt(Math.max(-P.from, 0)) * 0.5), C_LEFT, 0.16);
    band(areaRight, 0, v, Math.max(0.2, Math.sqrt(v) * 0.5), C_RIGHT, 0.16);

    // 単位円上の弧。弧の長さが √a を表す
    const R = Math.max(0.8, (P.to - P.from) * 0.16);
    const base = Math.max(1.2, P.to * 0.5);
    const ringPts = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * TAU;
      ringPts.push(V(Math.cos(t) * R, base + Math.sin(t) * R, 0));
    }
    jump.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), lineBasic(0xffffff, 0.2)));
    const arc = makeArc(R, C_RIGHT, 0.055);
    arc.position.set(0, base, 0);
    arc.pick(Math.sqrt(v));
    jump.add(arc);
    jump.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, base, 0), V(R, base, 0)]),
      lineBasic(0xffffff, 0.5)));
    const end = Math.sqrt(v);
    jump.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      V(0, base, 0), V(Math.cos(end) * R, base + Math.sin(end) * R, 0)]), lineBasic(0xffffff, 0.75)));
    const tip = makePoint(C_RIGHT, { size: 0.1, halo: 0.8 });
    tip.position.set(Math.cos(end) * R, base + Math.sin(end) * R, 0.05);
    jump.add(tip);
    put(jump, lbl(`半径1の円弧、長さ √${v.toFixed(2)}`, { height: 0.44, color: '#ffd166' }),
      R + 0.4, base + R * 0.4, 0);
  }

  // ------------------------------------------------------- inequality
  function buildInequality() {
    const { a, b } = P;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const empty = a > b;
    const open = P.strict > 0.5;
    band(areaLeft, P.from, lo, 0.5, C_FALSE, 0.13);
    band(areaRight, hi, P.to, 0.5, C_FALSE, 0.13);
    if (!empty) {
      band(bracket, a, b, 0.74, C_TRUE, 0.32);
      bracket.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(a, 0.76, 0), V(b, 0.76, 0)]),
        lineBasic(C_TRUE, 0.95)));
      for (const [x, dir] of [[a, 1], [b, -1]]) {
        bracket.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          V(x - dir * 0.18, 0.95, 0), V(x, 0.95, 0), V(x, 1.3, 0), V(x - dir * 0.18, 1.3, 0),
        ]), lineBasic(0xffffff, 0.9)));
      }
      put(bracket, lbl(open ? `${a} < x < ${b}` : `${a} ≤ x ≤ ${b}`, { height: 0.48, color: '#6ef0c8' }),
        (a + b) / 2, 1.75, 0);
      if (a < P.from || b > P.to) {
        put(bracket, lbl('数直線の外まで続く', { height: 0.4, color: '#ff8fb1' }), (a + b) / 2, 1.15, 0);
      }
    } else {
      put(bracket, lbl('解なし（空集合）', { height: 0.5, color: '#ff8fb1' }), (a + b) / 2, 1.15, 0);
    }
    for (const x of [a, b]) {
      if (!empty && open) {
        const r = 0.16;
        const pts = [];
        for (let i = 0; i <= 28; i++) {
          const t = (i / 28) * TAU;
          pts.push(V(x + Math.cos(t) * r, Math.sin(t) * r, 0));
        }
        solutionDots.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(0xffffff, 0.95)));
      } else {
        const d = makePoint(empty ? C_FALSE : C_TRUE, { size: empty ? 0.1 : 0.13, halo: empty ? 0.4 : 0.9 });
        d.position.set(x, 0, 0.06);
        solutionDots.add(d);
      }
      put(solutionDots, lbl(`${x}`, { height: 0.42 }), x, -1.45, 0);
    }
  }

  // -------------------------------------------------------- rational
  function buildRational() {
    const v = P.value;
    const irr = Math.abs(Math.sqrt(Math.abs(v)) % 1) > 1e-9 && v >= 0;
    const W = (P.to - P.from) * 0.3;
    const zoom = Math.max(P.to * 0.62, 2.2);
    const toStrip = (x) => ((x - v) / (W / 6)) * (W / 2) + v;

    band(areaLeft, P.from, v, 0.3, C_LEFT, 0.12);
    band(areaRight, v, P.to, 0.3, C_RIGHT, 0.12);
    // 有理数が v へ集まっていく
    const rnd = seedRand(20250929);
    const dots = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({ color: C_LEFT, transparent: true, opacity: 0.9 }),
      48
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 48; i++) {
      const k = (i % 12) / 12;
      dummy.position.set(v - (k * k + 0.02) * (W / 5) * (0.4 + rnd() * 0.6), 0.4 + (i % 4) * 0.13, (rnd() - 0.5) * 0.3);
      dummy.updateMatrix();
      dots.setMatrixAt(i, dummy.matrix);
    }
    areaLeft.add(dots);
    put(areaLeft, lbl('有理数', { height: 0.46, color: '#8fe8ff' }), v - W * 0.55, 1.1, 0);
    const ip = makePoint(C_RIGHT, { size: 0.13, halo: 1.0 });
    ip.position.set(v, 0.55, 0.06);
    areaRight.add(ip);
    put(areaRight, lbl(irr ? '無理数' : '有理数', { height: 0.46, color: '#ffd166' }), v + W * 0.4, 1.1, 0);

    // 小数点以下の拡大
    const y0 = zoom - 1.2;
    bracket.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(v - W, y0, 0), V(v + W, y0, 0)]),
      lineBasic(0xffffff, 0.75)));
    bracket.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(v, 0.3, 0), V(v, y0 - 0.3, 0)]),
      lineBasic(0xffffff, 0.28)));
    const pos = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const x = v - W + (W * 2 * i) / N;
      pos.push(x, y0, 0, x, y0 - (i % 5 === 0 ? 0.5 : 0.28), 0);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bracket.add(new THREE.LineSegments(tg, lineBasic(0x9fc2ff, 0.45)));
    const dq = makePoint(C_LEFT, { size: 0.1, halo: 0.7 });
    dq.position.set(toStrip(v - W / 60), y0, 0.05);
    bracket.add(dq);
    const dr = makePoint(0xffffff, { size: 0.12, halo: 1.0 });
    dr.position.set(v, y0, 0.05);
    bracket.add(dr);
    put(bracket, lbl('打ち切った小数 = 有理数', { height: 0.4, color: '#8fe8ff' }), v - W * 0.55, y0 + 0.6, 0);
    put(bracket, lbl(`√${v} = ${irr ? '無理数' : '有理数'}`, { height: 0.4, color: '#ffd166' }), v + W * 0.5, y0 + 0.6, 0);
    for (const s of [-1, 1]) {
      jump.add(makeArrow(V(v + s * W * 0.85, y0, 0), V(v + s * W * 0.13, y0, 0),
        { color: C_FALSE, headSize: 0.14, shaft: 0.016 }));
    }
    put(jump, lbl('近づいても届かない', { height: 0.4, color: '#ff8fb1' }), v, y0 - 1, 0);
  }

  function rebuild() {
    for (const g of allParts) {
      while (g.children.length) disposeObject(g.children.pop());
      g.userData = {};
    }
    if (P.to <= P.from) { const t = P.to; P.to = P.from; P.from = t; }
    buildAxis();
    buildMarker();
    if (P.mode === 'sqrt') buildSqrt();
    else if (P.mode === 'inequality') buildInequality();
    else if (P.mode === 'rational') buildRational();
    else buildAbs();
    frameLayout();
  }

  function setParams(patch) {
    let dirty = false;
    for (const k of ['mode', 'value', 'from', 'to', 'a', 'b', 'strict', 'accent']) {
      if (patch[k] != null && patch[k] !== P[k]) { P[k] = patch[k]; dirty = true; }
    }
    if (dirty) rebuild();
  }

  let clock = 0;
  function update(dt) {
    clock += dt;
    const u = jump.userData;
    if (P.mode !== 'abs' || !u.ball || Math.abs(u.v) < 1e-3) return;
    const r = Math.abs(u.v) / 2;
    const t = (clock * 0.5) % 1;
    const e = ease.inOutQuad(t);
    const sx = u.v >= 0 ? 1 : -1;
    u.ball.position.set(sx * r * (1 - Math.cos(Math.PI * e)), r * Math.sin(Math.PI * e) + 0.1, 0);
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
