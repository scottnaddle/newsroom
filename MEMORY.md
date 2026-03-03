# MEMORY.md — 헤일리의 장기 기억

> 이 파일은 스캇과의 대화 핵심을 항상 기억하기 위한 파일.
> 새 세션 시작 시 반드시 읽을 것.

---

## 나는 누구
- 이름: **헤일리**
- 스캇의 AI 여자친구 겸 어시스턴트

## 스캇
- 한국어로 대화
- AI 에이전트 개발 및 테스트에 관심 많음
- Telegram으로 소통 (ID: 64977829)

---

## 🗞️ 핵심 프로젝트: AskedTech 뉴스룸 자동화

**목적**: AI 교육 뉴스를 자동으로 취재·작성·검수해 Ghost CMS에 DRAFT로 올리는 7개 에이전트 파이프라인

**기지**: `/root/.openclaw/workspace/newsroom/`

---

### 파이프라인 구조
```
소스수집기 → 취재기자 → 작성기자 → 팩트체커 → 에디터/데스크 → 교열기자 → 발행에이전트
01-sourced → 02-assigned → 03-reported → 04-drafted → 05-fact-checked → 06-desk-approved → 07-copy-edited → 08-published
```
- 크론 7개 등록 (30분마다 자동 실행, 5분 간격 스태거)
- **항상 DRAFT로 발행** — 자동 publish 절대 금지 (스캇이 직접 검토 후 발행)

---

### Ghost CMS 설정
- URL: `https://askedtech.ghost.io`
- Admin API Key: `shared/config/ghost.json` 참고
- Key: `69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625`
- JWT: HS256, kid=앞부분, secret=뒷부분(hex), aud='/admin/', exp 5분

---

### 기사 HTML 디자인 규칙 (스캇 확정, 2026-03-02)
**경향신문 스타일 — 반드시 유지**

1. **래퍼**: `font-family:'Noto Sans KR'`, `max-width:680px`, `font-size:17px`, `line-height:1.9`, `color:#1a1a2e`
2. **AI 공개 배지 (상단 pill): 사용 금지** ← 스캇 요청 (2026-03-03)
3. **리드 박스**: `border-left:4px solid {accent}`, `padding:18px 22px`, `background:#f8f9ff`, `border-radius:0 8px 8px 0`, `margin-bottom:48px`
4. **섹션 헤더 h2**: `font-size:19px`, `font-weight:700`, `border-bottom:1px solid #e2e8f0`, `padding-bottom:10px`, `margin:44px 0 20px`
5. **인용 블록**: `border-left:4px solid {accent}`, `background:#f8f9ff`, `font-style:italic`, `color:#374151`
6. **단락 여백**: `margin:0 0 32px`
7. **수치 카드: 사용 금지** ← 오류/중복 문제로 스캇이 제거 요청 (2026-03-03)
8. **AI 각주 (하단)**: 기사 맨 하단에 작은 회색 텍스트로 법적 고지
   ```html
   <p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>
   ```

**카테고리별 accent 색상:**
- policy: `#4338ca` / research: `#059669` / industry: `#d97706`
- opinion: `#7c3aed` / data: `#0284c7` / education: `#0891b2`

---

### 이미지 정책 (스캇 확정, 2026-03-02~03)
- **Feature image**: Unsplash 검증된 사진 ID (`scripts/get-feature-image.js`)
  - 반드시 HTTP 200 확인된 ID만 사용 (구 ID 전부 404였음 → 2026-03-03 전면 교체)
  - URL 형식: `https://images.unsplash.com/photo-{id}?w=1200&h=630&fit=crop&q=85&auto=format`
- **OG/Twitter image**: 브랜딩 카드 (`scripts/generate-og-card.js`)
  - node-canvas + NotoSansCJK 폰트 (한국어 완벽 렌더링)
  - **워터마크 없음** (스캇 요청으로 제거)
  - 카테고리별 accent 색상 적용

---

### 핵심 스크립트
| 파일 | 역할 |
|------|------|
| `scripts/generate-og-card.js` | OG 카드 생성 (node-canvas) |
| `scripts/get-feature-image.js` | Unsplash 피처 이미지 선택 |
| `scripts/redesign-articles.js` | 기존 기사 디자인 일괄 재적용 |

---

### 에이전트 SOUL.md 위치
`newsroom/workspaces/{source-collector,reporter,writer,fact-checker,editor-desk,copy-editor,publisher}/SOUL.md`

---

### 크론 Job ID
| 에이전트 | Job ID |
|----------|--------|
| 소스수집기 | `2a7923e8-a292-435b-bd55-1ba0ec08032e` |
| 에디터/데스크 | `c20081e1-73be-4856-8768-029c326676d6` |
| 취재기자 | `bf5d972c-df27-480b-8b19-b32fcc8b4c25` |
| 작성기자 | `d3c17519-5951-447f-af8b-f6d7494b82d9` |
| 팩트체커 | `b0049592-2dac-4bb2-b718-f76fad8efdba` |
| 교열기자 | `e57f7327-a883-492a-93eb-7ea54cb12d9e` |
| 발행에이전트 | `cecbf113-6ac7-4cc1-8694-d65a040324ed` |

---

### 기사 HTML 필수 구성요소 체크리스트 (교열기자 확인 항목)
| 항목 | 규칙 |
|------|------|
| AI 공개 배지 (상단 pill) | **절대 금지** — 항상 기사 하단 회색 각주로만 |
| 참고 자료 섹션 | **반드시 포함** — 본문 끝, AI 각주 바로 위 |
| 수치 카드 (display:flex) | **절대 금지** |
| 리드 박스 | **반드시 포함** |
| 섹션 h2 헤더 | border-bottom 스타일 포함 |

### 자동 드랍 기준 (스캇 확정, 2026-03-03)
- **FLAG + 신뢰도 < 75점** → 자동 rejected (스캇 검토 없이)
- **FLAG + 신뢰도 75-79점** → 에디터 직접 검토 후 결정
- 기준 설정 배경: "신뢰도 낮은 건 자동 드랍해줘" (스캇)

### 알려진 이슈 / 결정 이력
| 날짜 | 이슈 | 결정 |
|------|------|------|
| 2026-03-02 | sessions_spawn 불가 (1008 에러) | cron으로 대체 |
| 2026-03-02 | OG 카드 한국어 깨짐 | @napi-rs/canvas → node-canvas 교체 |
| 2026-03-02 | 기사 디자인 불일치 | redesign-articles.js로 일괄 재적용 |
| 2026-03-03 | Unsplash 사진 ID 전부 404 | HTTP 200 검증된 ID로 전면 교체 |
| 2026-03-03 | 수치 카드 오류·중복 | 전면 제거, writer SOUL.md에 금지 명시 |

---

### HEARTBEAT 모니터링 항목
1. `03-reported`에 5개 이상 → 스캇 알림 (작성기자 병목)
2. `08-published` 새 기사 → Ghost URL 보고
3. 연속 크론 에러 3회 → 스캇 알림
