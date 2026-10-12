import './styles/main.css';
import { App } from './engine/App.js';
import { Ui } from './ui/Ui.js';
import * as THREE from 'three';
import { createStarMap } from './ui/StarMap.js';
import { LESSONS, lessonsBySubject, SUBJECTS } from './content/index.js';
import { SUBJECT_COLORS } from './engine/Materials.js';
import * as builderRegistry from './visuals/index.js';

const canvas = document.getElementById('stage');

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

if (!hasWebGL2()) {
  document.getElementById('boot').classList.add('hidden');
  document.getElementById('nowebgl').classList.remove('hidden');
} else {
  boot();
}

function boot() {
  const app = new App(canvas);
  const ui = new Ui(app, {
    onMap: () => openMap(),
    onOpen: (id) => openLesson(id),
    onStep: (dir) => (dir > 0 ? app.sequencer?.next() : app.sequencer?.prev()),
    onPlayToggle: () => { app.sequencer?.toggle(); ui.setPlaying(app.sequencer?.playing ?? false); },
    onSpeed: (s) => app.sequencer?.setSpeed(s),
  });

  ui.bootNote('星図を構築しています…');

  const bySubject = lessonsBySubject(LESSONS);
  const map = createStarMap(LESSONS, { onPick: (id) => openLesson(id) });
  app.builder = { group: map.group, update: (dt, t) => map.update(dt, t, app.stage.camera), dispose: () => {} };
  app.stage.world.add(map.group);
  app.onPick = (id) => openLesson(id);

  let inMap = true;

  function openMap() {
    inMap = true;
    map.showTags = window.innerWidth > 860;
    app.clearWorld();
    app.builder = { group: map.group, update: (dt, t) => map.update(dt, t, app.stage.camera), dispose: () => {} };
    app.stage.world.add(map.group);
    map.setFocus(null);
    app.rig.autoDrift = 0.012;
    app.rig.set(mapPose(), { immediate: true, lambda: 1.2 });
    ui.showMap(bySubject);
  }

  /**
   * Frames the whole ring. A portrait phone is limited by its horizontal field
   * of view, so the distance is derived rather than guessed, and the aim point
   * is dropped to push the ring up clear of the unit list.
   */
  const MAP_EXTENT = 46; // ring radius plus cluster reach
  function mapPose() {
    const cam = app.stage.camera;
    const portrait = window.innerHeight > window.innerWidth;
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
    const fov = Math.min(vFov, hFov);
    const dist = (MAP_EXTENT / Math.sin(fov / 2)) * (portrait ? 0.9 : 0.98);
    const halfH = dist * Math.tan(vFov / 2);
    const dir = new THREE.Vector3(0.1, 0.34, 1).normalize();
    const look = new THREE.Vector3(4, 0, 0);
    if (portrait) look.y -= halfH * 0.34; // push the ring into the top half
    return { pos: look.clone().addScaledVector(dir, dist).toArray(), look: look.toArray() };
  }

  function openLesson(id) {
    inMap = false;

    // Resolve the lesson first, then wire the hooks, then mount: mount() fires
    // the sequencer's step-0 callback synchronously, and a late-assigned hook
    // would swallow the opening caption.
    const lesson = LESSONS.find((l) => l.id === id);
    if (!lesson || !app.mount(id)) return;

    app.rig.autoDrift = 0;
    app.onStep = (step, i, n) => {
      ui.setStep(step, i, n);
      ui.wakeDock();
      if (i === n - 1) ui.markDone(lesson.id);
    };
    app.onProgress = (p) => ui.setProgress(p);
    app.onTick = (story, d) => ui.tick(story, d);

    ui.showLesson(lesson, { index: 0, total: lesson.steps.length });
    const siblings = (bySubject[lesson.subject] ?? []);
    const i = siblings.findIndex((l) => l.id === lesson.id);
    ui.setUnitNav(i > 0 ? siblings[i - 1].id : null, siblings[i + 1]?.id ?? null);
    ui.setStep(lesson.steps[0], 0, lesson.steps.length);

    app.sequencer.onFinish = () => { ui.setPlaying(false); ui.toast('この単元は終わりです'); };
    ui.setPlaying(true);
  }

  ui.onFocusSubject = (key) => {
    map.setFocus(key);
    const c = key && map.clusters.find((x) => x.key === key);
    if (c) {
      const off = new THREE.Vector3(c.center.x * 0.2, 10, c.center.z * 0.2 + 22);
      app.rig.set({ pos: [c.center.x + off.x, c.center.y + off.y, c.center.z + off.z], look: c.center.toArray() }, { lambda: 1.1 });
    } else {
      app.rig.set(mapPose(), { lambda: 1.1 });
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case ' ': e.preventDefault(); app.sequencer?.toggle(); ui.setPlaying(app.sequencer?.playing ?? false); break;
      case 'ArrowRight': app.sequencer?.next(); break;
      case 'ArrowLeft': app.sequencer?.prev(); break;
      case 'Escape': openMap(); break;
      case 'r': case 'R': app.sequencer?.restart(); ui.setPlaying(true); break;
      case 'c': case 'C': ui.flashCaption(); break;
      case 'v': case 'V': ui.toggleVoice(); break;
      case 'd': case 'D': ui.toggleDetail(); break;
      case '+': case '=': app.rig.zoomBy(-0.25); break;
      case '-': case '_': app.rig.zoomBy(0.25); break;
      case '0': app.rig.resetZoom(); break;
      case '?': document.getElementById('help').classList.remove('hidden'); break;
      default: break;
    }
  });

  ui.el.btnQuality.textContent = { low: '低', medium: '中', high: '高' }[app.quality];

  openMap();
  app.start();
  requestAnimationFrame(() => ui.bootDone());

  if (new URLSearchParams(location.search).has('unit')) {
    openLesson(new URLSearchParams(location.search).get('unit'));
  }

  // expose for screenshots / debugging
  window.__sukukan = {
    app, ui, openLesson, openMap, subjects: SUBJECTS, colors: SUBJECT_COLORS, map,
    builderNames: () => builderRegistry.builderNames(),
    lessonIds: () => LESSONS.map((l) => l.id),
    /** Mount a builder directly, without lesson content. Used by QA tooling. */
    mountBuilder(name, params = {}) {
      try {
        const build = builderRegistry.getBuilder(name);
        if (!build) return { error: `未登録: ${name}` };
        app.clearWorld();
        ui.el.topbar.classList.add('hidden');
        ui.el.panel.classList.add('hidden');
        ui.el.params.classList.add('hidden');
        ui.el.mapUi.classList.add('hidden');
        const b = build({ accent: 0x6ee7ff, ...params });
        app.stage.world.add(b.group);
        app.builder = b;
        for (let i = 0; i < 240; i++) b.update(1 / 60, i / 60, 0);
        app.rig.set({ pos: [7, 5.5, 13], look: [0, 0, 0] }, { immediate: true });
        return { parts: b.parts, params: b.params };
      } catch (e) {
        return { error: e.message };
      }
    },
  };
  // three.js internals the QA script needs
  window.__THREE = THREE;

  /**
   * Content/builder consistency check: builds every lesson's builder once and
   * reports any show/hide/focus/note name that the builder does not expose.
   * Missing names fail silently at runtime, so this is the only guard.
   */
  window.__sukukan.auditParts = function auditParts() {
    const { getBuilder } = builderRegistry;
    const report = [];
    for (const l of LESSONS) {
      const build = getBuilder(l.builder);
      if (!build) { report.push({ id: l.id, problem: `builder 未登録: ${l.builder}` }); continue; }
      let b;
      try {
        b = build({ ...(l.params ?? {}), accent: 0xffffff });
      } catch (e) {
        report.push({ id: l.id, problem: `構築失敗: ${e.message} @ ${String(e.stack).split("\n")[1]?.trim()}` });
        continue;
      }
      const have = new Set(Object.keys(b.parts ?? {}));
      const missing = new Set();
      for (const st of l.steps ?? []) {
        for (const k of [...(st.show ?? []), ...(st.hide ?? [])]) if (!have.has(k)) missing.add(k);
        if (st.focus && !have.has(st.focus)) missing.add(`focus:${st.focus}`);
        for (const n of [st.note].flat().filter(Boolean)) {
          if (typeof n === 'object' && n.at && !have.has(n.at)) missing.add(`note:${n.at}`);
        }
      }
      if (missing.size) report.push({ id: l.id, problem: `parts に無い: ${[...missing].join(', ')}` });
      if ((l.steps ?? []).length < 3) report.push({ id: l.id, problem: `ステップが足りない: ${(l.steps ?? []).length}` });
      b.dispose?.();
    }
    return report;
  };
}
