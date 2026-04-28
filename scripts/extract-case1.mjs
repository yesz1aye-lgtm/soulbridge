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

const src = '/Users/junyoung/Desktop/work/01_ai_product/05_ai_document_transfer/03. 품의결의서/2025 품의결의서 366-368(12월 인건비) 예시.hwp';
const out = '/tmp/rhwp-probe/case1_only.hwp';

const data = await readFile(src);
const doc = new HwpDocument(new Uint8Array(data));
console.log('Before — paras:', doc.getParagraphCount(0), 'pages:', doc.pageCount());

// Try delete paragraphs 4..9 (keep 0..3 = case 366)
try {
  const r = doc.deleteRange(0, 4, 0, 9, 0);
  console.log('deleteRange result:', r);
} catch (e) {
  console.log('deleteRange error:', e.message);
}

console.log('After — paras:', doc.getParagraphCount(0), 'pages:', doc.pageCount());

const bytes = doc.exportHwp();
await writeFile(out, bytes);
console.log(`wrote ${out} (${bytes.length} bytes)`);
