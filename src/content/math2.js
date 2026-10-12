import { lesson, s } from './schema.js';

const exp = (base) => (x) => Math.pow(base, x);
const log = (base) => (x) => Math.log(x) / Math.log(base);

/** 数学II 指数関数・対数関数・三角関数のグラフ、および数学III 分数関数と無理関数。 */
export const math2 = [
  lesson({
    id: 'm2-3-1',
    subject: 'm2',
    chapter: '指数関数・対数関数',
    unit: '（3）指数関数',
    title: '累乗は「繰り返しの掛け算」から曲線になる',
    summary: 'y = a^x のグラフ。底が 1 より大きければ右上がり、1 未満なら右下がり。y = 0 が漸近線。',
    builder: 'graph3d',
    params: { fn: exp(2), domain: [-3, 3], yRange: [-0.5, 8], label: 'y = 2ˣ' },
    cam: { pos: [5.0, 5.0, 18.0], look: [0, 2.2, 0] },
    steps: [
      s({
        d: 6, text: '整数では、a^n は a を n 回掛けることだった。非整数まで広げたものが<em>累乗関数</em> y = a^x だ。',
        math: 'y=a^x\\quad(a>0,\\ a\\neq1)',
        cam: { pos: [4.0, 3.6, 18.0], look: [0, 1.6, 0] },
        show: ['axes', 'grid', 'curve', 'curtain'],
      }),
      s({
        d: 6, text: 'x = 0 のとき y = 1。x = 1 のとき y = a。どの曲線も (0, 1) を通る。',
        math: 'a^0=1',
        set: { t: 0 },
        cam: { pos: [2.4, 2.4, 12.0], look: [0, 0.8, 0] },
      }),
      s({
        d: 7, text: 'x を 1 増やすごとに、y は a <em>倍</em>になる。だから伸び方が次第に急になる。',
        math: 'a^{x+1}=a\\cdot a^x',
        set: { t: 1.5 },
      }),
      s({
        d: 7, text: 'x を無限に負へ送ると、y は 0 に張り付く。<em>y = 0 が漸近線</em>だ。有限の x で 0 になることはない。',
        math: 'a^x>0',
        set: { t: -2.6, asymptoteY: 0 }, show: ['asymptote'],
        cam: { pos: [3.4, 2.4, 15.0], look: [0, 1.0, 0] },
      }),
      s({
        d: 7, text: '底が 1 より小さいと、左右が反転する。形は「裏返し」になるだけで、性質は同じだ。',
        math: 'a^x=\\left(\\tfrac1a\\right)^{-x}',
        set: { fn: exp(0.5), t: 1.5 },
        cam: { pos: [4.4, 2.8, 15.5], look: [0, 1.2, 0] },
      }),
      s({
        d: 6, text: 'f(x+h)/f(x) が常に a になる。<em>指数関数は「伸びの倍率」が一定</em>の曲線だ。線形関数が「伸びの量」一定だったのに対応する。',
        math: 'f(x+h)=a\\,f(x)',
        set: { fn: exp(2), t: 0 },
      }),
    ],
  }),

  lesson({
    id: 'm2-3-2',
    subject: 'm2',
    chapter: '指数関数・対数関数',
    unit: '（3）対数関数',
    title: '指数関数を左右反転したものが対数関数',
    summary: 'y = log_a x は y = a^x のグラフを直線 y = x に関して移したもので、x = a^y のこと。',
    builder: 'graph3d',
    params: { fn: log(2), domain: [0.05, 8], yRange: [-3, 3], label: 'y = log₂x' },
    cam: { pos: [5.4, 3.8, 16.0], look: [0.6, 0, 0] },
    steps: [
      s({
        d: 6, text: '対数の定義はこうだ。<em>log_a x は、a を何乗すると x になるか</em>の、その指数の値。',
        math: 'a^{y}=x \\iff y=\\log_a x',
        show: ['axes', 'grid', 'curve', 'curtain'],
      }),
      s({
        d: 6, text: 'x = 1 のとき y = 0。x = a のとき y = 1。指数関数と同じ点を、逆の順に通る。',
        math: '\\log_a 1=0',
        set: { t: 1 }, domainNote: true,
        cam: { pos: [3.0, 2.2, 12.5], look: [0.5, 0, 0] },
      }),
      s({
        d: 7, text: 'x が 0 に近づくと y は -∞ へ発散する。定義域は x > 0 だけだ。',
        math: '\\log_a x \\ (x>0)',
        set: { t: 0.3 },
        cam: { pos: [3.4, 2.4, 13.0], look: [0.5, -0.4, 0] },
      }),
      s({
        d: 8, text: '指数関数のグラフを直線 y = x について<em>折り返した図形</em>が、そのまま対数関数のグラフになる。黄色の破線が、折り返す直線 y = x だ。',
        math: 'y=\\log_a x \\iff y=a^x',
        show: ['mirror'],
        cam: { pos: [6.0, 3.6, 16.5], look: [0.6, 0, 0] },
      }),
      s({
        d: 7, text: 'だから両者は互いに<em>逆関数</em>。片方だけ分かれば、もう片方はグラフを左右を入れ替えて得られる。',
        math: 'f^{-1}\\circ f=\\mathrm{id}',
        set: { mirror: 0 }, show: ['mirror'],
      }),
    ],
  }),

  lesson({
    id: 'm2-4-4',
    subject: 'm2',
    chapter: '三角関数',
    unit: '（4）三角関数のグラフ',
    title: '円を回すと、波になる',
    summary: 'y = sin x, cos x, tan x のグラフ。周期・振幅・位相の読み取り。',
    builder: 'graph3d',
    params: { fn: (x) => Math.sin(x), domain: [-6.3, 6.3], yRange: [-1.4, 1.4], label: 'y = sin x' },
    cam: { pos: [3.6, 2.6, 15.5], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '円周上の点の y 座標がそのまま y = sin x の縦の値になる。x は<em>角度（ラジアン）</em>だ。',
        math: 'y=\\sin x',
        show: ['axes', 'grid', 'curve', 'projection'],
        cam: { pos: [2.8, 2.2, 14.5], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: '1 回転で 2π 進む。グラフの周期は 2π だ。',
        math: 'T=2\\pi',
        set: { t: 1.57 },
        cam: { pos: [1.8, 1.8, 12.0], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: '最大は 1、最小は -1。振幅は 1 で固定されている。',
        math: '-1\\le\\sin x\\le1',
        set: { t: 4.71 },
      }),
      s({
        d: 7, text: 'y = cos x は sin を π/2 だけ左にずらした形。' +
          'y = tan x は sin を cos で割ったもので、cos x = 0 の点で定義できず、<em>両側へ無限に伸びる</em>。',
        math: 'y=\\cos x=\\sin\\left(x+\\tfrac\\pi2\\right),\\quad y=\\tan x=\\tfrac{\\sin x}{\\cos x}',
        set: { fn: (x) => Math.tan(x), t: 1.4 },
        cam: { pos: [3.8, 2.6, 14.0], look: [0, 0, 0] },
      }),
      s({
        d: 6, text: 'sin, cos のグラフは y 軸に関して対称ではないが、<em>原点に関して点対称</em>である。奇関数だからだ。',
        math: 'f(-x)=-f(x)',
        set: { fn: (x) => Math.sin(x), t: 0 },
      }),
    ],
  }),

  lesson({
    id: 'mi-1-3',
    subject: 'mi',
    chapter: '極限',
    unit: '（1）分数関数と無理関数',
    title: '分母がゼロに近づくと在上する',
    summary: '分数関数の漸近線と、無理関数のグラフの特徴。合成関数と逆関数の入口。',
    builder: 'graph3d',
    params: { fn: (x) => 1 / x, domain: [-4, 4], yRange: [-4, 4], label: 'y = 1/x' },
    cam: { pos: [3.8, 2.8, 14.0], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '分母が一次式の分数関数を考える。y = 1/x は、原点を通る2本の双曲線になる。',
        math: 'y=\\frac{1}{x}\\quad(x\\neq0)',
        show: ['axes', 'grid', 'curve', 'curtain'],
      }),
      s({
        d: 7, text: 'x が 0 に近づくと、y は絶対値が無限大に大きくなる。x 軸も y 軸も<em>漸近線</em>だ。',
        math: '\\text{漸近線}:\\ x=0,\\ y=0',
        set: { t: 0.22 }, show: ['asymptote'], asymptoteY: 0,
        cam: { pos: [3.0, 2.2, 12.5], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: '極限は「x を有限の値まで近づけること」ではない。<em>無限に大きくなる</em>ことを、特別な書き方で表す。',
        math: 'x\\to0\\ \\Longrightarrow\\ y\\to\\infty',
        set: { t: 0.12 },
      }),
      s({
        d: 7, text: '無理関数の例 y = √(x+1)。これは x = y²-1 のグラフの y ≥ 0 の部分だ。両辺を入れ替えて y について解くことで、形の手がかりが得られる。',
        math: 'y=\\sqrt{x+1}\\iff x=y^2-1\\ (y\\ge0)',
        set: { fn: (x) => Math.sqrt(x + 1), t: 3, domain: [-1, 8] },
        cam: { pos: [4.2, 3.0, 14.0], look: [1, 1, 0] },
      }),
      s({
        d: 7, text: 'この「両辺を出し入れする」操作が、合成関数と逆関数を理解する入口になる。<em>y を解くと x が x の関数として得られる</em>——それが逆関数だ。',
        math: 'y=\\sqrt{x+1}\\iff x=y^2-1\\iff y=x^2-1\\ (x\\ge0)',
        set: { fn: (x) => x * x - 1, t: 1.5, domain: [0, 4] }, show: ['mirror'],
        cam: { pos: [5.0, 3.4, 14.0], look: [0.6, 0.4, 0] },
      }),
    ],
  }),

  lesson({
    id: 'mc-5-2',
    subject: 'mc',
    chapter: '合成関数と逆関数',
    unit: '（5）逆関数',
    title: '1 対 1 の対応だけが反転できる',
    summary: '逆関数が存在するのは、その関数が 1 対 1 の対応になっているときだけ。グラフは y = x に関して対称。',
    builder: 'graph3d',
    params: { fn: (x) => x * x * x, domain: [-2, 2], yRange: [-1, 3], label: 'y = x³' },
    cam: { pos: [4.0, 3.0, 13.0], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '逆関数は「矢印の向きを全部逆にする」操作だ。y = f(x) のとき、<em>それぞれの矢印を 始点と終点を入れ替えた線</em>が y = f⁻¹(x) になる。',
        math: 'y=f(x)\\iff x=f^{-1}(y)',
        show: ['axes', 'grid', 'curve', 'curtain'],
      }),
      s({
        d: 7, text: 'グラフで見ると、<em>直線 y = x に関して線対称</em>に移した図形が逆関数のグラフになる。',
        math: 'f^{-1}=f^{-1}\\circ\\mathrm{id}\\circ f',
        show: ['mirror'],
        cam: { pos: [5.0, 3.4, 13.5], look: [0, 0, 0] },
      }),
      s({
        d: 7, text: 'ただし、<em>元の関数が 1 対 1 でなければ</em>、矢印を反転した図形は関数にならない。y = x² の上半分の y ≥ 0 だけが反転できる。',
        math: 'f\\text{ が 1 対 1 }\\iff f^{-1}\\text{ が存在する}',
        set: { fn: (x) => x * x, t: 1.2, domain: [0, 2] },
        cam: { pos: [4.0, 2.8, 13.0], look: [0, 1, 0] },
      }),
      s({
        d: 6, text: '対数関数が指数関数の逆関数だったことを思い出すと、この理屈がそのまま使える。',
        math: '(\\log_a x)^{a^{\\log_a x}}=x',
        set: { fn: (x) => Math.log(x) / Math.log(2), t: 1, domain: [0.2, 6] },
      }),
    ],
  }),

  // ------------------------------------------------------------ いろいろな式
  lesson({
    id: 'm2-1-1',
    subject: 'm2',
    chapter: 'いろいろな式',
    unit: '（1）複素数',
    title: '数平面の点に、名前を与える',
    summary: '複素数を a + bi と表し、複素数平面上の点として扱う。加法と絶対値。',
    builder: 'complex',
    params: { z1: { a: 2, b: 1 }, z2: { a: 3, b: -4 }, n: 1, mode: 'polar', radius: 4.5 },
    cam: { pos: [1.8, 1.4, 14.0], look: [0, 0, 0] },
    steps: [
      s({
        d: 6, text: '二乗すると負になる数を、<em>虚数単位 i</em> と書く。',
        math: 'i^2=-1',
        show: ['plane', 'axes', 'unitGrid'],
      }),
      s({
        d: 6, text: '実数 a と b に i を掛けた和が、複素数になる。',
        math: 'z=a+bi',
        show: ['z1', 'vecA', 'labels'],
      }),
      s({
        d: 6, text: '実部が a、虚部が b だ。点の横が a、縦が b になる。',
        math: 'z=a+bi\\ \\leftrightarrow\\ (a,\\ b)',
      }),
      s({
        d: 6, text: '足し算は、成分ごとに足し合わせればよい。',
        math: '(a+bi)+(c+di)=(a+c)+(b+d)i',
      }),
      s({
        d: 7, text: '絶対値は原点からの距離だ。三平方の定理で求まる。',
        math: '|z|=\\sqrt{a^2+b^2}',
        set: { z1: { a: 3, b: 4 } }, show: ['radiusA', 'labels'],
      }),
      s({
        d: 7, text: '共役は実軸について対称な点だ。かけ合わせると実数になる。',
        math: 'z\\overline z=(a+bi)(a-bi)=a^2+b^2',
        set: { mode: 'product' }, show: ['z2', 'vecB', 'prodVec', 'radiusB'],
      }),
      s({
        d: 6, text: '距離と偏角で表すと、積は偏角を足すだけになる。',
        math: 'z=r(\\cos\\theta+i\\sin\\theta)',
        set: { mode: 'polar' }, show: ['unitCircle', 'radiusA', 'angleArc', 'labels'],
      }),
    ],
  }),

  lesson({
    id: 'm2-1-2',
    subject: 'm2',
    chapter: 'いろいろな式',
    unit: '（2）剰余の定理',
    title: '割ったあとに残る、ひとつ',
    summary: '多項式を一次式で割った余りは、割った位置における関数の値に等しい。',
    builder: 'algebra3d',
    params: { coeffs: [1, 0, -2, 1], divisor: 2, mode: 'remainder', domain: [-2, 2] },
    cam: { pos: [3.4, 3.2, 14.0], look: [0, 1.2, 0] },
    steps: [
      s({
        d: 6, text: '多項式を一次式で割ったときの余りを考える。',
        math: 'f(x)=x^3-2x+1,\\quad g(x)=x-2',
        show: ['axes', 'grid', 'poly', 'coeffBalls', 'divisorLine'],
      }),
      s({
        d: 7, text: '筆算で割ると、二次式の商と余り 5 に分かれる。',
        math: 'f(x)=(x-2)(x^2+2x+2)+5',
        show: ['divisorLine', 'remainderPoint'],
      }),
      s({
        d: 7, text: '緑の曲線は、割ったときの商そのものだ。',
        math: '\\frac{f(x)}{x-2}=x^2+2x+2',
        set: { mode: 'factor' }, show: ['productCurve', 'divisorLine', 'remainderPoint'],
      }),
      s({
        d: 6, text: '割る位置を −1 にすると、余りは 2 に変わる。',
        math: 'R=f(-1)=2',
        set: { divisor: -1 }, show: ['divisorLine', 'remainderPoint'],
      }),
      s({
        d: 7, text: '割り算の結果は、必ずこの形でまとめられる。',
        math: 'f(x)=(x-a)Q(x)+R',
        set: { mode: 'identity', divisor: 2 }, show: ['identityPanel', 'divisorLine'],
      }),
      s({
        d: 6, text: 'x = a を代入すれば、関数の値が余りだと分かる。',
        math: 'f(a)=R',
        show: ['identityPanel', 'divisorLine'],
      }),
    ],
  }),

  lesson({
    id: 'm2-1-3',
    subject: 'm2',
    chapter: 'いろいろな式',
    unit: '（3）因数定理と恒等式',
    title: '根を一つ見つけたら、残りを 因数分解できる',
    summary: 'f(a) = 0 ならば x − a で割り切れる。割り切れた式は恒等式として書ける。',
    builder: 'algebra3d',
    params: { coeffs: [1, 0, -3, 2], divisor: 1, mode: 'factor', domain: [-2.4, 2.4] },
    cam: { pos: [3.2, 3.4, 14.0], look: [0, 1.6, 0] },
    steps: [
      s({
        d: 6, text: '方程式を解く前に、<em>因数分解の見通し</em>を立てる。',
        math: 'f(x)=x^3-3x+2',
        set: { mode: 'factor' }, show: ['axes', 'grid', 'poly', 'coeffBalls'],
      }),
      s({
        d: 6, text: '因数定理は、f(a) が 0 なら割り切れるという定理だ。',
        math: 'f(a)=0\\ \\Longrightarrow\\ (x-a)\\ \\text{で割り切れる}',
        set: { divisor: 1 }, show: ['divisorLine', 'remainderPoint'],
      }),
      s({
        d: 6, text: 'x = 1 の位置で曲線の高さが 0 だ。余りも 0 になる。',
        math: 'f(1)=1-3+2=0',
        show: ['poly', 'divisorLine', 'remainderPoint'],
      }),
      s({
        d: 7, text: '割り切れたので、積の形に書き直せる。緑が商だ。',
        math: 'f(x)=(x-1)(x^2-x-2)',
        set: { mode: 'identity' }, show: ['identityPanel', 'productCurve', 'divisorLine'],
      }),
      s({
        d: 7, text: '左辺と右辺がまったく同じ曲線になる。これが恒等式だ。',
        math: 'f(x)\\equiv(x-1)(x^2-x-2)',
        show: ['identityPanel', 'divisorLine'],
      }),
      s({
        d: 6, text: '残った二次式にも、同じ手法で割り切れる場所を探す。',
        math: 'g(x)=x^2-x-2,\\ g(2)=0',
        set: { mode: 'factor', coeffs: [1, -1, -2], divisor: 2 },
        show: ['poly', 'divisorLine', 'remainderPoint'],
      }),
      s({
        d: 6, text: 'もう一度割ると、3 つの一次式の積になる。',
        math: 'f(x)=(x-1)(x-2)(x+1)',
        set: { divisor: -1 }, show: ['poly', 'divisorLine', 'remainderPoint'],
      }),
    ],
  }),

  lesson({
    id: 'm2-1-4',
    subject: 'm2',
    chapter: 'いろいろな式',
    unit: '（4）高次方程式と実数解の判定',
    title: 'グラフの交点を探る',
    summary: '高次方程式を解く前に、関数の値を調べると因数分解の見通しが立つ。実数解の個数もグラフから読める。',
    builder: 'algebra3d',
    params: { coeffs: [1, -1, -4, 4], rootGuess: 1, mode: 'roots', domain: [-2.2, 2.6] },
    cam: { pos: [3.0, 3.2, 14.0], look: [-1.0, 1.2, 0] },
    steps: [
      s({
        d: 6, text: '方程式を解くのは、曲線と x 軸の交点を探すのと同じだ。',
        math: 'f(x)=x^3-x^2-4x+4',
        set: { mode: 'roots' }, show: ['axes', 'grid', 'poly', 'coeffBalls', 'tLine'],
      }),
      s({
        d: 7, text: 'x = 1 を代入すると 0 になる。<em>因数が見つかった</em>。',
        math: 'f(1)=1-1-4+4=0',
        set: { rootGuess: 1 }, show: ['tLine', 'blowUp', 'poly'],
      }),
      s({
        d: 6, text: '同じ手順で、他の交点も見つかる。',
        math: 'f(x)=(x-1)(x-2)(x+2)',
        set: { rootGuess: 2 }, show: ['tLine', 'blowUp', 'poly'],
      }),
      s({
        d: 7, text: '黄色の点は実数解だ。交点の個数が、そのまま解の個数になる。',
        math: 'x=-2,\\ 1,\\ 2',
        show: ['zeros', 'rootDots', 'poly'],
      }),
      s({
        d: 7, text: '3 次方程式でも、実数解が 1 個しかないものがある。',
        math: 'g(x)=x^3-2x+2',
        set: { coeffs: [1, 0, -2, 2], rootGuess: -2 }, show: ['zeros', 'rootDots', 'poly'],
      }),
      s({
        d: 6, text: '残った 2 つは、係数が実数だから互いに共役になる。',
        math: '\\text{実数解 }1\\ \\text{個}+\\ \\text{共役複素解 }2\\ \\text{個}',
        set: { rootGuess: 0 }, show: ['zeros', 'rootDots', 'poly', 'tLine'],
      }),
    ],
  }),

  // -------------------------------------------------------- 図形と方程式
  lesson({
    id: 'm2-2-1',
    subject: 'm2',
    chapter: '図形と方程式',
    unit: '（1）点と直線',
    title: '傾きと切片で、直線の居場所が決まる',
    summary: '直線の式、傾きと切片、点と直線の距離。座標から式を組み立てる。',
    builder: 'lines3d',
    params: { mode: 'line', a: [-2, -1], b: [1, 2], c: [1, -1] },
    cam: { pos: [1.5, -1.8, 14.5], look: [0, -0.6, 0] },
    steps: [
      s({
        d: 6, text: '直線は、傾きと切片の二つで決まる。',
        math: 'y=mx+b',
        show: ['axes', 'grid', 'pointA', 'pointB', 'lineAB', 'lineC', 'equation'],
      }),
      s({
        d: 6, text: '傾きは、2 点の縦の差を横の差で割った値だ。',
        math: 'm=\\frac{y_2-y_1}{x_2-x_1}=\\frac{3}{3}=1',
        show: ['vectorAB', 'lengthBar', 'pointA', 'pointB', 'lineAB'],
      }),
      s({
        d: 6, text: '切片は、y 軸と交わるときの縦の値になる。',
        math: 'b=1',
        show: ['lineAB', 'lineC', 'pointA', 'pointB', 'equation'],
      }),
      s({
        d: 6, text: '傾きが負なら、直線は右下がりに進む。',
        math: 'y=-x',
        set: { a: [-2, 2], b: [1, -1] }, show: ['lineAB', 'lineC', 'pointA', 'pointB', 'equation'],
      }),
      s({
        d: 6, text: '横の変化がゼロだと、傾きは分数で書けない。',
        math: 'x=1',
        set: { a: [1, -2], b: [1, 2] }, show: ['lineAB', 'pointA', 'pointB', 'equation'],
      }),
      s({
        d: 7, text: '点と直線の距離は、その点から下ろした垂線の長さだ。',
        math: 'd=\\frac{|Ax_0+By_0+C|}{\\sqrt{A^2+B^2}}',
        set: { mode: 'distance', a: [-4, -3], b: [4, 3], c: [4, -1] },
        show: ['pointA', 'pointB', 'pointC', 'footDot', 'normalLine', 'equation'],
      }),
      s({
        d: 6, text: '比を 1 対 1 にしたときだけ、点はその中点になる。',
        math: 'AP:PB=1:1',
        set: { mode: 'midpoint', a: [-3, 0], b: [3, 0], ratio: 1 },
        show: ['pointA', 'pointB', 'midDot', 'segments', 'vectorAB', 'lengthBar', 'equation'],
      }),
    ],
  }),

  lesson({
    id: 'm2-2-2',
    subject: 'm2',
    chapter: '図形と方程式',
    unit: '（2）円の式',
    title: '中心と半径で、円はひとつに決まる',
    summary: '円の方程式 (x − a)² + (y − b)² = r²。接線は接点での半径に垂直になる。',
    builder: 'lines3d',
    params: { mode: 'circle', a: [0, 2.4], b: [2.4, 0], center: [0, 0], radius: 2.4 },
    cam: { pos: [1.5, -1.8, 14.5], look: [0, -0.6, 0] },
    steps: [
      s({
        d: 6, text: '中心と半径が分かれば、円は一意に決まる。',
        math: '(x-a)^2+(y-b)^2=r^2',
        show: ['axes', 'grid', 'circle', 'centerDot', 'radiusBar', 'equation'],
      }),
      s({
        d: 6, text: '展開すると、中心と半径が直接読み取れる形になる。',
        math: 'x^2+y^2+Dx+Ey+F=0',
        show: ['circle', 'centerDot', 'radiusBar', 'equation'],
      }),
      s({
        d: 6, text: '中心と半径を変えても、式はそのまま対応する。',
        math: '(x-1)^2+(y-1)^2=4',
        set: { center: [1, 1], radius: 2, a: [1, 3], b: [3, 1] },
        show: ['circle', 'centerDot', 'radiusBar', 'equation'],
      }),
      s({
        d: 6, text: '面積は半径からすぐ求まる。',
        math: 'S=\\pi r^2=4\\pi',
        set: { center: [0, 0], radius: 2.4, a: [0, 2.4], b: [2.4, 0] },
        show: ['circle', 'centerDot', 'radiusBar', 'area'],
      }),
      s({
        d: 7, text: '接点での半径は、接線と直角をなしている。',
        math: 'OT\\perp l',
        set: { mode: 'tangent', center: [0, 0], radius: 2.4, point: [1.8, 1.4] },
        show: ['circle', 'centerDot', 'radiusBar', 'pointOnCircle', 'tangentLine', 'normalBar'],
      }),
      s({
        d: 6, text: 'この 1 本の式で、円の位置も大きさも決まる。',
        math: '(x-a)^2+(y-b)^2=r^2',
        set: { mode: 'circle' }, show: ['circle', 'centerDot', 'radiusBar', 'equation'],
      }),
    ],
  }),

  // -------------------------------------------------- 指数関数・対数関数
  lesson({
    id: 'm2-3-3',
    subject: 'm2',
    chapter: '指数関数・対数関数',
    unit: '（3）指数・対数の方程式の解法',
    title: '底の累乗に読み替える',
    summary: 'a^x = b も log_a x = b も、底の累乗に読み替えて解く。両者は互いに逆の関係にある。',
    builder: 'graph3d',
    params: { fn: exp(2), domain: [0.1, 4.2], yRange: [-0.5, 16] },
    cam: { pos: [3.5, 5.2, 15.0], look: [1.2, 3.2, 0] },
    steps: [
      s({
        d: 6, text: '指数方程式は、底の累乗に読み替える問題になる。',
        math: 'a^x=b',
        show: ['axes', 'grid', 'curve', 'projection', 'curtain'],
      }),
      s({
        d: 7, text: '8 は 2 の 3 乗だから、解は 3 になる。',
        math: '2^3=8\\ \\Longrightarrow\\ x=3',
        set: { t: 3 }, show: ['marker', 'tLabel'],
      }),
      s({
        d: 6, text: 'グラフでも、縦 8 の点の横を読めば同じ答えが出る。',
        math: 'f(3)=8',
      }),
      s({
        d: 7, text: '対数の定義を使えば、累乗に読み替えるのと同じになる。',
        math: '\\log_a x=b\\ \\Longleftrightarrow\\ a^b=x',
        set: { fn: log(2) }, show: ['curve', 'projection', 'curtain', 'marker', 'tLabel'],
      }),
      s({
        d: 7, text: '対数関数のグラフは、縦 2 の点の横が 4 になっている。',
        math: '\\log_2 4=2',
        set: { t: 4 }, show: ['marker', 'tLabel', 'curve'],
      }),
      s({
        d: 6, text: '2 つの式は、互いに逆の関係にある。',
        math: '2^x=b\\ \\Longleftrightarrow\\ \\log_2 b=x',
      }),
    ],
  }),

  // ------------------------------------------------------------ 三角関数
  lesson({
    id: 'm2-4-1',
    subject: 'm2',
    chapter: '三角関数',
    unit: '（1）平面の三角比',
    title: '斜辺を 1 にした三角形で、3 つを一度に読む',
    summary: '直角三角形の対辺と隣辺の比。単位円の上では、正弦も余弦も 1 以下になる。',
    builder: 'unitcircle',
    params: { theta: Math.PI / 4, radius: 2.6, showSweep: 1 },
    cam: { pos: [1.5, 0.6, 14.0], look: [0, -1.0, 0] },
    steps: [
      s({
        d: 6, text: '斜辺の長さを 1 にした直角三角形を考える。',
        math: '\\text{斜辺}=1',
        show: ['circle', 'axes', 'grid', 'pointP', 'radius', 'triFill', 'sweepArc'],
      }),
      s({
        d: 6, text: '対辺の長さが、正弦の値になる。',
        math: '\\sin\\theta=\\frac{\\text{対辺}}{\\text{斜辺}}',
        show: ['legSin', 'footZ', 'pointP', 'labels'],
      }),
      s({
        d: 6, text: '隣辺の長さが、余弦の値になる。',
        math: '\\cos\\theta=\\frac{\\text{隣辺}}{\\text{斜辺}}',
        show: ['legCos', 'footX', 'pointP', 'labels'],
      }),
      s({
        d: 7, text: '隣辺から接線を足すと、対辺を隣辺で割ったものになる。',
        math: '\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}',
        show: ['legTan', 'footX', 'pointP', 'labels'],
      }),
      s({
        d: 6, text: '角を 30 度にすると、正弦は 0.5 になる。',
        math: '\\sin30^\\circ=0.5',
        set: { theta: Math.PI / 6 }, show: ['legCos', 'legSin', 'pointP', 'radius', 'labels'],
      }),
      s({
        d: 6, text: '三平方の定理から、2 つの値を結ぶ関係が出る。',
        math: '\\sin^2\\theta+\\cos^2\\theta=1',
        show: ['radius', 'legCos', 'legSin', 'triFill', 'labels'],
      }),
    ],
  }),

  lesson({
    id: 'm2-4-2',
    subject: 'm2',
    chapter: '三角関数',
    unit: '（2）一般角と三角関数',
    title: '符号は、座標そのものだ',
    summary: '0 度を超える角でも三角関数は定義できる。値は点の座標そのもので、360 度で元に戻る。',
    builder: 'unitcircle',
    params: { theta: Math.PI / 3, radius: 2.6, showSweep: 1 },
    cam: { pos: [1.5, 0.8, 14.0], look: [0, -1.0, 0] },
    steps: [
      s({
        d: 6, text: '角は、0 度からどれだけ回ったかで決める。',
        math: '0\\le\\theta<360',
        show: ['circle', 'axes', 'pointP', 'radius', 'sweepArc', 'labels'],
      }),
      s({
        d: 6, text: '第 2 象限では、正弦が正で余弦が負になる。',
        math: '\\sin\\theta>0,\\quad \\cos\\theta<0',
        set: { theta: Math.PI * 0.75 }, show: ['legCos', 'legSin', 'footX', 'footZ', 'pointP', 'labels'],
      }),
      s({
        d: 6, text: '第 3 象限では、両方が負になる。',
        math: '\\sin\\theta<0,\\quad \\cos\\theta<0',
        set: { theta: Math.PI * 1.25 }, show: ['legCos', 'legSin', 'footX', 'footZ', 'pointP', 'labels'],
      }),
      s({
        d: 6, text: '負の角は、時計回りに回した角のことだ。',
        math: '\\theta=-45^\\circ',
        set: { theta: -Math.PI / 4 }, show: ['sweepArc', 'pointP', 'radius', 'circle', 'labels'],
      }),
      s({
        d: 6, text: '一周分だけ進めると、同じ場所に戻る。',
        math: '\\sin(\\theta+360^\\circ)=\\sin\\theta',
        set: { theta: Math.PI / 3 + Math.PI * 2 },
        show: ['legCos', 'legSin', 'footX', 'footZ', 'pointP', 'labels'],
      }),
      s({
        d: 7, text: '接線との比を取ると、正接の値も得られる。',
        math: '\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}',
        set: { theta: Math.PI / 3 }, show: ['legTan', 'footX', 'pointP', 'labels'],
      }),
    ],
  }),

  lesson({
    id: 'm2-4-3',
    subject: 'm2',
    chapter: '三角関数',
    unit: '（3）加法定理',
    title: '角の和は、分配法則と同じ形になる',
    summary: 'sin(α + β)、cos(α + β)、tan(α + β) の公式。直角三角形と円弧で確かめられる。',
    builder: 'unitcircle',
    params: { theta: Math.PI / 3, theta2: Math.PI / 6, radius: 2.6, showSecond: 1 },
    cam: { pos: [-1.0, 0.5, 14.0], look: [-2.0, -0.8, 0] },
    steps: [
      s({
        d: 6, text: '左の小さい円が、一方の角を表している。',
        math: "\\alpha+\\beta",
        show: ['circle', 'axes', 'pointP', 'radius', 'unitCircle2', 'pointP2', 'labels'],
      }),
      s({
        d: 7, text: '和の正弦は、2 つの角の正弦と余弦で表せる。',
        math: '\\sin(\\alpha+\\beta)=\\sin\\alpha\\cos\\beta+\\cos\\alpha\\sin\\beta',
        show: ['legCos', 'legSin', 'footX', 'footZ', 'pointP', 'labels'],
      }),
      s({
        d: 7, text: '和の余弦は、同じ形に積の引き算が現れる。',
        math: '\\cos(\\alpha+\\beta)=\\cos\\alpha\\cos\\beta-\\sin\\alpha\\sin\\beta',
        show: ['legCos', 'legSin', 'footX', 'footZ', 'pointP', 'labels'],
      }),
      s({
        d: 7, text: '正接は、前 2 つを割り合わせて作られる。',
        math: '\\tan(\\alpha+\\beta)=\\frac{\\tan\\alpha+\\tan\\beta}{1-\\tan\\alpha\\tan\\beta}',
        show: ['legTan', 'footX', 'pointP', 'labels'],
      }),
      s({
        d: 6, text: '30 度と 30 度を足す。式で計算しても 0.87 になる。',
        math: '\\sin60^\\circ=\\sin30^\\circ\\cos30^\\circ+\\cos30^\\circ\\sin30^\\circ',
        set: { theta: Math.PI / 3, theta2: Math.PI / 6 },
        show: ['legCos', 'legSin', 'footX', 'footZ', 'pointP', 'labels'],
      }),
      s({
        d: 6, text: '式の形は、分配法則で和を展開したときと同じだ。',
        math: '\\sin(\\alpha+\\beta)=\\sin\\alpha\\cos\\beta+\\cos\\alpha\\sin\\beta',
      }),
    ],
  }),

  lesson({
    id: 'm2-4-5',
    subject: 'm2',
    chapter: '三角関数',
    unit: '（5）三角関数の最大と最小',
    title: '最高点と最も深い谷を読む',
    summary: 'y = a sin(bx) + d の最大と最小。振幅 a と平行移動 d を先に読む。',
    builder: 'graph3d',
    params: { fn: (x) => 2 * Math.sin(2 * x) + 1, domain: [-6.3, 6.3], yRange: [-1.4, 3.4] },
    cam: { pos: [3.2, 2.6, 15.0], look: [0, 0.6, 0] },
    steps: [
      s({
        d: 6, text: '係数が大きいほど、上下の幅が広く振れる。',
        math: 'y=2\\sin 2x+1',
        show: ['axes', 'grid', 'curve', 'projection', 'curtain'],
      }),
      s({
        d: 6, text: '上下の幅は、2 と 1 を足した 3 になる。',
        math: '-1\\le 2\\sin 2x+1\\le 3',
      }),
      s({
        d: 7, text: '最大になるのは、正弦が 1 のときだ。',
        math: '2x=\\frac{\\pi}{2}\\ \\Longrightarrow\\ x=\\frac{\\pi}{4}',
        set: { t: Math.PI / 4 }, show: ['marker', 'tLabel'],
      }),
      s({
        d: 7, text: '最小になるのは、正弦が −1 のときだ。',
        math: '2x=-\\frac{\\pi}{2}\\ \\Longrightarrow\\ x=-\\frac{\\pi}{4}',
        set: { t: -Math.PI / 4 }, show: ['marker', 'tLabel'],
      }),
      s({
        d: 6, text: '同じ形が繰り返す周期は、2 分の 1 の円周だ。',
        math: 'T=\\frac{2\\pi}{2}=\\pi',
      }),
      s({
        d: 6, text: '2 倍した値と、上下にずらした値だけを見ればよい。',
        math: 'd-2a\\le y\\le d+2a',
        set: { t: 0 }, show: ['curve', 'projection', 'curtain', 'marker'],
      }),
    ],
  }),

  // ------------------------------------------------------ 微分・積分の考え
  lesson({
    id: 'm2-5-1',
    subject: 'm2',
    chapter: '微分・積分の考え',
    unit: '（1）微分係数と接線',
    title: '割線を 2 点が重なるまで詰める',
    summary: '接線の傾きを微分係数と定義する。2 点間の幅を 0 に近づけたときの割線の傾き。',
    builder: 'calculus',
    params: { fn: (x) => x * x * x, a: 1, b: 2.2, mode: 'slope', h: 1, domain: [-1.4, 2.4] },
    cam: { pos: [3.0, 4.0, 14.0], look: [0, 2.0, 0] },
    steps: [
      s({
        d: 6, text: '接線の傾きを、<em>微分係数</em>と呼ぶ。',
        math: 'f^{\\prime}(a)=\\lim_{h\\to0}\\frac{f(a+h)-f(a)}{h}',
        show: ['axes', 'grid', 'curve', 'movingPoint', 'secant', 'hLine', 'derivativeReadout'],
      }),
      s({
        d: 7, text: '2 点 A と B を結ぶ直線を、割線と呼ぶ。',
        math: '\\text{割線の傾き}=\\frac{f(a+h)-f(a)}{h}',
        show: ['movingPoint', 'secant', 'hLine', 'derivativeReadout'],
      }),
      s({
        d: 7, text: '2 点の間隔 h を小さくすると、割線は接線に近づく。',
        math: 'h\\to0',
        set: { h: 0.3 }, show: ['movingPoint', 'secant', 'hLine', 'derivativeReadout'],
      }),
      s({
        d: 7, text: '十分に小さくすると、割線と接線が重なる。',
        math: 'y=f(a)+f^{\\prime}(a)\\,(x-a)',
        set: { mode: 'tangent' }, show: ['movingPoint', 'tangent', 'hLine', 'derivativeReadout'],
      }),
      s({
        d: 6, text: '3 乗を微分すると、係数の 3 と 2 乗が残る。',
        math: 'f^{\\prime}(x)=3x^2',
        show: ['curve', 'tangent', 'movingPoint', 'derivativeReadout'],
      }),
      s({
        d: 6, text: '多項式は、項ごとに別々に微分できる。',
        math: '(x^n)^{\\prime}=nx^{n-1}',
      }),
    ],
  }),

  lesson({
    id: 'm2-5-2',
    subject: 'm2',
    chapter: '微分・積分の考え',
    unit: '（2）増減と極大・極小',
    title: '傾きの符号が、上がり下がりを告げる',
    summary: '微分係数が正なら増加、負なら減少。符号が変わる場所には極大か極小がある。',
    builder: 'calculus',
    params: { fn: (x) => x * x * x - 3 * x, a: 0, b: 2.2, mode: 'tangent', h: 0.001, domain: [-2, 2.2] },
    cam: { pos: [3.0, 4.0, 14.0], look: [0, 2.0, 0] },
    steps: [
      s({
        d: 6, text: '増減は、微分係数の符号で決まる。',
        math: 'f^{\\prime}(x)=3x^2-3',
        show: ['axes', 'grid', 'curve', 'movingPoint', 'tangent', 'hLine', 'derivativeReadout'],
      }),
      s({
        d: 6, text: 'x = 0 では符号が負だ。このあたりは低下している。',
        math: 'f^{\\prime}(0)=-3<0',
        show: ['derivativeReadout', 'movingPoint', 'tangent', 'curve'],
      }),
      s({
        d: 6, text: 'x = 2 では符号が正だ。このあたりは上昇している。',
        math: 'f^{\\prime}(2)=9>0',
        set: { a: 2 }, show: ['derivativeReadout', 'movingPoint', 'tangent', 'curve'],
      }),
      s({
        d: 6, text: '傾きが 0 になる場所がある。接線は水平になる。',
        math: 'f^{\\prime}(1)=0',
        set: { a: 1 }, show: ['derivativeReadout', 'movingPoint', 'tangent', 'curve'],
      }),
      s({
        d: 7, text: '前後で符号が変わった場所が、極大になる。',
        math: 'f(1)=-2\\quad\\text{が極大}',
        show: ['curve', 'movingPoint', 'tangent', 'derivativeReadout'],
      }),
      s({
        d: 7, text: '反対側には、極小がある。',
        math: 'f(-1)=2\\quad\\text{が極小}',
        set: { a: -1 }, show: ['curve', 'movingPoint', 'tangent', 'derivativeReadout'],
      }),
    ],
  }),

  lesson({
    id: 'm2-5-3',
    subject: 'm2',
    chapter: '微分・積分の考え',
    unit: '（3）積分',
    title: '細かい長方形を、埋め尽くす',
    summary: '定積分は面積を求める。不定積分は原始関数をひとつ書くこと。',
    builder: 'calculus',
    params: { fn: (x) => 3 * x * x, a: 0, b: 1, mode: 'integral', n: 8, domain: [-0.2, 1.6] },
    cam: { pos: [3.0, 4.0, 14.0], look: [0, 2.0, 0] },
    steps: [
      s({
        d: 6, text: '曲線と x 軸で囲まれた面積を求める操作が積分だ。',
        math: 'S=\\int_0^1 3x^2\\,dx',
        show: ['axes', 'grid', 'curve', 'columns', 'arrowAB', 'baseLine'],
      }),
      s({
        d: 7, text: '区間を等しく割って、長方形の和で近似する。',
        math: 'S_n=\\sum_{i=1}^{n} f(x_i)\\,\\Delta x',
        show: ['columns', 'columnMesh', 'curve', 'arrowAB', 'baseLine'],
      }),
      s({
        d: 7, text: '分割数を増やすと、長方形の合計は面積に近づく。',
        math: 'n=40',
        set: { n: 40 }, show: ['columns', 'curve', 'arrowAB', 'baseLine', 'avgValue'],
      }),
      s({
        d: 6, text: 'さらに細かくすると、境目が見えなくなる。',
        math: 'S_n\\to S',
        set: { n: 160 }, show: ['columns', 'curve', 'arrowAB', 'baseLine', 'avgValue'],
      }),
      s({
        d: 7, text: '定積分の値は、原始関数を求めて差を取ればよい。',
        math: '\\int_0^1 3x^2\\,dx=\\left[x^3\\right]_0^1=1',
        set: { mode: 'area' }, show: ['filled', 'areaSlab', 'curve', 'arrowAB', 'baseLine'],
      }),
      s({
        d: 6, text: '原始関数だけを求める、不定積分もある。',
        math: '\\int 3x^2\\,dx=x^3+C',
        show: ['filled', 'areaSlab', 'curve', 'arrowAB', 'baseLine'],
      }),
    ],
  }),

  lesson({
    id: 'm2-5-4',
    subject: 'm2',
    chapter: '微分・積分の考え',
    unit: '（4）面積の計算',
    title: 'x 軸の上下で、話を分ける',
    summary: '曲線が x 軸より下なら符号を反転し、またぐなら交点で区切って足し合わせる。',
    builder: 'calculus',
    params: { fn: (x) => x * x, a: 0, b: 2, mode: 'area', domain: [-0.4, 2.4] },
    cam: { pos: [3.0, 3.5, 15.0], look: [0.5, 1.5, 0] },
    steps: [
      s({
        d: 6, text: '曲線と x 軸と 2 本の縦線で囲まれた面積を求める。',
        math: 'S=\\int_0^2 x^2\\,dx',
        show: ['axes', 'grid', 'curve', 'filled', 'areaSlab', 'arrowAB', 'baseLine'],
      }),
      s({
        d: 6, text: '原始関数を求めて、上下の値の差を取ればよい。',
        math: 'S=\\left[\\frac{x^3}{3}\\right]_0^2=\\frac{8}{3}',
        show: ['filled', 'areaSlab', 'curve', 'arrowAB', 'baseLine'],
      }),
      s({
        d: 7, text: '曲線が x 軸より下にあるときは、積分の値を反転させる。',
        math: 'S=-\\int_0^2 x^2\\,dx',
        set: { fn: (x) => -x * x }, show: ['curve', 'filled', 'areaSlab', 'arrowAB', 'baseLine'],
      }),
      s({
        d: 7, text: '曲線が x 軸をまたぐときは、交点で区切って足し合わせる。',
        math: 'S=-\\int_0^1(x^2-1)\\,dx+\\int_1^2(x^2-1)\\,dx',
        set: { fn: (x) => x * x - 1 }, show: ['curve', 'filled', 'areaSlab', 'arrowAB', 'baseLine'],
      }),
      s({
        d: 6, text: '実際に計算すると、面積は 2 になる。',
        math: 'S=\\frac{2}{3}+\\frac{4}{3}=2',
      }),
      s({
        d: 6, text: '原始関数の値の差で、面積そのものを求める。',
        math: 'S=F(b)-F(a)',
      }),
    ],
  }),
];
