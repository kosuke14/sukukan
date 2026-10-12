import * as THREE from 'three';
import { damp, dampVec3, clamp, TAU } from './MathUtil.js';

const _v = new THREE.Vector3();
const _sph = new THREE.Spherical();
const _off = new THREE.Vector3();

/** userZoom is a log-scale distance: radius *= exp(zoom). 0 = scripted framing. */
export const ZOOM_MIN = -1.9;   // ~0.15x  (寄る)
export const ZOOM_MAX = 1.1;    // ~3.0x   (引く)

/**
 * Scripted camera with a user orbit offset layered on top.
 *
 * Lesson steps push a pose; the rig eases toward it. Dragging spins the view
 * around the same focus without losing the scripted framing — the next step
 * re-aims and the offset fades out.
 */
export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;

    this.basePos = this.camera.position.clone();
    this.baseLook = new THREE.Vector3(0, 0, 0);
    this.curPos = this.camera.position.clone();
    this.curLook = new THREE.Vector3(0, 0, 0);

    this.lambda = 2.2;
    this.userAz = 0;
    this.userPo = 0;
    this.userZoom = 0;      // target (log scale)
    this.curZoom = 0;       // eased value actually applied
    this.enabled = true;
    this.dragging = false;
    this.autoDrift = 0;

    this._bind();
  }

  _bind() {
    const el = this.dom;
    const pts = new Map(); // pointerId -> {x, y}
    let pinchDist = 0;
    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onDown = (e) => {
      if (!this.enabled) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      if (pts.size === 2) {
        // second finger: switch from orbit to pinch
        this.dragging = false;
        pinchDist = dist();
      } else if (pts.size === 1) {
        this.dragging = true;
      }
      el.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size >= 2) {
        const d = dist();
        if (pinchDist > 0 && d > 0) this.zoomBy(-Math.log(d / pinchDist));
        pinchDist = d;
      } else if (this.dragging) {
        this.userAz -= dx * 0.0055;
        this.userPo = clamp(this.userPo - dy * 0.0045, -1.1, 1.1);
      }
    };
    const onUp = (e) => {
      pts.delete(e.pointerId);
      try { el.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
      if (pts.size === 1) {
        // pinch ended with one finger still down: resume orbit without a jump
        this.dragging = true;
      } else if (pts.size === 0) {
        this.dragging = false;
        el.style.cursor = '';
      }
      pinchDist = 0;
    };
    const onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      // Trackpad pinch arrives as ctrl+wheel with small fractional deltas; mouse
      // wheels send large notched deltas. Normalise both to a log-zoom step.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const dy = e.deltaY * unit;
      const step = e.ctrlKey ? dy * 0.012 : Math.sign(dy) * Math.min(Math.abs(dy) / 100, 3) * 0.12;
      this.zoomBy(step);
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.style.cursor = 'grab';
    el.style.touchAction = 'none'; // let us own drag + pinch on touch screens
    this._teardown = () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }

  /** Zoom by a log-scale amount. Positive = pull back, negative = move in. */
  zoomBy(d) {
    this.userZoom = clamp(this.userZoom + d, ZOOM_MIN, ZOOM_MAX);
  }

  /** Back to the scripted framing (distance only; orbit angle is kept). */
  resetZoom() {
    this.userZoom = 0;
  }

  /** Current magnification relative to the scripted framing (1 = as scripted). */
  get zoomFactor() { return Math.exp(-this.curZoom); }

  set(pose, { immediate = false, lambda } = {}) {
    if (!pose) return;
    if (pose.pos) this.basePos.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    if (pose.look) this.baseLook.set(pose.look[0], pose.look[1], pose.look[2]);
    if (lambda != null) this.lambda = lambda;
    if (immediate) {
      this.curPos.copy(this.basePos);
      this.curLook.copy(this.baseLook);
      this.camera.position.copy(this.curPos);
      this.camera.lookAt(this.curLook);
    }
  }

  resetUserOffset() {
    this.userAz = 0;
    this.userPo = 0;
    this.userZoom = 0;
    this.curZoom = 0;
  }

  /** Box that comfortably frames a bounding sphere at the current viewing distance. */
  frameObject(object3d, { padding = 1.65, dir = [0.72, 0.5, 1], immediate = false } = {}) {
    if (!object3d) return;
    const box = new THREE.Box3().setFromObject(object3d);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 0.3);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (radius * padding) / Math.sin(fov * 0.5);
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize().multiplyScalar(dist);
    this.set({ pos: [center.x + d.x, center.y + d.y, center.z + d.z], look: [center.x, center.y, center.z] }, { immediate });
  }

  update(dt) {
    // Ease the scripted pose, then apply the user's orbit on top of the result.
    dampVec3(this.curPos, this.basePos, this.lambda, dt);
    dampVec3(this.curLook, this.baseLook, this.lambda, dt);

    if (this.autoDrift) this.userAz += dt * this.autoDrift;
    this.curZoom = damp(this.curZoom, this.userZoom, 12, dt);

    const off = _off.copy(this.curPos).sub(this.curLook);
    _sph.setFromVector3(off);
    _sph.theta += this.userAz;
    _sph.phi = clamp(_sph.phi + this.userPo, 0.08, Math.PI - 0.08);
    _sph.radius = Math.max(_sph.radius * Math.exp(this.curZoom), 0.4);
    _sph.makeSafe();
    off.setFromSpherical(_sph);

    this.camera.position.copy(this.curLook).add(off);
    this.camera.lookAt(this.curLook);
  }

  get focus() { return this.curLook; }

  /** Screen-space projected position, for anchoring DOM to a 3D point. */
  project(v3) {
    _v.copy(v3).project(this.camera);
    return { x: (_v.x * 0.5 + 0.5) * 100, y: (-_v.y * 0.5 + 0.5) * 100, z: _v.z };
  }

  dispose() { this._teardown?.(); }
}

export { TAU };
