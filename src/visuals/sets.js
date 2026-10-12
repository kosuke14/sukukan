import * as THREE from 'three';
import { disposeObject, lineBasic } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { TAU, clamp } from '../engine/MathUtil.js';
import { makeArrow, makeGridPlane } from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _mid = new THREE.Vector3();
const TARGET = 11.5;
const MAX_BALLS = 64;

function seedRand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function fillPoly(g, pts, { color, opacity, edge = null, y = 0.02 }) {
  const pos = [];
  for (const p of pts) pos.push(p.x, y, p.y);
  const idx = [];
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  })));
  if (edge) {
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      pts.map((p) => V(p.x, y + 0.01, p.y))), lineBasic(edge, 0.7)));
  }
}

/** 2 円の重なり(レンズ)か、片側だけ(月の形)の境界。xy 平面で計算し、xz へ貼る。 */
function regionPoly(c1, r1, c2, r2, which) {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  if (d < 1e-6 || d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const h = Math.sqrt(Math.max(r1 * r1 - a * a, 0));
  const beta = Math.atan2(h, a);
  const gam = Math.atan2(h, a - d);
  const pts = [];
  const N = 44;
  const arc = (c, r, t0, t1) => {
    for (let i = 0; i <= N; i++) {
      const t = t0 + ((t1 - t0) * i) / N;
      pts.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r });
    }
  };
  if (which === 'both') {
    arc(c1, r1, -beta, beta);
    arc(c2, r2, gam, TAU - gam);
  } else {
    arc(c1, r1, beta, TAU - beta);
    arc(c2, r2, TAU - gam, gam);
  }
  return pts;
}

function discPoly(c, r, seg = 96) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * TAU;
    pts.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r });
  }
  return pts;
}

function fillRing(g, c, r0, r1, { color, opacity, y = 0.02, seg = 96 }) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * TAU;
    pos.push(c.x + Math.cos(t) * r0, y, c.y + Math.sin(t) * r0);
    pos.push(c.x + Math.cos(t) * r1, y, c.y + Math.sin(t) * r1);
  }
  for (let i = 0; i < seg; i++) {
    const o = i * 2;
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  })));
}

function ringLine(g, c, r, color, opacity, y = 0.03, seg = 120) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * TAU;
    pts.push(V(c.x + Math.cos(t) * r, y, c.y + Math.sin(t) * r));
  }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(color, opacity)));
}

