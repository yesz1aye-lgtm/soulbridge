import { readFile } from 'node:fs/promises';
import init, { HwpDocument, init_panic_hook } from '@rhwp/core';

globalThis.measureTextWidth = (font, text) => {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  const size = m ? parseFloat(m[1]) : 12;
  return text.length * size * 0.55;
};

const wasm = await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url));
await init({ module_or_path: wasm });
init_panic_hook();

const path = process.argv[2];
if (!path) { console.error('usage: node probe-structure.mjs <hwp file>'); process.exit(1); }

const data = await readFile(path);
const doc = new HwpDocument(new Uint8Array(data));

console.log(`File: ${path}`);
console.log(`pageCount: ${doc.pageCount()}`);
console.log(`sectionCount: ${doc.getSectionCount()}`);

const sections = doc.getSectionCount();
for (let s = 0; s < sections; s++) {
  const paraCount = doc.getParagraphCount(s);
  console.log(`\n--- Section ${s}: ${paraCount} paragraphs ---`);
  for (let p = 0; p < paraCount; p++) {
    const len = doc.getParagraphLength(s, p);
    let text = '';
    if (len > 0) {
      try { text = doc.getTextRange(s, p, 0, len); } catch (e) { text = `[err:${e.message}]`; }
    }
    const display = text.length > 80 ? text.slice(0, 77) + '...' : text;
    console.log(`  [${s}.${p}] len=${len} | ${JSON.stringify(display)}`);
  }
}
