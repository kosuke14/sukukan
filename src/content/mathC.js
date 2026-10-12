import { lesson, s } from './schema.js';

/** 数学C 第2章〜第6章。二次曲線（mc-1-*）は mathC-conics 側の別ファイルにある。 */
export const mathC = [
  lesson({
    id: 'mc-2-1',
    subject: 'mc',
    chapter: '媒介変数',
    unit: '（2）媒介変数',
    title: '媒介変数 t は、点を「泳がせる」ための目盛',
    summary: 'x = f(t), y = g(t) と書くと、平面上の点 P(t) のうごき方を1つの変数で表せる。',
    builder: 'paramcurve',
    params: { mode: 'parametric', kind: 'circle', a: 1, b: 1, t: 0, tEnd: Math.PI * 2 },
    cam: { pos: [4, 3.2, 14], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '点 P が平面内を動くと、その x 座標と y 座標はどちらも t の関数になる。<em>t だけを振れば点が決まる</em>。',
        math: 'x=f(t),\\quad y=g(t)',
        show: ['axes', 'grid', 'curve', 'movingPoint'],
      }),
      s({
        d: 6, text: '媒介変数の t が 0 から始まって上限まで増えるあいだ、点は曲線を一周する。',
        set: { t: 1.1 },
        cam: { pos: [3, 2.4, 11.5], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: '単位円なら x = cos t, y = sin t。<em>角度そのものが媒介変数</em>になっている。',
        math: 'x=\\cos t,\\ y=\\sin t\\quad(0\\le t<2\\pi)',
        set: { t: 2.0 },
      }),
      s({
        d: 7, text: 'paramTrace には、各 t での x と y が別のグラフに描かれる。表の1行ずつを読むのと同じだ。',
        show: ['paramTrace', 'xLine', 'yLine'],
        math: '\\begin{array}{c|cc}t & x & y\\\\ \\hline 0 & 1 & 0\\end{array}',
        cam: { pos: [5, 3.4, 13.0], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: '媒介変数表示はグラフそのものではない。時刻を消したあとに残る図形だけが曲線だ。',
        cam: { pos: [3.4, 2.6, 12.0], look: [0, 0, 0] },
      }),
    ],
  }),

  lesson({
    id: 'mc-2-2',
    subject: 'mc',
    chapter: '媒介変数',
    unit: '（2）媒介変数と曲線',
    title: '極座標は、角度で指定する曲線',
    summary: '極座標では、動径 r と偏角 θ で点を表す。極方程式 r = f(θ) は媒介変数の特別な場合。',
    builder: 'paramcurve',
    params: { mode: 'polar', kind: 'spiral', a: 1.6, c: 0.28, t: 2.4, tEnd: Math.PI * 6 },
    cam: { pos: [4, 3.4, 15], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '極座標では、点 P を「原点からの距離 r」と「x 軸から測った角 θ」で指定する。',
        math: 'x=r\\cos\\theta,\\quad y=r\\sin\\theta',
        show: ['axes', 'grid', 'curve', 'spokes', 'radiusBar', 'angleArc'],
      }),
      s({
        d: 7, text: 'θ を固定して r を変えると、<em>原点を通る半直線</em>上を動く。これが極方程式 r = f(θ) の一つの読み方だ。',
        set: { t: 1.0 },
        cam: { pos: [3, 2.6, 12.0], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: 'θ を 0 から増やしながら r を変えていくと、点が曲線を描く。距離と角度の二つの刻みで、動点の位置を常に規定できる。',
        math: 'r=a\\theta',
        set: { t: 3.4 },
        cam: { pos: [4, 3.2, 14.0], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: '楕円にも極座標表示がある。焦点からの距離の和が一定という定義を、角度で言い直した形だ。',
        math: 'r=\\frac{p}{1+e\\cos\\theta}',
        show: ['asymptote'],
        set: { kind: 'circle' },
      }),
    ],
  }),

  lesson({
    id: 'mc-3-1',
    subject: 'mc',
    chapter: '複素数平面',
    unit: '（3）複素数と極形式',
    title: '複素数を「距離と角度」で言い直す',
    summary: '極形式 z = r(cos θ + i sin θ)。乗算が足算になるのが極形式の強み。',
    builder: 'complex',
    params: { z1: { a: 3, b: 2 }, z2: { a: 1, b: -1 }, n: 3, mode: 'polar' },
    cam: { pos: [3.5, 4.5, 12], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '実数が数直線上にあるのと同じで、複素数は<em>複素数平面</em>の上にある。実部が x 座標、虚部が y 座標だ。',
        math: 'z=a+bi\\leftrightarrow (a,\\ b)',
        show: ['plane', 'axes', 'unitGrid'],
      }),
      s({
        d: 6, text: '原点からの距離 r と、偏角 θ とで同じ点を表せる。',
        math: 'r=|z|,\\quad z=r(\\cos\\theta+i\\sin\\theta)',
        show: ['vecA', 'radiusA', 'angleArc', 'labels'],
      }),
      s({
        d: 7, text: 'これで積が簡単になる。<em>絶対値は掛け、偏角は足す</em>。ガウスがこれを発見した。',
        math: 'z_1z_2=r_1r_2\\bigl(\\cos(\\theta_1+\\theta_2)+i\\sin(\\theta_1+\\theta_2)\\bigr)',
        show: ['vecB', 'prodVec'], set: { mode: 'product' },
      }),
      s({
        d: 6, text: '三乗根は偏角を 3 等分し、絶対値は 3 乗根を取ればよい。n 乗根は円周上に等間隔に並ぶ。',
        math: 'w^n=z\\iff |w|=|z|^{\\frac1n},\\quad \\arg w=\\frac{\\arg z+2k\\pi}{n}',
        show: ['unitCircle', 'roots'], set: { mode: 'roots' },
        cam: { pos: [2.5, 5.5, 11], look: [0, 0, 0] },
      }),
    ],
  }),

  lesson({
    id: 'mc-3-2',
    subject: 'mc',
    chapter: '複素数平面',
    unit: '（3）複素数とベクトル',
    title: '商は「角度の差」で読む',
    summary: 'z を w で割った結果は、拡大縮小と回転の合成。回転角は偏角の差。',
    builder: 'complex',
    params: { z1: { a: 1, b: 1 }, z2: { a: 1, b: 0 }, mode: 'product' },
    cam: { pos: [3.5, 4.5, 12], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '複素数の割り算は、分母の共役を使って有理化するか、極形式で計算する。極形式のほうが行列が速い。',
        math: '\\frac{z_1}{z_2}=\\frac{r_1}{r_2}\\bigl(\\cos(\\theta_1-\\theta_2)+i\\sin(\\theta_1-\\theta_2)\\bigr)',
        show: ['plane', 'axes', 'vecA', 'vecB', 'unitGrid'],
      }),
      s({
        d: 7, text: 'つまり割り算とは、<em>角度 θ2 だけ回してから r2 倍する</em>こと。これは相似な図形が互いに写り合う関係そのものだ。',
        show: ['angleArc', 'radiusB', 'labels'],
        cam: { pos: [2.6, 3.6, 10.5], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: '単位円上の複素数を掛け続けると回転になる。e は「一周の回転」そのものだ。',
        math: 'e^{i\\theta}=\\cos\\theta+i\\sin\\theta',
        show: ['expSpiral'], set: { mode: 'product' },
      }),
    ],
  }),

  lesson({
    id: 'mc-4-1',
    subject: 'mc',
    chapter: '2次元ベクトル',
    unit: '（4）内積',
    title: '内積は「.arch  Messiah」の数え方',
    summary: 'u・v = |u||v|cos θ。射影の長さ、平行四辺形の面積という2つの姿を持つ。',
    builder: 'vectors',
    params: { u: [3, 1], v: [1, 4], mode: 'dot' },
    cam: { pos: [3, 4.5, 12], look: [0.5, 0.5, 0] },
    steps: [
      s({
        d: 6, text: '2つのベクトルの内積は、片方をもう片方の軸に射影したときの、<em>長さに他方の長さを掛けた値</em>だ。',
        math: '\\mathbf{u}\\cdot\\mathbf{v}=|\\mathbf{u}||\\mathbf{v}|\\cos\\theta',
        show: ['axes', 'grid', 'u', 'v'],
      }),
      s({
        d: 7, text: '幾何的には、2つのベクトルが作る<em>平行四辺形の面積</em>に等しい。',
        math: '\\mathbf{u}\\cdot\\mathbf{v}=|\\mathbf{u}||\\mathbf{v}|\\sin\\left(\\theta+\\tfrac\\pi2\\right)',
        show: ['parallelogram', 'areaRect', 'areaLabel', 'dotReadout'],
        cam: { pos: [2.5, 5.0, 11], look: [0.5, 0.5, 0] },
      }),
      s({
        d: 6, text: '内積が 0 なら直交している。直交する基底を選ぶと、すべての座標表示が簡潔になる。',
        math: '\\mathbf{u}\\cdot\\mathbf{v}=0\\iff\\mathbf{u}\\perp\\mathbf{v}',
        set: { mode: 'projection' }, show: ['projV', 'footDot', 'resV'],
      }),
    ],
  }),

  lesson({
    id: 'mc-4-2',
    subject: 'mc',
    chapter: '2次元ベクトル',
    unit: '（4）外積',
    title: '外積は面積を表すスカラーを作る',
    summary: '2次元ベクトルの外積は、面積に等しいスカラーになる。',
    builder: 'vectors',
    params: { u: [3, 1], v: [1, 4], mode: 'cross' },
    cam: { pos: [4, 4.0, 12], look: [0.5, 0.5, 0] },
    steps: [
      s({
        d: 6, text: '内積が「角度の大きさ」を返すのに対し、<em>外積は面積を返す</em>。',
        math: '|\\mathbf{u}\\times\\mathbf{v}|=|\\mathbf{u}||\\mathbf{v}|\\sin\\theta',
        show: ['axes', 'grid', 'u', 'v', 'parallelogram'],
      }),
      s({
        d: 7, text: '向きは、u から v へ右ねじを回したときねじが進む向き。2次元平面では z 成分だけが残る。',
        math: '\\mathbf{u}\\times\\mathbf{v}=(0,0,u_1v_2-u_2v_1)',
        show: ['areaRect', 'areaLabel', 'angleArc'],
        cam: { pos: [5.5, 4.0, 12], look: [0.5, 0.5, 0] },
      }),
      s({
        d: 6, text: '内積の正負が角度の大小を決め、外積の大きさが面積を決める。内積と外積は、平面の幾何を2つの側面から押さえる。',
        set: { mode: 'dot' },
      }),
    ],
  }),

  lesson({
    id: 'mc-5-1',
    subject: 'mc',
    chapter: '合成関数と逆関数',
    unit: '（5）合成関数',
    title: '関数を2回使う',
    summary: 'f(g(x)) は「x に g を適用してから f を適用する」。中置きの順序を間違えやすい。',
    builder: 'graph3d',
    params: { fn: (x) => Math.sqrt(x), domain: [-1, 6], yRange: [-0.3, 2.6] },
    cam: { pos: [3.6, 3.0, 14], look: [0.4, 0.6, 0] },
    steps: [
      s({
        d: 6, text: '合成関数は、関数を2つ組み合わせたもの。<em>内側から外へ読む</em>。',
        math: '(f\\circ g)(x)=f(g(x))',
        show: ['axes', 'grid', 'curve'],
      }),
      s({
        d: 7, text: 'たとえば y = √(x+1) は、x を 1 増やしてから平方根を取る。先に +1 してから √。順序を逆にすると定義域が変わる。',
        math: 'y=\\sqrt{x+1}\\quad(x\\ge-1)',
        set: { fn: (x) => Math.sqrt(x + 1), domain: [-1, 8], t: 3 },
        cam: { pos: [3.4, 2.6, 13.0], look: [1, 1, 0] },
      }),
      s({
        d: 7, text: '合成の前後を入れ替えると別の関数になる。g∘f と f∘g は一般に等しくない。',
        math: 'f\\circ g\\neq g\\circ f',
        set: { fn: (x) => Math.sqrt(x) + 1, domain: [0, 6], t: 2 },
        cam: { pos: [3.4, 2.8, 13.0], look: [0.8, 1, 0] },
      }),
      s({
        d: 6, text: '定義域は「g が定義できる範囲」と「f が g(x) を受け取れる範囲」の共通部分になる。',
        cam: { pos: [3.0, 2.4, 12.0], look: [0.6, 0.8, 0] },
      }),
    ],
  }),

  lesson({
    id: 'mc-6-1',
    subject: 'mc',
    chapter: '微分法と積分法',
    unit: '（6）微分と接線',
    title: '割線を h → 0 に送ると接線になる',
    summary: '微分係数は、点 A と点 A+h を結ぶ割線の傾きの極限。接線の傾きそのものである。',
    builder: 'calculus',
    params: { fn: (x) => x * x * x - 3 * x, a: 1, mode: 'tangent', domain: [-2.6, 2.6] },
    cam: { pos: [3.4, 3.0, 13.5], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '曲線上の2点 A と B を結ぶ<em>割線</em>を考える。傾きは、変化量を変化量で割った値だ。',
        math: '\\frac{f(a+h)-f(a)}{h}',
        show: ['axes', 'grid', 'curve', 'secant', 'arrowAB', 'hLine'],
      }),
      s({
        d: 7, text: 'B を A に近づけていく。h を小さくすると、割線は、点 A で接する線に収束する。',
        math: "f'(a)=\\lim_{h\\to0}\\frac{f(a+h)-f(a)}{h}",
        set: { h: 0.05 },
        cam: { pos: [2.8, 2.4, 12.0], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: 'この極限が存在するとき、y = f(x) の x = a における接線の傾きは f′(a) になる。',
        math: "y-f(a)=f'(a)(x-a)",
        show: ['tangent'], set: { h: 0.001 },
      }),
      s({
        d: 6, text: '微分は「変化の速さ」であり、<em>その場の傾き</em>にほかならない。',
        set: { mode: 'slope' }, show: ['derivativeReadout', 'movingPoint'],
        cam: { pos: [3.4, 2.8, 13.0], look: [0, 0, 0] },
      }),
    ],
  }),

  lesson({
    id: 'mc-6-2',
    subject: 'mc',
    chapter: '微分法と積分法',
    unit: '（6）面積',
    title: '積分は、面積を細かく刻むこと',
    summary: '長方形の和の極限。分割を細かくするほど、面積の和は真の面積に近づく。',
    builder: 'calculus',
    params: { fn: (x) => x * x, a: 0, b: 3, n: 24, mode: 'area', domain: [-0.6, 3.6] },
    cam: { pos: [3.4, 3.2, 14], look: [0.4, 1, 0] },
    steps: [
      s({
        d: 6, text: '曲線と x 軸、x = a, x = b で囲まれた図形の面積を求める。定規では測れない。',
        math: 'S=\\int_a^b f(x)\\,dx',
        show: ['axes', 'grid', 'curve', 'baseLine'],
      }),
      s({
        d: 7, text: '区間を n 等分し、各区間で高さをとった長方形の和で近似する。',
        math: '\\sum_{k=1}^{n} f(x_k)\\Delta x',
        set: { mode: 'integral' }, show: ['columns'],
        cam: { pos: [3.0, 2.8, 13.0], look: [0.6, 1, 0] },
      }),
      s({
        d: 7, text: '分割を細かくすると長方形の角が曲線に近づき、和は真の面積に<em>収束</em>する。この極限を定積分という。',
        math: '\\lim_{n\\to\\infty}\\sum_{k=1}^{n}f(x_k)\\frac{b-a}{n}=\\int_a^b f(x)\\,dx',
        set: { n: 90 },
        cam: { pos: [3.4, 3.0, 13.5], look: [0.6, 1, 0] },
      }),
      s({
        d: 6, text: '原始関数を F とすれば、面積は F(b) − F(a) で求まる。和の極限を直接計算しなくてよい。',
        math: '\\int_a^b f(x)\\,dx=F(b)-F(a)',
        set: { mode: 'area' }, show: ['areaSlab'],
      }),
    ],
  }),

  lesson({
    id: 'mc-6-3',
    subject: 'mc',
    chapter: '微分法と積分法',
    unit: '（6）体積',
    title: '回転体の体積も、切り分ければ面積の積み上げ',
    summary: '回転体の体積は、底面積×高さの極限。キャヴァリの原理で、球も円柱の積層として体積を出す。',
    builder: 'solids',
    params: { shape: 'revolution', r: 2.2, h: 4.2, slices: 44 },
    cam: { pos: [5, 3.4, 14], look: [0, 0.4, 0] },
    steps: [
      s({
        d: 6, text: '平面図形を x 軸のまわりに回転すると立体になる。<em>体積は、底面積 × 高さを足し合わせたもの</em>。',
        math: 'V=\\sum_{k=1}^{n} S(x_k)\\Delta x',
        show: ['solid', 'wire', 'axis', 'revolved'],
        cam: { pos: [4.5, 3.2, 13.0], look: [0, 0.5, 0] },
      }),
      s({
        d: 7, text: '回転軸に平行な面で、立体を薄く切り分ける。各薄片の体積は円柱で近似できる。',
        math: 'V=\\lim_{n\\to\\infty}\\sum_{k=1}^{n}\\pi r_k^2\\Delta x',
        set: { slices: 10 }, show: ['slices', 'rings', 'crossSection'],
        cam: { pos: [5.5, 3.4, 14.0], look: [0, 0.4, 0] },
      }),
      s({
        d: 7, text: '球を赤道に平行に切ると、どの切片も同じ高さで同じ円柱に相似になる。<em>厚さを無限に薄くすれば体積は変わらない</em>。これがキャヴァリの原理だ。',
        math: 'V=\\frac43\\pi r^3',
        set: { shape: 'sphere' }, show: ['inscribedSphere', 'disc', 'fillUp'],
        cam: { pos: [4, 3.0, 13.0], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: '円錐の体積は、底面積の 3 分の 1 になる。同じ証明が成り立つ。',
        math: 'V=\\frac13\\pi r^2 h',
        set: { shape: 'cone' }, show: ['base', 'heightBar', 'radiusBar'],
        cam: { pos: [4.5, 3.2, 13.5], look: [0, 0.4, 0] },
      }),
    ],
  }),
];
