import * as THREE from 'three';
import { solidMat, lineBasic, glowSprite, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp, TAU } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makePoint, makeArrow, Animated } from './common.js';

/**
 * 関数を3D空間に立たせる標準ビルダー。
 *
 * y=f(x) を発光曲線として描き、床への射影・曲線と床をつなぐ幕・x=t の柱・
 * 接線・割線・面積・回転体・漸近線をステップで出し入れできる。
 * 二次関数・指数/対数・三角関数のグラフ・極限・微分積分・合成/逆関数が
 * すべてこの一つのビルダーを共有する。
 */
export function createGraph3D(params = {}) {
  const {
    fn = (x) => x * x,
    domain = [-4, 4],
    yRange = [-2, 5],
    accent = 0x6ee7ff,
    curveWidth = 0.05,
    showAxes = true,
    label = null,
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = {
    fn, domain, yRange, yScale: 1, t: domain[0] + (domain[1] - domain[0]) * 0.18,
    showArea: 0, showVolume: 0, showTangent: 0, showSecant: 0, showAsymptote: 0,
    showProjection: 1, showCurtain: 0, sweep: 0, mirror: 0,
  };

  const f = (x) => fn(x);
  // A function with a vertical asymptote (1/x, tan x, ...) evaluates to ±Infinity
  // exactly at the pole. Feeding that to TubeGeometry produces NaN vertices, so
  // values are clipped to a band just off-screen: the curve still runs out of
  // frame in the right direction, but stays finite.
  const LIMIT = Math.max(Math.abs(yRange[0]), Math.abs(yRange[1]), 1) * 3;
  const safeY = (x) => {
    const y = fn(x) * P.yScale;
    if (Number.isNaN(y)) return LIMIT;
    return clamp(y, -LIMIT, LIMIT);
  };

  // ------------------------------------------------------------- backdrop
  if (showAxes) {
    const ax = makeAxes({ size: 10, ticks: 10, accent, labels: ['x', 'y', 'z'] });
    group.add(ax);
    parts.axes = ax;
  }
  const grid = makeGridPlane({ size: 12, div: 24, color: 0x2f4a7a, opacity: 0.42 });
  grid.position.y = 0;
  group.add(grid);
  parts.grid = grid;

  // y-value ticks on the left edge help read the height of a point.
  const scale3 = (x, y) => new THREE.Vector3(x, y, 0);
  const YS = () => yRange[1] * P.yScale;

  // ---------------------------------------------------------------- curve
  const SAMPLES = 420;
  const curveGroup = new THREE.Group();
  const curvePts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = lerp(domain[0], domain[1], i / SAMPLES);
    curvePts.push(scale3(x, safeY(x)));
  }
  const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
  const curveLine = new THREE.Line(curveGeo, new THREE.LineBasicMaterial({ color: accent }));
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), SAMPLES, curveWidth, 8, false),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  curveGroup.add(curveLine, tube);
  group.add(curveGroup);
  parts.curve = curveGroup;

  if (label) {
    const cl = makeLabel(label, { height: 0.46, color: '#eaf6ff', bg: 'rgba(6,10,22,0.72)', border: 'rgba(110,231,255,0.35)' });
    cl.position.set(domain[1] * 0.52, YS() * 0.92, 0);
    group.add(cl);
    parts.curveLabel = cl;
  }

  // ------------------------------------------------------- floor projection
  const projGeo = new THREE.BufferGeometry().setFromPoints(curvePts.map((p) => new THREE.Vector3(p.x, 0.004, 0)));
  const projLine = new THREE.Line(projGeo, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.32 }));
  group.add(projLine);
  parts.projection = projLine;

  // --------------------------------------------------------------- curtain
  const curtainGeo = new THREE.BufferGeometry();
  const curtainPos = new Float32Array(SAMPLES * 6 * 3);
  const curtainIdx = [];
  for (let i = 0; i < SAMPLES; i++) {
    const o = i * 2;
    curtainIdx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  curtainGeo.setAttribute('position', new THREE.BufferAttribute(curtainPos, 3));
  curtainGeo.setIndex(curtainIdx);
  const curtain = new THREE.Mesh(curtainGeo, new THREE.MeshBasicMaterial({
    color: accent, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false,
  }));
  curtain.frustumCulled = false;
  group.add(curtain);
  parts.curtain = curtain;

  // --------------------------------------------------------- moving marker
  const marker = new THREE.Group();
  const dot = makePoint(0xffffff, { size: 0.11, halo: 0.85 });
  marker.add(dot);
  const stem = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  marker.add(stem);
  group.add(marker);
  parts.marker = marker;

  const tLabel = makeLabel('x', { height: 0.34, color: '#ffffff', bg: 'rgba(6,10,22,0.8)', border: 'rgba(255,255,255,0.25)' });
  group.add(tLabel);
  parts.tLabel = tLabel;

  // ------------------------------------------------------- tangent & secant
  const tangent = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd479 }));
  const secant = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8fe8ff }));
  group.add(tangent, secant);
  parts.tangent = tangent;
  parts.secant = secant;
  tangent.visible = secant.visible = false;

  // ------------------------------------------------------------- area fill
  const areaGeo = new THREE.BufferGeometry();
  const area = new THREE.Mesh(areaGeo, new THREE.MeshBasicMaterial({
    color: 0x8fe8ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false,
  }));
  area.frustumCulled = false;
  group.add(area);
  parts.area = area;
  area.visible = false;

  // Under-curve "columns" that rise to the curve — the picture of a Riemann sum.
  const COLS = 48;
  const cols = new THREE.Group();
  const colMat = new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const colMeshes = [];
  for (let i = 0; i < COLS; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), colMat);
    m.visible = false;
    cols.add(m);
    colMeshes.push(m);
  }
  group.add(cols);
  parts.columns = cols;
  parts.columnMeshes = colMeshes;

  // -------------------------------------------------------- rotation solid
  const solidMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
    color: 0x7cffb2, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
  }));
  solidMesh.frustumCulled = false;
  group.add(solidMesh);
  parts.solid = solidMesh;
  solidMesh.visible = false;

  // -------------------------------------------------------------- asymptote
  const asymptote = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(domain[0], 0, 0), new THREE.Vector3(domain[1], 0, 0)]),
    new THREE.LineDashedMaterial({ color: 0xff6b9d, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0.8 })
  );
  asymptote.computeLineDistances();
  group.add(asymptote);
  parts.asymptote = asymptote;
  asymptote.visible = false;

  // ------------------------------------------------------------- equations
  const eqLabel = makeLabel('y = f(x)', { height: 0.44, color: '#eaf6ff', bg: 'rgba(6,10,22,0.78)', border: 'rgba(110,231,255,0.3)' });
  eqLabel.position.set(domain[1] * 0.5, YS() * 0.62, 0);
  eqLabel.visible = false;
  group.add(eqLabel);
  parts.equation = eqLabel;

  // --------------------------------------------- reflection across y = x
  // 逆関数の図。元のグラフと線対称の位置に二重に描かれる。
  const mirrorGroup = new THREE.Group();
  const mirrorTube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts.map((p) => new THREE.Vector3(p.y, p.x, 0))), SAMPLES, curveWidth, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const mirrorDots = new THREE.Points(
    (() => {
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(curvePts.length * 3);
      curvePts.forEach((p, i) => { arr[i * 3] = p.y; arr[i * 3 + 1] = p.x; arr[i * 3 + 2] = 0; });
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      return g;
    })(),
    new THREE.PointsMaterial({ color: 0xffd479, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false })
  );
  mirrorGroup.add(mirrorTube, mirrorDots);
  const mirrorLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-domain[1], -domain[0], 0), new THREE.Vector3(domain[1], domain[0], 0),
    ]),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.24, gapSize: 0.2, transparent: true, opacity: 0.5 })
  );
  mirrorLine.computeLineDistances();
  mirrorGroup.add(mirrorLine);
  group.add(mirrorGroup);
  parts.mirror = mirrorGroup;
  mirrorGroup.visible = false;

  const anim = new Animated({ t: P.t, yScale: P.yScale, showArea: 0, showVolume: 0, showTangent: 0, showSecant: 0, showAsymptote: 0, showProjection: 1, showCurtain: 0, sweep: 0, mirror: 0 });

  function setParams(patch) {
    if (patch.fn) { P.fn = patch.fn; rebuildCurve(); }
    if (patch.equation) eqLabel.userData.setText(patch.equation);
    if (patch.eqShow != null) eqLabel.visible = !!patch.eqShow;
    if (patch.label) parts.curveLabel?.userData.setText(patch.label);
    if (patch.asymptoteY != null) {
      asymptote.geometry.dispose();
      asymptote.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(domain[0], patch.asymptoteY * P.yScale, 0),
        new THREE.Vector3(domain[1], patch.asymptoteY * P.yScale, 0),
      ]);
      asymptote.computeLineDistances();
    }
    Object.assign(P, patch);
    anim.to({
      showArea: patch.showArea ?? anim.target.showArea,
      showVolume: patch.showVolume ?? anim.target.showVolume,
      showTangent: patch.showTangent ?? anim.target.showTangent,
      showSecant: patch.showSecant ?? anim.target.showSecant,
      showAsymptote: patch.showAsymptote ?? anim.target.showAsymptote,
      showProjection: patch.showProjection ?? anim.target.showProjection,
      showCurtain: patch.showCurtain ?? anim.target.showCurtain,
      sweep: patch.sweep ?? anim.target.sweep,
      mirror: patch.mirror ?? anim.target.mirror,
      t: patch.t ?? anim.target.t,
      yScale: patch.yScale ?? anim.target.yScale,
    });
  }

  function rebuildCurve() {
    for (let i = 0; i <= SAMPLES; i++) {
      const x = lerp(domain[0], domain[1], i / SAMPLES);
      curvePts[i].set(x, safeY(x), 0);
    }
    curveGeo.attributes.position.needsUpdate = true;
    curveGeo.computeBoundingSphere();
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), SAMPLES, curveWidth, 8, false);
    projGeo.attributes.position.needsUpdate = true;

    mirrorTube.geometry.dispose();
    mirrorTube.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(curvePts.map((p) => new THREE.Vector3(p.y, p.x, 0))),
      SAMPLES, curveWidth, 8, false
    );
    const mArr = mirrorDots.geometry.attributes.position.array;
    curvePts.forEach((p, i) => { mArr[i * 3] = p.y; mArr[i * 3 + 1] = p.x; mArr[i * 3 + 2] = 0; });
    mirrorDots.geometry.attributes.position.needsUpdate = true;
  }

  function setLine(line, a, b) {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
  }

  function update(dt, elapsed) {
    const a = anim.update(dt, 4.2);
    P.t = a.t; P.yScale = a.yScale;

    // marker + stem
    const x = clamp(a.t, domain[0], domain[1]);
    const y = safeY(x);
    dot.position.set(x, y, 0);
    setLine(stem, new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, y, 0));
    tLabel.position.set(x, y + 0.55, 0);
    tLabel.userData.setText(`x = ${x.toFixed(2)}   y = ${y.toFixed(2)}`);

    // curtain
    const arr = curtainGeo.attributes.position.array;
    for (let i = 0; i <= SAMPLES; i++) {
      const p = curvePts[i];
      arr[i * 6] = p.x; arr[i * 6 + 1] = p.y; arr[i * 6 + 2] = 0;
      arr[i * 6 + 3] = p.x; arr[i * 6 + 4] = 0; arr[i * 6 + 5] = 0;
    }
    curtainGeo.attributes.position.needsUpdate = true;
    curtain.material.opacity = 0.07 * a.showCurtain;
    curtain.visible = a.showCurtain > 0.02;
    projLine.material.opacity = 0.22 * a.showProjection;
    projLine.visible = a.showProjection > 0.02;

    // tangent / secant
    const showT = a.showTangent > 0.02;
    tangent.visible = showT;
    if (showT) {
      const h = 0.02;
      const d = (fn(x + h) - fn(x - h)) / (2 * h);
      if (!Number.isFinite(d)) { tangent.visible = false; return; }
      tangent.visible = true;
      setLine(tangent, new THREE.Vector3(x - 4, (y - d * 4) * a.yScale, 0), new THREE.Vector3(x + 4, (y + d * 4) * a.yScale, 0));
    }
    const showS = a.showSecant > 0.02;
    secant.visible = showS;
    if (showS) {
      const x0 = 0;
      setLine(secant, new THREE.Vector3(x0, 0, 0), new THREE.Vector3(x, y, 0));
    }
    asymptote.visible = a.showAsymptote > 0.02;
    mirrorGroup.visible = a.mirror > 0.02;
    mirrorTube.material.opacity = 0.5 * a.mirror;
    mirrorDots.material.opacity = 0.8 * a.mirror;

    // Riemann columns
    const wantCols = a.showArea > 0.02;
    cols.visible = wantCols;
    if (wantCols) {
      const w = (domain[1] - domain[0]) / COLS;
      for (let i = 0; i < COLS; i++) {
        const x0 = domain[0] + i * w;
        const h = Math.abs(safeY(x0 + w));
        const m = colMeshes[i];
        m.visible = true;
        m.position.set(x0 + w / 2, h / 2, 0);
        m.scale.set(w * 0.86, h, 1);
      }
      colMat.opacity = 0.3 * a.showArea;
    }

    // area slab
    area.visible = a.showArea > 0.02 && wantCols;
    if (area.visible) {
      const pos = [];
      for (let i = 0; i < COLS; i++) {
        const w = (domain[1] - domain[0]) / COLS;
        const x0 = domain[0] + i * w;
        const x1 = x0 + w;
        const y1 = safeY(x1);
        pos.push(x0, 0, 0, x1, 0, 0, x0, y1, 0, x1, y1, 0);
      }
      areaGeo.dispose();
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g2.computeVertexNormals();
      area.geometry = g2;
      area.material.opacity = 0.4 * a.showArea;
    }

    // rotation solid about the x-axis
    solidMesh.visible = a.showVolume > 0.02;
    if (solidMesh.visible) {
      const prof = [];
      for (let i = 0; i <= 120; i++) {
        const xx = lerp(domain[0], domain[1], i / 120);
        prof.push(new THREE.Vector2(xx, Math.max(safeY(xx), 0)));
      }
      const lathe = new THREE.LatheGeometry(prof, 64);
      solidMesh.geometry.dispose();
      solidMesh.geometry = lathe;
      // LatheGeometry revolves around Y; rotate so it becomes revolution about the x-axis.
      solidMesh.rotation.z = Math.PI / 2;
      solidMesh.material.opacity = 0.32 * a.showVolume;
    }
  }

  function dispose() { disposeObject(group); }

  return { group, parts, params: P, setParams, update, dispose, yAt: (x) => f(x) * anim.cur.yScale };
}
