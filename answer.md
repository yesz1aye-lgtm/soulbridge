# 진단 결과 & 진행 방향 — `.hwpx` 우회 경로 채택

> 작성일: 2026-04-28
> 결론: `@rhwp/core` 0.7.7로 .hwp 표 셀 자동 편집 불가 → **.hwpx XML 직접 편집 방식**으로 전환

---

## 1. 진단

`request.md` 1번(품의결의서 template.hwp 플레이스홀더 삽입) 작업 중 다음 라이브러리 한계 확인.

### 검증된 사실 (`scripts/verify-roundtrip.mjs` 실행 결과)

| 단계 | 결과 |
|---|---|
| `replaceAll(...)` 매치 카운트 | ✓ (메모리상 정상 치환) |
| In-memory `searchText`로 변경 확인 | ✓ |
| `exportHwp()` → 다시 로드 → 변경 검색 | ✗ **변경 사라짐** |
| 본문 평문 단락의 `exportHwpx()` round-trip | ✓ (소울브릿지 → TESTSCHOOL 보존) |
| **표 셀 안의 텍스트** `exportHwpx()` round-trip | ✗ **표 자체가 누락되거나 텍스트 손실** |

### 결론
- `@rhwp/core` 0.7.7은 표 셀 텍스트의 직렬화에 결함 있음
- 우리 양식(품의결의서, 행사계획서 등)은 거의 다 표 기반 → **이 라이브러리로는 자동 편집 불가능**
- 같은 엔진을 쓰는 [HOP](https://github.com/golbin/hop)도 우리 use case와 다른 경로(GUI 수동 편집·저장)를 사용

---

## 2. 채택한 방향: `.hwpx` XML 직접 편집

### 핵심 아이디어
`.hwpx`는 단순한 **ZIP + XML** 구조 (.hwp 5.0의 CFB 바이너리와 달리 표준 OOXML 계열). 라이브러리 의존 없이 표준 도구만으로 처리 가능.

```
template.hwpx (ZIP)
├── Contents/
│   ├── header.xml
│   ├── section0.xml   ← 본문 + 표 텍스트가 여기 평문으로 들어감
│   └── ...
├── META-INF/
└── mimetype
```

→ `unzip` → `section0.xml`에서 `{{필드명}}` 텍스트 치환 → `zip`으로 다시 묶기. 한컴 한글이 정상적으로 열음.

### 워크플로우 (전체 흐름)

```
[원본 자료]                    [AI / 스크립트]                [결과물]
영수증 사진          ─┐                                 ┌→ output/품의결의서_407호.hwpx
PDF                  ─┼→ AI가 필드 추출 → 값 JSON ─→ XML 치환 → │
자연어 메모          ─┘     (제목, 금액, 날짜 등)                  └→ (선택) 한컴에서 .hwp로 저장
```

---

## 3. 사용자(정준영)가 한 번만 해주실 것

### 양식 .hwpx 변환 (양식별 5분, 최초 1회만)

라이브러리의 hwp→hwpx 변환은 표 텍스트가 손실되므로 **한컴 한글에서 직접** 해주셔야 함.

**품의결의서**
1. 한컴 한글로 `templates/품의결의서/raw.hwp` 열기
2. `파일 > 다른 이름으로 저장` 또는 `Cmd+Shift+S`
3. 파일 형식을 **HWPX 문서 (*.hwpx)** 선택
4. 같은 폴더에 `raw.hwpx`로 저장

**행사계획서** (request.md 2번 작업할 때)
1. `templates/2025-품의,결의서 392-404호 예시.hwp` 열기
2. 행사계획서 부분만 추출 (또는 별도 행사계획서 .hwp가 있으면 그것)
3. `.hwpx`로 저장 → `templates/행사계획서/raw.hwpx`

### `.hwp` 결과물이 꼭 필요할 때 (선택)
- 학교 행정에서 .hwp 의무면 → 결과 `.hwpx`를 한컴에서 열어 → **다른 이름으로 저장 > .hwp 선택**
- 클릭 3번. 한컴 한글 2014+ 면 `.hwpx` 그대로 제출도 가능 (요즘 표준)

---

## 4. 이번 세션 결과물 처리

`templates/품의결의서/template.hwpx`는 라이브러리로 만들어 **표 텍스트가 손상**된 상태이므로 **삭제**. raw.hwp만 남겨두고, raw.hwpx를 사용자가 만들어주신 후 새 스크립트로 다시 작업.

---

## 5. 다음 세션에서 해야 할 일

사용자가 `templates/품의결의서/raw.hwpx`를 만들어 푸시한 뒤:

1. **`scripts/make-template-품의결의서.mjs` 재작성**
   - `@rhwp/core` 사용 중단
   - `raw.hwpx` unzip → `Contents/section0.xml` 텍스트 치환 → re-zip
   - Node 표준 라이브러리 + `adm-zip` 또는 `jszip` 정도면 충분
   - 결과: `templates/품의결의서/template.hwpx`

2. **`scripts/fill-hwp.mjs` 재작성**
   - 입력: `template.hwpx` + `values.json`
   - 동일 방식으로 XML 치환 후 zip 패킹
   - 출력: `output/...hwpx`

3. **`CLAUDE.md` 업데이트**
   - 기술 스택에서 `@rhwp/core` 제거
   - `.hwpx` ZIP+XML 처리 방식 명시
   - 사용자 모드의 결과물 확장자 `.hwpx`로 변경 (또는 한컴 변환 안내)

---

## 6. 참고: 관련 검증 스크립트

- `scripts/verify-roundtrip.mjs` — .hwp export 결함 재현 (현존 유지)
- `scripts/verify-roundtrip-hwpx.mjs` — .hwpx 평문 단락 보존 확인
- `scripts/probe-hwpx-source.mjs` — 표 셀 텍스트 hwpx export 손실 재현 (이번 세션 작성)
