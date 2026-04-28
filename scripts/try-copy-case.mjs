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

const data = await readFile(src);
const srcDoc = new HwpDocument(new Uint8Array(data));
console.log('src — paras:', srcDoc.getParagraphCount(0), 'pages:', srcDoc.pageCount());

// Test 1: copy paras 0..3 (assumed case 1) and paste into a new empty doc
let r = srcDoc.copySelection(0, 0, 0, 4, 0);
console.log('copySelection result:', r);

const dstDoc = HwpDocument.createEmpty();
console.log('empty doc — paras:', dstDoc.getParagraphCount(0), 'pages:', dstDoc.pageCount());

r = dstDoc.pasteInternal(0, 0, 0);
console.log('pasteInternal result:', r);
console.log('after paste — paras:', dstDoc.getParagraphCount(0), 'pages:', dstDoc.pageCount());

const out1 = '/tmp/rhwp-probe/case_extracted.hwp';
await writeFile(out1, dstDoc.exportHwp());
console.log(`wrote ${out1}`);

// Test 2: in-place duplicate — copy case 1 paragraphs and paste at end
const srcDoc2 = new HwpDocument(new Uint8Array(data));
srcDoc2.copySelection(0, 0, 0, 4, 0);
const lastPara = srcDoc2.getParagraphCount(0) - 1;
const lastLen = srcDoc2.getParagraphLength(0, lastPara);
r = srcDoc2.pasteInternal(0, lastPara, lastLen);
console.log('\ndup paste result:', r);
console.log('after dup — paras:', srcDoc2.getParagraphCount(0), 'pages:', srcDoc2.pageCount());

const out2 = '/tmp/rhwp-probe/4cases.hwp';
await writeFile(out2, srcDoc2.exportHwp());
console.log(`wrote ${out2}`);
