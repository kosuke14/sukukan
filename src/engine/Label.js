import * as THREE from 'three';

const FONT_STACK = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic Medium", "Meiryo", system-ui, sans-serif';
const DPI = 2;

const texCache = new Map();

function textureFor(text, opts) {
  const key = `${text}|${JSON.stringify(opts)}`;
  if (texCache.has(key)) return texCache.get(key);

  const fontSize = opts.fontSize ?? 44;
  const pad = opts.pad ?? 14;
  const color = opts.color ?? '#eaf2ff';
  const bg = opts.bg ?? null;
  const border = opts.border ?? null;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `600 ${fontSize}px ${FONT_STACK}`;
  const w = Math.ceil(measure.measureText(text).width) + pad * 2;
  const h = Math.ceil(fontSize * 1.62) + pad * (bg ? 1.2 : 0.6);

  const canvas = document.createElement('canvas');
  canvas.width = w * DPI;
  canvas.height = h * DPI;
  const g = canvas.getContext('2d');
  g.scale(DPI, DPI);

  if (bg) {
    const r = 10;
    g.beginPath();
    g.moveTo(r, 0); g.lineTo(w - r, 0); g.quadraticCurveTo(w, 0, w, r);
    g.lineTo(w, h - r); g.quadraticCurveTo(w, h, w - r, h);
    g.lineTo(r, h); g.quadraticCurveTo(0, h, 0, h - r);
    g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
    g.closePath();
    g.fillStyle = bg;
    g.fill();
    if (border) { g.strokeStyle = border; g.lineWidth = 1.4; g.stroke(); }
  }

  g.font = `600 ${fontSize}px ${FONT_STACK}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.65)';
  g.shadowBlur = 8;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + fontSize * 0.04);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.userData.aspect = w / h;
  tex.userData.shared = true; // cached per string, reused across lessons
  texCache.set(key, tex);
  return tex;
}

/**
 * A crisp 3D-anchored text label. World units tall by default so labels keep
 * a consistent physical size while the camera moves.
 */
export function makeLabel(text, opts = {}) {
  const {
    height = 0.42,
    color = '#eaf2ff',
    bg = 'rgba(6,10,22,0.62)',
    border = null,
    depthTest = false,
    renderOrder = 10,
  } = opts;

  const tex = textureFor(text, { color, bg, border });
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest, depthWrite: false,
    sizeAttenuation: true, opacity: opts.opacity ?? 1,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(height * tex.userData.aspect, height, 1);
  sp.renderOrder = renderOrder;
  // Kept so the renderer can grow the sprite when the screen is small: a label
  // that is legible on a desktop shrinks below reading size on a phone.
  sp.userData.baseHeight = height;
  sp.userData.aspect = tex.userData.aspect;
  sp.userData.setText = (next) => {
    const t2 = textureFor(next, { color, bg, border });
    sp.material.map = t2;
    sp.material.needsUpdate = true;
    sp.userData.aspect = t2.userData.aspect;
    sp.scale.set(height * t2.userData.aspect, height, 1);
  };
  return sp;
}

/** Small glowing tick used for axis marks. */
export function makeTick(color = 0xffffff) {
  const geo = new THREE.SphereGeometry(0.045, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color });
  return new THREE.Mesh(geo, mat);
}
