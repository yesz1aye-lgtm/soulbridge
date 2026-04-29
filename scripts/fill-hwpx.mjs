// hwpx XML 직접 치환 방식으로 품의결의서 생성
// raw.hwpx(ZIP+XML) → 값 치환 → output.hwpx
//
// 사용법:
//   node scripts/fill-hwpx.mjs <raw.hwpx> <values.json> <out.hwpx>

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import JSZip from 'jszip';

const [, , srcPath, valuesPath, outPath] = process.argv;
if (!srcPath || !valuesPath || !outPath) {
  console.error('usage: node scripts/fill-hwpx.mjs <raw.hwpx> <values.json> <out.hwpx>');
  process.exit(1);
}

const rawData = await readFile(srcPath);
const values = JSON.parse(await readFile(valuesPath, 'utf-8'));
const zip = await JSZip.loadAsync(rawData);
let xml = await zip.file('Contents/section0.xml').async('string');

// <hp:t>텍스트</hp:t> 노드 정확히 치환 (부분 매칭 방지)
function replaceNode(xml, from, to) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<hp:t>${escaped}</hp:t>`, 'g');
  const result = xml.replace(re, `<hp:t>${to}</hp:t>`);
  const count = (xml.match(re) || []).length;
  return { xml: result, count };
}

// 첫 번째 occurrence만 치환 (동일 값이 여러 곳에 쓰일 때 순서 제어용)
function replaceNodeOnce(xml, from, to) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<hp:t>${escaped}</hp:t>`);
  const before = xml;
  const result = xml.replace(re, `<hp:t>${to}</hp:t>`);
  return { xml: result, count: before !== result ? 1 : 0 };
}

const log = [];
function apply(xml, from, to, label = '') {
  const { xml: newXml, count } = replaceNode(xml, from, to);
  const mark = count > 0 ? '✓' : '✗';
  log.push(`${mark} (${count}회) ${label || from.slice(0, 40)} → ${String(to).slice(0, 40)}`);
  return newXml;
}
function applyOnce(xml, from, to, label = '') {
  const { xml: newXml, count } = replaceNodeOnce(xml, from, to);
  const mark = count > 0 ? '✓' : '✗';
  log.push(`${mark} (once) ${label || from.slice(0, 40)} → ${String(to).slice(0, 40)}`);
  return newXml;
}

const v = values;

// ─── 품의서 ───────────────────────────────────────────────────────────────
xml = apply(xml, '제목 : 12월 강사비 (보통교과목,대안교과목) 지급 건', `제목 : ${v.품의_제목}`, '품의서 제목');
xml = apply(xml, '1. 서울시교육청지원금 &gt; 교육운영비 &gt; 강사수당', `1. ${v.관} &gt; ${v.항} &gt; ${v.목} &gt; ${v.세목}`, '예산분류');
xml = apply(xml, '2. 12월 강사(보통교과, 대안교과)비 지급 관련', `2. ${v.지출건명} 관련`, '품의서 내용');
xml = apply(xml, '- 참고, 강사비지급조서, 출근부', '', '불필요 문구 삭제');
xml = apply(xml, '  가. 지출 내역', '', '불필요 문구 삭제');
xml = apply(xml, '   3. 지급방법 : 계좌이체', `   3. 지급방법 : ${v.지출방법}`, '품의서 지급방법');
xml = apply(xml, '시행번호:  제 2025-366호   (2025. 12. 10)',
  `시행번호:  제 ${v.증제번호}   (${v.시행일자})`, '시행번호');

// ─── 결의서 메인 필드 ─────────────────────────────────────────────────────
xml = apply(xml, '증제  2025-366호', `증제  ${v.증제번호}`, '증제번호');
xml = apply(xml, '(교과목강사/강사수당)', `(${v.세목})`, '지출과목 카테고리');
xml = apply(xml, '12월 강사비 지급', v.지출건명, '지출건명');

// 관/항/목/세목 (exact node)
xml = apply(xml, '서울시교육청지원금', v.관, '관');
xml = apply(xml, '교육운영비', v.항, '항');
xml = apply(xml, '강사수당', v.목, '목');

// 지출일 · 이체실행일
xml = apply(xml, '2025.12.15', v.지출일, '지출일/이체실행일');

// 지출방법 체크박스
if (v.지출방법 === '카드결제') {
  xml = apply(xml, '□카드결제  ', '■카드결제  ', '지출방법 체크박스');
} else {
  xml = apply(xml, '□카드결제  ', '□카드결제  ', '지출방법 유지');
  xml = apply(xml, '계좌이체', '계좌이체', '계좌이체 유지');
}

// 금액
xml = apply(xml, '일금 칠백사십이만육천오백육십원정(￦', `일금 ${v.금액_한글}(￦`, '금액 한글');

// 7,426,560이 XML 순서상 3곳: [1]품의서합계행 [2]결의서금액셀 [3]결의서합계행
// 각각 다른 값으로 치환
xml = applyOnce(xml, '7,426,560', v.수량합계 || '22', '품의서 합계행 수량합계');
xml = applyOnce(xml, '7,426,560', v.금액_숫자, '결의서 금액셀');
xml = applyOnce(xml, '7,426,560', v.수량합계 || '22', '결의서 합계행 수량합계');

xml = apply(xml, '253,440', '', '원천세합계 삭제');
xml = apply(xml, '7,680,000', v.금액_숫자, '지급액합계→금액합계');

