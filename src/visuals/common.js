import * as THREE from 'three';
import { lineBasic, solidMat, glowSprite, SUBJECT_COLORS } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { TAU } from '../engine/MathUtil.js';

/**
 * Shared building blocks every visualisation draws from. Keeping these here
 * means a lesson builder only writes what is unique to its topic.
 */

/** Cartesian axes with tick marks and unit labels. */
export function makeAxes({ size = 6, ticks = 12, color = 0x6f86b8, labels = ['x', 'y', 'z'], accent = 0x6ee7ff, labelSize = 0.3 } = {}) {
  const g = new THREE.Group();
  const half = size / 2;

  for (const [axis, dir] of [['x', [1, 0, 0]], ['y', [0, 1, 0]], ['z', [0, 0, 1]]]) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-half * dir[0], -half * dir[1], -half * dir[2]),
      new THREE.Vector3(half * dir[0], half * dir[1], half * dir[2]),
    ]);
    g.add(new THREE.Line(geo, lineBasic(color, 0.75)));

    for (let i = -ticks; i <= ticks; i++) {
      if (i === 0) continue;
      const p = new THREE.Vector3(dir[0] * i * (half / ticks), dir[1] * i * (half / ticks), dir[2] * i * (half / ticks));
      const s = makeTickDot(axis === 'y' ? 0xffffff : accent, Math.abs(i) === ticks ? 0.055 : 0.032);
      s.position.copy(p);
      g.add(s);
    }

    const l = makeLabel(labels[axis === 'x' ? 0 : axis === 'y' ? 1 : 2], { height: labelSize, color: '#cfe0ff', bg: null });
    l.position.set(dir[0] * (half + 0.35), dir[1] * (half + 0.35), dir[2] * (half + 0.35));
    g.add(l);
  }
  return g;
}

function makeTickDot(color, r) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color }));
}

/** A translucent ground plane with a grid — the "stage floor" of most lessons. */
export function makeGridPlane({ size = 10, div = 20, color = 0x3d5a8f, plane = 'xz', opacity = 0.5 } = {}) {
  const g = new THREE.Group();
  const pos = [];
  for (let i = 0; i <= div; i++) {
    const t = -size / 2 + (size * i) / div;
    if (plane === 'xz') {
      pos.push(t, 0, -size / 2, t, 0, size / 2);
      pos.push(-size / 2, 0, t, size / 2, 0, t);
    } else {
      pos.push(t, -size / 2, 0, t, size / 2, 0);
      pos.push(-size / 2, t, 0, size / 2, t, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.LineSegments(geo, lineBasic(color, opacity)));

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    solidMat(0x0a1428, { opacity: 0.16, roughness: 1, metalness: 0, depthWrite: false })
  );
  fill.rotation.x = plane === 'xz' ? -Math.PI / 2 : 0;
  fill.position.y = plane === 'xz' ? -0.002 : 0;
  g.add(fill);
  return g;
}

/** Polyline from a function over a parameter range, with optional glow twin. */
export function makeCurve(fn, { samples = 240, color = 0x6ee7ff, opacity = 1, glow = false, glowWidth = 0.055 } = {}) {
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(fn(i / samples));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  const group = new THREE.Group();
  group.add(line);
  if (glow) {
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.min(samples, 220), glowWidth, 8, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    group.add(tube);
  }
  return group;
}

/** Arrow along an arbitrary segment — the most-used annotation in geometry lessons. */
export function makeArrow(from, to, { color = 0xffffff, headSize = 0.13, shaft = 0.016 } = {}) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 1e-6) return g;
  dir.normalize();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(shaft, shaft, len - headSize * 1.4, 10),
    new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.35, roughness: 0.35, transparent: true, opacity: 0.95 })
  );
  body.position.copy(from).addScaledVector(dir, (len - headSize * 1.4) / 2);
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(headSize, headSize * 2.4, 14),
    new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.5, roughness: 0.3 })
  );
  head.position.copy(from).addScaledVector(dir, len - headSize * 1.2);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(head);
  return g;
}

/** Flat filled polygon from an array of Vector3. */
export function makePolygon(points, { color = 0x6ee7ff, opacity = 0.3, edge = 0x6ee7ff, edgeOpacity = 0.9 } = {}) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const v2 = points.map((p) => new THREE.Vector2(p.x, p.z));
  shape.setFromPoints(v2);
  const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), solidMat(color, { opacity, side: THREE.DoubleSide }));
  face.rotation.x = -Math.PI / 2;
  g.add(face);
  const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), lineBasic(edge, edgeOpacity));
  g.add(loop);
  return g;
}

/** A point that is always legible: solid core + additive halo. */
export function makePoint(color, { size = 0.14, halo = 0.55 } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(size, 18, 12), new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color), emissiveIntensity: 0.7, roughness: 0.25,
  })));
  g.add(glowSprite(color, halo, 0.55));
  return g;
}

/** A ring of small spheres — urns, dice pips, sample clouds. */
export function makeBalls(count, { color = 0xffd479, radius = 0.16, spread = 3, seeded = 7 } = {}) {
  let s = seeded;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const geo = new THREE.SphereGeometry(radius, 16, 12);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, emissive: new THREE.Color(color), emissiveIntensity: 0.18 });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set((rand() - 0.5) * spread, (rand() - 0.5) * spread, (rand() - 0.5) * spread);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  const g = new THREE.Group();
  g.add(inst);
  return g;
}

/** Circular ring of dots in the xz-plane (unit circle, probability circle, ...). */
export function makeDotRing({ r = 1, count = 48, color = 0x6ee7ff, size = 0.04, plane = 'xz' } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(size, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    if (plane === 'xz') d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    else d.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  }
  g.add(inst);
  return g;
}

/** Rotating dashed ring used for "orbit" decoration. */
export function makeOrbit(radius, { color = 0x8fa8e0, opacity = 0.3, tilt = 0 } = {}) {
  const pts = [];
  const seg = 160;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineBasic(color, opacity));
  g.rotation.x = tilt;
  return g;
}

export function accentOf(accent) {
  return typeof accent === 'number' ? accent : (SUBJECT_COLORS[accent] ?? 0x6ee7ff);
}

/** Smoothly interpolated numeric parameter, for animated transitions. */
export class Animated {
  constructor(values = {}) {
    this.cur = { ...values };
    this.target = { ...values };
  }
  to(patch) { Object.assign(this.target, patch); }
  snap(patch) { Object.assign(this.cur, patch); Object.assign(this.target, patch); }
  update(dt, lambda = 4) {
    for (const k in this.target) {
      const t = this.target[k];
      this.cur[k] = t + (this.cur[k] - t) * Math.exp(-lambda * dt);
    }
    return this.cur;
  }
}
