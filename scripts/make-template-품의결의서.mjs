// template.hwp(raw 예시) → 플레이스홀더가 들어간 진짜 빈 양식으로 변환
// 원본: 366호 예시 → 결과: templates/품의결의서/template.hwp

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

const src = './templates/품의결의서/raw.hwp';
const out = './templates/품의결의서/template.hwp';

const data = await readFile(src);
const doc = new HwpDocument(new Uint8Array(data));

// [원문, 플레이스홀더] 순서 중요: 긴 문자열 먼저
const replacements = [
  // 품의서
  ['12월 강사비 (보통교과목,대안교과목) 지급 건',     '{{품의_제목}}'],
  ['1. 서울시교육청지원금 > 교육운영비 > 강사수당',    '{{품의_예산분류}}'],
  ['2. 12월 강사(보통교과, 대안교과)비 지급 관련',     '{{품의_본문}}'],
  ['- 참고, 강사비지급조서, 출근부',                   ''],
  ['  가. 지출 내역',                                  ''],
  ['   3. 지급방법 : 계좌이체',                        ''],

  // 결의서 — 지출건명 (줄바꿈 포함 셀: 카테고리 + 건명 나뉨)
  ['(교과목강사/강사수당)',   '({{지출과목_카테고리}})'],
  ['12월 강사비 지급',        '{{지출건명}}'],

  // 지출과목 (관/항/목)
  ['서울시교육청지원금',  '{{관}}'],
  ['교육운영비',          '{{항}}'],
  ['강사수당',            '{{목}}'],

  // 날짜 — 지출일·이체실행일 동일값이면 한 번에 치환 (각각 다를 경우 수동 수정)
  ['2025.12.15',          '{{지출일}}'],

  // 지출방법
  ['□카드결제  계좌이체', '{{지출방법}}'],

  // 금액
  ['일금 칠백사십이만육천오백육십원정', '{{금액_한글}}'],
  ['7,426,560',                          '{{금액_숫자}}'],

  // 결의서 내용
  ['12월 보통교과, 대안교과목 수업 강사비 지급.',  '{{내용}}'],
  ['1. 지출금액: 금 7,426,560원',                  ''],
  ['2. 구입 세부내역',                             ''],
  ['3. 지급 방법 : 계좌이체',                      ''],

  // 첨부서류
  ['강사출근부, 지급조서, 세금영수증, 송금확인증 첨부', '{{첨부서류}}'],

  // 증제번호 + 시행일자 (품의서·결의서 양쪽에 등장)
  ['2025-366',       '{{증제번호}}'],
  ['2025. 12. 10',   '{{시행일자}}'],
];

console.log('=== 플레이스홀더 삽입 ===');
let ok = 0, fail = 0;
for (const [from, to] of replacements) {
  if (!from) continue;
  const r = JSON.parse(doc.replaceAll(from, to, false));
  const mark = r.count > 0 ? '✓' : '✗';
  if (r.count > 0) ok++; else fail++;
  console.log(`${mark} (${r.count}회) "${from.slice(0,35)}" → "${to}"`);
}
console.log(`\n완료: 성공 ${ok}개, 미발견 ${fail}개`);

// 남은 {{ 검사
const leftover = JSON.parse(doc.searchText('{{', 0, 0, 0, true, true));
if (leftover?.found) {
  console.warn(`⚠ 처리 안 된 {{ 존재: sec${leftover.section} para${leftover.para} char${leftover.char_offset}`);
}

await writeFile(out, doc.exportHwp());
console.log(`\n✓ 저장: ${out}`);
