import * as THREE from 'three';
import { damp, dampVec3, clamp, TAU } from './MathUtil.js';

const _v = new THREE.Vector3();
const _sph = new THREE.Spherical();
const _off = new THREE.Vector3();

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
    this.userZoom = 0;
    this.enabled = true;
    this.dragging = false;
    this.autoDrift = 0;

    this._bind();
  }

  _bind() {
    const el = this.dom;
    let px = 0, py = 0;
    const onDown = (e) => {
      if (!this.enabled) return;
      this.dragging = true;
      px = e.clientX ?? e.touches[0].clientX;
      py = e.clientY ?? e.touches[0].clientY;
      el.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!this.dragging) return;
      const x = e.clientX ?? e.touches[0].clientX;
      const y = e.clientY ?? e.touches[0].clientY;
      this.userAz -= (x - px) * 0.0055;
      this.userPo = clamp(this.userPo - (y - py) * 0.0045, -1.1, 1.1);
      px = x; py = y;
    };
    const onUp = () => { this.dragging = false; el.style.cursor = ''; };
    const onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.userZoom = clamp(this.userZoom + Math.sign(e.deltaY) * 0.09, -0.72, 3.2);
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.style.cursor = 'grab';
    this._teardown = () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }

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

    const off = _off.copy(this.curPos).sub(this.curLook);
    _sph.setFromVector3(off);
    _sph.theta += this.userAz;
    _sph.phi = clamp(_sph.phi + this.userPo, 0.08, Math.PI - 0.08);
    _sph.radius = Math.max(_sph.radius * (1 + this.userZoom * 0.22), 0.4);
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
