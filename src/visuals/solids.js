import * as THREE from 'three';
import { solidMat, lineBasic, dotTexture, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp, TAU } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makePoint, makeArrow, makeOrbit, Animated, accentOf } from './common.js';

/**
 * 立体図形の体積と表面積を 3D で示す。
 * 円錐・円柱・球・四角錐・円錐台は底面の半径と高さを作り、水平に層を切って
 * 積層で体積を示す。球は接平面で切り Cavalieri の原理を見せ、回転体は関数を
 * 軸まわりにまわし、切断は断面の形と大きさを別に見せる。
 */
export function createSolids(params = {}) {
  const {
    shape = 'cone',
    r = 2.2, h = 4.2, n = 60, slices = 40,
    fn = null, accent = 0x6ee7ff,
  } = params;

  const col = accentOf(accent);
  const group = new THREE.Group();
  const parts = {};
  const P = {
    shape, r, h, n, slices, fn,
    rt: params.rt ?? 0.45,
    sides: params.sides ?? 4,
    cutShape: params.cutShape ?? 'cone',
    count: 1, spin: 0, H: 4.2, volume: 0, area: 0,
  };

  const GOLD = 0xffd166;
  const MINT = 0x7cffb2;
  const SKY = 0x8fe8ff;
  const ROSE = 0xff6b9d;
  const REV_FN = (x) => Math.max(0, 1.6 * Math.cos(x * 0.8) - x * 0.35 + 1.2);

  function vessel(name) {
    const g = new THREE.Group();
    group.add(g);
    parts[name] = g;
    return g;
  }
  /** 器に入れた幾何とマテリアルを解放してから空にする。 */
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

  const grid = makeGridPlane({ size: 13, div: 26, color: 0x2f4a7a, opacity: 0.4 });
  group.add(grid);
  parts.grid = grid;
  const axes = makeAxes({ size: 11, ticks: 10, accent: col, labels: ['x', 'y', 'z'] });
  group.add(axes);
  parts.axes = axes;

  const solid = vessel('solid');
  const wire = vessel('wire');
  const axis = vessel('axis');
  const base = vessel('base');
  const heightBar = vessel('heightBar');
  const radiusBar = vessel('radiusBar');
  const sliceGroup = vessel('slices');
  const fillUp = vessel('fillUp');
  const disc = vessel('disc');
  const inscribedSphere = vessel('inscribedSphere');
  const rings = vessel('rings');
  const crossSection = vessel('crossSection');
  const sectionShape = vessel('sectionShape');
  const revolved = vessel('revolved');
  const cutPlane = vessel('cutPlane');
  const cutFace = vessel('cutFace');

  const anim = new Animated({ count: 1, spin: 0 });
  const info = makeLabel('', { height: 0.44, color: '#eaf6ff', bg: 'rgba(6,10,22,0.84)', border: 'rgba(110,231,255,0.32)' });
  info.position.set(0, 7.4, 0);
  group.add(info);
  parts.info = info;

  const lblR = makeLabel('r', { height: 0.32, color: '#ffd166' });
  const lblH = makeLabel('h', { height: 0.32, color: '#9fd8ff' });

  const ringPts = (rad, y, seg = 48) => {
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
    }
    return pts;
  };
  const sidesOf = () => (P.shape === 'pyramid' ? clamp(Math.round(P.sides), 3, 12) : Math.max(6, Math.round(P.n)));

  /** t は底から天端までの割合。返り値はその水平面の半径。 */
  function sectionAt(t) {
    if (P.shape === 'sphere') return Math.sqrt(Math.max(1 - (2 * t - 1) ** 2, 0)) * P.r;
    if (P.shape === 'pyramid') return P.r * (1 - t) * Math.cos(Math.PI / sidesOf());
    if (P.shape === 'frustum') return lerp(P.r, P.r * P.rt, t);
    if (P.shape === 'cylinder') return P.r;
    if (P.shape === 'cone') return P.r * (1 - t);
    return P.r;
  }

  const isSphere = () => P.shape === 'sphere';
  const isRevolve = () => P.shape === 'revolution';
  const revFn = () => (typeof P.fn === 'function' ? P.fn : REV_FN);

  // ---------------------------------------------------------- 作り直し
  function rebuild() {
    for (const key of ['solid', 'wire', 'axis', 'base', 'heightBar', 'radiusBar', 'slices',
      'fillUp', 'disc', 'inscribedSphere', 'rings', 'crossSection', 'sectionShape',
      'revolved', 'cutPlane', 'cutFace']) emptyOf(parts[key]);
    lblR.parent?.remove(lblR);
    lblH.parent?.remove(lblH);

    const rev = isRevolve();
    const cut = P.shape === 'cut';
    const sph = isSphere();

    solid.visible = !rev;
    wire.visible = !rev;
    axis.visible = !rev && !cut;
    base.visible = heightBar.visible = radiusBar.visible = !rev && !cut && !sph;
    sliceGroup.visible = !rev && !cut;
    fillUp.visible = !rev && !cut;
    disc.visible = sph;
    inscribedSphere.visible = sph;
    rings.visible = sph;
    sectionShape.visible = cut || sph;
    crossSection.visible = rev;
    revolved.visible = rev;
    cutPlane.visible = cut;
    cutFace.visible = cut;

    if (rev) buildRevolve();
    else if (cut) buildCut();
    else buildBody();
  }

  // --- 円錐・円柱・球・四角錐・円錐台
  function buildBody() {
    const sph = isSphere();
    const H = sph ? P.r * 2 : P.h;
    P.H = H;

    axis.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, H + 0.9, 0)]),
      lineBasic(0xffffff, 0.45)
    ));
    axis.add(makeArrow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H, 0), { color: 0xffffff, headSize: 0.12, shaft: 0.008 }));

    if (sph) {
      // 接平面。どこで切っても断面積は変わらない（ Cavalieri の原理）。
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(P.r * 2.4, P.r * 2.4), solidMat(0xbcd4ff, { opacity: 0.06 }));
      plane.rotation.x = -Math.PI / 2;
      disc.add(plane);
      disc.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts(P.r * 1.15, 0, 56)), lineBasic(0xbcd4ff, 0.5)));
      disc.add(new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r, 0.05, 56), solidMat(0xbcd4ff, { opacity: 0.16 })));
      for (const s of [-1, 1]) {
        const c = makePoint(0xbcd4ff, { size: 0.1, halo: 0.7 });
        c.position.set(0, P.r + s * P.r * 0.4, 0);
        disc.add(c);
      }
      const dl = makeLabel('接平面で切る', { height: 0.34, color: '#bcd4ff' });
      dl.position.set(P.r * 1.35, P.r * 0.4, 0);
      disc.add(dl);

      // 水平に切った円の形そのもの
      const face = new THREE.Mesh(new THREE.CircleGeometry(P.r, 56), solidMat(MINT, { opacity: 0.2 }));
      face.rotation.x = -Math.PI / 2;
      face.position.set(0, P.r * 1.9, 0);
      sectionShape.add(face);
      sectionShape.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ringPts(P.r, P.r * 1.9, 56)),
        lineBasic(MINT, 0.8)
      ));
      const sl = makeLabel('切り口は円', { height: 0.34, color: '#7cffb2' });
      sl.position.set(0, P.r * 1.9 + 0.42, 0);
      sectionShape.add(sl);
    } else {
      base.add(new THREE.Mesh(circleGeo(P.r, 0, sidesOf()), solidMat(col, { opacity: 0.26 })));
      base.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts(P.r, 0, 48)), lineBasic(GOLD, 0.7)));
      radiusBar.add(makeArrow(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(P.r, 0.02, 0), { color: GOLD, headSize: 0.16 }));
      lblR.position.set(P.r * 0.5, -0.4, 0);
      radiusBar.add(lblR);
      heightBar.add(makeArrow(
        new THREE.Vector3(0, 0, P.r * 0.85), new THREE.Vector3(0, H, P.r * 0.85), { color: SKY, headSize: 0.16 }
      ));
      lblH.position.set(0, H * 0.5, P.r * 0.85 + 0.45);
      heightBar.add(lblH);
    }

    // 本体。CylinderGeometry と ConeGeometry は原点中心なので底が y=0 に来るよう上げる。
    const body = bodyGeometry();
    if (body) {
      const mesh = new THREE.Mesh(body, solidMat(P.shape === 'cone' ? 0xff8fb1 : 0x4f7fd0, { opacity: 0.22, roughness: 0.5 }));
      mesh.position.y = sph ? P.r : H / 2;
      solid.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body, 20), lineBasic(0x9fd8ff, 0.45));
      edges.position.copy(mesh.position);
      wire.add(edges);
    }

    // 積み上げの層
    const SL = clamp(Math.round(P.slices), 3, 60);
    for (let i = 0; i < SL; i++) {
      const y0 = (i / SL) * H;
      const y1 = ((i + 1) / SL) * H;
      const rad = Math.max(sectionAt((y0 + y1) / 2 / H), 0.02);
      const layer = new THREE.Mesh(sliceGeometry(rad, sidesOf(), y1 - y0), solidMat(i % 2 ? MINT : col, { opacity: 0.15, roughness: 0.6 }));
      layer.position.set(0, (y0 + y1) / 2, 0);
      layer.userData.noReveal = true;
      layer.userData.idx = i;
      sliceGroup.add(layer);
      sliceGroup.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ringPts(rad, y1, 48)),
        lineBasic(MINT, 0.32)
      ));
    }

    // 体積が積み上がる面
    if (sph) {
      const sweep = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 48), solidMat(MINT, { opacity: 0.55 }));
      sweep.userData.noReveal = true;
      sweep.userData.sweep = true;
      fillUp.add(sweep);
    } else {
      const fill = new THREE.Mesh(bodyGeometry(), solidMat(MINT, { opacity: 0.32 }));
      fill.userData.noReveal = true;
      fillUp.add(fill);
    }

    if (sph) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r, P.r, 48, 1, true), solidMat(GOLD, { opacity: 0.1 }));
      ins.position.y = P.r;
      ins.userData.noReveal = true;
      inscribedSphere.add(ins);
      for (const y of [0, P.r * 0.5, P.r]) {
        inscribedSphere.add(new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(ringPts(P.r, y, 48)),
          lineBasic(GOLD, 0.5)
        ));
      }
      const il = makeLabel('同じ断面積の円柱', { height: 0.34, color: '#ffd166' });
      il.position.set(0, P.r * 0.5, P.r + 0.5);
      inscribedSphere.add(il);
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        rings.add(new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(ringPts(sectionAt(t), t * 2 * P.r, 48)),
          lineBasic(0xffffff, 0.28)
        ));
      }
    }

    P.volume = volumeOf();
    P.area = surfaceArea();
    info.position.y = H + 1.8;
    info.userData.setText(`体積 ${P.volume.toFixed(2)}     表面積 ${P.area.toFixed(2)}`);
  }

  function bodyGeometry() {
    if (isSphere()) return new THREE.SphereGeometry(P.r, 64, 40);
    if (P.shape === 'cylinder') return new THREE.CylinderGeometry(P.r, P.r, P.h, 64, 1, false);
    if (P.shape === 'cone') return new THREE.ConeGeometry(P.r, P.h, 64, 1, false);
    if (P.shape === 'frustum') return new THREE.CylinderGeometry(P.r * P.rt, P.r, P.h, 64, 1, false);
    if (P.shape === 'pyramid') return new THREE.ConeGeometry(P.r, P.h, sidesOf(), 1, false);
    return null;
  }

  function sliceGeometry(rad, sides, thick) {
    return new THREE.CylinderGeometry(rad, rad, thick, Math.max(6, sides), 1, false);
  }

  function circleGeo(rad, y, sides) {
    const m = Math.max(3, Math.round(sides));
    const pos = [];
    for (let i = 0; i < m; i++) {
      const a0 = (i / m) * TAU, a1 = ((i + 1) / m) * TAU;
      pos.push(0, y, 0, Math.cos(a0) * rad, y, Math.sin(a0) * rad, Math.cos(a1) * rad, y, Math.sin(a1) * rad);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function volumeOf() {
    const m = sidesOf();
    if (P.shape === 'sphere') return (4 / 3) * Math.PI * P.r ** 3;
    if (P.shape === 'cylinder') return Math.PI * P.r ** 2 * P.h;
    if (P.shape === 'cone') return (1 / 3) * Math.PI * P.r ** 2 * P.h;
    if (P.shape === 'frustum') return (Math.PI * P.h / 3) * (P.r ** 2 + P.r * P.r * P.rt + (P.r * P.rt) ** 2);
    if (P.shape === 'pyramid') return (m / 3) * P.r ** 2 * Math.sin((TAU / m)) * P.h;
    return 0;
  }
  function surfaceArea() {
    const l = Math.hypot(P.r, P.h);
    if (P.shape === 'sphere') return 4 * Math.PI * P.r ** 2;
    if (P.shape === 'cylinder') return 2 * Math.PI * P.r ** 2 + 2 * Math.PI * P.r * P.h;
    if (P.shape === 'cone') return Math.PI * P.r * l + Math.PI * P.r ** 2;
    if (P.shape === 'frustum') {
      const l2 = Math.hypot(P.r - P.r * P.rt, P.h);
      return Math.PI * (P.r + P.r * P.rt) * l2 + Math.PI * P.r ** 2 + Math.PI * (P.r * P.rt) ** 2;
    }
    if (P.shape === 'pyramid') {
      const m = sidesOf();
      const s = 2 * P.r * Math.sin(Math.PI / m);
      const face = (m / 4) * s * Math.hypot(P.h, P.r * Math.cos(Math.PI / m));
      return face + (m / 2) * P.r ** 2 * Math.sin(TAU / m);
    }
    return 0;
  }

  // --- 回転体
  function buildRevolve() {
    const f = revFn();
    const X0 = -2.4, X1 = 2.4, S = 72;
    const prof = [];
    for (let i = 0; i <= S; i++) {
      const x = lerp(X0, X1, i / S);
      prof.push(new THREE.Vector2(x, Math.max(f(x), 0)));
    }
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), solidMat(col, { opacity: 0.24, roughness: 0.5 }));
    mesh.rotation.z = -Math.PI / 2;
    revolved.add(mesh);
    const orbit = makeOrbit(0.001, { color: 0xffffff, opacity: 0 });
    orbit.visible = false;
    revolved.add(orbit);

    crossSection.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(prof.map((q) => new THREE.Vector3(q.x, q.y, 0))),
      lineBasic(MINT, 0.95)
    ));
    crossSection.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X0, 0, 0), new THREE.Vector3(X1, 0, 0)]),
      lineBasic(0xffffff, 0.5)
    ));
    for (let i = 0; i <= S; i += 9) {
      const q = prof[i];
      crossSection.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(q.x, 0, 0), new THREE.Vector3(q.x, q.y, 0)]),
        lineBasic(0x9fd8ff, 0.3)
      ));
    }
    const fl = makeLabel('回転軸', { height: 0.3, color: '#9fd8ff' });
    fl.position.set(X1, -0.45, 0);
    crossSection.add(fl);
    const pl = makeLabel('断面', { height: 0.3, color: '#7cffb2' });
    pl.position.set(X0 - 0.4, 1.0, 0);
    crossSection.add(pl);

    let vol = 0;
    for (let i = 0; i < S; i++) {
      const a = prof[i], b = prof[i + 1];
      vol += (Math.PI / 3) * (b.x - a.x) * (a.y * a.y + a.y * b.y + b.y * b.y);
    }
    P.volume = vol;
    P.area = 0;
    info.position.y = 4.2;
    info.userData.setText(`回転体の体積 ${vol.toFixed(2)}（切り片を積分区間ごとに足す）`);
  }

  // --- 切断
  function buildCut() {
    const H = P.h;
    const kind = P.cutShape;
    info.position.y = H + 1.5;

    // 切られる立体。断面がどこから出るかを確かめるための下地。
    const body = kind === 'cylinder' ? new THREE.CylinderGeometry(P.r, P.r, H, 48)
      : kind === 'sphere' ? new THREE.SphereGeometry(P.r, 48, 32)
        : new THREE.ConeGeometry(P.r, H, 48);
    const skin = new THREE.Mesh(body, solidMat(0x4f7fd0, { opacity: 0.16, roughness: 0.5 }));
    skin.position.y = kind === 'sphere' ? P.r : H / 2;
    solid.add(skin);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body, 20), lineBasic(0x9fd8ff, 0.3));
    edges.position.copy(skin.position);
    wire.add(edges);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(P.r * 2.6, H * 1.3), solidMat(ROSE, { opacity: 0.1 }));
    cutPlane.add(plane);
    cutPlane.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-P.r * 1.3, -H * 0.65, 0), new THREE.Vector3(P.r * 1.3, -H * 0.65, 0),
        new THREE.Vector3(P.r * 1.3, H * 0.65, 0), new THREE.Vector3(-P.r * 1.3, H * 0.65, 0),
      ]),
      lineBasic(ROSE, 0.6)
    ));
    const pl = makeLabel('縦に切る', { height: 0.34, color: '#ff8fb1' });
    pl.position.set(0, H * 0.85, 0);
    cutPlane.add(pl);

    let pts, note;
    if (kind === 'cylinder') {
      pts = [new THREE.Vector3(-P.r, 0, 0), new THREE.Vector3(P.r, 0, 0), new THREE.Vector3(P.r, H, 0), new THREE.Vector3(-P.r, H, 0)];
      note = `切断面 = 長方形 ${(2 * P.r).toFixed(2)} x ${H.toFixed(2)} = ${(2 * P.r * H).toFixed(2)}`;
    } else if (kind === 'sphere') {
      pts = ringPts(P.r, P.r, 56);
      note = `切断面 = 円。面積 ${(Math.PI * P.r ** 2).toFixed(2)}`;
    } else {
      pts = [new THREE.Vector3(-P.r, 0, 0), new THREE.Vector3(P.r, 0, 0), new THREE.Vector3(0, H, 0)];
      note = `切断面 = 二等辺三角形。底辺 ${(2 * P.r).toFixed(2)}、高さ ${H.toFixed(2)}、面積 ${(P.r * H).toFixed(2)}`;
    }

    // 断面を縦に立てる
    const shape = flatShape(pts);
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), solidMat(ROSE, { opacity: 0.32 }));
    wall.position.set(0, 0, 0);
    cutFace.add(wall);
    cutFace.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineBasic(0xffd0dd, 0.95)
    ));
    const lb = makeLabel(note, {
      height: 0.36, color: '#ffd0dd', bg: 'rgba(6,10,22,0.84)', border: 'rgba(255,107,157,0.35)',
    });
    lb.position.set(0, H * 0.5, 0.5);
    cutFace.add(lb);

    // 断面の形と大きさを別に示す
    const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), solidMat(ROSE, { opacity: 0.3 }));
    face.rotation.x = -Math.PI / 2;
    face.position.set(0, 0.02, 2.6);
    sectionShape.add(face);
    const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(ROSE, 0.9));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(0, 0.03, 2.6);
    sectionShape.add(rim);
    const sl = makeLabel('断面の形', { height: 0.36, color: '#ff8fb1' });
    sl.position.set(0, 0.5, 2.6);
    sectionShape.add(sl);

    // 水平に切ると底面と同じ円
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(P.r, 56), solidMat(MINT, { opacity: 0.2 }));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(0, 0.02, -2.6);
    sectionShape.add(bottom);
    sectionShape.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPts(P.r, 0.03, 56)), lineBasic(MINT, 0.85)
    ));
    const bl = makeLabel('水平に切ると底面と同じ円', { height: 0.32, color: '#7cffb2' });
    bl.position.set(0, 0.5, -2.6);
    sectionShape.add(bl);

    P.volume = 0;
    P.area = 0;
    info.userData.setText(note);
  }
  function flatShape(pts) {
    const s = new THREE.Shape();
    s.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
    s.closePath();
    return s;
  }

  function setParams(patch) {
    let dirty = false;
    for (const k of ['shape', 'r', 'h', 'n', 'slices', 'fn', 'rt', 'sides', 'cutShape']) {
      if (patch[k] !== undefined) { P[k] = patch[k]; dirty = true; }
    }
    if (patch.count !== undefined) anim.to({ count: patch.count });
    if (patch.spin !== undefined) anim.to({ spin: patch.spin });
    Object.assign(P, patch);
    if (dirty) rebuild();
  }

  function update(dt, elapsed) {
    const a = anim.update(dt, 4.0);
    P.count = a.count;
    P.spin = a.spin;
    const t = clamp(a.count, 0, 1);

    // 層が下から順に現れる
    if (sliceGroup.visible) {
      const total = clamp(Math.round(P.slices), 3, 60);
      for (const o of sliceGroup.children) {
        const i = o.userData.idx;
        if (i === undefined) continue;
        o.visible = t * total - i > 0.02;
      }
    }
    // 体積が積み上がる面
    if (fillUp.visible && fillUp.children.length) {
      const f = fillUp.children[0];
      f.visible = t > 0.02;
      if (f.userData.sweep) {
        const rad = Math.max(sectionAt(t), 1e-3);
        f.scale.set(rad, 1, rad);
        f.position.y = t * P.H;
      } else {
        f.scale.y = Math.max(t, 1e-3);
        f.position.y = (P.H * t) / 2;
      }
    }
    // 回転体はゆっくり回る
    if (revolved.visible) revolved.rotation.y = elapsed * 0.3 * (1 + a.spin);
    // 球の切り口だけを回して、層の関係が分かるようにする
    if (rings.visible) {
      for (const o of rings.children) o.rotation.y = -elapsed * 0.2;
    }
  }

  function dispose() {
    disposeObject(group);
  }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
