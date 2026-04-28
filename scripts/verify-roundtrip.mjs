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

const data = await readFile('templates/품의결의서/raw.hwp');

const doc1 = new HwpDocument(new Uint8Array(data));
console.log('1) raw.hwp pre-mod searchText for "소울브릿지":', doc1.searchText('소울브릿지', 0, 0, 0, true, false));
const r = doc1.replaceAll('소울브릿지', 'TESTSCHOOL', false);
console.log('2) replaceAll result:', r);
console.log('3) post-mod (in-memory) searchText for "TESTSCHOOL":', doc1.searchText('TESTSCHOOL', 0, 0, 0, true, false));
console.log('4) post-mod (in-memory) searchText for "소울브릿지":', doc1.searchText('소울브릿지', 0, 0, 0, true, false));

const exported = doc1.exportHwp();
await writeFile('/tmp/roundtrip.hwp', exported);

const data2 = await readFile('/tmp/roundtrip.hwp');
const doc2 = new HwpDocument(new Uint8Array(data2));
console.log('\n5) reloaded searchText for "TESTSCHOOL":', doc2.searchText('TESTSCHOOL', 0, 0, 0, true, false));
console.log('6) reloaded searchText for "소울브릿지":', doc2.searchText('소울브릿지', 0, 0, 0, true, false));
console.log('7) reloaded paragraph 0 text:', JSON.stringify(doc2.getTextRange(0, 0, 0, doc2.getParagraphLength(0, 0))));
