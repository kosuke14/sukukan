#!/usr/bin/env node
/**
 * Text integrity check.
 *
 * Hand-written Japanese prose in this project has picked up replacement
 * characters and stray non-Japanese scripts, so every source file is scanned
 * before it is trusted.
 *
 * The kanji check uses kanjidic2: any CJK ideograph that is not a Japanese
 * kanji (JIS + legacy + variant forms) is foreign to this project. That
 * catches simplified-Chinese characters and mojibake with no false positives
 * on real Japanese prose.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const JP_KANJI = new Set(
  readFileSync(new URL('./kanji-set.txt', import.meta.url), 'utf8').split('\n').filter(Boolean)
);
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const FOREIGN_SCRIPTS = /[\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\uac00-\ud7af]/;

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['src', 'index.html', 'docs'];
const SKIP = new Set(['node_modules', '.git', 'dist', '.mimocode']);
const EXTS = ['.js', '.mjs', '.md', '.html', '.css'];
const problems = [];

function scan(file) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (line.includes('\ufffd')) problems.push(`${at} \u7f6e\u63db\u6587\u5b57 (U+FFFD)`);
    const stray = [...new Set(line.match(FOREIGN_SCRIPTS) ?? [])];
    if (stray.length) problems.push(`${at} 日本語にない書記体系: ${stray.join(' ')}`);
    const foreign = [...new Set([...line].filter((c) => CJK.test(c) && !JP_KANJI.has(c)))];
    if (foreign.length) problems.push(`${at} 日本語にない漢字: ${foreign.join(' ')}`);
  });
}

function walk(p) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    if (SKIP.has(p.split('/').pop())) return;
    for (const f of readdirSync(p)) walk(join(p, f));
  } else if (EXTS.includes(extname(p))) {
    scan(p);
  }
}

ROOTS.forEach(walk);

if (problems.length) {
  console.error(`✖ テキスト整合性エラー ${problems.length}件:\n` + problems.join('\n'));
  process.exit(1);
}
console.log(`✓ テキスト整合性: 問題なし (日本語漢字 ${JP_KANJI.size}字で照合)`);
