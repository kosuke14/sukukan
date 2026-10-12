import katex from 'katex';
import 'katex/dist/katex.min.css';
import { SUBJECTS } from '../content/schema.js';
import { Speech, latexToJapanese, toSpeechText } from '../engine/Speech.js';

const $ = (id) => document.getElementById(id);

/** How long a caption stays up, and how long the transport bar lingers. */
const CAPTION_HOLD = 5200;   // 実時間でこれ以上は見せない（最低の可読時間）
const DOCK_HOLD = 2600;

/** All DOM chrome: captions, transport, detail drawer, parameters, star map. */
export class Ui {
  constructor(app, { onMap, onOpen, onStep, onPlayToggle, onSpeed, onQuality }) {
    this.app = app;
    this.onMap = onMap;
    this.onOpen = onOpen;
    this.lesson = null;
    this.speed = 1;
    this.progress = new Map();

    this.detailOpen = false;
    this.speech = new Speech();
    this.captionTimer = null;
    this.dockTimer = null;
    this.captionSticky = false;

    try {
      const raw = localStorage.getItem('sukukan.progress');
      if (raw) this.progress = new Map(Object.entries(JSON.parse(raw)));
    } catch { /* private mode — progress simply won't persist */ }

    this.el = {
      boot: $('boot'), bootNote: $('boot-note'),
      topbar: $('topbar'), panel: $('panel'), params: $('params'),
      caption: $('caption'), transport: $('transport'),
      mapUi: $('map-ui'), mapSide: $('map-side'), help: $('help'),
      crumbSubject: $('crumb-subject'), crumbChapter: $('crumb-chapter'), crumbUnit: $('crumb-unit'),
      kicker: $('p-kicker'), title: $('p-title'), summary: $('p-summary'),
      capTitle: $('cap-title'), capStepNo: $('cap-stepno'), capStepMax: $('cap-stepmax'),
      capMath: $('cap-math'), capText: $('cap-text'),
      fill: $('p-fill'), dot: $('p-head-dot'), track: $('p-track'),
      btnPlay: $('btn-play'), btnSpeed: $('btn-speed'), btnQuality: $('btn-quality'),
      btnDetail: $('btn-detail'),
    };

    $('btn-map').onclick = () => this.onMap?.();
    $('map-close').onclick = () => this.onMap?.();
    $('btn-prev').onclick = () => onStep?.(-1);
    $('btn-next').onclick = () => onStep?.(1);
    $('btn-prev-unit').onclick = () => { this.gotoSibling(-1); this.wakeDock(); };
    $('btn-next-unit').onclick = () => { this.gotoSibling(1); this.wakeDock(); };
    $('btn-caption').onclick = () => this.flashCaption();
    this.speech.onState = (on) => $('btn-voice').classList.toggle('speaking', on);
    this.speech.setEnabled(this._loadVoicePref());
    this._syncVoiceButton();
    $('btn-voice').onclick = () => this.toggleVoice();
    $('btn-detail').onclick = () => this.toggleDetail();
    $('btn-detail-close').onclick = () => this.toggleDetail(false);
    this.el.btnPlay.onclick = () => onPlayToggle?.();
    this.el.btnSpeed.onclick = () => {
      this.speed = this.speed === 1 ? 1.5 : this.speed === 1.5 ? 0.5 : this.speed === 0.5 ? 2 : 1;
      this.el.btnSpeed.textContent = `${this.speed.toFixed(1)}×`;
      onSpeed?.(this.speed);
      this.wakeDock();
    };
    this.el.btnQuality.onclick = () => {
      const q = this.app.cycleQuality();
      this.el.btnQuality.textContent = { low: '低', medium: '中', high: '高' }[q];
    };
    $('btn-help').onclick = () => this.el.help.classList.remove('hidden');
    $('help-close').onclick = () => this.el.help.classList.add('hidden');
    this.el.help.onclick = (e) => { if (e.target === this.el.help) this.el.help.classList.add('hidden'); };

    this.el.track.onclick = (e) => {
      const r = this.el.track.getBoundingClientRect();
      app.sequencer?.seekProgress((e.clientX - r.left) / r.width);
      this.wakeDock();
    };

    // Anywhere near the bottom wakes both the caption and the controls.
    this.el.caption.addEventListener('pointerenter', () => this.showCaption(true, { sticky: true }));
    this.el.caption.addEventListener('pointerleave', () => {
      if (!this.captionSticky) this.scheduleCaption();
    });
    this.el.transport.addEventListener('pointerenter', () => this.wakeDock(1e9));
    this.el.transport.addEventListener('pointerleave', () => this.wakeDock());
    window.addEventListener('pointermove', () => this.wakeDock());
  }

  bootDone() {
    this.el.boot.classList.add('gone');
    setTimeout(() => this.el.boot.classList.add('hidden'), 800);
  }

  bootNote(t) { this.el.bootNote.textContent = t; }

  // ----------------------------------------------------------- 読み上げ

  _loadVoicePref() {
    try { return localStorage.getItem('sukukan.voice') === 'on'; } catch { return false; }
  }

