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

const path = '/Users/junyoung/Desktop/work/01_ai_product/05_ai_document_transfer/templates/품의결의서/template.hwp';
const data = await readFile(path);
const doc = new HwpDocument(new Uint8Array(data));

// 1. searchText로 다양한 패턴 시도
const patterns = ['{{', '증제번호', '{{증제번호}}', '시행일자', '{', '}', '\\{\\{'];
console.log('=== Pattern search ===');
for (const p of patterns) {
  try {
    const r = doc.searchText(p, 0, 0, 0, true, false);
    console.log(`  "${p}" → ${r}`);
  } catch (e) {
    console.log(`  "${p}" → ERR: ${e.message}`);
  }
}

// 2. replaceAll without actually modifying — just to see counts
console.log('\n=== replaceAll counts ===');
for (const p of ['{{', '증제번호', '{{증제번호}}', '〔〔', '［［']) {
  const doc2 = new HwpDocument(new Uint8Array(data));
  const r = doc2.replaceAll(p, p + '_TEST', false);
  console.log(`  "${p}" → ${r}`);
}

// 3. raw HWP file에 있는 {{ 같은 문자열이 그냥 byte로 보이는지 확인 (UTF-16 stored?)
const buf = data;
let hits16le = 0, hits8 = 0;
const target = '{{증제';
const utf16le = Buffer.from(target, 'utf16le');
const utf8 = Buffer.from(target, 'utf8');
for (let i = 0; i < buf.length - utf16le.length; i++) {
  if (buf.subarray(i, i + utf16le.length).equals(utf16le)) hits16le++;
}
for (let i = 0; i < buf.length - utf8.length; i++) {
  if (buf.subarray(i, i + utf8.length).equals(utf8)) hits8++;
}
console.log(`\n=== Raw byte search for "${target}" ===`);
console.log(`  utf16le matches: ${hits16le}`);
console.log(`  utf8 matches:    ${hits8}`);
