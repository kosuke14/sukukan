import { lesson, s } from './schema.js';

/** 数学C 第1章 二次曲線（円錐の切断として理解する）。 */
export const mathCConics = [
  lesson({
    id: 'mc-1-1',
    subject: 'mc',
    chapter: '二次曲線',
    unit: '1-1　楕円',
    title: '円錐を斜めに切ると楕円になる',
    summary: '円錐の切断面が底面と平行でないときに生まれる曲線。2つの焦点からの距離の和が一定になる、という定義で理解する。',
    builder: 'conics',
    params: { kind: 'ellipse', angle: -0.62, offset: 3.15, radius: 4.6, height: 7.4 },
    cam: { pos: [1.2, 4.0, 14.5], look: [0, -0.3, 0] },
    steps: [
      s({
        d: 6, text: 'これは<em>円錐</em>です。すべての母線は頂点を通り、底面の円に広がっていく。',
        math: 'r(y)=R\\left(\\tfrac12-\\tfrac{y}{h}\\right)',
        cam: { pos: [4.5, 5.2, 9.5], look: [0, 0, 0] },
        show: ['cone', 'generators', 'apex'],
      }),
      s({
        d: 6, text: 'ここに<em>一枚の平面</em>を通す。平面と円錐の側面が切り合わさった線だけを取り出す。',
        show: ['plane'], set: { cut: 1 },
        cam: { pos: [2.2, 3.4, 10.5], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: '切り口は<em>楕円</em>になった。切断面が底面と平行でないことが、円を楕円に変える。',
        math: '\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1\\quad(a>b>0)',
        show: ['section', 'sectionProj'], focus: 'section',
      }),
      s({
        d: 7, text: '楕円の中心を C、両端の2つの焦点を F と F2 とする。中心から F までの距離が<em>焦点距離</em> c だ。',
        math: 'c^2=a^2-b^2',
        show: ['foci', 'focusLabels', 'majorAxis'],
      }),
      s({
        d: 8, text: '楕円の<em>本質</em>は、2つの焦点からの距離の<em>和が一定</em>であること。走査する点が示しているのは、その軌跡そのものだ。',
        math: "|PF|+|PF2|=2a",
        show: ['scan', 'eLabel'],
        cam: { pos: [0, 2.0, 8.6], look: [0, -0.2, 0] },
      }),
      s({
        d: 6, text: '平面を底面に近づけると円に、立てると放物線に、さらに急にすると双曲線になる。二次曲線はひとつづきの流れの途中にある。',
        set: { angle: -0.05 }, hide: ['scan', 'eLabel'],
        cam: { pos: [3.4, 4.6, 10.2], look: [0, -0.2, 0] },
      }),
    ],
  }),

  lesson({
    id: 'mc-1-2',
    subject: 'mc',
    chapter: '二次曲線',
    unit: '1-2　双曲線',
    title: '円錐の片側だけを横切る',
    summary: '切断面が円錐を片側だけに通るとき、曲線は2つの枝に分かれる。焦点からの距離の差が一定という定義。',
    builder: 'conics',
    params: { kind: 'hyperbola', angle: -1.02, offset: 1.05, radius: 4.6, height: 7.4 },
    cam: { pos: [1.0, 3.4, 15.0], look: [0, -0.3, 0] },
    steps: [
      s({
        d: 6, text: '今度は平面を円錐の軸に対して<em>急角度</em>で傾ける。',
        show: ['cone', 'generators', 'plane'], set: { kind: 'hyperbola' },
        cam: { pos: [4.0, 4.4, 10.2], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: '円錐の片側だけを横切った。切り口は<em>2つの枝</em>に分裂した。これが双曲線だ。',
        math: '\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1',
        show: ['section', 'sectionProj'], focus: 'section',
      }),
      s({
        d: 7, text: '円錐が2つの頂点を持つ形だと考えれば、双曲線の2つの枝はそれぞれ円錐の片側から出ている。',
        show: ['apex', 'axis'],
        cam: { pos: [2.6, 3.2, 11.0], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: 'このとき、焦点からの距離の<em>差</em>が一定になる。楕円の「和」が「差」に変わっただけだ。',
        math: "||PF|-|PF2||=2a",
        show: ['foci', 'focusLabels', 'majorAxis', 'eLabel', 'scan'],
        cam: { pos: [0, 2.0, 9.2], look: [0, -0.2, 0] },
      }),
      s({
        d: 6, text: '離心率 e が 1 より大きいことが、双曲線であることの印になる。',
        math: 'e=\\frac{c}{a}>1',
      }),
    ],
  }),

  lesson({
    id: 'mc-1-3',
    subject: 'mc',
    chapter: '二次曲線',
    unit: '1-3　放物線',
    title: '円錐の軸に垂直な平面で切る',
    summary: '円錐の軸に垂直な平面で切ると切り口は放物線。1つの焦点と準線の関係として定義される。',
    builder: 'conics',
    params: { kind: 'parabola', radius: 4.6, height: 7.4 },
    cam: { pos: [1.0, 3.2, 15.0], look: [0, -0.3, 0] },
    steps: [
      s({
        d: 6, text: '円錐の<em>軸に垂直</em>な平面で切る。軸の上を通る平面だ。',
        show: ['cone', 'generators', 'axis'], set: { kind: 'parabola' },
        cam: { pos: [3.8, 4.0, 10.0], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: '切り口は<em>放物線</em>。円錐の側面と平行な切断面が触れているように見える。',
        math: 'y^2=4px\\quad(p>0)',
        show: ['plane', 'section', 'sectionProj'], focus: 'section',
      }),
      s({
        d: 7, text: '放物線には2つの焦点がない。1つの<em>焦点 F</em>と、それに平行な<em>準線</em>だけがある。',
        show: ['foci', 'focusLabels'], hide: ['focus2'],
      }),
      s({
        d: 8, text: '定義はこうだ。曲線上のどの点も、<em>焦点からの距離と準線からの距離が等しい</em>。走査点がその等式をなぞる。',
        math: '|PF|=\\mathrm{dist}(P,\\;\\text{準線})',
        show: ['scan', 'eLabel'],
        cam: { pos: [0, 2.0, 9.0], look: [0, -0.2, 0] },
      }),
      s({
        d: 6, text: '円錐の開きそのものが、放物線の形を規定している。平面の傾きを変えるたびに曲線が変わる。',
        cam: { pos: [4.4, 3.2, 9.4], look: [0, 0, 0] },
      }),
    ],
  }),
];
