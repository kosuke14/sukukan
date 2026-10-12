import * as THREE from 'three';

/** Subject accent colours — used by the star map, panel chrome and lessons. */
export const SUBJECT_COLORS = {
  m1: 0x5ec8ff,
  m2: 0xff8fb1,
  mi: 0x6ef0c8,
  ma: 0xffd166,
  mb: 0xb39dff,
  mc: 0xff9f6e,
};

const cache = new Map();

function remember(key, make) {
  if (!cache.has(key)) {
    const m = make();
    m.userData.shared = true; // never disposed by lessons — they are reused
    cache.set(key, m);
  }
  return cache.get(key);
}

/** Emissive line material — the workhorse for mathematical curves. */
export function lineMat(color, opacity = 1, linewidth = 1) {
  return remember(`L${color}${opacity}${linewidth}`, () =>
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, linewidth }));
}

/** Additively blended glow line for hero curves. */
export function glowLineMat(color, opacity = 1) {
  return remember(`G${color}${opacity}`, () =>
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
}

export function solidMat(color, opts = {}) {
  const key = `S${color}${JSON.stringify(opts)}`;
  return remember(key, () => new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.42,
    metalness: opts.metalness ?? 0.12,
    transparent: opts.transparent ?? true,
    opacity: opts.opacity ?? 0.45,
    side: opts.side ?? THREE.DoubleSide,
    flatShading: opts.flat ?? false,
    depthWrite: opts.depthWrite ?? false,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  }));
}

export function basicMat(color, opacity = 0.4, blending = THREE.NormalBlending) {
  return remember(`B${color}${opacity}${blending}`, () => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide,
    depthWrite: false, blending,
  }));
}

export function lineBasic(color, opacity = 0.4) {
  return remember(`LB${color}${opacity}`, () => new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
  }));
}

export function pointMat(color, size = 0.09, opacity = 1) {
  return remember(`P${color}${size}${opacity}`, () => new THREE.PointsMaterial({
    color, size, transparent: true, opacity, sizeAttenuation: true, depthWrite: false,
  }));
}

/** Soft radial sprite texture for glowing dots. */
let dotTex = null;
export function dotTexture() {
  if (dotTex) return dotTex;
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

export function glowSprite(color, size = 0.5, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: dotTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  sp.renderOrder = 5;
  return sp;
}

/** Wireframe look for polyhedra without extra geometry passes. */
export function edgesOf(geometry, color, opacity = 0.55) {
  const eg = new THREE.EdgesGeometry(geometry, 12);
  return new THREE.LineSegments(eg, lineBasic(color, opacity));
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.userData?.shared) continue; // cached library / label material
        if (m.map && m.map !== dotTex) m.map.dispose();
        m.dispose();
      }
    }
  });
}
