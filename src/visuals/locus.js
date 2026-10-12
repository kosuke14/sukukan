import * as THREE from 'three';
import { lineBasic, pointMat, basicMat, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { makeAxes, makeGridPlane, makeCurve, makePoint, accentOf } from './common.js';

/**
 * 軌跡。条件を満たす点 P の動く道筋と、その条件を確かめる定規・距離の線分。
 *   sum       |PF1| + |PF2| = 2a → 楕円
 *   diff      |PF1| − |PF2| = 2a → 双曲線
 *   product   |PA|·|PB| = k      → Cassini の楕円
 *   circlePoint 一定角を引いて通る円 → 円周角の定理の逆
 *   lineRatio AP : PB = k : 1     → アポロニウスの円
 *   distance  点から直線までの距離が k → 平行2直線
 * a, b は半軸（focus 距離は √(a²−b²) または √(a²+b²)）、k は type ごとに
 * 積・半径・比の分子・距離として使う。
 */
export function createLocus(params = {}) {
  const {
    type = 'sum',
    t = 0.5,
    a = 2.4,
    b = 1.8,
    k = 3,
    p = [0, 0],
    mode = 'trace',
    accent = 0x6ee7ff,
  } = params;

  let ACC = accentOf(accent);
  const AMBER = 0xffd479;
  const MINT = 0x7cffb2;
  const PINK = 0xff6b9d;
  const BOX = 5;
  const TRACE_MAX = 700;
  const TICKS = 5;

  const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const group = new THREE.Group();
  const parts = {};
  const P = { type, t, a, b, k, p: [...p], mode, auto: true, speed: 0.22, spin: 1 };

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

  function writeSeg(line, ax, ay, bx, by, z = 0) {
    line.geometry.attributes.position.setXYZ(0, ax, ay, z);
    line.geometry.attributes.position.setXYZ(1, bx, by, z);
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  function namedPoint(color, name) {
    const g = new THREE.Group();
    g.add(makePoint(color, { size: 0.12, halo: 0.95 }));
    const l = makeLabel(name, { height: 0.32, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)' });
    l.position.set(0, 0.42, 0);
    g.userData.label = l;
    g.add(l);
    return g;
  }

  /**
   * 数が動くラベル。makeLabel は文字列ごとに texture をキャッシュし続けるので、
   * 毎フレーム値が変わる場面では同じ canvas を描き直す方式を使う。
   */
  function makeValueTag({ height = 0.34, color = '#7cffb2', bg = 'rgba(6,10,22,0.85)', border = 'rgba(124,255,178,0.35)' } = {}) {
    const FONT = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic Medium", "Meiryo", system-ui, sans-serif';
    const FS = 40;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: true }));
    sp.renderOrder = 10;
    let last = null;
    sp.userData.setValue = (text) => {
      if (text === last) return;
      last = text;
      g.font = `600 ${FS}px ${FONT}`;
      const w = Math.ceil(g.measureText(text).width) + 28;
      const h = Math.ceil(FS * 1.62);
      if (canvas.width !== w * 2 || canvas.height !== h * 2) { canvas.width = w * 2; canvas.height = h * 2; }
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.clearRect(0, 0, w, h);
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      if (border) { g.strokeStyle = border; g.lineWidth = 1.4; g.strokeRect(0.7, 0.7, w - 1.4, h - 1.4); }
      g.font = `600 ${FS}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.65)';
      g.shadowBlur = 8;
      g.fillStyle = color;
      g.fillText(text, w / 2, h / 2);
      tex.needsUpdate = true;
      sp.scale.set((height * w) / h, height, 1);
    };
    return sp;
  }

  /** 目盛つきの定規。向きと長さは update で書き込む。 */
  function makeRuler(color) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.09, 0.3), basicMat(color, 0.5));
    g.add(shaft);
    const ticks = [];
    for (let i = 0; i < TICKS; i++) {
      const tk = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.32), basicMat(0xffffff, 0.75));
      g.add(tk);
      ticks.push(tk);
    }
    g.userData.shaft = shaft;
    g.userData.ticks = ticks;
    return g;
  }

  function placeRuler(ruler, ax, ay, bx, by, z) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    ruler.position.set((ax + bx) / 2, (ay + by) / 2, z);
    ruler.rotation.z = len > 1e-6 ? Math.atan2(dy, dx) : 0;
    ruler.userData.shaft.scale.x = Math.max(len, 1e-3);
    for (let i = 0; i < TICKS; i++) {
      ruler.userData.ticks[i].position.x = (len * (i + 1)) / (TICKS + 1) - len / 2;
    }
  }

  // ----------------------------------------------------------------- 背景
  const axes = flatAxes();
  group.add(axes);
  parts.axes = axes;

  const grid = makeGridPlane({ size: BOX * 2, div: BOX * 2, color: 0x2f4a7a, opacity: 0.4, plane: 'xy' });
  group.add(grid);
  parts.grid = grid;

  // ------------------------------------------------------------- 焦点など
  const focus1 = namedPoint(AMBER, 'F₁');
  const focus2 = namedPoint(AMBER, 'F₂');
  const point = namedPoint(0xffffff, 'P', 0.36);
  group.add(focus1, focus2, point);
  parts.focus1 = focus1; parts.focus2 = focus2; parts.point = point;

  // 距離の線分
  const distBar1 = new THREE.Group();
  const bar1 = dynamicLine(2, MINT, 0.9);
  distBar1.add(bar1);
  const distBar2 = new THREE.Group();
  const bar2 = dynamicLine(2, PINK, 0.9);
  distBar2.add(bar2);
  group.add(distBar1, distBar2);
  parts.distBar1 = distBar1; parts.distBar2 = distBar2;

  const ruler = new THREE.Group();
  const ruler1 = makeRuler(0x8fe8ff);
  const ruler2 = makeRuler(0xffb3c9);
  ruler.add(ruler1, ruler2);
  group.add(ruler);
  parts.ruler = ruler;

  const dist1 = makeValueTag({ height: 0.36 });
  group.add(dist1);
  parts.dist1 = dist1;

  // ------------------------------------------------------------ 軌跡本体
  const locusCurve = new THREE.Group();
  group.add(locusCurve);
  parts.locusCurve = locusCurve;

  const trace = new THREE.Group();
  const traceGeo = new THREE.BufferGeometry();
  const tracePos = new Float32Array(TRACE_MAX * 3);
  traceGeo.setAttribute('position', new THREE.BufferAttribute(tracePos, 3));
  traceGeo.setDrawRange(0, 0);
  const tracePts = new THREE.Points(traceGeo, pointMat(ACC, 0.075, 0.9));
  tracePts.frustumCulled = false;
  trace.add(tracePts);
  group.add(trace);
  parts.trace = trace;
  let traceCount = 0;

  // 円・直線・帯（circlePoint / distance 用）
  const circle = new THREE.Group();
  const ring = dynamicLine(129, AMBER, 0.95);
  circle.add(ring);
  group.add(circle);
  parts.circle = circle;

  const line = new THREE.Group();
  const baseLine = dynamicLine(2, 0xffffff, 0.75);
  const par1 = dynamicLine(2, MINT, 0.9);
  const par2 = dynamicLine(2, MINT, 0.9);
  line.add(baseLine, par1, par2);
  group.add(line);
  parts.line = line;

  const lineA = new THREE.Group();
  const segA = dynamicLine(2, AMBER, 0.9);
  lineA.add(segA);
  const lineB = new THREE.Group();
  const segB = dynamicLine(2, PINK, 0.9);
  lineB.add(segB);
  group.add(lineA, lineB);
  parts.lineA = lineA; parts.lineB = lineB;

  const band = new THREE.Group();
  const bandMesh = new THREE.Mesh(new THREE.BufferGeometry(), basicMat(0x6ee7ff, 0.13));
  bandMesh.frustumCulled = false;
  band.add(bandMesh);
  const bandLabel = makeLabel('幅 2k', { height: 0.3, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)' });
  band.add(bandLabel);
  group.add(band);
  parts.band = band;

  // ------------------------------------------------------------ 再構築
  const st = { px: 0, py: 0, d1: 0, d2: 0, name: 'F₁' };

  function locusAt(tt) {
    const ty = P.type;
    if (ty === 'sum') {
      const th = tt * Math.PI * 2;
      return [P.a * Math.cos(th), P.b * Math.sin(th)];
    }
    if (ty === 'diff') {
      const s = -1.9 + 3.8 * tt;
      return [P.a * Math.cosh(s), P.b * Math.sinh(s)];
    }
    if (ty === 'product') {
      const d = P.a / 2, phi = tt * Math.PI * 2;
      const c2 = Math.cos(2 * phi);
      const disc = d * d * d * d * c2 * c2 - d * d * d * d + P.k * P.k;
      if (disc < 0) return null;
      const w = d * d * c2 + Math.sqrt(disc);
      const r = Math.sqrt(Math.max(w, 0));
      return [r * Math.cos(phi), r * Math.sin(phi)];
    }
    if (ty === 'circlePoint') {
      const d = P.a / 2;
      const h = Math.sqrt(Math.max(P.k * P.k - d * d, 0));
      const cx = 0, cy = -h;
      const base = Math.atan2(-cy, -d);        // 端点 A の中心からの角度
      const sweep = Math.PI * 2 - 2 * Math.asin(Math.min(d / Math.max(P.k, 1e-6), 1));
      const ang = base + sweep * tt;
      return [cx + Math.cos(ang) * P.k, cy + Math.sin(ang) * P.k];
    }
    if (ty === 'lineRatio') {
      const d = P.a / 2;
      if (Math.abs(P.k - 1) < 0.02) return [0, -BOX + 2 * BOX * tt];
      const cx = (d * (P.k * P.k + 1)) / (P.k * P.k - 1);
      const rr = (2 * d * P.k) / Math.abs(P.k * P.k - 1);
      const ang = tt * Math.PI * 2;
      return [cx + rr * Math.cos(ang), rr * Math.sin(ang)];
    }
    // distance: 直線 l から距離 k の平行な直線上を動く
    const n = normalOf(P.p);
    const dir = [-n[1], n[0]];
    const s = -BOX + 2 * BOX * tt;
    return [P.k * n[0] + dir[0] * s, P.k * n[1] + dir[1] * s];
  }

  function normalOf(pt) {
    const l = Math.hypot(pt[0], pt[1]);
    return l > 1e-6 ? [pt[0] / l, pt[1] / l] : [0, 1];
  }

  function writeRing(line, cx, cy, r, a0 = 0, a1 = Math.PI * 2) {
    const attr = line.geometry.attributes.position;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / (n - 1);
      attr.setXYZ(i, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0);
    }
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  function writeBand(ax, ay, bx, by, off, z) {
    const dx = bx - ax, dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * off, ny = (dx / l) * off;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      ax, ay, z, bx, by, z, bx + nx, by + ny, z,
      ax, ay, z, bx + nx, by + ny, z, ax + nx, ay + ny, z,
    ], 3));
    g.computeVertexNormals();
    bandMesh.geometry.dispose();
    bandMesh.geometry = g;
    bandLabel.position.set((ax + bx) / 2 + nx * 0.5, (ay + by) / 2 + ny * 0.5, 0);
  }

  function rebuild() {
    const ty = P.type;
    resetGroup(locusCurve);
    st.name = 'F₁';

    // 焦点（distance では垂線の足を置く）
    let f1 = [0, 0], f2 = [0, 0];
    if (ty === 'sum') {
      const c = Math.sqrt(Math.max(P.a * P.a - P.b * P.b, 0));
      f1 = [-c, 0]; f2 = [c, 0];
    } else if (ty === 'diff') {
      const c = Math.sqrt(P.a * P.a + P.b * P.b);
      f1 = [-c, 0]; f2 = [c, 0];
    } else if (ty === 'product' || ty === 'circlePoint' || ty === 'lineRatio') {
      const d = P.a / 2;
      f1 = [-d, 0]; f2 = [d, 0];
      st.name = 'A'; focus1.userData.label.userData.setText('A');
      focus2.userData.label.userData.setText('B');
    } else {
      const n = normalOf(P.p);
      f1 = [0, 0]; f2 = [P.k * n[0], P.k * n[1]];
      st.name = '直線';
      focus1.userData.label.userData.setText('l');
      focus2.userData.label.userData.setText('H');
    }
    if (ty === 'sum' || ty === 'diff') {
      focus1.userData.label.userData.setText('F₁');
      focus2.userData.label.userData.setText('F₂');
    }
    focus1.position.set(f1[0], f1[1], 0.08);
    focus2.position.set(f2[0], f2[1], 0.08);

    // 軌跡そのもの
    if (ty === 'sum') {
      locusCurve.add(makeCurve((u) => v3(P.a * Math.cos(u * Math.PI * 2), P.b * Math.sin(u * Math.PI * 2), 0),
        { samples: 200, color: ACC }));
    } else if (ty === 'diff') {
      const branch = (sgn) => makeCurve((u) => {
        const s = -2.2 + 4.4 * u;
        return v3(sgn * P.a * Math.cosh(s), P.b * Math.sinh(s), 0);
      }, { samples: 160, color: ACC });
      locusCurve.add(branch(1), branch(-1));
    } else if (ty === 'product') {
      const d = P.a / 2;
      const ringOf = (root) => makeCurve((u) => {
        const phi = u * Math.PI * 2;
        const c2 = Math.cos(2 * phi);
        const disc = d * d * d * d * c2 * c2 - d * d * d * d + P.k * P.k;
        if (disc < 0) return v3(0, 0, -50);   // 描けない角度は画面外に逃がす
        const w = d * d * c2 + root * Math.sqrt(disc);
        const r = Math.sqrt(Math.max(w, 0));
        return v3(r * Math.cos(phi), r * Math.sin(phi), 0);
      }, { samples: 220, color: ACC });
      locusCurve.add(ringOf(1), ringOf(-1));
    } else if (ty === 'circlePoint') {
      const d = P.a / 2;
      const h = Math.sqrt(Math.max(P.k * P.k - d * d, 0));
      const base = Math.atan2(h, -d);
      const sweep = Math.PI * 2 - 2 * Math.asin(Math.min(d / Math.max(P.k, 1e-6), 1));
      locusCurve.add(makeCurve((u) => {
        const ang = base + sweep * u;
        return v3(Math.cos(ang) * P.k, -h + Math.sin(ang) * P.k, 0);
      }, { samples: 200, color: ACC }));
      writeRing(ring, 0, -h, P.k);
    } else if (ty === 'lineRatio') {
      const d = P.a / 2;
      if (Math.abs(P.k - 1) < 0.02) {
        const l = dynamicLine(2, ACC, 0.95);
        writeSeg(l, 0, -BOX, 0, BOX, 0);
        locusCurve.add(l);
      } else {
        const cx = (d * (P.k * P.k + 1)) / (P.k * P.k - 1);
        const rr = (2 * d * P.k) / Math.abs(P.k * P.k - 1);
        locusCurve.add(makeCurve((u) => {
          const ang = u * Math.PI * 2;
          return v3(cx + rr * Math.cos(ang), rr * Math.sin(ang), 0);
        }, { samples: 180, color: ACC }));
      }
    } else {
      const n = normalOf(P.p);
      const dir = [-n[1], n[0]];
      for (const sgn of [1, -1]) {
        const l = dynamicLine(2, ACC, 0.95);
        writeSeg(l,
          sgn * P.k * n[0] - dir[0] * BOX * 1.6, sgn * P.k * n[1] - dir[1] * BOX * 1.6,
          sgn * P.k * n[0] + dir[0] * BOX * 1.6, sgn * P.k * n[1] + dir[1] * BOX * 1.6, 0);
        locusCurve.add(l);
      }
      writeSeg(baseLine, -dir[0] * BOX * 1.6, -dir[1] * BOX * 1.6, dir[0] * BOX * 1.6, dir[1] * BOX * 1.6, -0.05);
      writeSeg(par1, -dir[0] * BOX * 1.6 + P.k * n[0], -dir[1] * BOX * 1.6 + P.k * n[1],
        dir[0] * BOX * 1.6 + P.k * n[0], dir[1] * BOX * 1.6 + P.k * n[1], 0);
      writeSeg(par2, -dir[0] * BOX * 1.6 - P.k * n[0], -dir[1] * BOX * 1.6 - P.k * n[1],
        dir[0] * BOX * 1.6 - P.k * n[0], dir[1] * BOX * 1.6 - P.k * n[1], 0);
      writeBand(-dir[0] * BOX * 1.6, -dir[1] * BOX * 1.6, dir[0] * BOX * 1.6, dir[1] * BOX * 1.6, P.k, -0.03);
      bandLabel.userData.setText('幅 2k');
    }

    // 表示の入れ替え
    const on = (o, flag) => { o.visible = flag; };
    on(focus1, ty !== 'distance');
    on(focus2, ty === 'sum' || ty === 'diff');
    on(distBar2, ty === 'sum' || ty === 'diff');
    on(circle, ty === 'circlePoint');
    on(line, ty === 'distance');
    on(lineA, ty === 'circlePoint');
    on(lineB, ty === 'circlePoint');
    on(band, ty === 'distance');
    on(ruler, ty === 'sum' || ty === 'diff');
    on(trace, P.mode !== 'curve');

    traceCount = 0;
    traceGeo.setDrawRange(0, 0);
  }

  function setParams(patch = {}) {
    if (patch.type) P.type = patch.type;
    if (patch.a != null) P.a = Math.max(0.2, patch.a);
    if (patch.b != null) P.b = Math.max(0.2, patch.b);
    if (patch.k != null) P.k = patch.k;
    if (patch.p) P.p = [patch.p[0] ?? P.p[0], patch.p[1] ?? P.p[1]];
    if (patch.mode) P.mode = patch.mode;
    if (patch.speed != null) P.speed = patch.speed;
    if (patch.spin != null) P.spin = patch.spin;
    if (patch.accent != null) ACC = accentOf(patch.accent);
    if (patch.t != null) { P.t = patch.t; P.auto = false; }   // t を指定すると固定
    if (patch.auto != null) P.auto = !!patch.auto;
    rebuild();
    refresh(P.t);
  }

  /** 点 P の位置・2本の距離・定規・点群をまとめて更新する。 */
  function refresh(tt) {
    const q = locusAt(tt);
    if (!q) return;
    st.px = q[0]; st.py = q[1];
    point.position.set(q[0], q[1], 0.16);
    st.d1 = Math.hypot(q[0] - focus1.position.x, q[1] - focus1.position.y);
    st.d2 = Math.hypot(q[0] - focus2.position.x, q[1] - focus2.position.y);
    writeSeg(bar1, focus1.position.x, focus1.position.y, q[0], q[1], 0.12);
    placeRuler(ruler1, focus1.position.x, focus1.position.y, q[0], q[1], -0.12);
    if (P.type === 'sum' || P.type === 'diff') {
      writeSeg(bar2, focus2.position.x, focus2.position.y, q[0], q[1], 0.1);
      placeRuler(ruler2, focus2.position.x, focus2.position.y, q[0], q[1], -0.24);
      dist1.userData.setValue(`|PF₁| = ${n(st.d1)}   |PF₂| = ${n(st.d2)}`);
    } else if (P.type === 'product') {
      dist1.userData.setValue(`|PA|·|PB| = ${n(st.d1 * st.d2)}`);
    } else if (P.type === 'circlePoint') {
      writeSeg(segA, focus1.position.x, focus1.position.y, q[0], q[1], 0.12);
      writeSeg(segB, focus2.position.x, focus2.position.y, q[0], q[1], 0.1);
      const d = P.a / 2;
      const ang = 2 * Math.asin(Math.min(d / Math.max(P.k, 1e-6), 1));
      dist1.userData.setValue(`∠APB = ${n((ang * 180) / Math.PI)}°（一定）`);
    } else if (P.type === 'lineRatio') {
      dist1.userData.setValue(`AP : PB = ${n(st.d1)} : ${n(st.d2)}`);
    } else {
      writeSeg(bar1, 0, 0, q[0], q[1], 0.12);
      dist1.userData.setValue(`距離 = ${n(st.d1)} = k`);
    }
    dist1.position.set(q[0] + 0.35, q[1] + 0.55, 0);

    if (traceCount < TRACE_MAX && parts.trace.visible) {
      tracePos[traceCount * 3] = q[0];
      tracePos[traceCount * 3 + 1] = q[1];
      tracePos[traceCount * 3 + 2] = 0.02;
      traceCount++;
      traceGeo.setDrawRange(0, traceCount);
      traceGeo.attributes.position.needsUpdate = true;
    }
  }

  let acc = 0;
  function update(dt, elapsed) {
    if (P.auto && P.mode !== 'curve') {
      P.t = (P.t + dt * P.speed * P.spin) % 1;
    }
    acc += dt;
    if (acc < 0.03) return;
    acc = 0;
    refresh(P.t);
  }

  function dispose() { disposeObject(group); }

  rebuild();
  refresh(P.t);
  return { group, parts, params: P, setParams, update, dispose };
}

const n = (x) => (Math.abs(x) < 1e-9 ? '0' : String(Math.round(x * 1000) / 1000));
