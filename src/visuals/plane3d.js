import * as THREE from 'three';
import { disposeObject, lineBasic } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, TAU } from '../engine/MathUtil.js';
import { makeGridPlane, makePoint } from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _mid = new THREE.Vector3();
const TARGET = 11.5;

function clearGroup(g) {
  while (g.children.length) disposeObject(g.children.pop());
}

/** 平面図(床上)へ写すマッパーと、立てた立体図へのマッパー。 */
function mapper(flat) {
  return flat ? (x, y) => V(x, 0, y) : (x, y) => V(x, y, 0);
}

/**
 * 平面三角形と円を「2 面図(床上)」と「立体図(たてた面)」で並べる。
 * 三角形は A(0,0), B(a,0), C=b(cosθ, sinθ) を基本形とし、
 * 円の図形は外接円（半径 c / 2sinθ）を使う。
 */
export function createPlane3D(params = {}) {
  const { shape = 'triangle', a = 3, b = 2.5, c = 0, theta = 50, animate = true, accent = 0x6ee7ff } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { shape, a, b, c, theta, animate, accent };

  const C_SIDE = 0x6ee7ff;
  const C_CTR = 0xffd166;

  const stage = new THREE.Group();
  group.add(stage);

  const grid = makeGridPlane({ size: 26, div: 26, color: 0x24406f, opacity: 0.32 });
  grid.position.y = -0.02;
  group.add(grid);
  parts.grid = grid;

  /** 2 面図(床) と 立体図(縦) の 2 つのビューを作る。 */
  function view(name, flat) {
    const g = new THREE.Group();
    if (flat) g.position.set(0, 0.02, 0);
    else { g.position.set(0, 0, 0); g.rotation.y = -0.34; }
    stage.add(g);
    if (name) parts[name] = g;
    return g;
  }

  const shape3d = view('shape3d', false);
  const shapeFlat = view('shapeFlat', true);
  const circle3d = view('circle3d', false);
  const circleFlat = view('circleFlat', true);
  const cevian = view('cevian', false);
  const cevianFlat = view(null, true);
  const points = view('points', false);
  const pointsFlat = view(null, true);
  const angles = view('angles', false);
  const anglesFlat = view(null, true);
  const centers = view('centerPoints', false);
  const centersFlat = view(null, true);
  const marks = view('equalMarks', false);
  const marksFlat = view(null, true);
  const labels = view('labels', false);
  const labelsFlat = view(null, true);
  const tangent = view('tangent', false);
  const tangentFlat = view(null, true);
  const chord = view('chord', false);
  const chordFlat = view(null, true);

  const allViews = [shape3d, shapeFlat, circle3d, circleFlat, cevian, cevianFlat, points, pointsFlat,
    angles, anglesFlat, centers, centersFlat, marks, marksFlat, labels, labelsFlat,
    tangent, tangentFlat, chord, chordFlat];

  // 2 つのビューを左右に並べる
  let spread = 0;

  // ------------------------------------------------------------ 道具
  function poly(g, flat, pts, { color = C_SIDE, opacity = 0.24, edge = color, edgeOpacity = 0.9 } = {}) {
    const m = mapper(flat);
    const arr = pts.map((p) => m(p.x, p.y));
    const pos = [];
    for (const p of arr) pos.push(p.x, p.y, p.z);
    const idx = [];
    for (let i = 1; i < arr.length - 1; i++) idx.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
    })));
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(arr), lineBasic(edge, edgeOpacity)));
  }

  function seg(g, flat, a2, b2, color = C_SIDE, opacity = 0.9) {
    const m = mapper(flat);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([m(a2.x, a2.y), m(b2.x, b2.y)]),
      lineBasic(color, opacity)));
  }

  function ring(g, flat, c2, r, color, opacity = 0.9, a0 = 0, a1 = TAU, seg = 96) {
    const m = mapper(flat);
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const t = a0 + (a1 - a0) * (i / seg);
      pts.push(m(c2.x + Math.cos(t) * r, c2.y + Math.sin(t) * r));
    }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(color, opacity));
    g.add(l);
    return l;
  }

  function dot(g, flat, p2, color = 0xffffff, size = 0.1) {
    const m = mapper(flat);
    const d = makePoint(color, { size, halo: 0.7 });
    d.position.copy(m(p2.x, p2.y));
    g.add(d);
    return d;
  }

  function text(g, flat, str, p2, { height = 0.42, color = '#eaf6ff' } = {}) {
    const m = mapper(flat);
    const s = makeLabel(str, {
      height, color, bg: 'rgba(6,10,22,0.72)', border: 'rgba(150,190,255,0.22)',
    });
    s.position.copy(m(p2.x, p2.y)).add(flat ? V(0, 0.5, 0) : V(0, 0, 0.1));
    g.add(s);
    return s;
  }

  // 辺の上に等しいことを示す短い目盛
  function tick(g, flat, a2, b2, n, color = 0xffffff) {
    const m = mapper(flat);
    const dx = b2.x - a2.x, dy = b2.y - a2.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const cx = a2.x + dx * t, cy = a2.y + dy * t;
      const h = 0.11;
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        m(cx - nx * h, cy - ny * h), m(cx + nx * h, cy + ny * h),
      ]), lineBasic(color, 0.8)));
    }
  }

  function labelBoth(name, str, p2, opts) {
    text(labels, false, str, p2, opts);
    text(labelsFlat, true, str, p2, opts);
  }

  function sideLabels(pts, names) {
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      const n = { x: -(q.y - p.y), y: q.x - p.x };
      const L = Math.hypot(n.x, n.y) || 1;
      const off = 0.42;
      labelBoth(`side${i}`, names[i], { x: mid.x + (n.x / L) * off, y: mid.y + (n.y / L) * off });
    });
  }

  // ------------------------------------------------------------ 再構築
  function rebuild() {
    for (const g of allViews) clearGroup(g);

    const th = (P.theta * Math.PI) / 180;
    const A = { x: 0, y: 0 };
    const B = { x: P.a, y: 0 };
    const C = { x: P.b * Math.cos(th), y: P.b * Math.sin(th) };
    const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
    const aOpp = dist(B, C);
    const bOpp = dist(A, C);
    const cOpp = dist(A, B);
    const per = aOpp + bOpp + cOpp || 1;
    P.c = aOpp;

    // 外心・内心・重心・垂心
    const d1 = { x: B.x - A.x, y: B.y - A.y };
    const d2 = { x: C.x - A.x, y: C.y - A.y };
    const r1 = (B.x * B.x + B.y * B.y - A.x * A.x - A.y * A.y) / 2;
    const r2 = (C.x * C.x + C.y * C.y - A.x * A.x - A.y * A.y) / 2;
    const det = d1.x * d2.y - d1.y * d2.x;
    const O = Math.abs(det) < 1e-6
      ? { x: P.a / 2, y: P.b / 2 }
      : { x: (r1 * d2.y - d1.y * r2) / det, y: (d1.x * r2 - r1 * d2.x) / det };
    const I = {
      x: (aOpp * A.x + bOpp * B.x + cOpp * C.x) / per,
      y: (aOpp * A.y + bOpp * B.y + cOpp * C.y) / per,
    };
    const G = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const H = { x: A.x + B.x + C.x - 2 * O.x, y: A.y + B.y + C.y - 2 * O.y };
    const R = cOpp / (2 * Math.max(Math.sin(th), 1e-3));

    // 図の外形から左右のipsis と倍率を決める
    const ext = Math.max(cOpp, aOpp, bOpp, R * 2, 1);
    spread = ext * 1.35 + 0.8;
    shape3d.position.set(spread, 0, 0);
    shapeFlat.position.set(-spread, 0.02, 0);
    for (const g of [circle3d, cevian, points, angles, centers, marks, labels, tangent, chord]) {
      g.position.set(spread, 0, 0);
    }
    for (const g of [circleFlat, cevianFlat, pointsFlat, anglesFlat, centersFlat, marksFlat,
      labelsFlat, tangentFlat, chordFlat]) {
      g.position.set(-spread, 0.02, 0);
    }

    const tri = [A, B, C];
    const drawTriangle = (g, flat) => poly(g, flat, tri, { color: P.accent, opacity: 0.2, edge: 0xffffff });
    const drawDots = (g, flat) => {
      dot(g, flat, A, 0xffffff);
      dot(g, flat, B, 0xffffff);
      dot(g, flat, C, 0xffffff);
    };
    const drawVertexLabels = () => {
      text(labels, false, 'A', { x: -0.34, y: -0.34 }, { height: 0.4 });
      text(labels, false, 'B', { x: P.a + 0.3, y: -0.34 }, { height: 0.4 });
      text(labels, false, 'C', { x: C.x + 0.3, y: C.y + 0.24 }, { height: 0.4 });
      text(labelsFlat, true, 'A', { x: -0.34, y: -0.34 }, { height: 0.4 });
      text(labelsFlat, true, 'B', { x: P.a + 0.3, y: -0.34 }, { height: 0.4 });
      text(labelsFlat, true, 'C', { x: C.x + 0.3, y: C.y + 0.24 }, { height: 0.4 });
    };
    const drawSideMarks = (g, flat) => {
      const lens = [cOpp, bOpp, aOpp];
      const uniq = [...new Set(lens.map((v) => Math.round(v * 1000)))].sort((x, y) => x - y);
      const rank = (l) => uniq.indexOf(Math.round(l * 1000)) + 1;
      tick(g, flat, A, B, rank(lens[0]));
      tick(g, flat, B, C, rank(lens[1]));
      tick(g, flat, C, A, rank(lens[2]));
    };

    if (P.shape === 'circle') {
      // 外接円と接線・弦・円周角
      ring(circle3d, false, O, R, C_SIDE, 0.85);
      ring(circleFlat, true, O, R, C_SIDE, 0.85);
      ring(circle3d, false, O, R * 1.06, 0xffffff, 0.12, 0, TAU, 72);
      drawTriangle(shape3d, false);
      drawTriangle(shapeFlat, true);
      drawDots(points, false);
      drawDots(pointsFlat, true);
      // 弦 BC
      seg(chord, false, B, C, 0xffd166);
      seg(chordFlat, true, B, C, 0xffd166);
      // 点 B の接線
      const tx = -(B.y - O.y), ty = B.x - O.x;
      const tl = Math.hypot(tx, ty) || 1;
      const T0 = { x: B.x - (tx / tl) * R * 0.6, y: B.y - (ty / tl) * R * 0.6 };
      const T1 = { x: B.x + (tx / tl) * R * 0.6, y: B.y + (ty / tl) * R * 0.6 };
      seg(tangent, false, T0, T1, 0xff8fb1);
      seg(tangentFlat, true, T0, T1, 0xff8fb1);
      // 角: A の円周角と O の中心角（どちらも弦 BC に対する角）
      ring(angles, false, A, 0.62, C_CTR, 0.95, 0, th, 24);
      ring(anglesFlat, true, A, 0.62, C_CTR, 0.95, 0, th, 24);
      const cA = angAtB(O, B, C);
      const cB = angAtB(O, C, B);
      ring(angles, false, O, 0.52, 0x6ef0c8, 0.95, cA, cB, 24);
      ring(anglesFlat, true, O, 0.52, 0x6ef0c8, 0.95, cA, cB, 24);
      labelBoth('circleLabel', `円周角 ${deg(th)}° , 中心角 ${deg(th * 2)}°`,
        { x: O.x, y: -R * 0.62 });
      labelBoth('chordLabel', '弦', { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 + 0.4 }, { color: '#ffd166' });
      labelBoth('tanLabel', '接線', { x: T1.x, y: T1.y + 0.4 }, { color: '#ff8fb1' });
    } else if (P.shape === 'cyclic') {
      // 円に内接する四角形。対角線 2 本はいずれも直径になる
      const D = { x: 2 * O.x - A.x, y: 2 * O.y - A.y };
      const quad = [A, B, D, C];
      ring(circle3d, false, O, R, C_SIDE, 0.85);
      ring(circleFlat, true, O, R, C_SIDE, 0.85);
      poly(shape3d, false, quad, { color: P.accent, opacity: 0.18, edge: 0xffffff });
      poly(shapeFlat, true, quad, { color: P.accent, opacity: 0.18, edge: 0xffffff });
      for (const [g, flat] of [[points, false], [pointsFlat, true]]) {
        for (const p of quad) dot(g, flat, p, 0xffffff);
      }
      seg(chord, false, A, D, 0xffd166);
      seg(chord, false, B, C, 0xffd166);
      seg(chordFlat, true, A, D, 0xffd166);
      seg(chordFlat, true, B, C, 0xffd166);
      for (const [g, flat] of [[points, false], [pointsFlat, true]]) dot(g, flat, O, 0x6ef0c8, 0.09);
      const na = Math.abs(angAtB(A, B, C));
      const nd = Math.abs(angAtB(D, B, C));
      ring(angles, false, A, 0.6, C_CTR, 0.95, angAtB(A, B, C), angAtB(A, C, B), 24);
      ring(anglesFlat, true, A, 0.6, C_CTR, 0.95, angAtB(A, B, C), angAtB(A, C, B), 24);
      ring(angles, false, D, 0.6, 0x6ef0c8, 0.95, angAtB(D, B, C), angAtB(D, C, B), 24);
      ring(anglesFlat, true, D, 0.6, 0x6ef0c8, 0.95, angAtB(D, B, C), angAtB(D, C, B), 24);
      labelBoth('cyc', `対角の角 A + D = ${deg(na + nd)}°`, { x: O.x, y: -R * 0.62 });
      labelBoth('dLabel', 'D', { x: D.x + 0.28, y: D.y - 0.1 }, { height: 0.4 });
      labelBoth('diag1', '直径', { x: (A.x + D.x) / 2, y: (A.y + D.y) / 2 + 0.36 },
        { color: '#ffd166', height: 0.36 });
    } else if (P.shape === 'bisector') {
      // 角の二等分線
      const u = norm({ x: B.x - A.x, y: B.y - A.y });
      const w = norm({ x: C.x - A.x, y: C.y - A.y });
      const bis = norm({ x: u.x + w.x, y: u.y + w.y });
      const bc = { x: B.x - C.x, y: B.y - C.y };
      const L = Math.hypot(bc.x, bc.y);
      // 角の二等分線が BC を分ける比 AB:AC
      const t = cOpp / (cOpp + bOpp);
      const Dm = { x: C.x + bc.x * t, y: C.y + bc.y * t };
      drawTriangle(shape3d, false);
      drawTriangle(shapeFlat, true);
      drawDots(points, false);
      drawDots(pointsFlat, true);
      dot(points, false, Dm, 0x6ef0c8, 0.09);
      dot(pointsFlat, true, Dm, 0x6ef0c8, 0.09);
      const end = { x: A.x + bis.x * L, y: A.y + bis.y * L };
      seg(cevian, false, A, end, 0xff8fb1);
      seg(cevian, false, A, Dm, 0xff8fb1, 0.5);
      seg(cevianFlat, true, A, end, 0xff8fb1);
      seg(cevianFlat, true, A, Dm, 0xff8fb1, 0.5);
      ring(angles, false, A, 0.66, C_CTR, 0.95, 0, th / 2, 20);
      ring(angles, false, A, 0.66, 0x6ef0c8, 0.95, th / 2, th, 20);
      ring(anglesFlat, true, A, 0.66, C_CTR, 0.95, 0, th / 2, 20);
      ring(anglesFlat, true, A, 0.66, 0x6ef0c8, 0.95, th / 2, th, 20);
      tick(marks, false, B, Dm, 1, 0xff8fb1);
      tick(marks, false, Dm, C, 1, 0xff8fb1);
      tick(marksFlat, true, B, Dm, 1, 0xff8fb1);
      tick(marksFlat, true, Dm, C, 1, 0xff8fb1);
      labelBoth('bis', `∠A = ${deg(th)}° を 2 等分`, { x: end.x * 0.62, y: end.y * 0.62 + 0.3 });
      labelBoth('dmLabel', 'D', { x: Dm.x + 0.26, y: Dm.y + 0.16 }, { height: 0.4 });
    } else {
      // triangle / centers
      drawTriangle(shape3d, false);
      drawTriangle(shapeFlat, true);
      drawDots(points, false);
      drawDots(pointsFlat, true);
      drawVertexLabels();
      sideLabels(tri, [`c = ${f(cOpp)}`, `b = ${f(bOpp)}`, `a = ${f(aOpp)}`]);
      drawSideMarks(marks, false);
      drawSideMarks(marksFlat, true);
      const arc = (g, flat, v, p, q, r, color) => {
        const a0 = angAtB(v, p, q);
        const a1 = angAtB(v, q, p);
        ring(g, flat, v, r, color, 0.95, a0, a1, 24);
      };
      arc(angles, false, A, B, C, 0.62, C_CTR);
      arc(angles, false, B, C, A, 0.62, C_CTR);
      arc(angles, false, C, A, B, 0.62, C_CTR);
      arc(anglesFlat, true, A, B, C, 0.62, C_CTR);
      arc(anglesFlat, true, B, C, A, 0.62, C_CTR);
      arc(anglesFlat, true, C, A, B, 0.62, C_CTR);
      if (P.shape === 'centers') {
        ring(circle3d, false, O, R, 0x6ef0c8, 0.4);
        ring(circleFlat, true, O, R, 0x6ef0c8, 0.4);
        const euler = [G, O, H];
        seg(centers, false, G, H, 0xffffff, 0.6);
        seg(centersFlat, true, G, H, 0xffffff, 0.6);
        for (let i = 0; i < 3; i++) {
          for (const [g, flat] of [[centers, false], [centersFlat, true]]) {
            if (i < 2) seg(g, flat, euler[i], euler[i + 1], 0xffffff, 0.55);
          }
        }
        const ctr = [[O, 'O', 0x6ef0c8], [I, 'I', 0xff8fb1], [G, 'G', 0xffd166], [H, 'H', 0xff9f6e]];
        for (const [p, n, col] of ctr) {
          for (const [g, flat] of [[centers, false], [centersFlat, true]]) dot(g, flat, p, col, 0.1);
          text(labels, false, n, { x: p.x + 0.26, y: p.y + 0.2 }, { height: 0.4, color: `#${col.toString(16).padStart(6, '0')}` });
          text(labelsFlat, true, n, { x: p.x + 0.26, y: p.y + 0.2 }, { height: 0.4, color: `#${col.toString(16).padStart(6, '0')}` });
        }
        labelBoth('euler', 'O, G, H は一直線（オイラーの直線）', { x: O.x, y: -R * 0.55 });
      } else {
        // 角の二等分線と 3 中心を同時に
        const u = norm({ x: B.x - A.x, y: B.y - A.y });
        const w = norm({ x: C.x - A.x, y: C.y - A.y });
        const bis = norm({ x: u.x + w.x, y: u.y + w.y });
        const t = cOpp / (cOpp + bOpp);
        const Dm = { x: C.x + (B.x - C.x) * t, y: C.y + (B.y - C.y) * t };
        const L = Math.hypot(B.x - C.x, B.y - C.y);
        const end = { x: A.x + bis.x * L, y: A.y + bis.y * L };
        seg(cevian, false, A, end, 0xff8fb1);
        seg(cevian, false, A, Dm, 0xff8fb1, 0.5);
        seg(cevianFlat, true, A, end, 0xff8fb1);
        seg(cevianFlat, true, A, Dm, 0xff8fb1, 0.5);
        dot(points, false, Dm, 0xff8fb1, 0.08);
        dot(pointsFlat, true, Dm, 0xff8fb1, 0.08);
        for (const [p, n, col] of [[O, 'O', 0x6ef0c8], [I, 'I', 0xff8fb1], [G, 'G', 0xffd166]]) {
          for (const [g, flat] of [[centers, false], [centersFlat, true]]) dot(g, flat, p, col, 0.1);
          text(labels, false, n, { x: p.x + 0.26, y: p.y + 0.2 }, { height: 0.4, color: `#${col.toString(16).padStart(6, '0')}` });
          text(labelsFlat, true, n, { x: p.x + 0.26, y: p.y + 0.2 }, { height: 0.4, color: `#${col.toString(16).padStart(6, '0')}` });
        }
        labelBoth('angA', `∠A = ${deg(th)}°`, { x: 0.5, y: 0.5 });
      }
    }

    frameLayout();
  }

  // 図形から実測して収まるように縮める
  function frameLayout() {
    stage.scale.setScalar(1);
    stage.position.set(0, 0, 0);
    _box.makeEmpty();
    _box.setFromObject(stage);
    if (_box.isEmpty()) return;
    _box.getSize(_size);
    _box.getCenter(_mid);
    const ext = Math.max(_size.x, _size.z, 0.001);
    const k = clamp(TARGET / ext, 0.3, 1.5);
    stage.scale.setScalar(k);
    stage.position.set(-_mid.x * k, -_mid.y * k, -_mid.z * k);
  }

  function norm(p) {
    const l = Math.hypot(p.x, p.y) || 1;
    return { x: p.x / l, y: p.y / l };
  }
  function angAtB(v, p, q) {
    return Math.atan2(p.y - v.y, p.x - v.x) - Math.atan2(q.y - v.y, q.x - v.x);
  }
  function deg(rad) { return Math.round((rad * 180) / Math.PI); }
  function f(v) { return v.toFixed(2); }

  function setParams(patch) {
    let dirty = false;
    if (patch.shape != null && patch.shape !== P.shape) { P.shape = patch.shape; dirty = true; }
    if (patch.a != null && Math.abs(patch.a - P.a) > 1e-6) { P.a = Math.max(0.2, patch.a); dirty = true; }
    if (patch.b != null && Math.abs(patch.b - P.b) > 1e-6) { P.b = Math.max(0.2, patch.b); dirty = true; }
    if (patch.theta != null && Math.abs(patch.theta - P.theta) > 1e-6) {
      P.theta = clamp(patch.theta, 8, 160);
      dirty = true;
    }
    if (patch.c != null && patch.theta == null && (patch.a != null || patch.b != null)) {
      // 3 辺が与えられたときは余弦定理から A を戻す
      const aa = P.a, bb = P.b, cc = clamp(patch.c, Math.abs(aa - bb) + 0.05, aa + bb - 0.05);
      P.theta = clamp(deg(Math.acos(clamp((aa * aa + bb * bb - cc * cc) / (2 * aa * bb), -1, 1))), 8, 160);
      dirty = true;
    }
    if (patch.accent != null) P.accent = patch.accent;
    if (patch.animate != null) P.animate = patch.animate;
    if (dirty) rebuild();
  }

  function update(dt, elapsed) {
    if (!P.animate) return;
    const base = -0.34 + Math.sin((elapsed || 0) * 0.3) * 0.22;
    for (const g of [shape3d, circle3d, cevian, points, angles, centers, marks, labels, tangent, chord]) {
      g.rotation.y = base;
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
