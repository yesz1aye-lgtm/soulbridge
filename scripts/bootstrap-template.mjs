// raw.hwp(케이스 366호 그대로) → template.hwp ({{필드명}} 플레이스홀더)
// 1차 치환 가능한 필드만 대상. 표 안의 가변 데이터(강사 9명 행)·지출일·이체실행일·지출과목 셀은 v2에서 처리.

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

const root = '/Users/junyoung/Desktop/work/01_ai_product/05_ai_document_transfer/templates/품의결의서';
const data = await readFile(`${root}/raw.hwp`);
const doc = new HwpDocument(new Uint8Array(data));

// [원문, 플레이스홀더] — replaceAll 사용. 원문이 unique해야 의도치 않은 치환을 피함
const replacements = [
  ['2025-366',                                            '{{증제번호}}'],
  ['2025. 12. 10',                                        '{{시행일자}}'],
  ['(교과목강사/강사수당)',                                  '({{지출과목_카테고리}})'],
  ['12월 강사비 지급',                                      '{{지출건명}}'],
  ['일금 칠백사십이만육천오백육십원정',                         '{{금액_한글}}'],
  ['7,426,560',                                           '{{금액_숫자}}'],
  ['12월 강사비 (보통교과목,대안교과목) 지급 건',                '{{품의_제목}}'],
  ['강사출근부, 지급조서, 세금영수증, 송금확인증 첨부',           '{{첨부서류}}'],
];

console.log('=== Replacing fields ===');
for (const [from, to] of replacements) {
  const r = doc.replaceAll(from, to, false);
  const parsed = JSON.parse(r);
  const status = parsed.count > 0 ? '✓' : '✗ (NOT FOUND)';
  console.log(`${status} count=${parsed.count} | ${from.slice(0,40)} -> ${to}`);
}

const outPath = `${root}/template.hwp`;
await writeFile(outPath, doc.exportHwp());
console.log(`\nWrote ${outPath}`);
