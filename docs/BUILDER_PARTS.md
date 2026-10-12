# ビルダーの部品名とパラメータ

`node scripts/parts.mjs --md` で再生成できる。

## conics

**parts**: cone, generators, apex, axis, plane, planeEdge, section, sectionLine, sectionProj, foci, focus1, focus2, center, focusLabels, majorAxis, scan, eLabel

**params**: kind, a, b, c, angle, offset, radius, height, cut, axisIsU

## graph3d

**parts**: axes, grid, curve, projection, curtain, marker, tLabel, tangent, secant, area, columns, columnMeshes, solid, asymptote, equation, mirror

**params**: fn, domain, yRange, yScale, t, showArea, showVolume, showTangent, showSecant, showAsymptote, showProjection, showCurtain, sweep, mirror

## unitcircle

**parts**: pointP, footX, footZ, legCos, legSin, legTan, radius, tangent, triFill, unitCircle2, pointP2, labels, grid, axes, circle, sweepArc

**params**: theta, theta2, radius, showSweep, showTangent, showSecond, spin, accent

## pythagoras

**parts**: tri, squares, legs, labels, prism, faces, path, sphere, greatCircle, grid

**params**: a, b, mode, animate, rise, scale, accent, c

## plane3d

**parts**: grid, shape3d, shapeFlat, circle3d, circleFlat, cevian, points, angles, centerPoints, equalMarks, labels, tangent, chord

**params**: shape, a, b, c, theta, animate, accent

## numberline

**parts**: axisLine, ticks, tickLabels, marker, bar, sqrtCurve, areaLeft, areaRight, bracket, solutionDots, jump

**params**: mode, value, from, to, a, b, strict, accent

## sets

**parts**: grid, venn, circleA, circleB, circleU, dots, regions, table, arrow, pLabel, qLabel, truthGrid

**params**: mode, a, b, accent

## parabola3d

**parts**: axes, grid, curve, projection, curtain, vertex, focus, axisLine, hLine, vLine, translate, equalLines, tangent, secant, completed, area, formula

**params**: a, p, q, accent, showVertex, showFocus, showAxis, transform, focus, area

## calculus

**parts**: axes, grid, curve, movingPoint, secant, tangent, hLine, derivativeReadout, arrowAB, baseLine, columns, columnMesh, filled, areaSlab, solidOfRevolution, avgValue

**params**: fn, a, b, mode, h, hNow, n, accent, domain, yScale, sum, mean

## limit

**parts**: axes, grid, curve, dot, targetDot, labelL, point, approachLine, epsBand, deltaBand, labelDelta, sequencePoints, seriesBars, partialSum, squeezeUpper, squeezeLower, jumpPoint

**params**: fn, target, approach, mode, L, r, terms, common, accent, domain, eps, yScale, lim, seriesSum, diverges, seriesX1, seqPts

## algebra3d

**parts**: axes, grid, poly, productCurve, divisorLine, remainderPoint, rootDots, zeros, tLine, coeffBalls, identityPanel, blowUp

**params**: coeffs, divisor, rootGuess, mode, accent, domain, yScale, roots, remainder, quotient

## complex

**parts**: plane, unitGrid, axes, unitCircle, z1, z2, vecA, vecB, sumVec, diffVec, prodVec, radiusA, radiusB, angleArc, arcSpan, roots, labels, curve, mirror, mirrorLabel, expSpiral

**params**: z1, z2, n, mode, radius, spin

## vectors

**parts**: axes, grid, u, v, w, sum, difference, projU, projV, resU, resV, parallelogram, areaRect, angleArc, footDot, footDot2, areaLabel, dotReadout

**params**: u, v, w, mode, spin

## lines3d

**parts**: axes, grid, pointA, pointB, pointC, footDot, midDot, extPoint, centerDot, pointOnCircle, lineAB, lineC, normalLine, tangentLine, vectorAB, lengthBar, normalBar, radiusBar, segments, circle, area, equation

**params**: mode, a, b, c, point, center, radius, ratio, spin, t

## locus

**parts**: axes, grid, focus1, focus2, point, distBar1, distBar2, ruler, dist1, locusCurve, trace, circle, line, lineA, lineB, band

**params**: type, t, a, b, k, p, mode, auto, speed, spin

## paramcurve

**parts**: curve, shadowCurve, sweep, axes, grid, movingPoint, radiusBar, angleArc, spokes, xLine, yLine, paramTrace, asymptote

**params**: mode, t, tEnd, t0, kind, a, b, c, n, box, auto, speed, shadowRot, shadowSpin, scale, cur

## sequence

**parts**: axes, grid, bars, points, termLabels, diffSegments, ratioSegments, risingSteps, sumBar, sumBlocks, tree, fixedPoints, divergeAxis, scatter, helixPath

**params**: kind, a1, a2, d, r, n, terms, nextA, nextB, b, c, helix, count, yScale, scale, values

## probability

**parts**: axes, grid, urn, balls, drawChute, sampled, lattice, tree, branches, permRow, permDot, combRow, combDot, bars, expectedMarker, meanLine, varianceBand, treeNodes, history, note

**params**: mode, red, white, draw, n, p, nTrials, people, count, grow, values, chuteZ, allWays

## induction

**parts**: grid, axes, stair, steps, base, inductiveStep, nMark, assumptionGroup, conclusion, brace, ladder, particles, formulaLabel

**params**: n, a, mode, formula, count, glow, values, heights, seeds

## solids

**parts**: grid, axes, solid, wire, axis, base, heightBar, radiusBar, slices, fillUp, disc, inscribedSphere, rings, crossSection, sectionShape, revolved, cutPlane, cutFace, info

**params**: shape, r, h, n, slices, fn, rt, sides, cutShape, count, spin, H, volume, area

