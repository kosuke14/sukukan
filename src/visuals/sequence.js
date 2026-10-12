import * as THREE from 'three';
import { solidMat, lineBasic, basicMat, pointMat, dotTexture, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp, TAU } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makePoint, makeArrow, Animated, accentOf } from './common.js';

/**
 * 数列の3Dモデル。
 * 等差数列・等比数列・第n項の式・漸化式・有限和を同じ座標系に並べて見比べる。
 * 棒の高さが項の値、x 軸が項の番号、z 軸は補助表示の置き場。
 */
export function createSequence(params = {}) {
  const {
    kind = 'arithmetic',
    a1 = 1, d = 2, r = 2, n = 8,
    terms = [1, 4, 9, 16, 25, 36, 49, 64],
    nextA = 0, nextB = 0, b = 0.5, c = 0.25,
    accent = 0x6ee7ff, helix = 0.55,
  } = params;

  const col = accentOf(accent);
  const group = new THREE.Group();
  const parts = {};
  const P = {
    kind, a1, a2: params.a2 ?? 1, d, r, n, terms: [...terms], nextA, nextB, b, c, helix,
    count: 1, yScale: 1, scale: 1, values: [],
  };

  const STEP = 1.15;
  const BARW = 0.68;

  // 器は一度だけ作って、作り直しでは中身だけを空にする。
  function vessel(name) {
    const g = new THREE.Group();
    group.add(g);
    parts[name] = g;
    return g;
  }
  function emptyOf(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (m.userData?.shared) continue;
          if (m.map && m.map !== dotTexture() && !m.map.userData?.shared) m.map.dispose();
          m.dispose();
        }
      }
    });
    g.clear();
  }

  // ---------------------------------------------------------------- 土台
  const axes = makeAxes({ size: 11, ticks: 10, accent: col, labels: ['n', 'a', 'z'] });
  group.add(axes);
  parts.axes = axes;

  const grid = makeGridPlane({ size: 13, div: 26, color: 0x2f4a7a, opacity: 0.4 });
  group.add(grid);
  parts.grid = grid;

  const bars = vessel('bars');
  const points = vessel('points');
  const termLabels = vessel('termLabels');
  const diffSegments = vessel('diffSegments');
  const ratioSegments = vessel('ratioSegments');
  const risingSteps = vessel('risingSteps');
  const sumBar = vessel('sumBar');
  const sumBlocks = vessel('sumBlocks');
  const tree = vessel('tree');
  const fixedPoints = vessel('fixedPoints');
  const divergeAxis = vessel('divergeAxis');
  const scatter = vessel('scatter');
  const helixPath = vessel('helixPath');

  // 数え上げの進捗は update 側で補間する。
  const anim = new Animated({ count: 1, yScale: 1 });
  const formula = makeLabel('a_n', { height: 0.42, color: '#eaf6ff', bg: 'rgba(6,10,22,0.78)', border: 'rgba(110,231,255,0.3)' });
  formula.position.set(0, 6.1, 0);

  const sumText = makeLabel('S_n = 0', { height: 0.4, color: '#ffe6a8', bg: 'rgba(6,10,22,0.78)', border: 'rgba(255,209,102,0.4)' });
  let lastSum = -1;

  // ------------------------------------------------------------ 項の計算
  function termValues() {
    const cnt = Math.max(2, Math.round(P.n));
    const out = [];
    const push = (v) => out.push(clamp(Number.isFinite(v) ? v : 0, -1e6, 1e6));
    if (P.kind === 'arithmetic') {
      for (let i = 0; i < cnt; i++) push(P.a1 + i * P.d);
    } else if (P.kind === 'geometric') {
      let v = P.a1;
      for (let i = 0; i < cnt; i++) { push(v); v *= P.r; }
    } else if (P.kind === 'explicit') {
      for (let i = 0; i < cnt; i++) {
        push(P.terms[i] ?? (P.explicitFn ? P.explicitFn(i + 1) : (i + 1) * (i + 1)));
      }
    } else if (P.kind === 'recurrence') {
      if (P.nextA || P.nextB) {
        let u = P.a1, v = P.a2;
        push(u); push(v);
        for (let i = 2; i < cnt; i++) { const w = P.nextA * v + P.nextB * u; u = v; v = w; push(w); }
      } else {
        let v = P.a1;
        for (let i = 0; i < cnt; i++) { push(v); v = P.b * v + P.c; }
      }
    } else {
      for (let i = 0; i < cnt; i++) push(P.a1 * (i + 1));
    }
    return out;
  }

  function formulaText() {
    if (P.kind === 'arithmetic') return `a_n = ${P.a1} + (n-1)·${P.d}`;
    if (P.kind === 'geometric') return `a_n = ${P.a1}·${P.r}^(n-1)`;
    if (P.kind === 'recurrence') {
      return (P.nextA || P.nextB)
        ? `a_(n+2) = ${P.nextA}·a_(n+1) + ${P.nextB}·a_n`
        : `a_(n+1) = ${P.b}·a_n + ${P.c}`;
    }
    if (P.kind === 'sum') return `S_n = 1 + 2 + … + n`;
    return P.formula ?? 'a_n = n^2';
  }

  const xOf = (i, cnt) => (i - (cnt - 1) / 2) * STEP;

  // ------------------------------------------------------------ 作り直し
  function rebuild() {
    const cnt = Math.max(2, Math.round(P.n));
    const V = termValues();
    P.values = V;
    const peak = Math.max(1, ...V.map(Math.abs));
    P.scale = 5.0 / peak;
    const h = (v) => v * P.scale * P.yScale;

    for (const key of ['bars', 'points', 'termLabels', 'diffSegments', 'ratioSegments',
      'risingSteps', 'sumBar', 'sumBlocks', 'tree', 'fixedPoints', 'divergeAxis', 'scatter', 'helixPath']) {
      emptyOf(parts[key]);
    }
    termLabels.add(formula);
    sumBar.add(sumText);
    lastSum = -1;
    formula.userData.setText(formulaText());

    // --- 棒（項の値そのもの）
    for (let i = 0; i < cnt; i++) {
      const y = h(V[i]);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(BARW, 1, BARW * 0.9),
        solidMat(i % 2 ? col : 0x3f6ea8, { opacity: 0.42, roughness: 0.4 })
      );
      mesh.position.set(xOf(i, cnt), y / 2, 0);
      mesh.scale.y = Math.max(Math.abs(y), 1e-3);
      mesh.userData.noReveal = true;
      mesh.userData.full = Math.max(Math.abs(y), 1e-3);
      bars.add(mesh);
    }

    // --- 頂点の点とラベル
    for (let i = 0; i < cnt; i++) {
      const y = h(V[i]);
      const p = makePoint(0xffffff, { size: 0.085, halo: 0.7 });
      p.position.set(xOf(i, cnt), y, 0);
      points.add(p);

      const vt = makeLabel(fmt(V[i]), { height: 0.32, color: '#eaf6ff' });
      vt.position.set(xOf(i, cnt), y + 0.42, 0.15);
      termLabels.add(vt);
      const it = makeLabel(`${i + 1}`, { height: 0.26, color: '#8fb2e6' });
      it.position.set(xOf(i, cnt), -0.42, 0.2);
      termLabels.add(it);
    }

    // --- 等差: 隣り合う差 d を矢印で
    diffSegments.visible = P.kind === 'arithmetic' || P.kind === 'sum';
    if (diffSegments.visible) {
      for (let i = 0; i < cnt - 1; i++) {
        const a = new THREE.Vector3(xOf(i, cnt), h(V[i]) + 0.28, 0);
        const b = new THREE.Vector3(xOf(i + 1, cnt), h(V[i + 1]) + 0.28, 0);
        diffSegments.add(makeArrow(a, b, { color: 0xffd166, headSize: 0.12, shaft: 0.012 }));
      }
      if (P.kind === 'arithmetic') {
        const mid = (cnt - 1) >> 1;
        const lb = makeLabel(`公差 ${fmt(P.d)}`, { height: 0.32, color: '#ffd166' });
        lb.position.set(xOf(mid, cnt), h(V[mid]) + 1.15, 0.2);
        diffSegments.add(lb);
      }
    }

    // --- 等比: 隣り合う比 r と極限の水平線
    ratioSegments.visible = P.kind === 'geometric';
    if (ratioSegments.visible) {
      for (let i = 0; i < cnt - 1; i++) {
        const a = new THREE.Vector3(xOf(i, cnt), h(V[i]) + 0.3, 0);
        const b = new THREE.Vector3(xOf(i + 1, cnt), h(V[i + 1]) + 0.3, 0);
        ratioSegments.add(makeArrow(a, b, { color: 0x8fe8ff, headSize: 0.13, shaft: 0.013 }));
        // r 倍した高さが次の項の高さになること
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(xOf(i, cnt), h(V[i + 1]), -0.34),
            new THREE.Vector3(xOf(i + 1, cnt), h(V[i + 1]), -0.34),
          ]),
          lineBasic(0x8fe8ff, 0.4)
        );
        ratioSegments.add(line);
      }
      const mid = (cnt - 1) >> 1;
      const lb = makeLabel(`公比 ${fmt(P.r)}`, { height: 0.32, color: '#8fe8ff' });
      lb.position.set(xOf(mid, cnt), h(V[mid]) + 1.3, 0.2);
      ratioSegments.add(lb);
      if (Math.abs(P.r) < 1) {
        const lim = P.a1 * P.r / (1 - P.r);
        const yl = h(lim);
        const ln = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(xOf(0, cnt) - STEP, yl, -0.34),
            new THREE.Vector3(xOf(cnt - 1, cnt) + STEP, yl, -0.34),
          ]),
          lineBasic(0xffd166, 0.6)
        );
        ratioSegments.add(ln);
        const pl = makeLabel(`極限 ${fmt(lim)}`, { height: 0.32, color: '#ffd166' });
        pl.position.set(xOf(cnt - 1, cnt), yl + 0.4, -0.34);
        ratioSegments.add(pl);
      }
    }

    // --- 累積 partial sums を階段で。値は項の総和なので、段は別に縮めて収める。
    risingSteps.visible = P.kind === 'sum' || P.kind === 'arithmetic';
    if (risingSteps.visible) {
      const partial = [];
      let acc = 0;
      for (let i = 0; i < cnt; i++) { acc += V[i]; partial.push(acc); }
      const sSum = 3.0 / Math.max(1, ...partial.map((q) => Math.abs(q)));
      const tops = [];
      for (let i = 0; i < cnt; i++) {
        const y = partial[i] * sSum;
        const m = new THREE.Mesh(new THREE.BoxGeometry(STEP * 0.92, 0.09, 0.9), solidMat(0x7cffb2, { opacity: 0.32 }));
        m.position.set(xOf(i, cnt), y, -1.5);
        m.userData.noReveal = true;
        risingSteps.add(m);
        tops.push(new THREE.Vector3(xOf(i, cnt), y, -1.5));
      }
      risingSteps.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tops), lineBasic(0x7cffb2, 0.8)));
      const lb = makeLabel('部分和', { height: 0.3, color: '#7cffb2' });
      lb.position.set(xOf(0, cnt), partial[cnt - 1] * sSum + 0.5, -1.5);
      risingSteps.add(lb);
    }

    // --- 総和の棒と積み上げブロック。総和は項より大きいので高さを別に取る。
    const total = V.reduce((s, v) => s + v, 0);
    const hSum = total * (4.2 / Math.max(1, Math.abs(total)));
    sumBar.visible = P.kind === 'sum';
    sumBlocks.visible = P.kind === 'sum';
    if (P.kind === 'sum') {
      const bx = xOf(0, cnt) - STEP * 1.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8), solidMat(0xffd166, { opacity: 0.5 }));
      m.position.set(bx, hSum / 2, 0);
      m.scale.y = Math.max(hSum, 1e-3);
      m.userData.noReveal = true;
      m.userData.full = Math.max(hSum, 1e-3);
      sumBar.add(m);
      sumText.position.set(bx, hSum + 0.6, 0.2);

      const each = V.map((v) => Math.min(Math.round(Math.abs(v)), 40));
      const cs = each.reduce((s, c) => s + c, 0) > 90 ? 90 / Math.max(1, each.reduce((s, c) => s + c, 0)) : 1;
      const counts = each.map((c) => Math.round(c * cs));
      const totalCubes = counts.reduce((s, c) => s + c, 0);
      // いちばん高い列が 3.6 になるように。列の高さのまま項の大小を表す。
      const cube = 3.6 / Math.max(1, ...counts);
      const inst = new THREE.InstancedMesh(
        new THREE.BoxGeometry(cube * 0.86, cube * 0.86, cube * 0.86),
        solidMat(0x7cffb2, { opacity: 0.62, roughness: 0.5 }),
        totalCubes
      );
      const dummy = new THREE.Object3D();
      let k = 0;
      for (let i = 0; i < cnt; i++) {
        for (let j = 0; j < counts[i]; j++) {
          dummy.position.set(xOf(i, cnt), (j + 0.5) * cube, 2.1);
          dummy.updateMatrix();
          inst.setMatrixAt(k++, dummy.matrix);
        }
      }
      inst.count = totalCubes;
      inst.userData.noReveal = true;
      inst.userData.totalCubes = totalCubes;
      sumBlocks.add(inst);
      const cl = makeLabel(`S_n = ${fmt(total)}`, { height: 0.34, color: '#7cffb2' });
      cl.position.set(xOf((cnt - 1) / 2, cnt), 4.6, 2.1);
      sumBlocks.add(cl);
    }

    // --- 漸化式の木
    tree.visible = P.kind === 'recurrence';
    fixedPoints.visible = P.kind === 'recurrence';
    divergeAxis.visible = false;
    if (P.kind === 'recurrence') {
      const tv = P.b;
      const scale2 = P.nextA || P.nextB;
      for (let i = 0; i < cnt; i++) {
        const x = xOf(i, cnt) * 0.8;
        const p = makePoint(col, { size: 0.1, halo: 0.8 });
        p.position.set(x, -1.6, 2.6);
        tree.add(p);
        const lb = makeLabel(fmt(V[i]), { height: 0.28, color: '#eaf6ff' });
        lb.position.set(x, -2.15, 2.6);
        tree.add(lb);
        const back = scale2 ? i - 2 : i - 1;
        if (i > 0) {
          const from = new THREE.Vector3(xOf(back, cnt) * 0.8, -1.6, 2.6);
          const to = new THREE.Vector3(x, -1.6, 2.6);
          tree.add(makeArrow(from, to, { color: 0x9fd8ff, headSize: 0.1, shaft: 0.011 }));
        }
      }
      const tl = makeLabel(scale2 ? '2つ前の項と1つ前の項から' : '1つ前の項から', { height: 0.3, color: '#9fd8ff' });
      tl.position.set(0, -2.7, 2.6);
      tree.add(tl);

      // 不動点: 定点 a = b·a + c を満たす値
      const fixed = Math.abs(tv - 1) < 1e-9
        ? (Math.abs(P.c) < 1e-9 ? 0 : null)
        : P.c / (1 - tv);
      if (fixed === null) {
        const lb = makeLabel('b = 1 のとき不動点なし', { height: 0.34, color: '#ff9f6e' });
        lb.position.set(0, 5.6, 0);
        fixedPoints.add(lb);
      } else {
        const y = h(fixed);
        fixedPoints.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(xOf(0, cnt) - STEP, y, 0.9),
            new THREE.Vector3(xOf(cnt - 1, cnt) + STEP, y, 0.9),
          ]),
          lineBasic(0xffd166, 0.7)
        ));
        const m = makePoint(0xffd166, { size: 0.13, halo: 1.0 });
        m.position.set(0, y, 0.9);
        fixedPoints.add(m);
        const lb = makeLabel(`不動点 ${fmt(fixed)}`, { height: 0.34, color: '#ffd166' });
        lb.position.set(0, y + 0.5, 0.9);
        fixedPoints.add(lb);
      }

      // b の大きさで挙動が変わる
      const bz = 3.0;
      const bx0 = -4.6, bx1 = 4.6;
      fixedPoints.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bx0, -3.6, bz), new THREE.Vector3(bx1, -3.6, bz)]),
        lineBasic(0x8fa8e0, 0.5)
      ));
      for (const e of [-1, 1]) {
        fixedPoints.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(e * 2.4, -3.75, bz), new THREE.Vector3(e * 2.4, -3.45, bz),
          ]),
          lineBasic(0xffd166, 0.9)
        ));
      }
      const bm = makePoint(Math.abs(tv) < 1 ? 0x7cffb2 : 0xff6b9d, { size: 0.11, halo: 0.9 });
      bm.position.set(clamp(tv, bx0, bx1), -3.6, bz);
      fixedPoints.add(bm);
      const bl = makeLabel(Math.abs(tv) < 1 ? '|b| < 1 収束' : '|b| > 1 発散', { height: 0.32, color: Math.abs(tv) < 1 ? '#7cffb2' : '#ff6b9d' });
      bl.position.set(0, -4.1, bz);
      fixedPoints.add(bl);

      if (Math.abs(tv) > 1) {
        const last = new THREE.Vector3(xOf(cnt - 1, cnt), h(V[cnt - 1]) + 0.4, 0);
        divergeAxis.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([last, last.clone().add(new THREE.Vector3(2.2, 2.6, 0))]),
          lineBasic(0xff6b9d, 0.6)
        ));
        divergeAxis.add(makeArrow(last, last.clone().add(new THREE.Vector3(2.2, 2.6, 0)), { color: 0xff6b9d, headSize: 0.17 }));
        const dl = makeLabel('発散', { height: 0.34, color: '#ff6b9d' });
        dl.position.copy(last).add(new THREE.Vector3(2.3, 3.0, 0));
        divergeAxis.add(dl);
      }
    }

    if (P.kind === 'geometric' && Math.abs(P.r) > 1) {
      const last = new THREE.Vector3(xOf(cnt - 1, cnt), h(V[cnt - 1]) + 0.4, 0);
      divergeAxis.add(makeArrow(last, last.clone().add(new THREE.Vector3(1.6, 3.0, 0)), { color: 0xff6b9d, headSize: 0.17 }));
      const dl = makeLabel('公比 > 1 で無限に伸びる', { height: 0.32, color: '#ff6b9d' });
      dl.position.copy(last).add(new THREE.Vector3(1.7, 3.4, 0));
      divergeAxis.add(dl);
      divergeAxis.visible = true;
    }

    // --- ばらつき: 項を点群で
    scatter.visible = P.kind === 'sum' || P.kind === 'geometric';
    if (scatter.visible) {
      const CAP = 240;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(CAP * 3), 3));
      const pts = new THREE.Points(geo, pointMat(0x8fb2e6, 0.09, 0.7));
      pts.frustumCulled = false;
      scatter.add(pts);
      const arr = geo.attributes.position.array;
      for (let i = 0; i < cnt && i < CAP; i++) {
        const jitter = Math.sin(i * 2.399) * 0.5;
        arr[i * 3] = xOf(i, cnt);
        arr[i * 3 + 1] = h(V[i]);
        arr[i * 3 + 2] = -3.6 + jitter;
      }
      geo.setDrawRange(0, Math.min(cnt, CAP));
      geo.attributes.position.needsUpdate = true;
      const sl = makeLabel('各項のばらつき', { height: 0.3, color: '#8fb2e6' });
      sl.position.set(0, 0.7, -3.6);
      scatter.add(sl);
    }

    // --- 螺旋表示
    const turns = cnt + 5;
    const SEG = Math.min(900, turns * 26);
    const hpts = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const fi = t * (cnt - 1 + 5);
      const i0 = clamp(Math.floor(fi), 0, cnt - 1);
      const i1 = clamp(i0 + 1, 0, cnt - 1);
      const v = lerp(V[i0], V[i1], fi - i0);
      const ang = t * turns * TAU;
      const rad = 0.35 + Math.min(Math.abs(v) * P.scale * P.helix, 1.5);
      hpts.push(new THREE.Vector3(Math.cos(ang) * rad, t * 4.4, Math.sin(ang) * rad));
    }
    const hc = new THREE.CatmullRomCurve3(hpts);
    helixPath.add(new THREE.Mesh(new THREE.TubeGeometry(hc, SEG, 0.04, 8, false), basicMat(col, 0.5, THREE.AdditiveBlending)));
    helixPath.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 4.6, 0)]),
      lineBasic(0xffffff, 0.22)
    ));
    for (let i = 0; i < cnt; i++) {
      const ang = (i / (cnt - 1 + 5)) * turns * TAU;
      const rad = 0.35 + Math.min(Math.abs(V[i]) * P.scale * P.helix, 1.5);
      const bm = makePoint(0xffffff, { size: 0.07, halo: 0.5 });
      bm.position.set(Math.cos(ang) * rad, (i / (cnt - 1 + 5)) * 4.4, Math.sin(ang) * rad);
      helixPath.add(bm);
    }
    helixPath.position.set(xOf(cnt - 1, cnt) + 1.75, 0.15, -0.35);
    const hl = makeLabel('項は次へつながる', { height: 0.32, color: '#cfe0ff' });
    hl.position.set(0, 5.0, 0);
    helixPath.add(hl);

    bars.visible = true;
    points.visible = true;
  }

  function fmt(v) {
    const r = Math.round(v * 1000) / 1000;
    return String(r);
  }

  function setParams(patch) {
    let dirty = false;
    for (const k of ['kind', 'a1', 'a2', 'd', 'r', 'n', 'terms', 'nextA', 'nextB', 'b', 'c', 'helix', 'explicitFn', 'formula']) {
      if (patch[k] !== undefined) { P[k] = Array.isArray(patch[k]) ? [...patch[k]] : patch[k]; dirty = true; }
    }
    if (patch.count !== undefined) anim.to({ count: patch.count });
    if (patch.yScale !== undefined) { P.yScale = patch.yScale; anim.to({ yScale: patch.yScale }); }
    if (patch.scaleTo !== undefined) P.scale = patch.scaleTo;
    Object.assign(P, patch);
    if (dirty) rebuild();
  }

  function update(dt, elapsed) {
    const a = anim.update(dt, 4.0);
    P.count = a.count;
    P.yScale = a.yScale;

    const cnt = bars.children.length;
    const shown = a.count * cnt;
    for (let i = 0; i < cnt; i++) {
      const m = bars.children[i];
      const full = m.userData.full ?? 1;
      m.scale.y = Math.max(full * clamp(shown - i, 0, 1), 1e-3);
    }
    if (sumBar.visible) {
      const m = sumBar.children.find((o) => o.isMesh);
      if (m) {
        const full = m.userData.full ?? 1;
        const total = P.values.reduce((s, v) => s + v, 0);
        // 総和の棒は後ろ 45% のあいだに伸びる。
        const tSum = clamp((shown - cnt * 0.55) / (cnt * 0.45), 0, 1);
        m.scale.y = Math.max(full * tSum, 1e-3);
        const done = Math.min(cnt, Math.floor(shown));
        if (done !== lastSum) {
          lastSum = done;
          let s2 = 0;
          for (let i = 0; i < done; i++) s2 += P.values[i];
          sumText.userData.setText(`S_${done} = ${fmt(s2)} / ${fmt(total)}`);
        }
      }
    }
    const inst = sumBlocks.children.find((o) => o.isInstancedMesh);
    if (inst) inst.count = Math.round(inst.userData.totalCubes * clamp(a.count, 0, 1));

    helixPath.rotation.y = elapsed * 0.12;
  }

  function dispose() {
    disposeObject(group);
  }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