// 결의서 내용
xml = apply(xml, '12월 보통교과, 대안교과목 수업 강사비 지급.', `${v.지출건명}.`, '결의서 내용');
xml = apply(xml, '1. 지출금액: 금 7,426,560원', '', '지출금액 문구 삭제');
xml = apply(xml, '2. 구입 세부내역', '', '불필요 문구 삭제');
xml = apply(xml, '3. 지급 방법 : 계좌이체', `3. 지급 방법 : ${v.지출방법}`, '결의서 지급방법');

// 첨부서류
xml = apply(xml, '강사출근부, 지급조서, 세금영수증, 송금확인증 첨부', v.첨부서류, '첨부서류');

// ─── 내역 표 헤더 ─────────────────────────────────────────────────────────
xml = apply(xml, '성함', v.표헤더?.col1 || '교재명', '표 헤더 col1');
xml = apply(xml, '과목', v.표헤더?.col2 || '출판사', '표 헤더 col2');
xml = apply(xml, '실지급액', v.표헤더?.col3 || '수량', '표 헤더 col3');
xml = apply(xml, '원천세', v.표헤더?.col4 || '단가', '표 헤더 col4');
xml = apply(xml, '지급액', v.표헤더?.col5 || '금액', '표 헤더 col5');

// ─── 내역 행 1 (교과서 1) ─────────────────────────────────────────────────
const r1 = (v.내역 || [])[0] || {};
xml = apply(xml, '조용웅', r1.col1 || '', '행1 교재명');
xml = apply(xml, '국어',   r1.col2 || '', '행1 출판사');
xml = apply(xml, '464,160', r1.col3 || '', '행1 수량');
xml = apply(xml, '15,840',  r1.col4 || '', '행1 단가');
xml = apply(xml, '480,000', r1.col5 || '', '행1 금액');

// ─── 내역 행 2 (교과서 2) ─────────────────────────────────────────────────
const r2 = (v.내역 || [])[1] || {};
xml = apply(xml, '김연옥', r2.col1 || '', '행2 교재명');
xml = apply(xml, '수학',   r2.col2 || '', '행2 출판사');
xml = apply(xml, '618,880', r2.col3 || '', '행2 수량');
xml = apply(xml, '21,120',  r2.col4 || '', '행2 단가');
xml = apply(xml, '640,000', r2.col5 || '', '행2 금액');

// ─── 나머지 행(3-9) 삭제 ──────────────────────────────────────────────────
const clearNames = ['김혜영', '오지혜', '이효원', '소산', '최정민', '정해리', '김호빈'];
const clearSubj = ['사회', '과학', '영어', '대안', '(공동체활동)', '(건강및운동생활)', '(미술심리,자기성장프로젝트)', '(생활과인성)'];
const clearNums = ['928,320', '31,680', '960,000', '232,080', '7,920', '240,000',
                   '2,320,800', '79,200', '2,720,000', '696,240', '23,760', '720,000'];

for (const name of clearNames) xml = apply(xml, name, '', `강사명 삭제: ${name}`);
for (const subj of clearSubj) xml = apply(xml, subj, '', `과목 삭제: ${subj}`);
for (const num of clearNums)  xml = apply(xml, num,  '', `금액 삭제: ${num}`);

// ─── PrvText.txt 업데이트 (한컴 변조 감지 우회) ──────────────────────────
const prvLines = [
  `서울시교육청 대안교육 위탁교육기관 소울브릿지학교`,
  `<수신 : 내부결재(지출품의서) 제목 : ${v.품의_제목}>`,
  `<>`,
  `<  1. ${v.관} &gt; ${v.항} &gt; ${v.목} &gt; ${v.세목} 2. ${v.지출건명} 관련>`,
  `<교재명><출판사><수량><단가><금액>`,
  `<1><${(v.내역||[])[0]?.col1||''}><${(v.내역||[])[0]?.col2||''}><${(v.내역||[])[0]?.col3||''}><${(v.내역||[])[0]?.col4||''}><${(v.내역||[])[0]?.col5||''}>`,
  `<2><${(v.내역||[])[1]?.col1||''}><${(v.내역||[])[1]?.col2||''}><${(v.내역||[])[1]?.col3||''}><${(v.내역||[])[1]?.col4||''}><${(v.내역||[])[1]?.col5||''}>`,
  `<시행번호:  제 ${v.증제번호}   (${v.시행일자})>`,
  `<[2025년도 소울브릿지학교 회계]>`,
  `<증제  ${v.증제번호}>`,
  `<(${v.세목})><${v.지출건명}>`,
  `<${v.관}><지출일><${v.지출일}>`,
  `<${v.항}><${v.목}>`,
  `<금액><일금 ${v.금액_한글}(￦><${v.금액_숫자}>`,
  `<${v.지출건명}.>`,
  `<첨부><서류><${v.첨부서류}>`,
  `<상기와 같이 지출 처리코자 함.>`,
];
zip.file('Preview/PrvText.txt', prvLines.join('\n'), { binary: false });

// ─── 출력 ────────────────────────────────────────────────────────────────
console.log('=== fill-hwpx 치환 결과 ===');
log.forEach(l => console.log(' ', l));

// 빈 hp:t 태그 → 공백으로 (한컴이 빈 태그 거부)
xml = xml.replace(/<hp:t><\/hp:t>/g, '<hp:t> </hp:t>');

// linesegarray 초기화 → 한컴이 열 때 텍스트 크기 자동 재계산
xml = xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '<hp:linesegarray/>');

zip.file('Contents/section0.xml', Buffer.from(xml, 'utf8'));
const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });

const outDir = dirname(outPath);
if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
await writeFile(outPath, outBuf);
console.log(`\n✓ 저장: ${outPath}`);
