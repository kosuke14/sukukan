#!/usr/bin/env node
/**
 * Prints the `parts` keys and parameter names of every registered builder.
 * `node scripts/parts.mjs` → console; `node scripts/parts.mjs --md` → docs table.
 * The parts list is the contract content authors write `show`/`hide`/`focus`
 * against, so it is generated from the code rather than kept in a doc by hand.
 */
function stubCtx() {
  const noop = () => {};
  return new Proxy({
    measureText: () => ({ width: 40 }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  }, {
    get(t, k) { return k in t ? t[k] : noop; },
    set() { return true; },
  });
}
global.document = { createElement: () => ({ width: 0, height: 0, getContext: stubCtx }) };
global.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
global.self = global.window;

const mod = await import(new URL('../src/visuals/index.js', import.meta.url).href);
const out = {};
for (const n of mod.builderNames()) {
  try {
    const b = mod.getBuilder(n)({ accent: 0x6ee7ff });
    out[n] = { parts: Object.keys(b.parts ?? {}), params: Object.keys(b.params ?? {}) };
    b.dispose?.();
  } catch (e) {
    out[n] = { error: e.message, parts: [], params: [] };
  }
}

if (process.argv.includes('--md')) {
  const lines = ['# ビルダーの部品名とパラメータ', '',
    '`node scripts/parts.mjs --md` で再生成できる。', ''];
  for (const [name, v] of Object.entries(out)) {
    lines.push(`## ${name}`, '', `**parts**: ${v.parts.join(', ')}`, '', `**params**: ${v.params.join(', ')}`, '');
  }
  console.log(lines.join('\n'));
} else {
  console.log(JSON.stringify(out, null, 1));
}
