// raw.hwp → hwpx로 한 번 export → 그 hwpx를 로드해 replaceAll → exportHwpx
// "HWPX 출처" 경로가 변경 직렬화에 더 안정적인지 테스트
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

// 1단계: raw.hwp → /tmp/raw.hwpx
const raw = await readFile('templates/품의결의서/raw.hwp');
const doc1 = new HwpDocument(new Uint8Array(raw));
await writeFile('/tmp/raw.hwpx', doc1.exportHwpx());
console.log('1) raw.hwp → /tmp/raw.hwpx');

// 2단계: /tmp/raw.hwpx 로드 → replaceAll → /tmp/template.hwpx
const hwpx = await readFile('/tmp/raw.hwpx');
const doc2 = new HwpDocument(new Uint8Array(hwpx));
const r1 = JSON.parse(doc2.replaceAll('12월 강사비 (보통교과목,대안교과목) 지급 건', '{{품의_제목}}', false));
const r2 = JSON.parse(doc2.replaceAll('2025-366', '{{증제번호}}', false));
console.log('2) replaceAll 품의_제목:', r1, '증제번호:', r2);
await writeFile('/tmp/template.hwpx', doc2.exportHwpx());

// 3단계: /tmp/template.hwpx 재로드 → placeholder 잔존 확인
const tpl = await readFile('/tmp/template.hwpx');
const doc3 = new HwpDocument(new Uint8Array(tpl));
const v1 = JSON.parse(doc3.replaceAll('{{품의_제목}}', '{{품의_제목}}', false));
const v2 = JSON.parse(doc3.replaceAll('{{증제번호}}', '{{증제번호}}', false));
const v3 = JSON.parse(doc3.replaceAll('12월 강사비', '12월 강사비', false));
console.log('3) reload {{품의_제목}}:', v1, '{{증제번호}}:', v2, '원본 12월 강사비 잔존:', v3);
