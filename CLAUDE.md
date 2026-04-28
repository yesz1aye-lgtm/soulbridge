# 문서 자동 생성 프로젝트

학교(소울브릿지학교)의 행정 문서(품의결의서 등)를 영수증/PDF/메모 같은 원본 자료로부터 한글(.hwp) 양식으로 자동 생성한다.

---

## 🟢 세션 시작 시 — 반드시 먼저 물어볼 것

**대화 첫 응답에서, 다른 어떤 작업보다 먼저 다음을 묻는다:**

> "사용자세요, 개발자세요?"

답변에 따라 모드가 결정되고, 그 세션 동안 유지된다. (중간에 "개발자로 바꿔줘" 같은 요청이 오면 전환 가능)

---

## 모드별 동작 규칙

### 👤 사용자 모드 (클라이언트 — 선생님)

**역할**: 실제 문서를 생성한다.

**입력**: 영수증 사진, PDF, 텍스트 메모, 자연어 설명 등 자유 형식
**출력**: `output/` 폴더의 .hwp 파일

**동작 원칙**:
1. 사용자가 자료를 주면 → Read/이미지 분석으로 내용 추출 → 양식 필드 채워서 .hwp 생성
2. 모르는 정보는 **추측하지 말고 물어본다** (예: "지출일이 적혀있지 않은데 언제로 할까요?")
3. 코드/터미널 명령은 **숨긴다** (사용자에게 노출 X). 내부적으로 Node 스크립트 실행
4. **에러/문제 발생 시** → 사용자에게 알리고, `fix_request/` 폴더에 다음 형식으로 기록:
   - 파일명: `YYYY-MM-DD_간단한제목.md`
   - 내용: 발생한 일, 원본 입력, 기대 결과, 실제 결과, 사용자가 알려준 추가 정보
   - 그러고 나서 사용자에게 "개발자가 다음 세션에서 처리할 수 있게 정리해두었습니다"라고 안내
5. **codex 호출 금지** (클라이언트 환경에 codex 없음)

### 🛠️ 개발자 모드 (현재 세션 — 정준영)

**역할**: 코드 작성·수정·확장.

**시작 동작**:
1. `fix_request/` 폴더 확인. 처리 안 된 항목 있으면 우선순위로 안내
2. 아래 명세대로 작업 진행

**도구**:
- codex CLI 사용 가능 (`codex exec "..."`로 헤드리스 호출 — 아키텍처 의견, 코드 리뷰 등)
- 직접 코드 수정, 의존성 추가, 테스트 모두 가능

---

## 기술 스택

- **런타임**: Node.js 20+ (ESM)
- **HWP 처리**: [`@rhwp/core`](https://www.npmjs.com/package/@rhwp/core) — Rust+WASM 기반. .hwp/.hwpx 모두 읽기·편집·쓰기 지원
- **PDF 텍스트 추출**: `pdftotext` (poppler) — 입력으로 들어온 PDF 영수증 처리
- **언어**: 한국어 (UI/문서/주석 모두)

### @rhwp/core 사용 시 주의사항 (Node.js 환경)

README 예제는 브라우저(Vite) 기반이지만 Node에서도 동작한다. **단, 두 가지 stub 필요**:

```js
import { readFile } from 'node:fs/promises';
import init, { HwpDocument, init_panic_hook } from '@rhwp/core';

// 1. 텍스트 폭 측정 함수 — 브라우저의 canvas 대체
globalThis.measureTextWidth = (font, text) => {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  const size = m ? parseFloat(m[1]) : 12;
  return text.length * size * 0.55;  // 근사값. 렌더링 안 해서 OK
};

// 2. WASM 직접 로드
const wasm = await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url));
await init({ module_or_path: wasm });
init_panic_hook();
```

**핵심 API** (자세한 건 `node_modules/@rhwp/core/rhwp.d.ts`):
- `new HwpDocument(uint8Array)` — 파일 로드
- `doc.replaceAll(query, newText, caseSensitive)` — 전체 치환 (`{{필드명}}` 같은 플레이스홀더에 사용). 결과는 `{"ok":true,"count":N}` JSON 문자열
- `doc.replaceText(sec, para, charOffset, length, newText)` — 위치 기반 치환
- `doc.insertTextInCell(...)`, `doc.insertTableRow(...)` — 표 셀 채우기, 행 추가
- `doc.exportHwp()` — Uint8Array 반환 (.hwp 바이너리)
- `doc.exportHwpx()` — .hwpx 형식

---

## 폴더 구조

```
.
├── CLAUDE.md                # 이 파일
├── package.json
├── templates/
│   └── 품의결의서/
│       ├── template.hwp     # 빈 양식 (플레이스홀더 포함)
│       └── README.md        # 양식별 필드 정의·예시
├── input/                   # 사용자가 던지는 원본 자료 (영수증 사진, PDF, 메모)
├── output/                  # 생성된 최종 .hwp 파일
├── scripts/
│   └── fill-hwp.mjs         # 범용 hwp 채우기 스크립트
├── fix_request/             # 사용자 모드에서 발생한 문제 기록 (개발자 모드가 처리)
│   └── README.md
└── 03. 품의결의서/           # 원본 예시 (참조용)
```

---

## 양식 추가/수정 규칙

새 양식을 만들 땐:
1. `templates/양식명/` 폴더 생성
2. 빈 .hwp 양식 파일 준비 — 채워질 자리에 `{{필드명}}` 플레이스홀더 삽입
3. `templates/양식명/README.md`에 필드 목록·예시·표 행 패턴 정의
4. 필요하면 `scripts/`에 양식별 helper 스크립트 추가 (보통은 범용 fill-hwp.mjs로 충분)

플레이스홀더는 `{{...}}` 형식으로 통일. `replaceAll`로 일괄 치환되므로 `<hp:run>` 분리 함정 자동 해결 (기존 명세 8.1은 무시 가능 — rhwp가 처리).

---

## fix_request 처리 워크플로우

1. **사용자 모드** Claude가 문제 인식 → `fix_request/2026-04-27_지출일_누락_처리.md` 같은 식으로 기록 → 사용자에게 알림
2. 사용자가 다음 번에 개발자(정준영)에게 전달
3. **개발자 모드** Claude가 세션 시작 시 `fix_request/` 확인 → 항목별 처리 → 처리 후 파일을 `fix_request/done/`으로 이동
