import * as THREE from 'three';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(1200, 760);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0x94b4ff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.3);
key.position.set(6, 10, 7);
const rim = new THREE.DirectionalLight(0x6ee7ff, 0.8);
rim.position.set(-7, -3, -6);
scene.add(key, rim);

const camera = new THREE.PerspectiveCamera(48, 1200 / 760, 0.05, 3000);
const CAM = {
  default: { pos: [6, 4.4, 14], look: [0, 0.6, 0] },
  flat: { pos: [0.4, 1.6, 15], look: [0, 1.6, 0] },
  side: { pos: [10, 5, 11], look: [0, 0.5, 0] },
};

const CASES = {
  parabola: ['parabola3d', 'createParabola3D', { a: 1, p: 1, q: 2, transform: 3, showFocus: true }],
  parabolaT1: ['parabola3d', 'createParabola3D', { a: 1, p: 1, q: 2, transform: 1 }],
  parabolaArea: ['parabola3d', 'createParabola3D', { a: -0.5, p: 0, q: 3, transform: 0 }],
  tangent: ['calculus', 'createCalculus', { mode: 'tangent', a: 0, b: 3 }],
  slope: ['calculus', 'createCalculus', { mode: 'slope', a: 0, b: 3 }],
  integral: ['calculus', 'createCalculus', { mode: 'integral', a: 0, b: 3, n: 30 }],
  area: ['calculus', 'createCalculus', { mode: 'area', a: 0, b: 3 }],
  volume: ['calculus', 'createCalculus', { mode: 'volume', a: 0, b: 3 }],
  leps: ['limit', 'createLimit', { mode: 'eps' }],
  lseq: ['limit', 'createLimit', { mode: 'sequence', terms: 8 }],
  lseries: ['limit', 'createLimit', { mode: 'series', r: 0.5, terms: 8 }],
  lseriesD: ['limit', 'createLimit', { mode: 'series', r: 1.3, terms: 5 }],
  lsqueeze: ['limit', 'createLimit', { mode: 'squeeze' }],
  lcont: ['limit', 'createLimit', { mode: 'continuity' }],
  arem: ['algebra3d', 'createAlgebra3D', { mode: 'remainder', coeffs: [1, 0, -1], divisor: 2 }],
  afac: ['algebra3d', 'createAlgebra3D', { mode: 'factor', coeffs: [1, 0, -4], divisor: 2 }],
  aid: ['algebra3d', 'createAlgebra3D', { mode: 'identity', coeffs: [1, -3, 2], divisor: 1 }],
  aroots: ['algebra3d', 'createAlgebra3D', { mode: 'roots', coeffs: [1, -6, 11, -6], rootGuess: 1 }],
};

const q = new URLSearchParams(location.search);
const key2 = q.get('case') || 'parabola';
const [name, fn, params] = CASES[key2];
const mod = await import(`/src/visuals/${name}.js`);
const b = mod[fn](params);
scene.add(b.group);

const cam = CAM[q.get('cam') || 'default'];
camera.position.set(...cam.pos);
camera.lookAt(...cam.look);

let t = 0;
let frames = 0;
renderer.setAnimationLoop(() => {
  t += 0.033;
  frames++;
  b.update(0.033, t, 0.5);
  renderer.render(scene, camera);
  if (frames > 4) window.__ready = true;
});
window.__info = { case: key2, parts: Object.keys(b.parts), params: b.params };
window.__dump = () => {
  const THREEBox = b.group.constructor;
  const out = {};
  b.group.updateMatrixWorld(true);
  for (const [k, o] of Object.entries(b.parts)) {
    let vis = o.visible;
    let p = o.parent;
    while (p) { if (!p.visible) vis = false; p = p.parent; }
    const wp = o.getWorldPosition(new (b.group.position.constructor)());
    out[k] = `vis=${vis ? 1 : 0} at(${wp.x.toFixed(2)},${wp.y.toFixed(2)},${wp.z.toFixed(2)}) kids=${o.children.length}`;
  }
  return out;
};
window.__balls = () => {
  const m = b.parts.coeffBalls;
  const inst = m.children[0];
  const e = [];
  for (let i = 0; i < inst.count; i++) {
    const a = inst.instanceMatrix.array;
    e.push([i, a[i*16+12].toFixed(2), a[i*16+13].toFixed(2), a[i*16+0].toFixed(2)].join('/'));
  }
  return { vis: inst.visible, pvis: m.visible, count: inst.count, max: inst.instanceMatrix.array.length / 16, rows: e };
};
