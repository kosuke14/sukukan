/**
 * A lesson script is an ordered list of steps. Each step holds narration,
 * an optional display equation, a camera pose, and declarative actions that
 * the lesson player applies when the step begins.
 *
 *   { d: 5, text, math, cam:{pos,look}, show:[], hide:[], set:{}, focus:'', note:'' }
 */
export class Sequencer {
  constructor({ steps = [], onStep, onProgress, onFinish } = {}) {
    this.steps = steps;
    this.onStep = onStep;
    this.onProgress = onProgress;
    this.onFinish = onFinish;

    this.index = -1;
    this.elapsed = 0;
    this.speed = 1;
    this.playing = false;
    this.finished = false;
  }

  get current() { return this.steps[this.index] ?? null; }
  get count() { return this.steps.length; }
  get total() { return this.steps.reduce((a, s) => a + (s.d ?? 5), 0); }

  /** Progress through the whole lesson, 0..1. */
  get overall() {
    if (!this.steps.length) return 0;
    let before = 0;
    for (let i = 0; i < this.index; i++) before += this.steps[i].d ?? 5;
    const cur = (this.steps[this.index]?.d ?? 5) || 1;
    return (before + Math.min(this.elapsed, cur)) / this.total;
  }

  play() { this.playing = true; this.finished = false; }
  pause() { this.playing = false; }
  toggle() { this.playing ? this.pause() : this.play(); }

  goTo(i, { autoplay = null } = {}) {
    if (!this.steps.length) return;
    const idx = Math.max(0, Math.min(i, this.steps.length - 1));
    const changed = idx !== this.index;
    this.index = idx;
    this.elapsed = 0;
    this.finished = false;
    if (autoplay !== null) this.playing = autoplay;
    if (changed) this.onStep?.(this.current, idx, this.steps.length);
    this._emitProgress();
  }

  restart() {
    this.finished = false;
    this.elapsed = 0;
    this.goTo(0, { autoplay: true });
  }

  next() {
    if (this.index >= this.steps.length - 1) { this.pause(); this.finished = true; this.onFinish?.(); return; }
    this.goTo(this.index + 1);
  }

  prev() { this.goTo(Math.max(0, this.index - 1)); }

  /** Jump to the step covering absolute progress p (0..1) — used by the scrubber. */
  seekProgress(p) {
    if (!this.steps.length) return;
    const target = p * this.total;
    let acc = 0;
    for (let i = 0; i < this.steps.length; i++) {
      const d = this.steps[i].d ?? 5;
      if (target < acc + d || i === this.steps.length - 1) {
        const changed = i !== this.index;
        this.index = i;
        this.elapsed = target - acc;
        this.finished = false;
        if (changed) this.onStep?.(this.current, i, this.steps.length);
        this._emitProgress();
        return;
      }
      acc += d;
    }
  }

  setSpeed(s) { this.speed = s; }

  update(dt) {
    if (!this.steps.length) return;
    if (!this.playing) return;
    const d = this.current?.d ?? 5;
    this.elapsed += dt * this.speed;
    if (this.elapsed >= d) {
      const over = this.elapsed - d;
      if (this.index >= this.steps.length - 1) {
        this.elapsed = d;
        this.playing = false;
        this.finished = true;
        this.onFinish?.();
      } else {
        this.goTo(this.index + 1);
        this.elapsed = over; // carry the remainder so transitions stay smooth
      }
    }
    this._emitProgress();
  }

  /** Normalised progress inside the active step. */
  get stepProgress() {
    const d = this.current?.d ?? 5;
    return d ? Math.min(this.elapsed / d, 1) : 0;
  }

  _emitProgress() { this.onProgress?.(this.overall, this.stepProgress, this.index); }

  dispose() {
    this.onStep = this.onProgress = this.onFinish = null;
  }
}