  _syncVoiceButton() {
    const b = $('btn-voice');
    const on = this.speech.enabled;
    b.classList.toggle('on', on);
    b.textContent = on ? '🔊 読み上げ' : '読み上げ';
    b.title = on ? '読み上げを止める (V)' : '読み上げをはじめる (V)';
  }

  toggleVoice(force) {
    const on = this.speech.setEnabled(force ?? !this.speech.enabled);
    try { localStorage.setItem('sukukan.voice', on ? 'on' : 'off'); } catch { /* ignore */ }
    this._syncVoiceButton();
    if (on) {
      const cur = this.el.capText.textContent.trim();
      if (cur) this.speech.say(cur);
      this.toast('読み上げをはじめます');
    } else {
      this.toast('読み上げを止めました');
    }
    return on;
  }

  /** ステップの本文と数式を、読み上げ用の日本語にまとめて話す。 */
  _speakStep(step) {
    if (!this.speech.enabled) return;
    const body = toSpeechText(step.text);
    const formula = latexToJapanese(step.math);
    const text = [formula, body].filter(Boolean).join('。');
    if (text) this.speech.say(text);
  }

  // ------------------------------------------------------------- 字幕

  /**
   * The explanation is part of the staging: it rises with the step, holds long
   * enough to read, then dissolves so the animation has the screen to itself.
   */
  showCaption(on, { sticky = false } = {}) {
    this.captionSticky = sticky && on;
    this.el.caption.classList.toggle('show', on);
    clearTimeout(this.captionTimer);
    if (on && !this.captionSticky) this.scheduleCaption();
  }

  /**
   * `tick` does the real work; this is only a safety net so a stalled render
   * loop cannot leave a caption parked over the scene forever.
   */
  scheduleCaption() {
    clearTimeout(this.captionTimer);
    this.captionTimer = setTimeout(() => this.showCaption(false), CAPTION_HOLD * 3);
    this.captionStepStart = performance.now();
  }

  /**
   * Called from the render loop. A caption that only ever followed the wall
   * clock would vanish early on a slow device while the step was still playing,
   * so it waits for the step's own progress too.
   */
  tick(storyElapsed, stepDuration) {
    if (!this.el.caption.classList.contains('show') || this.captionSticky) return;
    const wall = performance.now() - (this.captionStepStart ?? 0);
    const storyCap = Math.min(CAPTION_HOLD, (stepDuration ?? 8) * 0.78) * 1000;
    if (wall >= CAPTION_HOLD && storyElapsed * 1000 >= storyCap) this.showCaption(false);
  }

  /** Re-show the current caption on demand (C key, tapping, scrubbing). */
  flashCaption() {
    this.showCaption(true, { sticky: true });
    this.scheduleCaption();
    this.captionSticky = false;
    if (this.speech.enabled) this.speech.say(toSpeechText(this.el.capText.textContent));
  }

