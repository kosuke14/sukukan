import { createConics } from './conics.js';
import { createGraph3D } from './graph3d.js';
import { createUnitCircle } from './unitcircle.js';
import { createPythagoras } from './pythagoras.js';
import { createPlane3D } from './plane3d.js';
import { createNumberLine } from './numberline.js';
import { createSets } from './sets.js';
import { createParabola3D } from './parabola3d.js';
import { createCalculus } from './calculus.js';
import { createLimit } from './limit.js';
import { createAlgebra3D } from './algebra3d.js';
import { createComplex } from './complex.js';
import { createVectors } from './vectors.js';
import { createLines3D } from './lines3d.js';
import { createLocus } from './locus.js';
import { createParamCurve } from './paramcurve.js';
import { createSequence } from './sequence.js';
import { createProbability } from './probability.js';
import { createInduction } from './induction.js';
import { createSolids } from './solids.js';

/**
 * ビルダー登録テーブル。content 側で `builder: 'xxx'` と書けばここが引かれる。
 * 新しい可視化を追加するのは、この表に1行足すだけでよい。
 * 契約の詳細は docs/BUILDER_CONTRACT.md。
 */
const REGISTRY = {
  conics: createConics,
  graph3d: createGraph3D,
  unitcircle: createUnitCircle,
  pythagoras: createPythagoras,
  plane3d: createPlane3D,
  numberline: createNumberLine,
  sets: createSets,
  parabola3d: createParabola3D,
  calculus: createCalculus,
  limit: createLimit,
  algebra3d: createAlgebra3D,
  complex: createComplex,
  vectors: createVectors,
  lines3d: createLines3D,
  locus: createLocus,
  paramcurve: createParamCurve,
  sequence: createSequence,
  probability: createProbability,
  induction: createInduction,
  solids: createSolids,
};

export function getBuilder(name) {
  const b = REGISTRY[name];
  if (!b) console.warn(`[visuals] 未登録のビルダー: ${name}`);
  return b;
}

export function builderNames() { return Object.keys(REGISTRY); }
export function registerBuilder(name, fn) { REGISTRY[name] = fn; }
