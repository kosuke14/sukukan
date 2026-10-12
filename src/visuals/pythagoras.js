import * as THREE from 'three';
import { disposeObject, edgesOf, lineBasic } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, ease, TAU } from '../engine/MathUtil.js';
import { makeArrow, makeGridPlane, makePoint } from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _d = new THREE.Vector3();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _mid = new THREE.Vector3();

function clearGroup(g) {
  while (g.children.length) {
    const c = g.children.pop();
    disposeObject(c);
  }
}

/** 平面多角形（頂点列）を塗りつぶしと輪郭で描く。 */
function makePoly(pts, { color = 0x6ee7ff, opacity = 0.3, edge = color, edgeOpacity = 0.9 } = {}) {
  const g = new THREE.Group();
  const pos = [];
  for (const p of pts) pos.push(p.x, p.y, p.z);
  const idx = [];
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  })));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(edge, edgeOpacity)));
  return g;
}

function lbl(sprite, x, y, z) { sprite.position.set(x, y, z); return sprite; }

/**
 * ピタゴラスの定理を 3 つの見せ方で描く。
 *   proof       3辺に正方形を立てて立ち上がり、面積の一致を示す
 *   prism       直方体の 3 面と対角線（斜めが最も長い）
 *   sphere      直径 c の球に内接する直角三角形と大円
 * a, b は直角辺、c = √(a²+b²) は hypotenuse で常に導出する。
 */