  wakeDock(ms = DOCK_HOLD) {
    clearTimeout(this.dockTimer);
    this.el.transport.classList.add('show');
    this.el.topbar.style.opacity = '1';
    if (ms < 1e8) this.dockTimer = setTimeout(() => this.el.transport.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------- 詳細

  toggleDetail(force) {
    this.detailOpen = force ?? !this.detailOpen;
    this.el.panel.classList.toggle('hidden', !this.detailOpen);
    this.el.btnDetail.classList.toggle('on', this.detailOpen);
    if (this.detailOpen) this.wakeDock(1e9);
  }

  // ----------------------------------------------------------- lessons

  showLesson(lesson, { index = 0, total = 1 } = {}) {
    this.lesson = lesson;
    const meta = SUBJECTS[lesson.subject];
    this.el.topbar.classList.remove('hidden');
    this.el.panel.classList.add('hidden');
    this.detailOpen = false;
    this.el.btnDetail.classList.remove('on');
    this.el.params.classList.remove('hidden');
    this.el.caption.classList.remove('hidden');
    this.el.transport.classList.remove('hidden');
    this.el.mapUi.classList.add('hidden');

    document.documentElement.style.setProperty('--accent', meta.color);
    this.el.crumbSubject.textContent = meta.name;
    this.el.crumbChapter.textContent = lesson.chapter;
    this.el.crumbUnit.textContent = lesson.unit;
    this.el.kicker.textContent = lesson.id.toUpperCase();
    this.el.title.textContent = lesson.title;
    this.el.capTitle.textContent = `${meta.name}　${lesson.unit}`;
    this.el.summary.textContent = lesson.summary ?? '';

    this.buildParams(lesson.paramsSpec);
    this.wakeDock();
  }

  setStep(step, index, total) {
    this.el.capStepNo.textContent = index + 1;
    this.el.capStepMax.textContent = total;
    this.el.capText.innerHTML = step.text ?? '';

    const html = renderMath(step.math);
    this.el.capMath.innerHTML = html;
    $('p-math').innerHTML = html;
    $('p-text').innerHTML = step.text ?? '';

    this.showCaption(true);
    this.scheduleCaption();
    this._speakStep(step);
  }

  setProgress(p) {
    this.el.fill.style.width = `${p * 100}%`;
    this.el.dot.style.left = `${p * 100}%`;
  }

  setPlaying(on) {
    this.el.btnPlay.textContent = on ? '❚❚' : '▶';
    // Paused means the viewer is reading; keep the caption up.
    if (!on) {
      this.showCaption(true, { sticky: true });
      this.speech.cancel();
    } else if (!this.captionSticky) this.scheduleCaption();
  }

  markDone(id) {
    this.progress.set(id, (this.progress.get(id) ?? 0) + 1);
    try { localStorage.setItem('sukukan.progress', JSON.stringify(Object.fromEntries(this.progress))); } catch { /* ignore */ }
  }

  /** Walk to the neighbouring unit within the same subject. */
  gotoSibling(dir) {
    if (!this.lesson) return;
    const list = Object.values(this.allBySubject ?? {}).flat()
      .filter((l) => l.subject === this.lesson.subject);
    const i = list.findIndex((l) => l.id === this.lesson.id);
    const next = list[i + dir];
    if (next) this.onOpen?.(next.id);
    else this.toast(dir > 0 ? 'この科目の最後の単元です' : '最初の単元です');
  }

  setUnitNav(prevId, nextId) {
    $('btn-prev-unit').disabled = !prevId;
    $('btn-next-unit').disabled = !nextId;
  }

  // ------------------------------------------------------------ params

  buildParams(spec) {
    const box = this.el.params;
    box.innerHTML = '';
    if (!spec?.length) return;
    const title = document.createElement('div');
    title.className = 'pr-title';
    title.textContent = 'パラメータ';
    box.appendChild(title);

    for (const p of spec) {
      if (p.type === 'check') {
        const row = document.createElement('label');
        row.className = 'pr-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!p.value;
        cb.onchange = () => this.app.builder?.setParams?.({ [p.key]: cb.checked });
        row.append(cb, document.createTextNode(p.label));
        box.appendChild(row);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'pr-row';
      const lab = document.createElement('div');
      lab.className = 'pr-label';
      const val = document.createElement('b');
      val.textContent = fmt(p.value);
      lab.append(Object.assign(document.createElement('span'), { textContent: p.label }), val);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = p.min; input.max = p.max; input.step = p.step ?? 'any'; input.value = p.value;
      input.oninput = () => {
        const v = parseFloat(input.value);
        val.textContent = fmt(v);
        this.app.builder?.setParams?.({ [p.key]: v });
      };
      row.append(lab, input);
      box.appendChild(row);
    }
  }

  // --------------------------------------------------------------- map

  showMap(groups) {
    this.allBySubject = groups;
    this.el.topbar.classList.add('hidden');
    this.el.caption.classList.add('hidden');
    this.el.transport.classList.add('hidden');
    this.el.panel.classList.add('hidden');
    this.el.params.classList.add('hidden');
    this.detailOpen = false;
    this.el.btnDetail.classList.remove('on');
    this.el.mapUi.classList.remove('hidden');

    const side = this.el.mapSide;
    side.innerHTML = '';
    for (const [key, list] of Object.entries(groups)) {
      const meta = SUBJECTS[key];
      const g = document.createElement('div');
      g.className = 'ms-group';
      const head = document.createElement('div');
      head.className = 'ms-head';
      head.innerHTML = `
        <span class="ms-dot" style="background:${meta.color};box-shadow:0 0 10px ${meta.color}"></span>
        <span class="ms-name">${meta.name}</span>
        <span class="ms-count">${list.length}</span>
        <span class="ms-caret">▶</span>`;
      head.onclick = () => {
        g.classList.toggle('open');
        this.onFocusSubject?.(g.classList.contains('open') ? key : null);
      };
      const ul = document.createElement('div');
      ul.className = 'ms-list';
      for (const l of list) {
        const b = document.createElement('button');
        b.className = 'ms-unit';
        const done = this.progress.has(l.id) ? '<span class="ms-done">●</span>' : '';
        b.innerHTML = `<span class="ms-id">${l.id}</span><span class="ms-title">${l.unit}</span>${done}`;
        b.onclick = () => this.onOpen?.(l.id);
        ul.appendChild(b);
      }
      g.append(head, ul);
      side.appendChild(g);
    }
  }

  toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', left: '50%', bottom: '6rem', transform: 'translateX(-50%)',
      background: 'rgba(9,14,30,0.9)', border: '1px solid rgba(140,170,255,0.25)',
      padding: '0.5em 1.1em', borderRadius: '999px', fontSize: '0.8rem', zIndex: '80',
      opacity: '0', transition: 'opacity .3s', pointerEvents: 'none',
    });
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 1600);
  }
}

function renderMath(src) {
  if (!src) return '';
  try {
    return katex.renderToString(src, { displayMode: true, throwOnError: false, strict: false });
  } catch {
    return '';
  }
}

function fmt(v) {
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}
