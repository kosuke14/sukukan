/**
 * 読み上げ（Web Speech API）。
 *
 * ライブラリも API キーも不要で、OS に組み込まれた日本語音声を使う。
 * 教材なので2点だけ対処している:
 *   - 1文が長いと Chrome / Safari で途中で切られるので文単位で分割する
 *   - LaTeX をそのまま読ませると不自然な音になるため、日本語へ変換してから渡す
 */
const RATE = 1.0;

// 日本語音声の優先順（自然な響きのものを先に置く）
const VOICE_PREFERENCE = [
  'Kyoko', 'Otoya', 'Nanami', 'Haruka', 'Microsoft Nanami', 'Microsoft Haruka',
  'Google 日本語', 'Google Japan', 'Japanese', '日本語',
];

/** LaTeX を「読み上げられる日本語」に落とす。教材で頻出する記法だけ。 */
export function latexToJapanese(src) {
  if (!src) return '';
  let s = src;
  // 入れ子の \frac を外側から潰すため数回回す
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s
      .replace(/\\d?frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, ' $1 分の $2 ')
      .replace(/\\sqrt\{([^{}]*)\}/g, ' $1 の根号 ')
      .replace(/\\(sin|cos|tan)\b/g, ' $1 ')
      .replace(/\\log_?\{?[a-zA-Z0-9]*\}?/g, '  logarithm ')
      .replace(/\\lim/g, ' リミット ')
      .replace(/\\(pi|theta|alpha|beta|gamma|delta|varepsilon|varepsilon)\b/g,
        (_, n) => ({ pi: 'パイ', theta: 'シータ', alpha: 'アルファ', beta: 'ベータ',
          gamma: 'ガンマ', delta: 'デルタ', varepsilon: 'ヴァーエプシロン', varepsilon: 'エプシロン' })[n])
      .replace(/\\infty/g, ' 無限大 ')
      .replace(/\\le(?!q)|\\leq/g, ' 以下 ')
      .replace(/\\ge(?!q)|\\geq/g, ' 以上 ')
      .replace(/\\ne(?!q)|\\neq/g, ' 等しくない ')
      .replace(/\\iff/g, ' と同値 ')
      .replace(/\\to|\\rightarrow/g, ' ならば ')
      .replace(/\\cdot|\\times/g, ' かける ')
      .replace(/\\ldots|\\dots|\\cdots/g, ' 続々 ')
      .replace(/\\quad|\\qquad/g, ' ')
      .replace(/\\(left|right|displaystyle|,|;|:)/g, '')
      .replace(/\\text\{([^}]*)\}/g, ' $1 ')
      .replace(/\\mathrm\{([^}]*)\}/g, ' $1 ')
      .replace(/[{}]/g, '');
    if (s === before) break;
  }
  s = s
    .replace(/\\circ/g, ' 度 ')
    .replace(/\\degree/g, ' 度 ')
    .replace(/<=|>=/g, ' ')
    .replace(/</g, ' 小于 ')
    .replace(/>/g, ' 大于 ')
    .replace(/\|/g, ' 絶対値の ')
    .replace(/\+/g, ' プラス ')
    .replace(/-/g, ' マイナス ')
    .replace(/=/g, ' は ')
    .replace(/,/g, '、');
  // 上付き・下付き
  s = s
    .replace(/\^\{?(-?\d+)\}?/g, 'の$1乗')
    .replace(/\^\{?(-?[a-zA-Z])\}?/g, 'の$1乗')
    .replace(/\^\{([^}]*)\}/g, 'の$1乗')
    .replace(/_\{?\{([^}]*)\}\}?/g, 'の$1')
    .replace(/_\{?([a-zA-Z0-9])\}?/g, 'の$1');
  return s
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\\/g, '')
    .replace(/絶対値の\s*(\S+)\s*絶対値の/g, '絶対値の $1')
    .replace(/絶対値の\s*は/g, 'は')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** HTML タグと実体参照を取り除いて読み上げ用の plain text にする。 */
export function toSpeechText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '、')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '小于')
    .replace(/&gt;/g, '大于')
    .replace(/&amp;/g, 'と')
    .replace(/&deg;/g, '度')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 1チャンクに収まるよう、句読点で切り出す。 */
