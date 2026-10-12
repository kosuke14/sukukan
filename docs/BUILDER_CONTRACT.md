# ビルダー契約 (Builder Contract)

`src/visuals/*.js` の各モジュールは、1つの関数 `createXxx(params)` を `export` する。
それが `src/visuals/index.js` の `REGISTRY` に登録され、content から `builder: 'xxx'` で呼ばれる。

## シグネチャ

```js
export function createXxx(params = {}) {
  // params は content から来る初期値。必ず既定値を持つこと。
  ...
  return {
    group,        // THREE.Group。scene に入る唯一のルート
    parts,        // { 名前: THREE.Object3D }。content の show/hide/focus はここを指す
    params,       // 現在の可変パラメータ（読み取り用）
    setParams(patch),   // 部分更新。差分を見てジオメトリを作り直す
    update(dt, elapsed, stepProgress),  // 毎フレーム
    dispose(),    // 後始末
  };
}
```

## .step アクションの解釈（App 側が処理）

```js
s({
  d: 6,                        // 表示秒数
  text: '…',                   // パネル本文。<em>強調</em> が使える
  math: '…',                   // KaTeX 文法（displayMode）
  cam: { pos: [x,y,z], look: [x,y,z] },  // カメラ。省略時は前の位置を保つ
  show: ['curve', 'grid'],     // parts の名前を可視化（スケールでポップイン）
  hide: ['area'],
  set: { a: 2 },               // setParams に渡す
  focus: 'cone',               // parts[name] を框に収めるカメラ移動
  note: { text: '頂点', at: 'apex', dy: 0.6 }  // 3Dラベル。at は parts の名前
})
```

`update` は `group` がシーンに追加されている間ずっと呼ばれる。builder 自身が
`visible` を切り替えるのはよいが、`parts` の中身はあとから差し替えない（`clear` は
 Vessel 的に中身を空にしてよい）。

## 実装ルール

1. **材料は共通部品を使う。** `src/visuals/common.js` から import する:
   - `makeAxes({size, ticks, accent, labels})` — x/y/z 軸と目盛りとラベル
   - `makeGridPlane({size, div, color, plane})` — 床のグリッド
   - `makeCurve(fn, {samples, color, glow, glowWidth})` — `fn(t)` が Vector3 を返す
   - `makeArrow(from, to, {color, headSize, shaft})` — 任意の線分への矢印
   - `makePolygon(points, {color, opacity, edge})` — 頂点列の多角形
   - `makePoint(color, {size, halo})` — 光る点
   - `makeBalls(count, {color, radius, spread})` — InstancedMesh の球群
   - `makeDotRing({r, count, color, size, plane})` — 円周上の点列
   - `makeOrbit(radius, {color, opacity, tilt})` — 円軌道
   - `Animated` — パラメータのなめらかな補間（`to` / `snap` / `update(dt, lambda)`）
2. **マテリアルは `src/engine/Materials.js` から使う。** `solidMat` `basicMat` `lineBasic`
   `pointMat` `glowSprite` `dotTexture` `edgesOf`。これらはキャッシュ共有される
   （`dispose` しても他の単元で使い回される）。**マテリアルを直接 `dispose` しない。**
   ジオメトリは毎回 `dispose()` してから差し替える。
3. **3D内テキストは `makeLabel(text, {height, color, bg, border})` を使う。**
   KaTeX は使わない（DOM パネル専用）。
4. **初期化時に `parts` を作る。** 表示/非表示は content の `show`/`hide` に任せる。
   ただし既定で見せたいものは `group` に全部入れておいてよい。
5. **色は `accent` パラメータ**（科目色を `App` が渡す）。魔法値で色を固定しない。
6. **座標系は右手系・y 上。** 平面のグラフは xy 平面、立体図形は xyz。
   1単位 ≒ 1ワールド単位、区切りは 6〜12 ワールド単位が見やすい。

## 品質基準

- 最初のフレームで例外を出さない。`setParams` は未知キーを受けても無視してよい。
- `update` 内で `new THREE.*` を毎フレーム作らない（GC 対策）。
  ただし頂点配列の更新は可。
- `dispose` 知道自己が作った geometry を解放する。
- 日本語の文章は**コードコメントと文字列の中にしか書かない**。混在文字（簡体字など）が
  入ると `node scripts/lint-text.mjs` で落ちるので、書き終えたら必ず実行して確認する。

## 検証

```
node scripts/lint-text.mjs      # 文字化け・混在文字の検出
npx vite build                  # 構文と import の検証
node scripts/shoot.mjs <lessonId>  # 実描画のスクリーンショット（下の content が必要）
```

## 呼び出し側（App）の期待

- `parts` の各要素は `THREE.Object3D`。`group` に直下でなくてもよいが、
  `focus` は `Box3.setFromObject` で枠を取るため、孤立した空きオブジェクトは避ける。
- `setParams` はステップ遷移時に呼ばれる。重い再構築は `patch` の差分を見て行う。
