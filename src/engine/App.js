import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Stage } from './Stage.js';
import { CameraRig } from './CameraRig.js';
import { Sequencer } from './Sequencer.js';
import { makeLabel } from './Label.js';
import { SUBJECT_COLORS, disposeObject } from './Materials.js';
import { ease, clamp } from './MathUtil.js';
import { getBuilder } from '../visuals/index.js';
import { LESSONS, getLesson } from '../content/index.js';

const _tmpV = new THREE.Vector3();

const QUALITY = {
  high: { pr: 3, bloom: true, strength: 0.62 },
  medium: { pr: 2.5, bloom: true, strength: 0.5 },
  low: { pr: 1.75, bloom: false, strength: 0 },
};

/** 3D内ラベルがこの画面ピクセル未満の高さにならないよう補正する。 */
const LABEL_MIN_PX = 13;
const LABEL_MAX_SCALE = 7;

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.stage = new Stage();
    this.rig = new CameraRig(this.stage.camera, canvas);

    this.quality = this._detectQuality();
    this._initRenderer();
    this._initComposer();

    this.lesson = null;
    this.builder = null;
    this.sequencer = null;
    this.notes = new THREE.Group();
    this.stage.world.add(this.notes);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.onPick = null;

    this._reveals = [];
    this._labels = [];
    this._labelScanIn = 0;
    this._bindPointer();

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /**
   * Quality follows the device's reported capability, not its screen size.
   * Phones are small but their GPUs are not, and forcing `low` there was what
   * made text unreadable.
   */
  _detectQuality() {
    const mem = navigator.deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (mem <= 2 || cores <= 2) return 'low';
    if (mem <= 4 || cores <= 4) return 'medium';
    return 'high';
  }

  _initRenderer() {
    const r = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.quality !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
    });
    r.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[this.quality].pr));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.renderer = r;
  }

  _initComposer() {
    const q = QUALITY[this.quality];
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.stage.scene, this.stage.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), q.strength, 0.72, 0.72);
    this.bloom.enabled = q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setQuality(level) {
    if (!QUALITY[level] || level === this.quality) return this.quality;
    this.quality = level;
    const q = QUALITY[level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pr));
    this.bloom.enabled = q.bloom;
    this.bloom.strength = q.strength;
    this.resize();
    return this.quality;
  }

  cycleQuality() {
    const order = ['low', 'medium', 'high'];
    const i = order.indexOf(this.quality);
    return this.setQuality(order[(i + 1) % order.length]);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.stage.resize(w, h);
    this.stage.setPixelRatio(this.renderer.getPixelRatio());
  }

  _bindPointer() {
    let downAt = null;
    let active = 0;      // 押されている指の数
    let multi = false;   // 今回のタッチ中に2本以上触れたか（ピンチ操作ならピックしない）
    this.canvas.addEventListener('pointerdown', (e) => {
      active++;
      if (active > 1) multi = true;
      downAt = { x: e.clientX, y: e.clientY };
    });
    const release = () => { active = Math.max(0, active - 1); if (!active) multi = false; };
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('pointerup', (e) => {
      const wasMulti = multi;
      release();
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (wasMulti || moved > 6) return; // camera drag / pinch, not a click
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.stage.camera);
      const hits = this.raycaster.intersectObjects(this.stage.world.children, true);
      for (const h of hits) {
        const pickable = h.object.userData.pickId || h.object.parent?.userData.pickId;
        if (pickable) { this.onPick?.(pickable); return; }
      }
    });
  }

  // ---------------------------------------------------------------- lessons

  /** Tear down whatever is currently mounted in the world. */
  clearWorld() {
    this.sequencer?.dispose();
    this.sequencer = null;
    this.builder?.dispose?.();
    this.builder = null;
    this.lesson = null;
    this._reveals.length = 0;
    for (const c of [...this.stage.world.children]) {
      if (c === this.notes) continue;
      this.stage.world.remove(c);
      disposeObject(c);
    }
    while (this.notes.children.length) this.notes.remove(this.notes.children[0]);
  }

  mount(id, { autoplay = true } = {}) {
    const lesson = getLesson(id);
    if (!lesson) { console.warn('unknown lesson', id); return null; }

    this.clearWorld();
    this.lesson = lesson;

    const color = SUBJECT_COLORS[lesson.subject] ?? 0x6ee7ff;
    this.stage.setMood(lesson.subject === 'm2' || lesson.subject === 'mc' ? 1.15 : 0.75);

    const build = getBuilder(lesson.builder);
    if (!build) { console.warn('unknown builder', lesson.builder); return null; }

    this.builder = build({ ...(lesson.params ?? {}), accent: color });
    this.stage.world.add(this.builder.group);
    this.builder.group.traverse((o) => { if (!o.userData.noReveal) this._trackReveal(o); });

    this.sequencer = new Sequencer({
      steps: lesson.steps ?? [],
      onStep: (step, i, n) => this._applyStep(step, i, n),
      onProgress: (p) => this.onProgress?.(p),
    });
    this.sequencer.play();
    this.sequencer.goTo(0, { autoplay });

    this._measureScene();
    this.rig.resetUserOffset();
    this.rig.set(this._fitPose(lesson.cam ?? { pos: [6, 4.6, 8], look: [0, 0, 0] }), { immediate: true });
    return lesson;
  }

  /**
   * Pop-in bookkeeping lives here rather than in `userData`: builders own their
   * own userData and are free to replace it, which would otherwise wipe the
   * base scale mid-animation.
   */
  _trackReveal(o) {
    if (this._reveals.some((r) => r.obj === o)) return;
    this._reveals.push({ obj: o, base: o.scale.clone(), t: 1 });
  }

  /**
   * Lesson scripts are written by hand, so a `cam` that is too close would crop
   * the figure. The direction and target stay exactly as authored; only the
   * distance is pushed out to whatever frames the whole scene.
   */
  _fitPose(pose) {
    const radius = this._fitRadius;
    if (!radius || !pose?.pos) return pose;
    const look = new THREE.Vector3(...(pose.look ?? [0, 0, 0]));
    const pos = new THREE.Vector3(...pose.pos);
    const offset = pos.clone().sub(look);
    // Portrait phones are limited by the horizontal field, not the vertical one.
    const cam = this.stage.camera;
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
    // 0.86 lets a small part of the frame crop rather than shrinking the
    // subject to a speck; the authored framing is the intent, this is a guard.
    const need = (radius * 0.92) / Math.sin(Math.min(vFov, hFov) * 0.5);
    // Only step in when the authored pose is clearly cropping; a script's
    // deliberate close-up should survive.
    if (offset.length() >= need * 1.15) return pose;
    offset.setLength(need);
    return { pos: look.clone().add(offset).toArray(), look: pose.look };
  }

  /**
   * Sprites are sized in world units, so a phone shows them far too small.
   * Every label is grown until it covers at least LABEL_MIN_PX on screen, which
   * keeps annotations readable on any display without shrinking them on desktop.
   */
  _tuneLabels() {
    const cam = this.stage.camera;
    const vh = window.innerHeight || 1;
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / vh;
    for (const sp of this._labels) {
      const base = sp.userData.baseHeight;
      if (!base) continue;
      sp.getWorldPosition(_tmpV);
      const d = Math.max(cam.position.distanceTo(_tmpV), 0.1);
      const k = clamp((LABEL_MIN_PX * perPx * d) / base, 1, LABEL_MAX_SCALE);
      sp.scale.set(base * sp.userData.aspect * k, base * k, 1);
    }
  }

  /** Builders create labels lazily, so the set is refreshed periodically. */
  _scanLabels() {
    this._labels.length = 0;
    const collect = (root) => root.traverse((o) => { if (o.isSprite && o.userData.baseHeight) this._labels.push(o); });
    collect(this.stage.world);
  }

  _measureScene() {
    this._fitRadius = 0;
    if (!this.builder?.group) return;
    const box = new THREE.Box3().setFromObject(this.builder.group);
    if (box.isEmpty()) return;
    // Widest axis of the box rather than the bounding sphere: a scene padded
    // with a large flat backdrop should be framed by its subject, not by the
    // corners of its scenery.
    const size = box.getSize(new THREE.Vector3());
    this._fitRadius = Math.max(size.x, size.y, size.z) * 0.5;
  }

  _applyStep(step, i, n) {
    if (!step || !this.builder) return;
    const b = this.builder;

    if (step.set) b.setParams?.(step.set);

    for (const key of step.show ?? []) this._setPart(key, true, step);
    for (const key of step.hide ?? []) this._setPart(key, false, step);

    if (step.cam) {
      this.rig.set(this._fitPose(step.cam), { lambda: step.lambda ?? 2.0 });
    } else if (step.focus && b.parts?.[step.focus]) this.rig.frameObject(b.parts[step.focus], { dir: step.dir ?? [0.8, 0.55, 1] });
    else if (step.focus) this.rig.set(step.focusPos, { lambda: 1.6 });

    this._setNote(step.note, step);

    this.onStep?.(step, i, n);
  }

  _setPart(key, visible, step) {
    const p = this.builder?.parts?.[key];
    if (!p) return;
    if (visible) {
      p.visible = true;
      if (step?.pop !== false) {
        this._trackReveal(p);
        const rec = this._reveals.find((r) => r.obj === p);
        if (rec) rec.t = 0;
      }
    } else {
      p.visible = false;
    }
  }

  _setNote(note, step) {
    while (this.notes.children.length) this.notes.remove(this.notes.children[0]);
    if (!note) return;
    const items = Array.isArray(note) ? note : [note];
    for (const item of items) {
      const spec = typeof item === 'string' ? { text: item } : item;
      const anchor = this.builder?.parts?.[spec.at] ?? this.builder?.anchors?.(spec.at);
      const pos = anchor ? anchor.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
      if (spec.at && !anchor) continue;
      const label = makeLabel(spec.text, {
        height: spec.size ?? 0.44,
        color: spec.color ?? '#f2f8ff',
        bg: 'rgba(5,9,20,0.78)',
        border: 'rgba(110,231,255,0.35)',
      });
      label.position.copy(pos);
      label.position.y += (spec.dy ?? 0.5);
      this.notes.add(label);
    }
  }

  // ----------------------------------------------------------------- loop

  start() {
    this.renderer.setAnimationLoop(() => this._frame());
  }

  stop() { this.renderer.setAnimationLoop(null); }

  _frame() {
    // Cap generously rather than tightly: a 0.05s cap makes the lesson run in
    // slow motion whenever the frame rate drops below 20fps (which is exactly
    // when a viewer is most likely on a phone). 0.25s still absorbs the jump
    // after a backgrounded tab without letting the story lurch.
    const dt = Math.min(this.stage.clock.getDelta(), 0.25);

    if (--this._labelScanIn <= 0) { this._scanLabels(); this._labelScanIn = 30; }
    this._tuneLabels();

    this.sequencer?.update(dt);
    if (this.sequencer) this.onTick?.(this.sequencer.elapsed, this.sequencer.current?.d);
    this.builder?.update?.(dt, this.stage.time, this.sequencer?.stepProgress ?? 0);
    this.rig.update(dt);
    this.stage.update(dt);

    for (const r of this._reveals) {
      if (r.t >= 1) continue;
      r.t = clamp(r.t + dt * 2.1, 0, 1);
      const s = ease.outBack(r.t) * 0.28 + 0.72;
      r.obj.scale.set(r.base.x * s, r.base.y * s, r.base.z * s);
    }

    this.notes.children.forEach((l, i) => { l.position.y += Math.sin(this.stage.time * 1.6 + i) * 0.0009; });

    this.composer.render();
  }
}

export { LESSONS };