export function createPythagoras(params = {}) {
  const {
    a = 3,
    b = 4,
    mode = 'proof',
    animate = true,
    rise = 0.55,
    scale = 0,
    accent = 0x6ee7ff,
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { a, b, mode, animate, rise, scale, accent, c: Math.hypot(a, b) };

  const C_A = 0x6ef0c8;
  const C_B = 0xffd166;
  const C_C = 0xff8fb1;
  const C_BOX = 0x7ea6e8;
  const TARGET = 11.5;

  const stage = new THREE.Group();
  group.add(stage);

  const mk = () => {
    const g = new THREE.Group();
    stage.add(g);
    return g;
  };
  const triG = mk();
  const squaresG = mk();
  const legsG = mk();
  const labelsG = mk();
  const prismG = mk();
  const facesG = mk();
  const pathG = mk();
  const sphereG = mk();
  const circleG = mk();
  parts.tri = triG;
  parts.squares = squaresG;
  parts.legs = legsG;
  parts.labels = labelsG;
  parts.prism = prismG;
  parts.faces = facesG;
  parts.path = pathG;
  parts.sphere = sphereG;
  parts.greatCircle = circleG;

  const grid = makeGridPlane({ size: 26, div: 26, color: 0x24406f, opacity: 0.35 });
  grid.position.y = -0.02;
  group.add(grid);
  parts.grid = grid;

  const label = (text, { height = 0.44, color = '#eaf6ff' } = {}) => {
    const s = makeLabel(text, {
      height, color, bg: 'rgba(6,10,22,0.75)', border: 'rgba(150,190,255,0.22)',
    });
    labelsG.add(s);
    return s;
  };

  // 移動する 4 枚の三角形
  let pieces = [];
  let clock = 0;

  function frameLayout() {
    // 作図後に実測した箱でcentering と倍率を決める
    stage.scale.setScalar(1);
    stage.position.set(0, 0, 0);
    _box.makeEmpty();
    _box.setFromObject(stage);
    if (_box.isEmpty()) return;
    _box.getSize(_size);
    _box.getCenter(_mid);
    const ext = Math.max(_size.x, _size.y, _size.z, 0.001);
    const k = P.scale > 0 ? P.scale : clamp(TARGET / ext, 0.3, 1.4);
    stage.scale.setScalar(k);
    stage.position.set(-_mid.x * k, -_mid.y * k, -_mid.z * k);
    grid.position.y = stage.position.y - 0.02;
  }

  // ---------------------------------------------------------------- {proof}
  function buildProof() {
    const A = V(P.a, 0, 0);
    const B = V(0, P.b, 0);
    const O = V(0, 0, 0);
    const s = P.a + P.b;

    // --- 直角三角形
    triG.add(makePoly([O, A, B], { color: P.accent, opacity: 0.34, edge: 0xffffff, edgeOpacity: 0.95 }));
    // 内部の分割線（3 辺を等分した補助線）
    const midAB = A.clone().add(B).multiplyScalar(0.5);
    triG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([O, midAB]), lineBasic(0xffffff, 0.4)));

    // --- 3 辺に立てる正方形（hinge で持ち上げる）
    const nOut = V(P.b, P.a, 0).normalize(); // 斜辺の外向き
    const mkSided = (base, dir, pts, color, title) => {
      const g = new THREE.Group();
      g.position.copy(base);
      const poly = makePoly(pts.map((p) => p.clone().sub(base)), {
        color, opacity: 0.26, edge: color, edgeOpacity: 0.85,
      });
      g.add(poly);
      if (dir === 'x') g.rotation.x = -P.rise;
      else if (dir === 'y') g.rotation.y = P.rise;
      else {
        _d.copy(B).sub(A).normalize();
        g.quaternion.setFromUnitVectors(V(1, 0, 0), _d);
        g.rotateX(P.rise);
      }
      squaresG.add(g);
      const ctr = pts.reduce((acc, p) => acc.add(p), V(0, 0, 0)).multiplyScalar(1 / pts.length);
      g.userData.anchor = ctr;
      lbl(label(title, { height: 0.5, color: `#${color.toString(16).padStart(6, '0')}` }),
        ctr.x * 0.75, ctr.y * 0.75, ctr.z * 0.75 + 0.25);
      return g;
    };
    mkSided(O, 'x', [O, A, V(P.a, -P.a, 0), V(0, -P.a, 0)], C_A, 'a²');
    mkSided(O, 'y', [O, B, V(-P.b, P.b, 0), V(-P.b, 0, 0)], C_B, 'b²');
    mkSided(A, 'ab', [
      A, B, B.clone().addScaledVector(nOut, P.b), A.clone().addScaledVector(nOut, P.b),
    ], C_C, 'c²');

    // --- 3 辺の辺（a, b, c）を矢印で
    const arrow = (from, to, color, text, dy) => {
      legsG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), lineBasic(0xffffff, 0.5)));
      legsG.add(makeArrow(from, to, { color, headSize: 0.16, shaft: 0.02 }));
      lbl(label(text, { height: 0.4, color: `#${color.toString(16).padStart(6, '0')}` }),
        (from.x + to.x) / 2, (from.y + to.y) / 2 + dy, 0.12);
    };
    arrow(O, A, C_A, 'a', -0.5);
    arrow(O, B, C_B, 'b', 0.5);
    arrow(A, B, C_C, 'c', 0.34);
    lbl(label('a² + b² = c²', { height: 0.62, color: '#ffffff' }), (P.a - P.b) * 0.5, -P.a - 1.1, 0.3);

    // --- (a+b)² の大.square と円華表
    const zBase = -1.6;
    const P2 = (x, z) => V(x - s / 2, 0.03, z + zBase);
    const big = [P2(0, 0), P2(s, 0), P2(s, s), P2(0, s)];
    pathG.add(makePoly(big, { color: 0x3f6fbf, opacity: 0.1, edge: 0x7ea6e8, edgeOpacity: 0.6 }));
    // 傾いた c 方の正方形
    pathG.add(makePoly([P2(P.a, 0), P2(s, P.a), P2(P.b, s), P2(0, P.b)], {
      color: C_C, opacity: 0.2, edge: C_C, edgeOpacity: 0.8,
    }));
    // 4 枚の三角形
    pieces = [];
    const tris = [
      [P2(0, 0), P2(P.a, 0), P2(0, P.b)],
      [P2(s, 0), P2(P.a, 0), P2(s, P.a)],
      [P2(s, s), P2(s, P.a), P2(P.b, s)],
      [P2(0, s), P2(P.b, s), P2(0, P.b)],
    ];
    for (let i = 0; i < 4; i++) {
      const t = tris[i];
      const ctr = t[0].clone().add(t[1]).add(t[2]).multiplyScalar(1 / 3);
      const local = t.map((p) => p.clone().sub(ctr));
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9fd0ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(
        local.flatMap((p) => [p.x, p.y, p.z]), 3));
      geo.setIndex([0, 1, 2]);
      const m = new THREE.Mesh(geo, mat);
      m.add(new THREE.LineLoop(geo.clone(), lineBasic(0xffffff, 0.55)));
      m.position.copy(ctr);
      pathG.add(m);
      const out = ctr.clone().sub(V(0, 0, zBase + s / 2));
      out.y = 0;
      out.normalize().multiplyScalar(s * 0.55);
      pieces.push({ mesh: m, home: ctr.clone(), from: ctr.clone().add(out), spin: (i % 2 ? 1 : -1) * 0.5 });
    }
    lbl(label('(a+b)² = 4 × ab + c²', { height: 0.5, color: '#cfe0ff' }), 0, 0.06, zBase + s + 0.9);
  }

  // ----------------------------------------------------------------  prism
  function buildPrism() {
    const a = P.a, b = P.b, c = P.c;
    const box = new THREE.BoxGeometry(a, b, c);
    const prism = new THREE.Group();
    prism.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({
      color: 0x2c4f8a, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false,
    })));
    prism.add(edgesOf(box, C_BOX, 0.55));
    prism.position.set(a / 2, b / 2, c / 2);
    prismG.add(prism);

    // 原点まわりに接する 3 面（面積 a², b², c² に対応する面）
    const O = V(0, 0, 0), A = V(a, 0, 0), B = V(0, b, 0), C = V(0, 0, c);
    const F = V(a, b, 0), G = V(a, 0, c), H = V(0, b, c);
    facesG.add(makePoly([O, A, F, B], { color: C_A, opacity: 0.2, edge: C_A, edgeOpacity: 0.7 }));
    facesG.add(makePoly([O, A, G, C], { color: C_B, opacity: 0.2, edge: C_B, edgeOpacity: 0.7 }));
    facesG.add(makePoly([O, B, H, C], { color: C_C, opacity: 0.2, edge: C_C, edgeOpacity: 0.7 }));
    lbl(label('a × b', { height: 0.46, color: `#${C_A.toString(16).padStart(6, '0')}` }), a / 2, b / 2, 0.15);
    lbl(label('a × c', { height: 0.46, color: `#${C_B.toString(16).padStart(6, '0')}` }), a / 2, 0.2, c / 2);
    lbl(label('b × c', { height: 0.46, color: `#${C_C.toString(16).padStart(6, '0')}` }), 0.2, b / 2, c / 2);

    // 辺と対角線
    legsG.add(makeArrow(O, A, { color: C_A, headSize: 0.16, shaft: 0.022 }));
    legsG.add(makeArrow(O, B, { color: C_B, headSize: 0.16, shaft: 0.022 }));
    legsG.add(makeArrow(O, C, { color: C_C, headSize: 0.16, shaft: 0.022 }));
    lbl(label('a', { height: 0.42, color: '#6ef0c8' }), a * 0.55, -0.35, 0);
    lbl(label('b', { height: 0.42, color: '#ffd166' }), -0.35, b * 0.55, 0);
    lbl(label('c', { height: 0.42, color: '#ff8fb1' }), -0.35, 0, c * 0.55);

    const diag = makeArrow(V(a, 0, 0), V(0, b, c), { color: 0xffffff, headSize: 0.2, shaft: 0.03 });
    pathG.add(diag);
    const other = makeArrow(V(0, b, 0), V(a, 0, c), { color: 0xffffff, headSize: 0.2, shaft: 0.03 });
    pathG.add(other);
    lbl(label(`対角線 √(a²+b²+c²) = ${Math.hypot(a, b, c).toFixed(2)}`, { height: 0.5, color: '#ffffff' }),
      a / 2, b / 2 + 0.4, c / 2);
    lbl(label('斜めが最も長い', { height: 0.5, color: '#ffd166' }), a / 2, b / 2 - 0.6, c / 2);
  }

  // ---------------------------------------------------------------  sphere
  function buildSphere() {
    const a = P.a, b = P.b, c = P.c;
    const M = V(a / 2, b / 2, 0);
    const r = c / 2;
    const sp = new THREE.Mesh(
      new THREE.SphereGeometry(r, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x2f6fa8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    sp.position.copy(M);
    sphereG.add(sp);
    sp.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(r, 24, 12)),
      lineBasic(0x7ea6e8, 0.18)));
    const mDot = makePoint(0xffffff, { size: 0.08, halo: 0.5 });
    mDot.position.copy(M);
    sphereG.add(mDot);

    // 大円（直径 c）: 3 頂点を通る円
    const ringPts = [];
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * TAU;
      ringPts.push(V(M.x + Math.cos(t) * r, M.y + Math.sin(t) * r, 0));
    }
    circleG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), lineBasic(C_C, 0.95)));

    // 内接する直角三角形
    const O = V(0, 0, 0), A = V(a, 0, 0), B = V(0, b, 0);
    triG.add(makePoly([O, A, B], { color: P.accent, opacity: 0.42, edge: 0xffffff, edgeOpacity: 0.95 }));
    legsG.add(makeArrow(A, B, { color: 0xffffff, headSize: 0.16, shaft: 0.028 }));
    lbl(label('直径 c', { height: 0.5, color: '#ffffff' }), a / 2, b / 2 - 0.45, 0.1);
    lbl(label('∠C = 90°', { height: 0.5, color: '#ffd166' }), 0.5, 0.5, 0.1);
    lbl(label('半径 c/2 の球に内接', { height: 0.52, color: '#8fe8ff' }), M.x, b + 0.9, 0);

    // 直径を通る半円の道
    const arcPts = [];
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI;
      arcPts.push(V(M.x + Math.cos(t) * r, M.y + Math.sin(t) * r, 0));
    }
    pathG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), lineBasic(0xff9f6e, 0.8)));
  }

  function rebuild() {
    for (const g of [triG, squaresG, legsG, labelsG, prismG, facesG, pathG, sphereG, circleG]) clearGroup(g);
    P.c = Math.hypot(P.a, P.b);
    pieces = [];
    if (P.mode === 'prism') buildPrism();
    else if (P.mode === 'sphere') buildSphere();
    else buildProof();
    frameLayout();
  }

  function setParams(patch) {
    let dirty = false;
    if (patch.a != null && Math.abs(patch.a - P.a) > 1e-6) { P.a = Math.max(0.2, patch.a); dirty = true; }
    if (patch.b != null && Math.abs(patch.b - P.b) > 1e-6) { P.b = Math.max(0.2, patch.b); dirty = true; }
    if (patch.mode != null && patch.mode !== P.mode) { P.mode = patch.mode; dirty = true; }
    if (patch.rise != null) { P.rise = patch.rise; dirty = true; }
    if (patch.scale != null) { P.scale = patch.scale; dirty = true; }
    if (patch.accent != null && patch.accent !== P.accent) { P.accent = patch.accent; dirty = true; }
    if (patch.animate != null) P.animate = patch.animate;
    if (dirty) rebuild();
  }

  function update(dt) {
    clock += dt;
    if (P.animate) stage.rotation.y = Math.sin(clock * 0.22) * (P.mode === 'proof' ? 0.12 : 0.34);
    if (!P.animate || pieces.length === 0) return;
    // 4 枚が 1 つずつ定位置へ滑り込む（4 秒周期）
    const period = 4.2;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const t = ((clock / period) + i * 0.13) % 1;
      const e = ease.outCubic(clamp(t * 1.6, 0, 1));
      p.mesh.position.lerpVectors(p.from, p.home, e);
      p.mesh.position.y += Math.sin(Math.PI * clamp(t, 0, 1)) * 0.7;
      p.mesh.rotation.y = p.spin * (1 - e);
      p.mesh.material.opacity = 0.25 + 0.45 * e;
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
