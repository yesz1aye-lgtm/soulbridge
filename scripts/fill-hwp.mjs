// 범용 HWP 채우기: 템플릿 + JSON 값 → output hwp
//
// 사용법:
//   node scripts/fill-hwp.mjs <template.hwp> <values.json> <out.hwp>
//
// values.json 예시:
//   { "증제번호": "2025-366", "시행일자": "2025. 12. 10", ... }
//
// 동작:
//   - 각 키를 {{키}} 형태로 변환해 replaceAll 적용
//   - 모든 placeholder가 치환됐는지 후검증 (남은 {{...}} 검출)

import { readFile, writeFile } from 'node:fs/promises';
import init, { HwpDocument, init_panic_hook } from '@rhwp/core';

globalThis.measureTextWidth = (font, text) => {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  const size = m ? parseFloat(m[1]) : 12;
  return text.length * size * 0.55;
};

const wasm = await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url));
await init({ module_or_path: wasm });
init_panic_hook();

const [, , templatePath, valuesPath, outPath] = process.argv;
if (!templatePath || !valuesPath || !outPath) {
  console.error('usage: node scripts/fill-hwp.mjs <template.hwp> <values.json> <out.hwp>');
  process.exit(1);
}

const tplBytes = await readFile(templatePath);
const values = JSON.parse(await readFile(valuesPath, 'utf-8'));
const doc = new HwpDocument(new Uint8Array(tplBytes));

console.log(`=== Filling ${templatePath} ===`);
let totalSubstitutions = 0;
const missing = [];
for (const [key, val] of Object.entries(values)) {
  const placeholder = `{{${key}}}`;
  const r = JSON.parse(doc.replaceAll(placeholder, String(val), false));
  if (r.count === 0) missing.push(placeholder);
  else totalSubstitutions += r.count;
  console.log(`  ${r.count > 0 ? '✓' : '✗'} ${placeholder} → ${String(val).slice(0,40)}  (count=${r.count})`);
}

// 후검증: 남은 {{...}} 있는지
const leftover = JSON.parse(doc.searchText('{{', 0, 0, 0, true, true));
if (leftover && leftover.found) {
  console.warn(`\n⚠ 남은 placeholder가 있습니다: 첫 위치 = sec:${leftover.section} para:${leftover.para} char:${leftover.char_offset}`);
} else {
  console.log('\n✓ 남은 {{ 없음');
}

if (missing.length) {
  console.warn(`\n⚠ values에 있지만 템플릿에서 못 찾은 키: ${missing.join(', ')}`);
}

await writeFile(outPath, doc.exportHwp());
console.log(`\nWrote ${outPath}  (총 치환=${totalSubstitutions})`);
