import * as THREE from 'three';
import { solidMat, lineBasic, glowSprite, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, TAU } from '../engine/MathUtil.js';
import { makePoint, makeArrow } from './common.js';

/**
 * 二次曲線の実空間モデル: ダブルコーンを平面で切り、その切断軌跡を見る。
 * 平面の傾きと位置で楕円・双曲線・放物線が連続的に切り替わる。
 */
export function createConics(params = {}) {
  const {
    kind = 'ellipse',
    a = 2.4,
    b = 1.6,
    c = 1.92,
    angle = -0.62,
    offset = 3.15,
    radius = 4.6,
    height = 7.4,
    accent = 0xff9f6e,
  } = params;

  const group = new THREE.Group();
  const parts = {};
  const P = { kind, a, b, c, angle, offset, radius, height, cut: 1 };

  // ---------------------------------------------------------------- cone
  const coneGeo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
  const cone = new THREE.Group();
  const coneSkin = new THREE.Mesh(coneGeo, solidMat(0x2c4f8a, { opacity: 0.17, side: THREE.DoubleSide, roughness: 0.6 }));
  coneSkin.renderOrder = 1;
  cone.add(coneSkin);
  cone.add(new THREE.LineSegments(new THREE.EdgesGeometry(coneGeo, 25), lineBasic(0x7ea6e8, 0.42)));
  group.add(cone);
  parts.cone = cone;

  // Generators: the ruling lines that meet at the apex.
  const gens = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * TAU;
    const pts = [new THREE.Vector3(0, height / 2, 0), new THREE.Vector3(Math.cos(a0) * radius, -height / 2, Math.sin(a0) * radius)];
    gens.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(0x9fc2ff, 0.18)));
  }
  group.add(gens);
  parts.generators = gens;

  // Apex + axis.
  const apex = makePoint(0xffffff, { size: 0.12, halo: 1.1 });
  apex.position.set(0, height / 2, 0);
  group.add(apex);
  parts.apex = apex;

  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -height / 2, 0), new THREE.Vector3(0, height / 2, 0)]),
    lineBasic(0xffffff, 0.35)
  );
  group.add(axis);
  parts.axis = axis;

  // ------------------------------------------------------- cutting plane
  const planePivot = new THREE.Group();
  const planeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 8.5),
    solidMat(0xbcd4ff, { opacity: 0.055, side: THREE.DoubleSide })
  );
  planeMesh.position.z = 0.01;
  planePivot.add(planeMesh);
  const planeEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(12, 8.5)),
    lineBasic(accent, 0.45)
  );
  planePivot.add(planeEdge);
  group.add(planePivot);
  parts.plane = planePivot;
  parts.planeEdge = planeEdge;

  // -------------------------------------------------------- intersection
  const curveMat = new THREE.MeshBasicMaterial({
    color: accent, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const section = new THREE.Mesh(new THREE.BufferGeometry(), curveMat);
  section.renderOrder = 4;
  const sectionLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  sectionLine.renderOrder = 5;
  group.add(section, sectionLine);
  parts.section = section;
  parts.sectionLine = sectionLine;

  // A second copy, offset onto the horizontal plane: where the curve is "read".
  const projMat = new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const sectionProj = new THREE.Mesh(new THREE.BufferGeometry(), projMat);
  sectionProj.renderOrder = 3;
  group.add(sectionProj);
  parts.sectionProj = sectionProj;

  // Foci / focus + directrix annotations.
  const focusGroup = new THREE.Group();
  const f1 = makePoint(0xffd479, { size: 0.13, halo: 0.9 });
  const f2 = makePoint(0xffd479, { size: 0.13, halo: 0.9 });
  const cc = makePoint(0x6ee7ff, { size: 0.09, halo: 0.7 });
  focusGroup.add(f1, f2, cc);
  group.add(focusGroup);
  parts.foci = focusGroup;
  parts.focus1 = f1;
  parts.focus2 = f2;
  parts.center = cc;

  const focusLabels = new THREE.Group();
  const l1 = makeLabel('F₁', { height: 0.3, color: '#ffd479' });
  const l2 = makeLabel('F₂', { height: 0.3, color: '#ffd479' });
  const lc = makeLabel('C', { height: 0.3, color: '#6ee7ff' });
  focusLabels.add(l1, l2, lc);
  group.add(focusLabels);
  parts.focusLabels = focusLabels;
  l1.position.y = 0.42; l2.position.y = 0.42; lc.position.y = 0.4;

  // Semi-major axis ruler.
  const majorAxis = makeArrow(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), { color: 0xff9f6e, headSize: 0.2, shaft: 0.022 });
  group.add(majorAxis);
  parts.majorAxis = majorAxis;

  // Distorted "scan" points riding the section curve.
  const SCAN = 60;
  const scanGeo = new THREE.BufferGeometry();
  const scanPos = new Float32Array(SCAN * 3);
  scanGeo.setAttribute('position', new THREE.BufferAttribute(scanPos, 3));
  const scan = new THREE.Points(scanGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.11, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scan.frustumCulled = false;
  group.add(scan);
  parts.scan = scan;

  const eLabel = makeLabel('e = 1.5', { height: 0.34, color: '#ffd479', bg: 'rgba(6,10,22,0.75)', border: 'rgba(255,212,121,0.4)' });
  eLabel.position.set(-radius * 0.75, -P.height / 2 + 0.9, radius * 0.9);
  group.add(eLabel);
  parts.eLabel = eLabel;
  eLabel.visible = false;

  let scanT = 0;
  let curveSamples = [];

  /**
   * Cone:  x² + z² = k²y²  (double cone, apex at the origin, k = R/(h/2)).
   * Plane: P(s,t) = (s, -d·cosθ - t·sinθ,  d·sinθ + t·cosθ)  — the plane's own
   * (s,t) frame, rotated by θ about the x axis and pushed distance d along its
   * normal. Substituting P into the cone gives a genuine quadratic in t:
   *
   *     (k²sin²θ - cos²θ)t² + 2d·sinθcosθ(k²-1)t + (k²d²cos²θ - d²sin²θ - s²) = 0
   *
   * Solving that for t at each s traces the intersection exactly, so the
   * ellipse / hyperbola / parabola is the cone's real cut, not an approximation.
   */
  function rebuild() {
    const ca = Math.cos(P.angle), sa = Math.sin(P.angle);
    const d = P.offset;
    const k = P.radius / (P.height / 2);

    const A = k * k * sa * sa - ca * ca;
    const B = 2 * d * sa * ca * (k * k - 1);
    const C0 = d * d * (k * k * ca * ca - sa * sa);
    const toWorld = (s, t) => new THREE.Vector3(s, -d * ca - t * sa, d * sa + t * ca);

    const roots = (s) => {
      const C = C0 - s * s;
      if (Math.abs(A) < 1e-9) {
        if (Math.abs(B) < 1e-9) return [];
        return [-C / B];
      }
      const disc = B * B - 4 * A * C;
      if (disc < 0) return [];
      const sq = Math.sqrt(disc);
      return [(-B + sq) / (2 * A), (-B - sq) / (2 * A)];
    };

    const S = P.radius * (P.kind === 'parabola' ? 1.8 : 3.2);
    const STEPS = 1400;
    const onCone = (p) =>
      Math.abs(p.y) <= P.height / 2 + 0.02 &&
      Math.hypot(p.x, p.z) <= P.radius + 0.02;
    const lo = [], hi = [];
    let sMin = Infinity, sMax = -Infinity;
    for (let i = 0; i <= STEPS; i++) {
      const s = -S + (2 * S * i) / STEPS;
      const r = roots(s);
      if (r.length === 0) continue;
      const a = toWorld(s, r[0]);
      const b = r.length > 1 ? toWorld(s, r[1]) : a;
      if (!onCone(a) && !onCone(b)) continue;
      lo.push(a); hi.push(b);
      sMin = Math.min(sMin, s); sMax = Math.max(sMax, s);
    }

    // For a closed ellipse, walk one branch out and the other back; for an open
    // curve only the outer branch is real (the other root leaves the cone).
    let curve;
    if (P.kind === 'ellipse') {
      curve = lo.slice();
      for (let i = hi.length - 1; i >= 0; i--) curve.push(hi[i]);
    } else {
      curve = [];
      for (let i = 0; i < lo.length; i++) {
        if (onCone(lo[i])) curve.push(lo[i]);
        if (onCone(hi[i])) curve.push(hi[i]);
      }
      curve.sort((p, q) => (p.x - q.x) || (p.y - q.y));
      const dedup = [curve[0]];
      for (let i = 1; i < curve.length; i++) {
        if (curve[i].distanceToSquared(dedup[dedup.length - 1]) > 1e-4) dedup.push(curve[i]);
      }
      curve = dedup;
    }
    curveSamples = curve;

    if (curve.length > 4) {
      // A closed loop for the ellipse, an open sweep for the parabola.
      const closed = P.kind === 'ellipse' && sMax - sMin < S * 1.9;
      const crv = new THREE.CatmullRomCurve3(curve, closed, 'centripetal', 0.4);
      section.geometry.dispose();
      section.geometry = new THREE.TubeGeometry(crv, Math.min(curve.length, 420), 0.042, 10, closed);
      sectionLine.geometry.dispose();
      sectionLine.geometry = new THREE.BufferGeometry().setFromPoints(curve);

      const proj = curve.map((p) => new THREE.Vector3(p.x, -P.height / 2 - 0.6, p.z));
      sectionProj.geometry.dispose();
      sectionProj.geometry = new THREE.BufferGeometry().setFromPoints(proj);
    } else {
      section.geometry.dispose();
      section.geometry = new THREE.BufferGeometry();
      sectionLine.geometry.dispose();
      sectionLine.geometry = new THREE.BufferGeometry();
      sectionProj.geometry.dispose();
      sectionProj.geometry = new THREE.BufferGeometry();
    }

    // Foci, centre and semi-axes are read off the quadratic, not hard-coded:
    //   s² + A't² + B't + C' = 0
    const Ap = ca * ca - k * k * sa * sa;
    const Bp = 2 * d * sa * ca * (1 - k * k);
    const Cp = d * d * (sa * sa - k * k * ca * ca);

    const origin = new THREE.Vector3(0, -d * ca, d * sa);
    const uAxis = new THREE.Vector3(1, 0, 0);
    const vAxis = new THREE.Vector3(0, -sa, ca);

    let center = origin.clone();
    let focusDist = 0;
    let semiMajor = P.a;
    let semiMinor = P.b;
    let ecc = 1;

    if (Math.abs(Ap) < 1e-6) {
      // Parabola: s² = -B'·t - C' = 4p·(t - t_v)
      const tv = -Cp / Bp;
      const p = -Bp / 4;
      center = toWorld(0, tv);
      focusDist = p;
      semiMajor = 3.4;
      ecc = 1;
      f1.position.copy(center).addScaledVector(vAxis, p);
      f2.position.copy(center);
      f2.visible = false;
    } else {
      const t0 = -Bp / (2 * Ap);
      const R2 = Ap * t0 * t0 - Cp;
      const alongU2 = R2;          // semi-axis squared along s
      const alongT2 = R2 / Ap;     // semi-axis squared along t (negative ⇒ hyperbola)
      center = toWorld(0, t0);

      let major2, minor2, axisIsU;
      if (Ap > 0) {
        if (alongU2 >= alongT2) { major2 = alongU2; minor2 = alongT2; axisIsU = true; }
        else { major2 = alongT2; minor2 = alongU2; axisIsU = false; }
        focusDist = Math.sqrt(Math.max(major2 - minor2, 0));   // ellipse
      } else {
        major2 = alongU2; minor2 = -alongT2; axisIsU = true;
        focusDist = Math.sqrt(Math.max(major2 + minor2, 0));   // hyperbola
      }
      semiMajor = Math.sqrt(Math.max(major2, 1e-6));
      semiMinor = Math.sqrt(Math.max(minor2, 1e-6));
      const axis = axisIsU ? uAxis : vAxis;
      f1.position.copy(center).addScaledVector(axis, -focusDist);
      f2.position.copy(center).addScaledVector(axis, focusDist);
      ecc = focusDist / semiMajor;
      P.axisIsU = axisIsU;
    }

    P.a = semiMajor;
    P.b = semiMinor;
    P.c = focusDist;

    l1.position.copy(f1.position).add(new THREE.Vector3(0, 0.42, 0));
    l2.position.copy(f2.position).add(new THREE.Vector3(0, 0.42, 0));
    l2.visible = P.kind !== 'parabola';
    cc.position.copy(center);
    lc.position.copy(center).add(new THREE.Vector3(0, 0.4, 0));

    const majLen = semiMajor * 1.1;
    const dir = Math.abs(Ap) < 1e-6
      ? vAxis
      : (P.axisIsU ? uAxis : vAxis);
    const from = center.clone().addScaledVector(dir, -majLen);
    const to = center.clone().addScaledVector(dir, majLen);
    majorAxis.clear();
    majorAxis.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), lineBasic(accent, 0.7)),
      makeArrow(from, center, { color: accent, headSize: 0.16, shaft: 0.014 })
    );

    eLabel.visible = Math.abs(ecc - 1) > 0.02;
    eLabel.userData.setText?.(`e = ${ecc.toFixed(2)}`);

    planePivot.position.set(0, -d * ca, d * sa);
    planePivot.rotation.x = P.angle;
  }

  function eccentricity(p) {
    if (p.kind === 'parabola') return 1;
    return clamp(p.c / Math.max(p.a, 1e-3), 0.05, 3);
  }

  function setParams(patch) {
    const k = P.radius / (P.height / 2);
    Object.assign(P, patch);
    if (patch.kind) {
      // Orientations that make each conic appear at its textbook tilt:
      // a plane must stay off the apex (d > 0) or the cut degenerates.
      if (patch.kind === 'ellipse') { P.angle = -0.62; P.offset = 3.15; }
      if (patch.kind === 'hyperbola') { P.angle = -1.02; P.offset = 1.05; }
      if (patch.kind === 'parabola') { P.angle = -Math.atan(1 / k); P.offset = -1.75; }
    }
    rebuild();
  }

  function update(dt) {
    scanT = (scanT + dt * 0.16) % 1;
    if (curveSamples.length < 4) {
      scan.visible = false;
      return;
    }
    scan.visible = P.cut > 0.35;
    const arr = scanGeo.attributes.position.array;
    const n = curveSamples.length;
    for (let i = 0; i < SCAN; i++) {
      const idx = Math.floor(((scanT + i / SCAN) % 1) * (n - 1));
      const p = curveSamples[idx];
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
    }
    scanGeo.attributes.position.needsUpdate = true;
    curveMat.opacity = 0.35 + 0.6 * P.cut;
    projMat.opacity = 0.5 * P.cut;
  }

  function dispose() {
    disposeObject(group);
  }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose, eccentricity: () => eccentricity(P) };
}
