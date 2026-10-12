import * as THREE from 'three';
import { lineBasic, basicMat, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makeCurve, makePoint, accentOf } from './common.js';

/**
 * 媒介変数と極座標。x = f(t), y = g(t) の棒グラフ（横軸が t）と、
 * 動径 r = f(θ) を引いた先の点が描く極曲線を同じ場所に置く。
 * kind ごとの形:
 *   circle      x = a cos t, y = b sin t
 *   lissajous   x = sin(a t + c), y = b sin(b t)
 *   spiral      双曲螺線 r = a/θ + b（θ → 0 で無限大、極軸が漸近線）
 *   rose        r = a cos(n θ)
 *   cycloid     x = a(t − sin t) + b, y = a(1 − cos t) + c
 *   epicycloid  x = (a+b)cos t − a cos((a+b)t/a), y = (a+b) sin t − a sin((a+b)t/a)
 */
export function createParamCurve(params = {}) {
  const {
    mode = 'parametric',
    t = 0,
    tEnd = Math.PI * 2,
    t0 = 0,
    kind = 'circle',
    a = 1,
    b = 1,
    c = 1,
    n = 3,
    box = 4,
    accent = 0x6ee7ff,
  } = params;

  let ACC = accentOf(accent);
  const AMBER = 0xffd479;
  const MINT = 0x7cffb2;
  const PINK = 0xff6b9d;
  const SAMPLES = 720;

  const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const group = new THREE.Group();
  const parts = {};
  const P = {
    mode, t, tEnd, t0, kind, a, b, c, n, box,
    auto: true, speed: 0.55, shadowRot: null, shadowSpin: null, scale: 1, cur: t,
  };

  // ---------------------------------------------------------- 共通の小部品
  function flatAxes() {
    const ax = makeAxes({ size: P.box * 2, ticks: P.box, accent: ACC, labels: ['x', 'y', ''] });
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

  function put(line, i, x, y, z = 0) { line.geometry.attributes.position.setXYZ(i, x, y, z); }
  function flush(line, n) {
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.setDrawRange(0, n);
    line.geometry.computeBoundingSphere();
  }
  function writeSeg(line, ax, ay, bx, by, z = 0) { put(line, 0, ax, ay, z); put(line, 1, bx, by, z); flush(line, 2); }

  function makeValueTag({ height = 0.34, color = '#eaf6ff', bg = 'rgba(6,10,22,0.88)', border = 'rgba(110,231,255,0.35)' } = {}) {
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

  // ------------------------------------------------------------ 曲線本体
  const curve = new THREE.Group();
  group.add(curve);
  parts.curve = curve;

  const shadowCurve = new THREE.Group();
  const shadowLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([v3(), v3()]),
    lineBasic(0x9db4ff, 0.35)
  );
  shadowCurve.add(shadowLine);
  group.add(shadowCurve);
  parts.shadowCurve = shadowCurve;

  // 掃いた部分（曲線の上に重ねる太線）
  const sweep = new THREE.Group();
  const sweepLine = new THREE.Line(
    (() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SAMPLES + 1) * 3), 3));
      geo.setDrawRange(0, 0);
      return geo;
    })(),
    lineBasic(0xffffff, 0.95)
  );
  sweepLine.frustumCulled = false;
  sweep.add(sweepLine);
  group.add(sweep);
  parts.sweep = sweep;

  // ----------------------------------------------------------------- 背景
  const axes = flatAxes();
  group.add(axes);
  parts.axes = axes;

  const grid = makeGridPlane({ size: P.box * 2, div: P.box * 2, color: 0x2f4a7a, opacity: 0.4, plane: 'xy' });
  group.add(grid);
  parts.grid = grid;

  // ------------------------------------------------------ 動点と補助線
  const movingPoint = new THREE.Group();
  const dot = makePoint(0xffffff, { size: 0.13, halo: 1.0 });
  movingPoint.add(dot);
  const readout = makeValueTag({ height: 0.38 });
  movingPoint.add(readout);
  group.add(movingPoint);
  parts.movingPoint = movingPoint;

  const radiusBar = new THREE.Group();
  const radLine = dynamicLine(2, AMBER, 0.95);
  radiusBar.add(radLine);
  const radLabel = makeValueTag({ height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.82)', border: 'rgba(255,212,121,0.4)' });
  radiusBar.add(radLabel);
  group.add(radiusBar);
  parts.radiusBar = radiusBar;

  const angleArc = new THREE.Group();
  const arcLine = dynamicLine(33, AMBER, 0.95);
  angleArc.add(arcLine);
  const arcLabel = makeValueTag({ height: 0.3, color: '#ffd479', bg: 'rgba(6,10,22,0.82)', border: 'rgba(255,212,121,0.4)' });
  angleArc.add(arcLabel);
  group.add(angleArc);
  parts.angleArc = angleArc;

  const spokes = new THREE.Group();
  const dropX = dynamicLine(2, 0xffffff, 0.5);    // 動点から x 軸への縦線
  const dropY = dynamicLine(2, 0xffffff, 0.35);   // 動点から y 軸への横線
  spokes.add(dropX, dropY);
  group.add(spokes);
  parts.spokes = spokes;

  const xLine = new THREE.Group();               // t 軸から x へ棒
  const xBar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basicMat(MINT, 0.55));
  xLine.add(xBar);
  group.add(xLine);
  parts.xLine = xLine;

  const yLine = new THREE.Group();               // t 軸から y へ棒
  const yBar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basicMat(AMBER, 0.55));
  yLine.add(yBar);
  group.add(yLine);
  parts.yLine = yLine;

  const paramTrace = new THREE.Group();           // t 軸の目盛と動く印
  const axisT = dynamicLine(2, 0xffffff, 0.7);
  const ticks = dynamicLine(24, 0xffffff, 0.6);
  const marker = dynamicLine(2, 0xffffff, 0.95);
  const tLabel = makeLabel('t', { height: 0.32, color: '#ffffff', bg: 'rgba(6,10,22,0.8)' });
  const eqLabel = makeLabel('', { height: 0.34, color: '#eaf6ff', bg: 'rgba(6,10,22,0.85)', border: 'rgba(110,231,255,0.35)' });
  paramTrace.add(axisT, ticks, marker, tLabel, eqLabel);
  group.add(paramTrace);
  parts.paramTrace = paramTrace;

  const asymptote = new THREE.Group();
  const asyLine = dynamicLine(2, PINK, 0.85);
  asymptote.add(asyLine);
  const asyLabel = makeLabel('θ = 0', { height: 0.3, color: '#ff6b9d', bg: 'rgba(6,10,22,0.82)' });
  asymptote.add(asyLabel);
  group.add(asymptote);
  parts.asymptote = asymptote;

  // ------------------------------------------------------------ 再構築
  const pts = new Float32Array((SAMPLES + 1) * 3);

  /** 縮尺を掛ける前の値（螺線の特異点は 0.06 で逃がす）。 */
  function rawAt(t) {
    if (P.mode === 'polar') {
      if (P.kind === 'rose') { const r = P.a * Math.cos(P.n * t); return [r * Math.cos(t), r * Math.sin(t)]; }
      if (P.kind === 'spiral') {
        const r = P.a / Math.max(t, 0.06) + P.b;
        return [r * Math.cos(t), r * Math.sin(t)];
      }
      return [P.a * Math.cos(t), P.a * Math.sin(t)];
    }
    switch (P.kind) {
      case 'circle': return [P.a * Math.cos(t), P.b * Math.sin(t)];
      case 'lissajous': return [Math.sin(P.a * t + P.c), P.b * Math.sin(P.b * t)];
      case 'spiral': {
        const r = P.a / Math.max(t, 0.06) + P.b;
        return [r * Math.cos(t), r * Math.sin(t)];
      }
      case 'rose': { const r = P.a * Math.cos(P.n * t); return [r * Math.cos(t), r * Math.sin(t)]; }
      case 'cycloid': return [P.a * (t - Math.sin(t)) + P.b, P.a * (1 - Math.cos(t)) + P.c];
      case 'epicycloid': {
        const R = P.a + P.b, w = (R / Math.max(P.a, 1e-6)) * t;
        return [R * Math.cos(t) - P.a * Math.cos(w), R * Math.sin(t) - P.a * Math.sin(w)];
      }
      default: return [P.a * Math.cos(t), P.b * Math.sin(t)];
    }
  }

  /** 媒介変数の値を世界座標（縮尺込み）で返す。 */
  function evalAt(t) {
    const q = rawAt(t);
    return [q[0] * P.scale, q[1] * P.scale];
  }

  function rebuild() {
    const s0 = P.t0, s1 = P.tEnd;
    // 箱に収まる縮尺（螺線線のように無限大へ向かう点だけ外す）
    let mx = 1e-6;
    for (let i = 0; i <= 200; i++) {
      const t = s0 + ((s1 - s0) * i) / 200;
      const q = rawAt(t);
      const d = Math.max(Math.abs(q[0]), Math.abs(q[1]));
      if (d < P.box * 1.2) mx = Math.max(mx, d);
    }
    P.scale = P.box / mx;

    for (let i = 0; i <= SAMPLES; i++) {
      const t = s0 + ((s1 - s0) * i) / SAMPLES;
      const q = evalAt(t);
      pts[i * 3] = q[0];
      pts[i * 3 + 1] = q[1];
      pts[i * 3 + 2] = 0;
    }
    resetGroup(curve);
    curve.add(makeCurve((u) => {
      const i = Math.min(SAMPLES, Math.round(u * SAMPLES));
      return v3(pts[i * 3], pts[i * 3 + 1], 0);
    }, { samples: SAMPLES, color: ACC }));

    // 極座標のままの影（原点まわりに回した同じ曲線）
    shadowLine.geometry.dispose();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pts.slice(), 3));
    shadowLine.geometry = sg;

    // 掃いた部分も同じ点列を使う（drawRange だけを進める）
    const sweepGeo = sweepLine.geometry;
    sweepGeo.attributes.position.array.set(pts);
    sweepGeo.attributes.position.needsUpdate = true;
    sweepGeo.setDrawRange(0, 0);
    sweepGeo.computeBoundingSphere();

    // t 軸
    const axY = -P.box * 1.22;
    writeSeg(axisT, -P.box * 1.05, axY, P.box * 1.05, axY, -0.05);
    tLabel.position.set(P.box * 1.12, axY, 0);
    for (let i = 0; i < 12; i++) {
      const tt = s0 + ((s1 - s0) * i) / 11;
      const tx = -P.box + (2 * P.box * i) / 11;
      put(ticks, i * 2, tx, axY - 0.09, -0.05);
      put(ticks, i * 2 + 1, tx, axY + 0.09, -0.05);
    }
    flush(ticks, 24);

    // 漸近線（双曲螺線は θ → 0 で極軸に吸い付く）
    if (P.kind === 'spiral') {
      writeSeg(asyLine, P.box * 1.05, 0, P.box * 1.6, 0, -0.04);
      asyLabel.position.set(P.box * 1.18, 0.3, 0);
    }

    const isParam = P.mode === 'parametric';
    parts.angleArc.visible = !isParam;
    parts.radiusBar.visible = !isParam || P.kind === 'spiral';
    parts.xLine.visible = isParam;
    parts.yLine.visible = isParam;
    parts.paramTrace.visible = isParam;
    parts.spokes.visible = true;
    parts.shadowCurve.visible = !isParam;
    parts.asymptote.visible = !isParam && P.kind === 'spiral';
    if (P.shadowRot == null) P.shadowRot = P.kind === 'rose' ? Math.PI / Math.max(P.n, 1) : 0.5;
    if (P.shadowSpin == null) P.shadowSpin = P.kind === 'rose' ? 0 : 0.2;
    shadowCurve.rotation.z = P.shadowRot;

    // 曲線の式を t 軸のそばに置く
    eqLabel.userData.setText({
      circle: `x = ${f(P.a)} cos t,  y = ${f(P.b)} sin t`,
      lissajous: `x = sin(${f(P.a)}t + ${f(P.c)}),  y = ${f(P.b)} sin(${f(P.b)}t)`,
      spiral: isParam ? 'x = (a/θ + b) cos θ,  y = (a/θ + b) sin θ' : 'r = a/θ + b',
      rose: 'r = a cos(nθ)',
      cycloid: 'x = a(t − sin t) + b,  y = a(1 − cos t) + c',
      epicycloid: 'x = (a+b) cos t − a cos((a+b)t/a)',
    }[P.kind] ?? '');
    eqLabel.position.set(-P.box * 1.05, axY - 0.55, 0);
  }

  function setParams(patch = {}) {
    if (patch.mode) P.mode = patch.mode;
    if (patch.kind) P.kind = patch.kind;
    if (patch.tEnd != null) P.tEnd = patch.tEnd;
    if (patch.t0 != null) P.t0 = patch.t0;
    if (patch.a != null) P.a = patch.a;
    if (patch.b != null) P.b = patch.b;
    if (patch.c != null) P.c = patch.c;
    if (patch.n != null) P.n = patch.n;
    if (patch.box != null) P.box = Math.max(1, patch.box);
    if (patch.shadowRot != null) P.shadowRot = patch.shadowRot;
    if (patch.shadowSpin != null) P.shadowSpin = patch.shadowSpin;
    if (patch.speed != null) P.speed = patch.speed;
    if (patch.accent != null) ACC = accentOf(patch.accent);
    if (patch.t != null) { P.t = patch.t; P.auto = false; }
    if (patch.auto != null) P.auto = !!patch.auto;
    rebuild();
  }

  function update(dt, elapsed) {
    if (P.auto) {
      const span = Math.max(P.tEnd - P.t0, 1e-6);
      P.t = P.t0 + ((P.t - P.t0 + dt * P.speed * span * 0.25) % span);
    }
    const tt = clamp(P.t, P.t0, P.tEnd);
    const q = evalAt(tt);
    dot.position.set(q[0], q[1], 0.14);
    readout.position.set(q[0], q[1] - 0.72, 0);

    // 掃いた部分
    const frac = (tt - P.t0) / Math.max(P.tEnd - P.t0, 1e-6);
    sweepLine.geometry.setDrawRange(0, Math.max(2, Math.round(frac * SAMPLES) + 1));

    // 動径と偏角
    const r = Math.hypot(q[0], q[1]);
    const th = Math.atan2(q[1], q[0]);
    writeSeg(radLine, 0, 0, q[0], q[1], 0.06);
    radLabel.position.set(q[0] * 0.55 + 0.25, q[1] * 0.55 + 0.25, 0);
    radLabel.userData.setValue(`r = ${f(r / P.scale)}`);
    if (parts.angleArc.visible) {
      const arcR = Math.min(1.1, Math.max(0.35, r * 0.4));
      const attr = arcLine.geometry.attributes.position;
      for (let i = 0; i < 33; i++) {
        const a = (th * i) / 32;
        attr.setXYZ(i, Math.cos(a) * arcR, Math.sin(a) * arcR, 0.05);
      }
      attr.needsUpdate = true;
      arcLine.geometry.computeBoundingSphere();
      arcLabel.position.set(arcR * Math.cos(th * 0.5) + 0.2, arcR * Math.sin(th * 0.5) + 0.2, 0);
      arcLabel.userData.setValue(`θ = ${f((tt * 180) / Math.PI)}°`);
    }

    // 軸への垂線
    writeSeg(dropX, q[0], 0, q[0], q[1], -0.02);
    writeSeg(dropY, 0, q[1], q[0], q[1], -0.02);

    // 棒グラフ（媒介変数モード）
    if (P.mode === 'parametric') {
      const axY = -P.box * 1.22;
      const tx = -P.box + 2 * P.box * frac;
      writeSeg(marker, tx, axY - 0.16, tx, axY + 0.16, -0.04);
      const bw = 0.16;
      xBar.position.set(tx - bw, (axY + q[0]) / 2, 0);
      xBar.scale.set(bw, Math.abs(q[0] - axY), 1);
      yBar.position.set(tx + bw, (axY + q[1]) / 2, 0);
      yBar.scale.set(bw, Math.abs(q[1] - axY), 1);
      readout.position.set(tx + 0.9, axY + 0.4, 0);
      readout.userData.setValue(
        `t = ${f(tt)}   x = ${f(q[0] / P.scale)}   y = ${f(q[1] / P.scale)}`
      );
    } else {
      readout.position.set(q[0], q[1] - 0.72, 0);
      readout.userData.setValue(
        `θ = ${f((tt * 180) / Math.PI)}°   r = ${f(r / P.scale)}`
      );
    }

    // 影の回転
    if (parts.shadowCurve.visible) {
      shadowCurve.rotation.z = P.shadowRot + elapsed * P.shadowSpin;
    }
  }

  function dispose() { disposeObject(group); }

  rebuild();
  update(0, 0);
  return { group, parts, params: P, setParams, update, dispose };
}

const f = (x) => (Math.abs(x) < 1e-9 ? '0' : String(Math.round(x * 1000) / 1000));
