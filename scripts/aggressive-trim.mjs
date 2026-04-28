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

// Strategy: try multiple deletion ranges, pick the one that yields exactly 2 pages
const tries = [
  { name: 'para1-9',   range: [0, 1, 0, 9, 0] },
  { name: 'para2-9',   range: [0, 2, 0, 9, 0] },
  { name: 'para3-9',   range: [0, 3, 0, 9, 0] },
  { name: 'para4-9',   range: [0, 4, 0, 9, 0] },
  { name: 'para1-end', range: null },  // delete everything after para 0
];

for (const t of tries) {
  const doc = new HwpDocument(new Uint8Array(data));
  const before = { paras: doc.getParagraphCount(0), pages: doc.pageCount() };
  let r;
  try {
    if (t.range) {
      r = doc.deleteRange(...t.range);
    } else {
      const lastP = doc.getParagraphCount(0) - 1;
      const lastL = doc.getParagraphLength(0, lastP);
      r = doc.deleteRange(0, 1, 0, lastP, lastL);
    }
    const after = { paras: doc.getParagraphCount(0), pages: doc.pageCount() };
    const out = `/tmp/rhwp-probe/trim_${t.name}.hwp`;
    await writeFile(out, doc.exportHwp());
    console.log(`${t.name.padEnd(12)} | before paras=${before.paras} pages=${before.pages} | after paras=${after.paras} pages=${after.pages} | -> ${out}`);
  } catch (e) {
    console.log(`${t.name.padEnd(12)} | FAILED: ${e.message}`);
  }
}
