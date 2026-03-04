# UBION AI & EDTECH 뉴스룸 운영 전략 보고서

> **작성일**: 2026년 3월 4일  
> **서비스**: [ubion.ghost.io](https://ubion.ghost.io)  
> **버전**: v1.2

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [기술 아키텍처](#2-기술-아키텍처)
3. [콘텐츠 파이프라인](#3-콘텐츠-파이프라인)
4. [에이전트 구성](#4-에이전트-구성)
5. [콘텐츠 전략](#5-콘텐츠-전략)
6. [품질 관리 기준](#6-품질-관리-기준)
7. [발행 정책](#7-발행-정책)
8. [디자인 가이드](#8-디자인-가이드)
9. [운영 모니터링](#9-운영-모니터링)
10. [향후 로드맵](#10-향후-로드맵)

---

## 1. 서비스 개요

### 서비스 정의
UBION AI & EDTECH는 AI 기술이 교육 분야에 미치는 영향을 전문적으로 다루는 **AI 자동화 뉴스 서비스**입니다. UBION의 20년 에듀테크·ODA 전문성을 바탕으로, 글로벌 AI 교육 동향을 한국 에듀테크 산업 관점에서 해석·제공합니다.

### 핵심 차별점

| 구분 | 일반 AI 뉴스레터 | UBION AI & EDTECH |
|------|----------------|-------------------|
| 대상 | 일반 독자 | 교육 정책 담당자, 에듀테크 종사자, 교사 |
| 관점 | 기술 중심 | **교육·에듀테크 산업 영향 중심** |
| 소스 | 국내 중심 | 글로벌 (미국·영국·인도·UAE·아시아) |
| 제작 방식 | 수동 편집 | **7단계 AI 에이전트 자동화 파이프라인** |
| 투명성 | 미고지 | AI 기본법 제31조 준수, AI 작성 전면 공개 |

### 콘텐츠 카테고리

```
ubion.ghost.io
├── AI 교육 (/tag/ai-edu/)          — 글로벌 AI 교육 뉴스 (주력)
├── AI 다이제스트 (/tag/ai-digest/) — AI 기술 뉴스 + 에듀테크 시사점
└── 에듀테크 인사이트 (/tag/edu-insight/) — 일일 심층 논설 (featured)
```

---

## 2. 기술 아키텍처

### 인프라 구성

```
┌─────────────────────────────────────────────────────┐
│              Contabo VPS (vmi3116086)                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │          OpenClaw Gateway                   │   │
│  │   (AI 에이전트 오케스트레이션 플랫폼)           │   │
│  │                                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │ Cron     │  │ Agents   │  │ Memory   │  │   │
│  │  │ Scheduler│  │ (Claude) │  │ Files    │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────┘   │
│                        │                           │
│                        ▼                           │
│  ┌─────────────────────────────────────────────┐   │
│  │     파일 기반 파이프라인                        │   │
│  │  /workspace/newsroom/pipeline/               │   │
│  └─────────────────────────────────────────────┘   │
│                        │                           │
└────────────────────────┼────────────────────────────┘
                         ▼
              Ghost CMS (ubion.ghost.io)
```

### 핵심 기술 스택

- **AI 엔진**: Anthropic Claude (Sonnet 4.6 / Opus 4.6)
- **에이전트 플랫폼**: OpenClaw (자체 호스팅)
- **CMS**: Ghost Pro (ubion.ghost.io)
- **뉴스 수집**: Brave Search API
- **서버**: Contabo VPS (Linux 6.8.0, Node.js v24)
- **언어**: Korean (한국어), 일부 영문 소스

### 파이프라인 저장소

```
/root/.openclaw/workspace/newsroom/
├── pipeline/           # 교육 파이프라인 (8단계)
│   ├── 01-sourced/
│   ├── 02-assigned/
│   ├── 03-reported/
│   ├── 04-drafted/
│   ├── 05-fact-checked/
│   ├── 06-desk-approved/
│   ├── 07-copy-edited/
│   ├── 08-published/
│   └── rejected/
├── pipeline/digest/    # AI Digest 파이프라인 (3단계)
│   ├── 01-sourced/
│   ├── 02-drafted/
│   ├── 03-published/
│   └── rejected/
├── pipeline/insight/   # 에듀테크 인사이트 발행 기록
├── reviews/            # 주간 리뷰 기록
├── workspaces/         # 에이전트 SOUL.md
├── shared/config/      # 공유 설정 (소스, Ghost API)
└── scripts/            # 유틸리티 스크립트
```

---

## 3. 콘텐츠 파이프라인

### 3.1 교육 뉴스 파이프라인 (7-에이전트, 8단계)

```
뉴스 소스 발견
      │
      ▼
[01] 소스 수집기 ──── Brave Search로 국내외 AI 교육 뉴스 수집
      │               한국어 쿼리 15개 + 영어 쿼리 15개
      │               중복 제거 (48시간 dedup window)
      ▼
[02] 배정 (editor-desk) ── 기사 가치 평가, 취재 방향 설정
      │
      ▼
[03] 취재기자 (reporter) ── web_fetch로 원문 심층 취재
      │                     취재 브리프 작성
      ▼
[04] 작성기자 (writer) ──── 한국어 기사 초안 작성
      │                     경향신문 스타일 HTML
      ▼
[05] 팩트체커 ──────────── 사실 주장 검증 (최대 10개)
      │                   신뢰도 점수 산출
      ▼
[06] 데스크 승인 ────────── 신뢰도별 처리:
      │                   • 90점+ → 패스트트랙 (07 건너뜀)
      │                   • 80-89점 → 전체 검토 후 승인
      │                   • 75-79점 → FLAG (에디터 검토)
      │                   • 75점 미만 → 자동 드랍
      ▼
[07] 교열기자 ──────────── 맞춤법·문체·스타일 최종 점검
      │
      ▼
[08] 발행 에이전트 ─────── Ghost CMS 즉시 발행 (published)
                           피처 이미지 자동 선택
                           태그·slug·메타 자동 설정
```

**처리 속도 (최적화 후)**:
- 소스 → 발행: **평균 45분~1시간** (기존 3.5시간)
- 배치 크기: writer 5개/회, fact-checker 5개/회, copy-editor 8개/회
- 패스트트랙: 신뢰도 90점+ 기사는 교열 단계 건너뜀

### 3.2 AI Digest 파이프라인 (3-에이전트)

```
[01] Digest 수집기 ─── 일반 AI 뉴스 수집 (1시간 주기)
      │                관련성 점수 85점+ 만 통과 (엄선)
      ▼
[02] Digest 작성기 ─── 한국어 요약 (500~700자)
      │                + 에듀테크 시사점 섹션 필수
      ▼
[03] Digest 발행기 ─── Ghost 즉시 발행, ai-digest 태그
```

### 3.3 에듀테크 인사이트 파이프라인 (일일 논설)

```
매일 KST 20:00
      │
[analyst 에이전트] ─── 당일 발행 기사 3개 이상 확인
      │                 국내 에듀테크 영향 큰 기사 선정
      │                 800~1,200자 심층 논설 작성
      ▼
Ghost 발행 (featured: true)
ai-edu + edu-insight 태그
```

---

## 4. 에이전트 구성

### 4.1 교육 파이프라인 에이전트

| 에이전트 | 역할 | 실행 주기 | 모델 |
|---------|------|---------|------|
| source-collector | 국내외 AI 교육 뉴스 수집 | 30분 | Sonnet |
| reporter | 원문 취재, 브리프 작성 | 15분 | Sonnet |
| writer | 한국어 기사 초안 | 10분 | Sonnet |
| fact-checker | 사실 검증, 신뢰도 점수 | 15분 | Sonnet |
| editor-desk | 데스크 승인/반려/드랍 | 15분 | Sonnet |
| copy-editor | 교열, 최종 스타일 | 10분 | Sonnet |
| publisher | Ghost CMS 발행 | 10분 | Sonnet |

### 4.2 AI Digest 에이전트

| 에이전트 | 역할 | 실행 주기 | 모델 |
|---------|------|---------|------|
| digest-collector | AI 뉴스 수집 (85점+ 필터) | 1시간 | Sonnet |
| digest-writer | 한국어 요약 + 에듀테크 시사점 | 30분 | Sonnet |
| digest-publisher | Ghost 발행 | 30분 | Sonnet |

### 4.3 특수 에이전트

| 에이전트 | 역할 | 실행 시각 | 모델 |
|---------|------|---------|------|
| analyst | 에듀테크 인사이트 일일 논설 | KST 20:00 | Sonnet |
| reviewer | 주간 서비스 리뷰 + 개선 제안 | 매주 월 KST 10:00 | **Opus** |

### 4.4 지원 크론

| 크론 | 역할 | 실행 시각 |
|------|------|---------|
| 일일 브리핑 | 오늘의 주요 기사 요약 → Telegram | KST 09:00 |

---

## 5. 콘텐츠 전략

### 5.1 소스 전략

**국내 소스** (한국어 쿼리 15개):
- 교육부 AI 정책, 에듀테크 산업, 대학 AI 교육
- AI 기본법, 디지털교육, K-12 AI

**해외 소스** (영어 쿼리 15개):
- AI education policy US/UK/EU
- EdTech funding, AI in K-12, higher education AI
- OECD AI education, UNESCO AI guidelines

**dedup 기준**: 48시간 내 동일 URL 재수집 방지

### 5.2 태그 체계

```
필수 태그:
├── AI 교육 (ai-edu) — 모든 교육 파이프라인 기사
├── ai-digest — 모든 Digest 기사
└── 에듀테크 인사이트 (edu-insight) — 논설 기사

자동 분류 태그:
├── 교육정책
├── 고등교육 (대학/대학원 관련 → featured: true)
├── K-12
├── 에듀테크산업
└── 글로벌AI교육
```

### 5.3 Featured 정책

다음 키워드 포함 시 `featured: true` 자동 설정:
- 대학, 대학원, 고등교육, 대입, 학부
- university, college, higher education

에듀테크 인사이트 논설은 항상 `featured: true`

### 5.4 AI Digest 차별화 원칙

일반 AI 뉴스레터(모두레터, AI코리아 등)와 차별화를 위해:
- 모든 Digest 기사에 **`🎓 에듀테크 시사점`** 섹션 필수
- 수집 기준: 관련성 점수 **85점 이상** (엄선)
- 교육/에듀테크와 연결점 없는 뉴스는 작성 거부

---

## 6. 품질 관리 기준

### 6.1 팩트체크 판정 기준

| 점수 | 판정 | 처리 방식 |
|------|------|---------|
| 90점+ | PASS (우수) | 패스트트랙 → 교열 건너뜀 |
| 80~89점 | PASS (양호) | 전체 검토 후 승인 |
| 75~79점 | FLAG | 에디터 검토 필요 |
| 75점 미만 | FAIL | **자동 드랍** (rejected/) |

### 6.2 기사 품질 기준

**필수 요소**:
- ✅ 한국어 제목 (최대 30자)
- ✅ 클릭베이트 금지
- ✅ 출처 링크 (원문 URL)
- ✅ AI 공개 각주 (`본 기사는 AI가 작성했습니다 (AI 기본법 제31조)`)
- ✅ 피처 이미지 (Unsplash 검증 ID, 중복 방지)
- ✅ 영문 slug (파이프라인 파일명 기반)

**금지 사항**:
- ❌ 수치 카드 (`display:flex` 도표)
- ❌ 상단 AI 공개 배지 pill
- ❌ 영문 제목 그대로 발행
- ❌ 출처 없는 기사 발행

### 6.3 수정 정책

- 최대 수정 횟수: **2회**
- 2회 초과 시 → `rejected/`로 이동
- 신뢰도 75 미만 → 검토 없이 자동 드랍

### 6.4 피처 이미지 정책

- Unsplash 검증 ID 풀 (45개, HTTP 200 확인)
- 카테고리별 배분: policy 12개, education 13개, industry 10개, research 9개, data 8개, opinion 6개
- `used-images.json` 추적으로 중복 방지
- 카테고리 소진 시 전체 풀에서 미사용 선택

---

## 7. 발행 정책

### 7.1 발행 상태

| 파이프라인 | 발행 상태 | 이유 |
|----------|---------|------|
| 교육 기사 | `published` (즉시) | 품질 안정화 확인 후 즉시 공개 전환 |
| AI Digest | `published` (즉시) | 뉴스 속보성 중시 |
| 에듀테크 인사이트 | `published` (즉시) | 일일 논설 |

### 7.2 발행 대상 기사 조건

교육 파이프라인:
- 이미지 있는 기사만 published 유지 (없으면 draft)
- 한국어 제목 기사만 (영문 제목 기사는 취재 단계에서 한국어화)

### 7.3 AI 공개 규정 (AI 기본법 제31조)

모든 기사에 하단 각주 형식으로 표시:
```html
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;
  font-size:13px;color:#cbd5e1;">
  본 기사는 AI가 작성했습니다 (AI 기본법 제31조)
</p>
```

상단 AI 배지 pill **금지** — 하단 각주만 허용

---

## 8. 디자인 가이드

### 8.1 기본 스타일 (경향신문 스타일)

```css
font-family: 'Noto Sans KR', Apple SD Gothic Neo, sans-serif;
font-size: 17px;
line-height: 1.9;
color: #1a1a2e;
max-width: 680px;
margin: 0 auto;
```

### 8.2 섹션 구분선

```html
<h2 style="font-size:18px;font-weight:700;color:#111;
  border-bottom:1px solid #e2e8f0;padding-bottom:8px;
  margin:36px 0 16px;">섹션 제목</h2>
```

### 8.3 카테고리별 배지

| 카테고리 | 색상 | 배지 |
|---------|------|------|
| AI 교육 기사 | - | 없음 (배지 금지) |
| AI Digest | `#FF6B35` (오렌지) | ⚡ AI Digest |
| 에듀테크 인사이트 | `#0F766E` (틸) | 🔍 에듀테크 인사이트 |

### 8.4 Ghost 태그 색상

| 태그 | slug | 색상 |
|------|------|------|
| AI 교육 | ai-edu | `#4338CA` (인디고) |
| AI Digest | ai-digest | `#FF6B35` (오렌지) |
| 에듀테크 인사이트 | edu-insight | `#0F766E` (틸) |

---

## 9. 운영 모니터링

### 9.1 일일 브리핑 (KST 09:00)

매일 아침 Telegram으로 전송:
- 전날 발행 기사 수 및 목록
- 파이프라인 현황 (단계별 적체 현황)
- 주요 이슈

### 9.2 주간 서비스 리뷰 (매주 월 KST 10:00)

Opus 모델이 5개 차원 분석 후 Telegram으로 보고:

| 차원 | 분석 내용 |
|------|---------|
| 콘텐츠 차별성 | 경쟁 서비스 대비 독보적 콘텐츠 여부 |
| 저널리즘 품질 | 출처, 정확성, 심층성 |
| 독자 경험 | 사이트 구조, 검색, 태그, URL |
| 발행 속도·일관성 | 파이프라인 적체, 발행 주기 |
| 성장 잠재력 | SEO, 소셜, 구독 요소 |

→ 개선 제안 3개 → 스캇 컨펌(✅/❌) → 자동 적용

### 9.3 파이프라인 상태 확인 방법

```bash
cd /root/.openclaw/workspace/newsroom
for dir in 01-sourced 02-assigned 03-reported 04-drafted \
           05-fact-checked 06-desk-approved 07-copy-edited \
           08-published rejected; do
  echo "$dir: $(ls pipeline/$dir/*.json 2>/dev/null | wc -l)개"
done
```

---

## 10. 향후 로드맵

### Phase 2 — 콘텐츠 심화 (2026 Q2)

- [ ] **ODA 현장 리포트 연재**: 카자흐스탄·베트남·캄보디아·스리랑카 AI 교육 현장 (UBION 독점 콘텐츠)
- [ ] **Unsplash API 연동**: 키워드 기반 기사 맞춤 이미지 자동 선택 (API 승인 후)
- [ ] **주간 정책 비교 시리즈**: "이번 주 글로벌 AI 교육 정책 한눈에"
- [ ] **"Behind the Newsroom"**: AI 뉴스룸 운영 방식 공개 시리즈

### Phase 3 — 독자 확장 (2026 Q3)

- [ ] **Ghost 뉴스레터 활성화**: 주간 AI 교육 브리핑 (이메일)
- [ ] **LinkedIn/X 자동 발행**: 기사 발행 시 소셜 자동 공유
- [ ] **검색 기능 강화**: Ghost 검색 위젯 활성화
- [ ] **AI 뉴스룸 성능 대시보드**: 월간 생산량·팩트체크 통과율 공개

### Phase 4 — 고도화 (2026 Q4)

- [ ] **Unsplash API → AI 이미지 생성**: 기사별 맞춤 일러스트
- [ ] **개인화 추천**: 독자 관심 분야별 기사 추천
- [ ] **다국어 지원**: 영문 요약 자동 생성 (글로벌 독자 확보)
- [ ] **데이터 저널리즘**: 교육 통계 시각화 자동화

---

## 부록

### A. Ghost Admin API 정보

- **URL**: `https://ubion.ghost.io/ghost/api/admin/`
- **인증**: JWT HS256 (kid + secret, 5분 만료)
- **API 버전**: v5.0

### B. 주요 태그 ID

| 태그 | ID |
|------|-----|
| AI 교육 (ai-edu) | `69a7a9ed659ea80001153c13` |
| AI Digest (ai-digest) | `69a78cc8659ea80001153beb` |
| 에듀테크 인사이트 (edu-insight) | `69a7cb72659ea80001153ede` |

### C. 크론 작업 목록

| 이름 | 크론 ID | 주기 |
|------|--------|------|
| 소스 수집기 | `2a7923e8` | 30분 |
| 에디터/데스크 | `c20081e1` | 15분 |
| 취재기자 | `bf5d972c` | 15분 |
| 작성기자 | `d3c17519` | 10분 |
| 팩트체커 | `b0049592` | 15분 |
| 교열기자 | `e57f7327` | 10분 |
| 발행에이전트 | `cecbf113` | 10분 |
| 일일 브리핑 | `622feb3f` | KST 09:00 |
| digest-collector | `c3248e78` | 1시간 |
| digest-writer | `f378b8a8` | 30분 |
| digest-publisher | `dbe4af0c` | 30분 |
| 에듀테크 인사이트 논설 | `17e11d13` | KST 20:00 |
| 주간 서비스 리뷰 (Opus) | `b8793684` | 매주 월 KST 10:00 |

### D. 백업 정보

- **Git 태그**: `v1.0-stable` (commit `234f1b4`)
- **타볼**: `/root/.openclaw/workspace/backups/newsroom-v1.0-stable.tar.gz`
- **롤백**: `git checkout v1.0-stable`

---

*본 문서는 UBION AI & EDTECH 뉴스룸 운영팀 내부 공유용입니다.*  
*최종 업데이트: 2026-03-04*
