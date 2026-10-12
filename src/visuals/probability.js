import * as THREE from 'three';
import { solidMat, lineBasic, dotTexture, disposeObject } from '../engine/Materials.js';
import { makeLabel } from '../engine/Label.js';
import { clamp, lerp, TAU, seededRandom } from '../engine/MathUtil.js';
import { makeAxes, makeGridPlane, makePoint, makeArrow, Animated, accentOf } from './common.js';

/**
 * 確率の3Dモデル。
 * 壺からの拔出、順列と組合せの表、さいころの独立性、期待値、反復試行、試行の樹を
 * 同じ器の上に置く。どの表示も「数えているものを形で見せる」ことを優先する。
 */
export function createProbability(params = {}) {
  const {
    mode = 'urn',
    red = 3, white = 4, draw = 3,
    n = 4, p = 0.5, nTrials = 8, people = 5,
    accent = 0x6ee7ff,
  } = params;

  const col = accentOf(accent);
  const group = new THREE.Group();
  const parts = {};
  const P = { mode, red, white, draw, n, p, nTrials, people, count: 1, grow: 0, values: [] };

  const RED = 0xff6b6b;
  const WHITE = 0xdfe9ff;
  const GOLD = 0xffd166;

  function vessel(name) {
    const g = new THREE.Group();
    group.add(g);
    parts[name] = g;
    return g;
  }
  /** 器に入れた幾何とマテリアルを解放してから空にする。 */
  function emptyOf(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (m.userData?.shared) continue;
          if (m.map && m.map !== dotTexture() && !m.map.userData?.shared) m.map.dispose();
          m.dispose();
        }
      }
    });
    g.clear();
  }

  const axes = makeAxes({ size: 11, ticks: 10, accent: col, labels: ['x', 'y', 'z'] });
  group.add(axes);
  parts.axes = axes;
  const grid = makeGridPlane({ size: 13, div: 26, color: 0x2f4a7a, opacity: 0.36 });
  group.add(grid);
  parts.grid = grid;

  const urn = vessel('urn');
  const balls = vessel('balls');
  const drawChute = vessel('drawChute');
  const sampled = vessel('sampled');
  const lattice = vessel('lattice');
  const tree = vessel('tree');
  const branches = vessel('branches');
  const permRow = vessel('permRow');
  const permDot = vessel('permDot');
  const combRow = vessel('combRow');
  const combDot = vessel('combDot');
  const bars = vessel('bars');
  const expectedMarker = vessel('expectedMarker');
  const meanLine = vessel('meanLine');
  const varianceBand = vessel('varianceBand');
  const treeNodes = vessel('treeNodes');
  const history = vessel('history');

  const anim = new Animated({ count: 1, grow: 0 });
  const note = makeLabel('', { height: 0.4, color: '#eaf6ff', bg: 'rgba(6,10,22,0.8)', border: 'rgba(110,231,255,0.3)' });
  note.position.set(0, 7.0, 0);
  group.add(note);
  parts.note = note;

  // ------------------------------------------------------ 必要な計算
  const fact = (N) => { let r = 1; for (let i = 2; i <= N; i++) r *= i; return r; };
  const binom = (N, K) => {
    if (K < 0 || K > N) return 0;
    let r = 1;
    for (let i = 1; i <= K; i++) r = (r * (N - K + i)) / i;
    return Math.round(r);
  };
  const binomProb = (N, K, pp) => binom(N, K) * Math.pow(pp, K) * Math.pow(1 - pp, N - K);
  const probLabel = (q) => (q > 0.9995 ? '1' : q < 0.0005 ? '0' : q.toFixed(3).replace(/^0\./, '.'));
  const ring = (r, y, seg = 48) => {
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    return pts;
  };

  // ------------------------------------------------------------ 壺
  function buildUrn() {
    const h = 2.8, rr = 1.4;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(rr, rr * 0.72, h, 44, 1, true),
      solidMat(0x8fb2e6, { opacity: 0.13, roughness: 0.2 })
    );
    wall.position.y = h / 2;
    urn.add(wall);
    urn.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring(rr, h)), lineBasic(0x8fb2e6, 0.75)));
    urn.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring(rr * 0.72, 0)), lineBasic(0x8fb2e6, 0.75)));
    const cl = makeLabel('壺', { height: 0.38, color: '#cfe0ff' });
    cl.position.set(0, h + 0.5, 0);
    urn.add(cl);

    const cz = 2.6;
    const chute = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.62, 0.6, 26, 1, true), solidMat(GOLD, { opacity: 0.22 }));
    chute.position.set(0, 0.3, cz);
    drawChute.add(chute);
    drawChute.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ring(1.0, 0.6 + cz, 36)),
      lineBasic(GOLD, 0.8)
    ));
    const dl = makeLabel('引いた玉', { height: 0.32, color: '#ffd166' });
    dl.position.set(0, 0.95, cz);
    drawChute.add(dl);
    P.chuteZ = cz;
  }

  function buildBalls() {
    const total = Math.max(1, P.red + P.white);
    const rand = seededRandom(31);
    const d = new THREE.Object3D();
    const put = (count, y0, color) => {
      if (count <= 0) return;
      const inst = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.2, 18, 12),
        solidMat(color, { opacity: 1, roughness: 0.3, metalness: 0.05 }),
        count
      );
      for (let i = 0; i < count; i++) {
        const a = rand() * TAU, rad = Math.sqrt(rand()) * 0.8;
        d.position.set(Math.cos(a) * rad, y0 + rand() * 0.5, Math.sin(a) * rad);
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      }
      inst.userData.noReveal = true;
      balls.add(inst);
    };
    put(P.red, 0.25, RED);
    put(P.white, 0.8, WHITE);

    // 取り出した玉。引いた順で並べる。
    const rd = seededRandom(17);
    const cz = P.chuteZ ?? 2.6;
    for (let i = 0; i < P.draw; i++) {
      const isRed = rd() < P.red / total;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 18, 12),
        solidMat(isRed ? RED : WHITE, { opacity: 1, roughness: 0.3, metalness: 0.05 })
      );
      m.userData.noReveal = true;
      m.userData.slot = i;
      m.userData.destX = (i - (P.draw - 1) / 2) * 0.5;
      m.userData.destY = 0.24;
      m.userData.destZ = cz;
      m.position.set(0, 1.4, 0);
      sampled.add(m);
    }
    const lbl = makeLabel(`${P.draw} 個ひく`, { height: 0.32, color: '#eaf6ff' });
    lbl.position.set(0, -0.25, cz);
    sampled.add(lbl);

    P.allWays = fact(total) / fact(Math.max(total - P.draw, 0));
    note.userData.setText(`赤玉 ${P.red} / 白玉 ${P.white}。全体 ${total} 個から ${P.draw} 個。並べ方は ${P.allWays.toLocaleString('en-US')} 通り。`);
  }

  // ------------------------------------------------- さいころの独立な表
  function buildLattice() {
    const w = 1.15, dz = 0.42;
    for (let i = 1; i <= 6; i++) {
      for (let j = 1; j <= 6; j++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.86, 0.09, dz * 2.2),
          solidMat(i === j ? GOLD : 0x2b4a80, { opacity: i === j ? 0.8 : 0.4 })
        );
        m.position.set((i - 3.5) * w, 0, (j - 3.5) * dz * 1.7);
        m.userData.noReveal = true;
        lattice.add(m);
        const lb = makeLabel(`${i}${j}`, { height: 0.2, color: '#a9c6f0' });
        lb.position.set(m.position.x, 0.16, m.position.z);
        lattice.add(lb);
      }
    }
    lattice.add(makeArrow(new THREE.Vector3(-3.9, 0.25, 4.4), new THREE.Vector3(-2.6, 0.25, 4.4), { color: 0xff8fb1, headSize: 0.22 }));
    lattice.add(makeArrow(new THREE.Vector3(2.6, 0.25, 4.4), new THREE.Vector3(3.9, 0.25, 4.4), { color: 0xff8fb1, headSize: 0.22 }));
    const la = makeLabel('さいころ A の目', { height: 0.32, color: '#ff8fb1' });
    la.position.set(0, 0.3, 4.7);
    lattice.add(la);
    lattice.add(makeArrow(new THREE.Vector3(-4.6, 0.25, -3.4), new THREE.Vector3(-4.6, 0.25, -2.1), { color: 0x8fe8ff, headSize: 0.22 }));
    const lb2 = makeLabel('さいころ B の目', { height: 0.32, color: '#8fe8ff' });
    lb2.position.set(-5.0, 0.3, 0.4);
    lattice.add(lb2);
    note.userData.setText('36 通りの出目。同じ目は 6 つずつ、すべて 1/36。片方が決まっても他方は変わらない。');
  }

  // ------------------------------------------------- 順列と組合せ
  // 並びは表示できる枚数だけで止める。総数は数え上げで求める。
  const ROW_CAP = 12;
  function permutations(N, R, cap) {
    const out = [], used = new Array(N).fill(false), cur = [];
    (function rec() {
      if (out.length >= cap) return;
      if (cur.length === R) { out.push([...cur]); return; }
      for (let i = 0; i < N; i++) {
        if (used[i]) continue;
        used[i] = true; cur.push(i);
        rec();
        cur.pop(); used[i] = false;
        if (out.length >= cap) return;
      }
    })();
    return out;
  }
  function combos(N, R, cap) {
    const out = [], cur = [];
    (function rec(start) {
      if (out.length >= cap) return;
      if (cur.length === R) { out.push([...cur]); return; }
      for (let i = start; i < N; i++) {
        cur.push(i);
        rec(i + 1);
        cur.pop();
        if (out.length >= cap) return;
      }
    })(0);
    return out;
  }

  function buildPerm() {
    const N = Math.max(2, Math.round(P.n));
    const R = clamp(Math.round(P.draw), 1, Math.min(4, N));
    const total = Math.round(fact(N) / fact(N - R));
    const list = permutations(N, R, ROW_CAP);
    P.perms = list;
    P.permTotal = total;
    const gap = 0.7, rows = list.length, pitch = 0.42;
    for (let i = 0; i < N; i++) {
      const p = makePoint(0x9fd8ff, { size: 0.12, halo: 0.8 });
      p.position.set(i * gap, 2.8, 0);
      permRow.add(p);
      const lb = makeLabel(String(i + 1), { height: 0.3, color: '#cfe0ff' });
      lb.position.set(i * gap, 3.3, 0);
      permRow.add(lb);
    }
    const ml = makeLabel('並べる順序を区別する', { height: 0.3, color: '#9fd8ff' });
    ml.position.set((N - 1) * gap * 0.5 - 1.4, 2.8, 0.4);
    permRow.add(ml);
    for (let k = 0; k < rows; k++) {
      const y = 2.0 - k * pitch;
      for (let j = 0; j < R; j++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), solidMat(GOLD, { opacity: 0.92, roughness: 0.3 }));
        d.position.set(j * gap, y, 0);
        d.userData.noReveal = true;
        d.userData.row = k;
        permDot.add(d);
      }
    }
    const cl = makeLabel(`${total} 通り = ${fact(N)} / ${fact(N - R)}`, {
      height: 0.36, color: '#ffd166', bg: 'rgba(6,10,22,0.8)', border: 'rgba(255,209,102,0.35)',
    });
    cl.position.set((R - 1) * gap * 0.5, 1.0 - rows * pitch, 0);
    permRow.add(cl);
    note.userData.setText(`${N} 個から ${R} 個の並べ方は ${total} 通り。取り出す順序も区別する。`);
  }

  function buildComb() {
    const N = Math.max(2, Math.round(P.n));
    const R = clamp(Math.round(P.draw), 1, Math.min(4, N));
    const total = binom(N, R);
    const list = combos(N, R, ROW_CAP);
    P.combs = list;
    P.combTotal = total;
    const gap = 0.75, step = 0.85, rows = list.length;
    for (let i = 0; i < N; i++) {
      const p = makePoint(0x9fd8ff, { size: 0.12, halo: 0.8 });
      p.position.set(i * gap, 2.8, 0);
      combRow.add(p);
      const lb = makeLabel(String(i + 1), { height: 0.3, color: '#cfe0ff' });
      lb.position.set(i * gap, 3.3, 0);
      combRow.add(lb);
    }
    for (let k = 0; k < rows; k++) {
      const y = 1.9 - k * step;
      // 同じ並びはひとまとめの枠で囲む
      const box = new THREE.Mesh(new THREE.BoxGeometry(R * gap * 0.96, 0.6, 0.34), solidMat(0x7cffb2, { opacity: 0.16 }));
      box.position.set((R - 1) * gap * 0.5, y, -0.28);
      box.userData.noReveal = true;
      combRow.add(box);
      for (let j = 0; j < R; j++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), solidMat(0x7cffb2, { opacity: 0.92, roughness: 0.3 }));
        d.position.set(j * gap, y, 0);
        d.userData.noReveal = true;
        d.userData.row = k;
        combDot.add(d);
      }
      const lb = makeLabel(`{ ${list[k].map((i) => i + 1).join(',')} }`, { height: 0.26, color: '#7cffb2' });
      lb.position.set((R - 1) * gap * 0.5 + 1.4, y, 0);
      combRow.add(lb);
    }
    const cl = makeLabel(`${total} 通り`, {
      height: 0.36, color: '#7cffb2', bg: 'rgba(6,10,22,0.8)', border: 'rgba(124,255,178,0.35)',
    });
    cl.position.set(0, 1.9 - rows * step - 0.3, 0);
    combRow.add(cl);
    note.userData.setText(`順序を無視すると ${total} 通り。同じ並びはひとまとめにする。`);
  }

  // ------------------------------------------------- 期待値と分布
  function buildExpect() {
    const N = clamp(Math.round(P.n), 1, 12);
    P.values = [];
    for (let k = 0; k <= N; k++) P.values.push({ k, prob: binomProb(N, k, P.p) });
    P.expect = N * P.p;
    P.variance = N * P.p * (1 - P.p);
    const sd = Math.sqrt(P.variance);
    const w = 0.95;
    const UNIT = 5.6;                                   // 確率 1 に相当する高さ
    const heights = P.values.map((v) => v.prob * UNIT);
    const top = Math.max(...heights, 1e-3);
    for (let i = 0; i < P.values.length; i++) {
      const v = P.values[i];
      const x = (v.k - N / 2) * w;
      const hgt = heights[i];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 1, 0.78), solidMat(col, { opacity: 0.45 }));
      m.position.set(x, hgt / 2, 0);
      m.scale.y = Math.max(hgt, 1e-3);
      m.userData.noReveal = true;
      m.userData.full = Math.max(hgt, 1e-3);
      bars.add(m);
      const lb = makeLabel(`${v.k}`, { height: 0.3, color: '#cfe0ff' });
      lb.position.set(x, -0.55, 0.3);
      bars.add(lb);
      const pl = makeLabel(probLabel(v.prob), { height: 0.26, color: '#8fb2e6' });
      pl.position.set(x, hgt + 0.4, 0);
      bars.add(pl);
    }
    // 期待値は分布の重心
    const ex = (P.expect - N / 2) * w;
    expectedMarker.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ex, 0, 0.7), new THREE.Vector3(ex, top + 1.1, 0.7)]),
      lineBasic(GOLD, 0.95)
    ));
    const m = makePoint(GOLD, { size: 0.13, halo: 1.0 });
    m.position.set(ex, 0.35, 0.7);
    expectedMarker.add(m);
    const lb = makeLabel(`期待値 ${P.expect.toFixed(2)}`, { height: 0.36, color: '#ffd166' });
    lb.position.set(ex, top + 1.5, 0.7);
    expectedMarker.add(lb);

    // 棒の高さは確率そのものなので、全部足すと 1 になる
    meanLine.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-(N / 2) * w - 0.5, UNIT, -1.1), new THREE.Vector3((N / 2) * w + 0.5, UNIT, -1.1),
      ]),
      lineBasic(0x7cffb2, 0.85)
    ));
    const ml = makeLabel('確率を足すと 1', { height: 0.32, color: '#7cffb2' });
    ml.position.set(0, UNIT + 0.45, -1.1);
    meanLine.add(ml);

    if (sd > 1e-6) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(sd * 2 * w, top + 0.7, 1.6), solidMat(0xff8fb1, { opacity: 0.1 }));
      band.position.set(ex, (top + 0.7) / 2, -0.5);
      band.userData.noReveal = true;
      varianceBand.add(band);
      for (const s of [-1, 1]) {
        varianceBand.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(ex + s * sd * w, 0, -0.5), new THREE.Vector3(ex + s * sd * w, top + 0.7, -0.5),
          ]),
          lineBasic(0xff8fb1, 0.5)
        ));
      }
      const vl = makeLabel(`標準偏差 ${sd.toFixed(2)}`, { height: 0.32, color: '#ff8fb1' });
      vl.position.set(ex, top + 2.2, -0.5);
      varianceBand.add(vl);
    }
    note.userData.setText(`X = 成功した回数。E(X) = n·p = ${N}·${P.p} = ${P.expect.toFixed(2)} が期待値。`);
  }

  // ------------------------------------------------- 二項分布の棒グラフ
  function buildBinomial() {
    const N = clamp(Math.round(P.n), 1, 12);
    P.values = [];
    for (let k = 0; k <= N; k++) P.values.push({ k, prob: binomProb(N, k, P.p) });
    P.allOutcomes = Math.pow(2, N);
    const w = 0.95, UNIT = 5.6;
    const top = Math.max(...P.values.map((v) => v.prob * UNIT), 1e-3);
    for (const v of P.values) {
      const x = (v.k - N / 2) * w;
      const hgt = v.prob * UNIT;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 1, 0.78), solidMat(col, { opacity: 0.45 }));
      m.position.set(x, hgt / 2, 0);
      m.scale.y = Math.max(hgt, 1e-3);
      m.userData.noReveal = true;
      m.userData.full = Math.max(hgt, 1e-3);
      bars.add(m);
      const lb = makeLabel(`${v.k}`, { height: 0.3, color: '#cfe0ff' });
      lb.position.set(x, -0.55, 0.3);
      bars.add(lb);
      const pl = makeLabel(probLabel(v.prob), { height: 0.26, color: '#8fb2e6' });
      pl.position.set(x, hgt + 0.4, 0);
      bars.add(pl);
    }
    const ex = (N * P.p - N / 2) * w;
    meanLine.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ex, 0, 0.8), new THREE.Vector3(ex, top + 1.1, 0.8)]),
      lineBasic(GOLD, 0.9)
    ));
    const ml = makeLabel(`平均 ${(N * P.p).toFixed(2)}`, { height: 0.32, color: '#ffd166' });
    ml.position.set(ex, top + 1.5, 0.8);
    meanLine.add(ml);
    note.userData.setText(`${P.allOutcomes} 通りのうち成功は平均 ${(N * P.p).toFixed(2)} 回。いちばん多いのは中央。`);
  }

  // ------------------------------------------------- 試行結果の木
  function buildLeafStrip(N) {
    const depth = clamp(Math.round(N), 1, 6);
    const total = Math.pow(2, depth);
    const cap = Math.min(total, 64);
    const dx = Math.min(0.4, 9 / Math.max(cap, 1));
    const y = -1.6;
    for (let i = 0; i < cap; i++) {
      let succ = 0;
      for (let k = 0; k < depth; k++) succ += (i >> k) & 1;
      const x = (i - (cap - 1) / 2) * dx;
      const node = makePoint(succ * 2 >= depth ? 0x7cffb2 : 0xff8fb1, { size: 0.075, halo: 0.5 });
      node.position.set(x, y, 3.4);
      treeNodes.add(node);
      let par = Math.floor(i / 2);
      let guard = 0;
      while (par >= 0 && guard < 3) {
        branches.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3((par - (cap - 1) / 2) * dx, y, 3.4),
            new THREE.Vector3(x, y, 3.4),
          ]),
          lineBasic(0x9fd8ff, 0.28)
        ));
        par = Math.floor(par / 2);
        guard++;
      }
    }
    const tl = makeLabel(`${total} 通りの結果（緑は成功が半数以上）`, { height: 0.32, color: '#9fd8ff' });
    tl.position.set(0, y - 0.75, 3.4);
    treeNodes.add(tl);
  }

  function buildBranchTree() {
    const depth = clamp(Math.round(P.n), 1, 5);
    const g = new THREE.Group();
    tree.add(g);
    const w = clamp(P.people * 1.5, 3.5, 10);
    const rootY = 5.4, dy = 0.95;
    branch(g, depth, 0, 0, rootY, w, dy);
    const tl = makeLabel(`1 回の成功の確率 p = ${P.p}`, { height: 0.34, color: '#9fd8ff' });
    tl.position.set(0, rootY + 0.9, 0);
    g.add(tl);
    const bl = makeLabel('成功', { height: 0.28, color: '#7cffb2' });
    bl.position.set(-w * 0.3, rootY - 0.55, 0.3);
    g.add(bl);
    const fl = makeLabel('失敗', { height: 0.28, color: '#ff8fb1' });
    fl.position.set(w * 0.3, rootY - 0.55, 0.3);
    g.add(fl);
    note.userData.setText(`${Math.pow(2, depth)} 通りのうち成功が過半数の道が ${Math.round(P.p * Math.pow(2, depth) * 10) / 10} 本。`);
    P.treeDepth = depth;
  }

  function branch(g, depth, idx, x, y, w, dy) {
    const node = makePoint(idx === 0 ? 0xffffff : 0x7cffb2, { size: 0.1, halo: 0.7 });
    node.position.set(x, y, 0);
    node.userData.noReveal = true;
    g.add(node);
    if (depth === 0) return;
    for (let k = 0; k < 2; k++) {
      const nx = x + (k === 0 ? -w / 4 : w / 4);
      const ny = y - dy;
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, 0), new THREE.Vector3(nx, ny, 0)]),
        lineBasic(k === 0 ? 0x7cffb2 : 0xff8fb1, 0.55)
      ));
      branch(g, depth - 1, idx * 2 + k, nx, ny, w / 2, dy);
    }
  }

  // ------------------------------------------------- 実験の履歴
  function buildHistory() {
    const rand = seededRandom(101);
    const trials = clamp(Math.round(P.nTrials), 2, 24);
    P.history = [];
    let sum = 0;
    for (let i = 0; i < trials; i++) {
      sum += rand() < P.p ? 1 : 0;
      P.history.push(sum);
    }
    const w = 0.42, hScale = 0.75, z = 3.2;
    for (let i = 0; i < trials; i++) {
      const x = (i - (trials - 1) / 2) * w;
      const hgt = P.history[i] * hScale;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 1, 0.5), solidMat(col, { opacity: 0.42 }));
      m.position.set(x, hgt / 2, z);
      m.scale.y = Math.max(hgt, 1e-3);
      m.userData.noReveal = true;
      m.userData.full = Math.max(hgt, 1e-3);
      m.userData.idx = i;
      history.add(m);
      if (i % 2 === 0) {
        const lb = makeLabel(`${i + 1}`, { height: 0.22, color: '#8fb2e6' });
        lb.position.set(x, -0.4, z);
        history.add(lb);
      }
    }
    const ax = (trials - 1) * w * 0.5;
    const theory = trials * P.p;
    meanLine.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-ax, theory * hScale, z), new THREE.Vector3(ax, theory * hScale, z),
      ]),
      lineBasic(GOLD, 0.9)
    ));
    const ml = makeLabel(`理論値 ${theory.toFixed(1)} / 実際 ${sum}`, { height: 0.3, color: '#ffd166' });
    ml.position.set(0, theory * hScale + 0.7, z);
    meanLine.add(ml);
    note.userData.setText(`${trials} 回反復したら成功の回数が理論値 ${theory.toFixed(1)} に近づく。`);
  }

  // ---------------------------------------------------------- 作り直し
  function rebuild() {
    for (const key of ['urn', 'balls', 'drawChute', 'sampled', 'lattice', 'tree', 'branches',
      'permRow', 'permDot', 'combRow', 'combDot', 'bars', 'expectedMarker', 'meanLine',
      'varianceBand', 'treeNodes', 'history']) emptyOf(parts[key]);

    urn.visible = balls.visible = drawChute.visible = sampled.visible = P.mode === 'urn';
    lattice.visible = P.mode === 'indep';
    permRow.visible = permDot.visible = P.mode === 'perm';
    combRow.visible = combDot.visible = P.mode === 'comb';
    bars.visible = expectedMarker.visible = varianceBand.visible = P.mode === 'expect';
    meanLine.visible = P.mode === 'expect' || P.mode === 'binomial' || P.mode === 'tree';
    tree.visible = P.mode === 'tree';
    treeNodes.visible = branches.visible = P.mode === 'binomial';
    history.visible = P.mode === 'tree';

    if (P.mode === 'urn') { buildUrn(); buildBalls(); }
    if (P.mode === 'indep') buildLattice();
    if (P.mode === 'perm') buildPerm();
    if (P.mode === 'comb') buildComb();
    if (P.mode === 'expect') buildExpect();
    if (P.mode === 'binomial') { buildLeafStrip(P.n); buildBinomial(); }
    if (P.mode === 'tree') { buildBranchTree(); buildHistory(); }
    anim.snap({ count: P.count ?? 1, grow: P.grow ?? 0 });
  }

  function setParams(patch) {
    let dirty = false;
    for (const k of ['mode', 'red', 'white', 'draw', 'n', 'p', 'nTrials', 'people']) {
      if (patch[k] !== undefined) { P[k] = patch[k]; dirty = true; }
    }
    if (patch.count !== undefined) anim.to({ count: patch.count });
    if (patch.grow !== undefined) anim.to({ grow: patch.grow });
    Object.assign(P, patch);
    if (dirty) rebuild();
  }

  const tmp = new THREE.Vector3();
  const mouth = new THREE.Vector3(0, 1.5, 0);
  function update(dt, elapsed) {
    const a = anim.update(dt, 4.0);
    P.count = a.count;
    P.grow = a.grow;

    for (const m of bars.children) {
      if (!m.isMesh || m.userData.full === undefined) continue;
      m.scale.y = Math.max(m.userData.full * clamp(a.count, 0, 1), 1e-3);
    }
    for (const m of history.children) {
      if (!m.isMesh || m.userData.idx === undefined) continue;
      m.scale.y = Math.max(m.userData.full * clamp(a.count * 26 - m.userData.idx, 0, 1), 1e-3);
    }
    // 順列・組合せの行を順に点灯
    if (P.mode === 'perm' || P.mode === 'comb') {
      const src = P.mode === 'perm' ? permDot : combDot;
      for (const d of src.children) {
        const t = clamp(a.count * 26 - (d.userData.row ?? 0), 0, 1);
        d.scale.setScalar(0.35 + 0.65 * t);
      }
    }
    // 壺から玉が 1 個ずつ抜けてくる
    if (P.mode === 'urn') {
      for (const b of sampled.children) {
        if (!b.isMesh) continue;
        const t = clamp(a.count * P.draw - (b.userData.slot ?? 0), 0, 1);
        tmp.set(b.userData.destX, b.userData.destY, b.userData.destZ);
        b.position.lerpVectors(mouth, tmp, t);
        b.position.y += Math.sin(Math.PI * t) * 0.9;
        b.scale.setScalar(0.3 + 0.7 * t);
      }
    }
    if (treeNodes.visible) {
      for (const nd of treeNodes.children) {
        if (!nd.isGroup) continue;
        nd.position.y = -1.6 + Math.sin(elapsed * 1.2 + nd.position.x * 0.6) * 0.04;
      }
    }
  }

  function dispose() {
    disposeObject(group);
  }

  rebuild();
  return { group, parts, params: P, setParams, update, dispose };
}
