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
const r = doc1.replaceAll('소울브릿지', 'TESTSCHOOL', false);
console.log('replaceAll:', r);

// Try exportHwpx
const hwpx = doc1.exportHwpx();
await writeFile('/tmp/roundtrip.hwpx', hwpx);
console.log(`exportHwpx → ${hwpx.length} bytes`);

const data2 = await readFile('/tmp/roundtrip.hwpx');
const doc2 = new HwpDocument(new Uint8Array(data2));
console.log('reloaded(.hwpx) "TESTSCHOOL":', doc2.searchText('TESTSCHOOL', 0, 0, 0, true, false));
console.log('reloaded(.hwpx) "소울브릿지":', doc2.searchText('소울브릿지', 0, 0, 0, true, false));
console.log('reloaded(.hwpx) para0 text:', JSON.stringify(doc2.getTextRange(0, 0, 0, doc2.getParagraphLength(0, 0))));