function inPoly(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * 集合を 3 つの円で描き、包除原理と命題（p→q と対偶）を示す。
 * a は p の半径、b は q の半径。
 * implication / contrapositive は同心の 2 円。a ≤ b なら p ⊆ q で p→q は真。
 */
export function createSets(params = {}) {
  const { mode = 'venn', a = 3.0, b = 2.0, accent = 0x6ee7ff } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { mode, a, b, accent };

  const C_A = 0x6ee7ff;
  const C_B = 0xffd166;
  const C_U = 0x2a4a80;
  const C_BOTH = 0x6ef0c8;
  const C_BAD = 0xff6b9d;
  const C_TRUE = 0x6ef0c8;
  const C_FALSE = 0xff6b9d;

  const stage = new THREE.Group();
  group.add(stage);

  const grid = makeGridPlane({ size: 26, div: 26, color: 0x24406f, opacity: 0.3 });
  grid.position.y = -0.02;
  group.add(grid);
  parts.grid = grid;

  const mk = (name, parent = stage) => {
    const g = new THREE.Group();
    parent.add(g);
    if (name) parts[name] = g;
    return g;
  };
  const venn = mk('venn');
  const circleA = mk(null, venn);
  const circleB = mk(null, venn);
  const circleU = mk(null, venn);
  parts.circleA = circleA;
  parts.circleB = circleB;
  parts.circleU = circleU;
  const dots = mk('dots');
  const regions = mk('regions');
  const table = mk('table');
  const arrow = mk('arrow');
  const pLabel = mk('pLabel');
  const qLabel = mk('qLabel');
  const truthGrid = mk('truthGrid');

  const allParts = [venn, circleA, circleB, circleU, dots, regions, table, arrow, pLabel, qLabel, truthGrid];

  const lbl = (s, { height = 0.44, color = '#eaf6ff' } = {}) => makeLabel(s, {
    height, color, bg: 'rgba(6,10,22,0.78)', border: 'rgba(150,190,255,0.22)',
  });
  const put = (g, sprite, x, y, z) => { sprite.position.set(x, y, z); g.add(sprite); return sprite; };

  function frameLayout() {
    stage.scale.setScalar(1);
    stage.position.set(0, 0, 0);
    _box.makeEmpty();
    _box.setFromObject(stage);
    if (_box.isEmpty()) return;
    _box.getSize(_size);
    _box.getCenter(_mid);
    const k = clamp(TARGET / Math.max(_size.x, 0.001), 0.3, 1.6);
    stage.scale.setScalar(k);
    stage.position.set(-_mid.x * k, -_mid.y * k, 0);
  }

  // ------------------------------------------------------------ 点玉
  function ballGroup(g, color, n, pick) {
    const inst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({
        color, emissive: new THREE.Color(color), emissiveIntensity: 0.4, roughness: 0.35,
      }),
      MAX_BALLS
    );
    const rnd = seedRand(0x5eed);
    const d = new THREE.Object3D();
    let k = 0;
    for (let guard = 0; k < n && guard < n * 40; guard++) {
      const p = pick(rnd);
      if (!p) continue;
      d.position.set(p.x, 0.17, p.y);
      d.updateMatrix();
      inst.setMatrixAt(k++, d.matrix);
    }
    inst.count = k;
    g.add(inst);
    return inst;
  }

  /** 指定した領域からランダムな平面点を 1 つ返す関数を返す。 */
  function sampler(test) {
    return (rnd) => {
      for (let i = 0; i < 40; i++) {
        const t = rnd() * TAU;
        const rr = Math.sqrt(rnd());
        const p = { x: Math.cos(t) * rr, y: Math.sin(t) * rr };
        if (test(p)) return p;
      }
      return null;
    };
  }

  function rebuild() {
    for (const g of allParts) {
      while (g.children.length) disposeObject(g.children.pop());
      g.userData = {};
    }
    const ra = Math.max(0.5, P.a);
    const rb = Math.max(0.5, P.b);
    const concentric = P.mode !== 'venn';
    const d = concentric ? 0 : (ra + rb) * 0.58;
    const cA = { x: -d / 2, y: 0 };
    const cB = { x: d / 2, y: 0 };
    const cU = { x: 0, y: 0 };
    const rU = Math.max(ra, rb) + d / 2 + 0.8;
    const sub = concentric && ra <= rb + 1e-6;

    // 円
    ringLine(circleU, cU, rU, 0x8fa8e0, 0.55);
    ringLine(circleA, cA, ra, C_A, 0.9);
    ringLine(circleB, cB, rb, C_B, 0.9);
    put(circleU, lbl('U（もとの集合）', { height: 0.46, color: '#cfe0ff' }), 0, 0.5, -rU * 0.88);
    put(pLabel, lbl('p が成り立つ', { height: 0.5, color: '#6ee7ff' }), cA.x, 0.62, -ra * 0.62);
    put(qLabel, lbl('q が成り立つ', { height: 0.5, color: '#ffd166' }), cB.x, 1.28, -rb * 0.62);

    // 領域
    fillPoly(regions, discPoly(cU, rU), { color: C_U, opacity: 0.16 });
    fillPoly(regions, discPoly(cA, ra), { color: C_A, opacity: 0.18 });
    fillPoly(regions, discPoly(cB, rb), { color: C_B, opacity: 0.18 });

    if (concentric) {
      // 同心: 小さい方が共通部分、大きい方が余り
      const rMin = Math.min(ra, rb);
      const rMax = Math.max(ra, rb);
      fillPoly(regions, discPoly(cA, rMin), { color: C_BOTH, opacity: 0.24, edge: C_BOTH });
      if (rMax > rMin + 1e-6) {
        fillRing(regions, cA, rMin, rMax, { color: sub ? C_B : C_BAD, opacity: sub ? 0.2 : 0.4 });
      }
      ballGroup(dots, C_BOTH, 7, sampler((p) => Math.hypot(p.x, p.y) < rMin / rU));
      if (sub) ballGroup(dots, C_B, 5, sampler((p) => {
        const r = Math.hypot(p.x, p.y);
        return r > rMin / rU && r < rMax / rU;
      }));
      else {
        ballGroup(dots, C_BAD, 5, sampler((p) => {
          const r = Math.hypot(p.x, p.y);
          return r > rMin / rU && r < rMax / rU;
        }));
        put(dots, lbl('反例', { height: 0.48, color: '#ff6b9d' }), rMax * 0.72, 0.5, -rMax * 0.72);
      }
      ballGroup(dots, 0x9fc2ff, 6, sampler((p) => Math.hypot(p.x, p.y) > rMax / rU));
    } else {
      const lens = regionPoly(cA, ra, cB, rb, 'both');
      const onlyA = regionPoly(cA, ra, cB, rb, 'only');
      if (lens) fillPoly(regions, lens, { color: C_BOTH, opacity: 0.32, edge: C_BOTH });
      const toWorld = (c, r) => (p) => {
        const x = c.x + p.x * rU;
        const y = c.y + p.y * rU;
        const insideA = Math.hypot(x - cA.x, y - cA.y) < ra;
        const insideB = Math.hypot(x - cB.x, y - cB.y) < rb;
        return insideA !== insideB;
      };
      ballGroup(dots, C_A, 6, sampler(toWorld(cA, rU)));
      ballGroup(dots, C_B, 6, sampler(toWorld(cB, rU)));
      if (lens) ballGroup(dots, C_BOTH, 7, sampler((p) => {
        const x = p.x * rU;
        const y = p.y * rU;
        return inPoly(lens, x, y);
      }));
      if (onlyA) ballGroup(dots, C_B, 3, sampler((p) => inPoly(onlyA, p.x * rU, p.y * rU)));
      ballGroup(dots, 0x9fc2ff, 6, sampler((p) => {
        const x = p.x * rU;
        const y = p.y * rU;
        return Math.hypot(x - cA.x, y - cA.y) >= ra && Math.hypot(x - cB.x, y - cB.y) >= rb;
      }));
      put(dots, lbl('共通部分', { height: 0.48, color: '#6ef0c8' }),
        (cA.x + cB.x) / 2, 0.5, (cA.y + cB.y) / 2 + Math.max(ra, rb) * 0.28);
    }

    if (P.mode === 'venn') {
      put(table, lbl('共通部分に点が集まる', { height: 0.52, color: '#6ef0c8' }), 0, 0.5, rU + 1.5);
      frameLayout();
      return;
    }
    buildTable(sub, rU);
    buildArrow(ra, rb, sub);
    frameLayout();
  }

  // ---------------------------------------------------------- 真偽表
  function buildTable(sub, rU) {
    const withContra = P.mode === 'contrapositive';
    const cols = withContra ? 4 : 3;
    const z = -(rU + 1.6);
    const xs = [];
    for (let i = 0; i < cols; i++) xs.push((i - (cols - 1) / 2) * 1.6);
    const heads = withContra ? ['p', 'q', 'p → q', '¬q → ¬p'] : ['p', 'q', 'p → q'];
    const rows = [
      ['真', '真', '真', '真'],
      ['真', '偽', '偽', '偽'],
      ['偽', '真', '真', '真'],
      ['偽', '偽', '真', '真'],
    ];
    heads.forEach((h, i) => put(table, lbl(h, { height: 0.48 }), xs[i], 2.3, z));
    rows.forEach((row, ri) => {
      const y = 1.25 - ri * 0.9;
      for (let ci = 0; ci < cols; ci++) {
        const good = row[ci] === '真';
        const cell = new THREE.Mesh(
          new THREE.PlaneGeometry(1.3, 0.7),
          new THREE.MeshBasicMaterial({
            color: good ? C_TRUE : C_FALSE, transparent: true, opacity: good ? 0.14 : 0.36,
            side: THREE.DoubleSide, depthWrite: false,
          })
        );
        cell.position.set(xs[ci], y, z - 0.02);
        truthGrid.add(cell);
        truthGrid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
          V(xs[ci] - 0.65, y - 0.35, z - 0.01), V(xs[ci] + 0.65, y - 0.35, z - 0.01),
          V(xs[ci] + 0.65, y + 0.35, z - 0.01), V(xs[ci] - 0.65, y + 0.35, z - 0.01),
        ]), lineBasic(0xbcd4ff, 0.4)));
        put(table, lbl(row[ci], { height: 0.44, color: good ? '#6ef0c8' : '#ff8fb1' }), xs[ci], y, z);
      }
    });
    if (withContra) {
      put(table, lbl('2 列目と 3 列目は必ず一致', { height: 0.46, color: '#9fc2ff' }), 0, -2.2, z);
    }
    put(table, lbl(sub ? 'p ⊆ q なので p → q は真' : 'p ⊄ q なので p → q は偽',
      { height: 0.5, color: sub ? '#6ef0c8' : '#ff8fb1' }), 0, -1.55, z);
  }

  // -------------------------------------------------------- 含意の矢印
  function buildArrow(ra, rb, sub) {
    const from = V(Math.min(ra, rb) * 0.45, 0.4, 0);
    const to = V(Math.min(ra, rb) * 0.45 + (rb - ra) * 0.85, 0.4, 0);
    if (Math.abs(to.x - from.x) > 0.4) {
      arrow.add(makeArrow(from, to, { color: sub ? C_TRUE : C_BAD, headSize: 0.2, shaft: 0.028 }));
    }
    put(arrow, lbl(sub ? 'p → q' : 'p → q（偽）', { height: 0.54, color: sub ? '#6ef0c8' : '#ff8fb1' }),
      (from.x + to.x) / 2, 1.0, 0);
    if (P.mode === 'contrapositive') {
      const f2 = V(-Math.min(ra, rb) * 0.62, 0.4, 0);
      const t2 = V(f2.x - (rb - ra) * 0.85, 0.4, 0);
      if (Math.abs(t2.x - f2.x) > 0.4) {
        arrow.add(makeArrow(f2, t2, { color: 0x9fc2ff, headSize: 0.2, shaft: 0.028 }));
      }
      put(arrow, lbl('¬q → ¬p', { height: 0.5, color: '#9fc2ff' }), f2.x - 0.4, 1.0, 0);
    }
  }

  function setParams(patch) {
    let dirty = false;
    for (const k of ['mode', 'a', 'b', 'accent']) {
      if (patch[k] != null && patch[k] !== P[k]) { P[k] = patch[k]; dirty = true; }
    }
    if (dirty) rebuild();
  }

  let clock = 0;
  function update(dt) {
    clock += dt;
    if (!arrow.children.length) return;
    const s = 1 + 0.04 * Math.sin(clock * 2.2);
    arrow.scale.set(s, s, s);
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
