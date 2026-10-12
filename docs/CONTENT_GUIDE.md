# 教材台本の書き方 (Content Guide)

各単元は `src/content/<科目>.js` に1つの `lesson({...})` として書く。

## スキーマ

```js
import { lesson, s } from './schema.js';

lesson({
  id: 'm1-3-1',                 // シラバス表の id と一致させる
  subject: 'm1',                // m1 | m2 | mi | ma | mb | mc
  chapter: '二次関数',            // CHAPTERS[subject] にある章名
  unit: '（3）二次関数とグラフ',   // 教科書的な節タイトル
  title: '放物線を3D空間で切る',   // 1行、面白さが伝わる見出し
  summary: '〜的理解できる。',      // 1〜2文
  builder: 'parabola3d',        // src/visuals/index.js に登録された名前
  params: { /* builder の初期値。fn はJSの関数も可 */ },
  paramsSpec: [                 // 任意。右パネルのスライダー
    { key: 'a', label: '係数 a', min: -3, max: 3, step: 0.1, value: 1 },
    { key: 'showArea', label: '面積', type: 'check', value: false },
  ],
  cam: { pos: [5, 4, 14], look: [0, 0, 0] },  // 単元全体の初期カメラ
  steps: [ s({...}), s({...}) ],
})
```

### ステップ `s({...})`

```js
s({
  d: 7,                       // 表示秒数。6〜8 が読みやすい
  text: '〜。<em>ここが要点</em>を強調する。',
  math: 'y=a^x\\quad(a>0)',   // KaTeX。省略可。' を本文に使うなら text 側だけ
  cam: { pos: [x,y,z], look: [x,y,z] },  // 省略可
  show: ['curve', 'area'],    // parts の名前を表示（スケールでポップイン）
  hide: ['columns'],
  set: { a: 2, t: 1.5 },      // builder.setParams に渡す
  focus: 'cone',              // parts[name] を框に収める
  note: { text: '頂点', at: 'vertex', dy: 0.6 },  // 3Dラベル
})
```

## 執筆ルール（重要）

1. **1単元 5〜7 ステップ。** 最初導入 → 定義 → 性質 →  Benoit 帰着 → まとめ。
2. **各ステップは「見て分かる」ことを1つだけ言う。** 説明と絵が一致していないと意味がない。
3. **数式は KaTeX 記法。** `\\frac`, `\\sqrt`, `\\sin`, `^`, `_`, `\\quad`。
   日本語は `\\text{...}` の中に入れる。
4. **文字列中のアポストロフィ `'` は `\\'` かダブルクォートを使う。**
   `'F'` のような表記は必ず `F2` と書くか、「F および F2」と平仮名混じりで書く。
5. **日本語の文は短く。** 1文 40 字以内。複雑な構文は使わない。
6. **外部言語の混入を禁ずる。** 簡体字・中国語・韓国語・タイ語・英語混挿は
   `node scripts/lint-text.mjs` で検出される。数学用語は日本語表記（`正弦`）か
   標準的な英字（`sin`）のどちらかに統一する。
7. **英語語の挿入は禁止。** 例えば「その指数 portion」のような英文の挿入は不可。
   全部日本語で書くか、数式に逃がす。
8. `cam` の距離は **10〜20**。対象が画面外に出るなら遠ざける。教科書のグラフは
   描画領域が 12 ワールド単位なので、z = 14 付近が見やすい。

## 手順

```
node scripts/lint-text.mjs     # 文字化け・混入言語の検出（必須）
npx vite build                 # 構文確認
node scripts/shoot.mjs <id>    # 実描画の確認。shots/lesson-<id>-a.png / -b.png
```

スクリーンショットを見て、グラフが画面内に収まっているか、ラベルが重なっていないか
を確認する。収まっていなければ `cam` を調整する。

## 参考実装

- `src/content/mathC.js` … ビルダーが「円錐の切断」1つに集中している例
- `src/content/math2.js` … 汎用ビルダーを関数ごとに差し替えて使う例
