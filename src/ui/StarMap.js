import * as THREE from 'three';
import { glowSprite, disposeObject, SUBJECT_COLORS } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { TAU, seededRandom } from '../engine/MathUtil.js';
import { makeOrbit } from '../visuals/common.js';
import { SUBJECTS } from '../content/schema.js';

const ORDER = ['m1', 'm2', 'mi', 'ma', 'mb', 'mc'];

/**
 * 星図: 6科目を星雲、82単元を星として空間上に配置する。
 * Layout is deterministic so returning to the map always looks the same.
 */
export function createStarMap(lessons, { onPick } = {}) {
  const group = new THREE.Group();
  const rand = seededRandom(90210);
  const R = 34;
  const nodeIndex = new Map();

  const hub = new THREE.Group();
  group.add(hub);

  // Central "core" of the universe: a slowly turning icosahedral knot.
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.1, 1),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff, wireframe: true, transparent: true, opacity: 0.5 })
  );
  const coreGlow = glowSprite(0x6ee7ff, 9, 0.5);
  hub.add(core, coreGlow);
  for (let i = 0; i < 3; i++) {
    const ring = makeOrbit(3.4 + i * 1.1, { color: 0x6ee7ff, opacity: 0.18, tilt: (i * Math.PI) / 3 });
    hub.add(ring);
  }

  const clusters = [];
  const nodeMats = [];

  ORDER.forEach((key, ci) => {
    const meta = SUBJECTS[key];
    const color = SUBJECT_COLORS[key];
    const list = lessons.filter((l) => l.subject === key);
    if (!list.length) return;

    // A ring rather than a sphere: six clusters all end up in the upper half of
    // a fibonacci sphere, which reads as one blob from the map camera. Lifting and
    // dropping alternate clusters keeps the ring legible from a raised viewpoint.
    // Half-step offset keeps no cluster parked at the far right, where the
    // unit sidebar would cover it.
    const theta = (ci / ORDER.length) * TAU - Math.PI / 2 + Math.PI / 6;
    const lift = (ci % 2 === 0 ? 1 : -1) * (7 + (ci % 3) * 3);
    const center = new THREE.Vector3(Math.cos(theta) * R, lift, Math.sin(theta) * R);

    const cluster = new THREE.Group();
    cluster.position.copy(center);
    group.add(cluster);

    const halo = glowSprite(color, 13, 0.3);
    cluster.add(halo);

    const cloud = new THREE.Points(
      (() => {
        const N = 420;
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
          const r = 3 + Math.pow(rand(), 0.5) * 7.5;
          const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u);
          pos[i * 3] = Math.cos(th) * s * r;
          pos[i * 3 + 1] = u * r * 0.7;
          pos[i * 3 + 2] = Math.sin(th) * s * r;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        return g;
      })(),
      new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    cluster.add(cloud);

    const nameLabel = makeLabel(meta.name, { height: 2.9, color: '#ffffff', bg: 'rgba(6,10,22,0.6)', border: 'rgba(140,170,255,0.3)' });
    nameLabel.position.set(0, 8.2, 0);
    cluster.add(nameLabel);
    const subLabel = makeLabel(`${list.length}単元`, { height: 1.35, color: '#a8bde8' });
    subLabel.position.set(0, 6.6, 0);
    cluster.add(subLabel);

    // Unit stars on a fibonacci sphere so no unit hides behind another.
    list.forEach((l, i) => {
      const k = i + 0.5;
      const phiU = Math.acos(1 - (2 * k) / list.length);
      const thetaU = Math.PI * (1 + Math.sqrt(5)) * k;
      const r = 3.2 + ((i % 5) / 5) * 2.4;
      const pos = new THREE.Vector3(
        Math.cos(thetaU) * Math.sin(phiU) * r,
        Math.cos(phiU) * r * 0.72,
        Math.sin(thetaU) * Math.sin(phiU) * r
      );
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 14, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      node.position.copy(pos);
      node.userData.pickId = l.id;
      const glow = glowSprite(color, 1.5, 0.85);
      glow.position.copy(pos);
      cluster.add(node, glow);
      nodeIndex.set(l.id, { node, glow, cluster, label: null, color });
      nodeMats.push(node.material);

      // hidden until the cluster is focused
      const tag = makeLabel(l.unit, { height: 0.62, color: '#e8f0ff' });
      tag.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
      tag.visible = false;
      cluster.add(tag);
      nodeIndex.get(l.id).label = tag;
    });

    clusters.push({ key, cluster, center, nameLabel, cloud, halo, list });
  });

  // Faint lines from the core to each cluster — the "curriculum" drawn as orbits.
  const linkPts = [];
  for (const c of clusters) linkPts.push(new THREE.Vector3(), c.center);
  const linkGeo = new THREE.BufferGeometry().setFromPoints(linkPts);
  const links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: 0x3f5a94, transparent: true, opacity: 0.3 }));
  group.add(links);

  const api = {
    group,
    clusters,
    focusKey: null,
    /** Per-unit tags are unreadable on a phone; the sidebar lists them instead. */
    showTags: true,
    setFocus(key) {
      api.focusKey = key;
      for (const c of clusters) {
        const on = key === null || c.key === key;
        for (const [id, rec] of nodeIndex) {
          const mine = rec.cluster === c.cluster;
          rec.glow.material.opacity = mine && on ? 0.85 : 0.12;
          rec.node.material.color.setHex(mine && on ? 0xffffff : 0x6a7899);
          rec.node.scale.setScalar(mine && on ? 1 : 0.65);
          if (rec.label) rec.label.visible = mine && on && key === key && api.showTags;
        }
        c.halo.material.opacity = on ? 0.3 : 0.08;
        c.cloud.material.opacity = on ? 0.6 : 0.16;
      }
    },
    update(dt, elapsed, camera) {
      hub.rotation.y += dt * 0.07;
      core.rotation.x += dt * 0.11;
      core.rotation.z -= dt * 0.05;
      for (const c of clusters) {
        c.cluster.rotation.y += dt * 0.02;
        c.nameLabel.lookAt(camera.position);
        c.nameLabel.children;
      }
      for (const [, rec] of nodeIndex) {
        if (rec.label?.visible) rec.label.lookAt(camera.position);
      }
    },
    dispose() { disposeObject(group); },
  };
  return api;
}
