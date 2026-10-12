/** Single place that knows how a lesson is shaped. */
export const SUBJECTS = {
  m1: { key: 'm1', name: '数学I', short: 'I', color: '#5ec8ff', blurb: '数と式・図形と性質・二次関数' },
  m2: { key: 'm2', name: '数学II', short: 'II', color: '#ff8fb1', blurb: '式・指数対数・三角関数・微積分の考え' },
  mi: { key: 'mi', name: '数学III', short: 'III', color: '#6ef0c8', blurb: '極限・微分法・積分法' },
  ma: { key: 'ma', name: '数学A', short: 'A', color: '#ffd166', blurb: '図形・場合の数・確率' },
  mb: { key: 'mb', name: '数学B', short: 'B', color: '#b39dff', blurb: '数列・ベクトル・複素数・極限' },
  mc: { key: 'mc', name: '数学C', short: 'C', color: '#ff9f6e', blurb: '二次曲線・媒介変数・面積体積' },
};

export const CHAPTERS = {
  m1: ['数と式', '図形と性質', '二次関数'],
  m2: ['いろいろな式', '図形と方程式', '指数関数・対数関数', '三角関数', '微分・積分の考え'],
  mi: ['極限', '微分法', '積分法'],
  ma: ['図形の性質', '図形と式', '数と式', '場合の数', '確率'],
  mb: ['数列', '平面ベクトル', '複素数', '漸化式', '関数の極限と連続', '微分法と積分法'],
  mc: ['二次曲線', '媒介変数', '複素数平面', '2次元ベクトル', '合成関数と逆関数', '微分法と積分法'],
};

/** Applies a lesson script to a builder. Small factories keep content terse. */
export const s = (o) => ({ d: 5, ...o });

/** Assemble a lesson record. */
export function lesson(def) {
  return {
    steps: [],
    params: {},
    cam: { pos: [6, 4.6, 8], look: [0, 0, 0] },
    ...def,
  };
}

let REGISTRY = new Map();

export function defineLessons(list) {
  for (const l of list) REGISTRY.set(l.id, l);
}

export function getLesson(id) { return REGISTRY.get(id); }
export function allLessons() { return [...REGISTRY.values()]; }
export function lessonsBySubject() {
  const out = {};
  for (const l of REGISTRY.values()) (out[l.subject] ??= []).push(l);
  return out;
}
export function setRegistry(map) { REGISTRY = map; }