function chunk(text, limit = 110) {
  const parts = text.split(/(?<=[。！？!?])/);
  const out = [];
  let buf = '';
  for (const p of parts) {
    if ((buf + p).length > limit && buf) { out.push(buf); buf = ''; }
    if (p.length > limit) {
      for (let i = 0; i < p.length; i += limit) out.push(p.slice(i, i + limit));
      continue;
    }
    buf += p;
  }
  if (buf.trim()) out.push(buf);
  return out.filter((s) => s.trim());
}

export class Speech {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.supported = !!this.synth && typeof window.SpeechSynthesisUtterance !== 'undefined';
    this.enabled = false;
    this.voice = null;
    this.speaking = false;
    this.onState = null;
    this._pieces = [];
    this._index = 0;
    this._ka = null;

    if (this.supported) {
      const pick = () => this._pickVoice();
      pick();
      // Chrome は voices が非同期に arriving する
      this.synth.addEventListener?.('voiceschanged', pick);
    }
  }

  _pickVoice() {
    const voices = this.synth.getVoices();
    if (!voices.length) return;
    const ja = voices.filter((v) => /^ja(-|_|$)/i.test(v.lang));
    const pool = ja.length ? ja : voices;
    for (const want of VOICE_PREFERENCE) {
      const hit = pool.find((v) => v.name.includes(want));
      if (hit) { this.voice = hit; return; }
    }
    this.voice = pool.find((v) => v.default) ?? pool[0];
  }

  /** 音声一覧（日本語のみ）。選択 UI 用。 */
  voices() {
    if (!this.supported) return [];
    return this.synth.getVoices().filter((v) => /^ja(-|_|$)/i.test(v.lang));
  }

  setVoice(name) {
    const hit = this.voices().find((v) => v.name === name);
    if (hit) this.voice = hit;
  }

  setEnabled(on) {
    this.enabled = on && this.supported;
    if (!this.enabled) this.cancel();
    return this.enabled;
  }
  /**
   * 読み上げを求める。ステップを跨いでも、今吹んでいる1文は最後まで通す。
   *
   * 教材なので文章の途中で切れると内容が頭に入らない。ここでは
   * 「進行中の1文は最後まで読み、待ち行列は最新のものだけ残す」挙動にしてある。
   * 連続して飛ばしたり、ボタンを連打したりしても積み重ならない。
   */
  say(text) {
    if (!this.enabled || !this.supported) return;
    const pieces = chunk(String(text ?? '').replace(/\s+/g, ' ').trim());
    if (!pieces.length) return;

    this._pieces = pieces;
    this._index = 0;
    if (this.speaking) return;   // 進行中の1文を終えてから、この続きを話す
    this._drain();
  }

  _drain() {
    if (!this.enabled || !this.supported) return this._finish();
    if (this._index >= this._pieces.length) return this._finish();

    this.speaking = true;
    this.onState?.(true);
    this._keepAlive();

    const u = new SpeechSynthesisUtterance(this._pieces[this._index++]);
    u.lang = this.voice?.lang ?? 'ja-JP';
    if (this.voice) u.voice = this.voice;
    u.rate = RATE;
    u.pitch = 1.0;
    u.onend = () => this._drain();
    u.onerror = () => this._drain();
    this.synth.speak(u);
  }

  /** Chrome は 15 秒左右的で読み上げを勝手に止める。既知の回避策。 */
  _keepAlive() {
    if (this._ka) return;
    this._ka = setInterval(() => {
      if (this.speaking && this.synth.speaking && !this.synth.paused) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 9000);
  }

  _stopKeepAlive() {
    if (this._ka) { clearInterval(this._ka); this._ka = null; }
  }

  _finish() {
    this.speaking = false;
    this._index = 0;
    this._stopKeepAlive();
    this.onState?.(false);
  }

  /** 読み上げを強制的に止める（一時停止・星図へ移動・オフ に切るとき）。 */
  cancel() {
    this._pieces = [];
    this._index = 0;
    this._stopKeepAlive();
    if (this.supported) { try { this.synth.cancel(); } catch { /* noop */ } }
    this.speaking = false;
    this.onState?.(false);
  }
}