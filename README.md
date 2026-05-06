# 📰 UBION Newsroom

**Hermes Agent 기반 완전 자동화 AI 뉴스룸 파이프라인**

AI 뉴스 수집 → 작성 → 이미지 생성 → Ghost CMS 발행까지 **완전 자동**으로 처리합니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/Status-Production-green.svg)

---

## ✨ Features

### 🧠 Hermes Agent 기반 파이프라인
- **뉴스 수집기**: Brave Search + RSS로 AI/에듀테크 뉴스 수집
- **기사 작성기**: DeepSeek LLM으로 경향신문 스타일 기사 작성 (1,200~1,800자)
- **팩트체커**: web_search 기반 검증 & 신뢰도 점수
- **교열기자**: 맞춤법, 톤, 명확성 최종 검토
- **발행자**: Ghost CMS에 직접 Published 상태로 발행

### 🎨 AI 이미지 생성 (ComfyUI FLUX.1-schnell)
- **Mac Studio (M4 Max)**: SSH → ComfyUI → FLUX.1-schnell 4-step 추론
- **국가별 이미지 다양성**: 국가명 감지 → 2~3개 scene variant 자동 순환
  - 일본: 교실 / 학생 태블릿 / 대학 연구실
  - 인도: 전통교실 / 노트북 수업 / 스마트스쿨
  - 미국: 다양한 교실 / 협업 프로젝트 / 강의실
  - 외 10개 국가 매핑
- **World Map 방지**: `"해외"` 태그 → 글로벌 교실 이미지 (세계지도 제거)
- **이미지 캐시**: `.imgcache/pending.json`에 CDN URL 저장

### 📊 3단계 중복 검출 시스템
| 단계 | 위치 | 방식 | 임계값 |
|------|------|------|--------|
| 1 | 팩트체커 | 동일 도메인 URL 카운트 | 1회 초과 시 감점 |
| 2 | 퍼블리셔 | 제목 단어 중복 + 한국어 trigram 유사도 | 50% / 40% |
| 3 | 최종 게이트 (Ghost) | 전체 Ghost 게시글 대상 제목 비교 | Trigram 40% |

### 🏗️ 3개 파이프라인

| 파이프라인 | 일정 | 설명 |
|-----------|------|------|
| **뉴스룸** (오전/오후) | 08:00 / 18:00 UTC | AI/에듀테크 뉴스 수집→발행 |
| **AI 테크 브리핑** (오전/오후) | 00:00 / 09:00 UTC (평일) | RSS로 AI 업계 TOP 10 이슈 |
| **논문 요약** | 14:00 KST (매일) | arXiv API → DeepSeek 요약 → Ghost |

### 🔍 품질 관리 (QC)
- **이미지 URL 실측 검증**: `curl -sI`로 HTTP 2xx/3xx 응답 확인
- **HTML 구조 검사**: h2 중복, 마크다운 잔재, 링크 카운트
- **Featured 플래그**: 태그별 True/False 자동 설정
- **주제 중복 검사**: 같은 날 동일 주제 기사 감지
- 일일 11:00 KST 자동 실행 (cron)

---

## 🏗️ 아키텍처

```
                    Hermes Agent Cron
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   [수집+취재]         [기사작성]          [팩트체크]
   (Brave Search)     (DeepSeek)         (web_search)
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                      [교열기자]
                           │
                           ▼
                   ┌───────────────┐
                   │  중복 검사     │ ←─── 3단계 dedup
                   │  (최종 게이트) │
                   └───────┬───────┘
                           │
                    중복?  │  신규?
                     │     │
                     ▼     ▼
                [rejected]  [이미지 생성]
                            │ ComfyUI FLUX
                            │ (Mac Studio)
                            ▼
                      [Ghost CMS]
                      (Published)
```

### 파이프라인 디렉토리

```
pipeline/
├── 01-sourced/          ← 수집된 뉴스 원문
├── 02-assigned/         ← 취재기자 할당 완료
├── 03-reported/         ← 취재기자 검증 완료
├── 04-drafted/          ← 작성기자 초안 완성
├── 05-fact-checked/     ← 팩트체커 검증 완료
├── 06-desk-approved/    ← 편집자 승인
├── 07-copy-edited/      ← 교열기자 교열 완료
├── 08-published/        ← 발행 완료된 기사
├── rejected/            ← 품질 미달 / 중복 기사
└── memory/              ← 파이프라인 상태 파일
```

---

## 🔧 주요 스크립트

### 발행 관련
| 스크립트 | 설명 |
|---------|------|
| `publish-ghost-fixed.js` | **메인 발행기**: 이미지 캐시 조회 → Ghost API 발행 (3단계 dedup 포함) |
| `pregen-article-images.py` | **이미지 사전 생성**: ComfyUI SSH → FLUX → Ghost 업로드 → 캐시 |
| `regenerate-article-images.py` | **이미지 재생성**: 발행된 기사의 feature_image 교체 |

### 품질 관리
| 스크립트 | 설명 |
|---------|------|
| `article-qc.py` | **QC 자동 검사**: 이미지 URL 검증, HTML 구조, 링크, 중복, Featured |
| `unsplash-smart-search.js` | Unsplash 키워드 기반 이미지 검색 (Pollinations fallback) |

### 파이프라인
| 스크립트 | 설명 |
|---------|------|
| `ai-tech-brief.py` | AI 테크 브리핑 v2: RSS 수집 → DeepSeek 랭킹 → 이미지 생성 → 발행 |
| `generate-article-image.js` | 기사 이미지 생성기: 국가/장면 분석 → ComfyUI FLUX → Ghost 업로드 |
| `fetch-and-enhance-articles.js` | 기사 수집 및 보완 |
| `publish-to-ghost.js` | Legacy Ghost 발행기 |

---

## 📋 Requirements

### 서버 (Hermes VPS)
- Python 3.11+
- Node.js 18+
- DeepSeek API Key (기사 작성/요약)
- Ghost Admin API Key
- SSH 접근: Mac Studio (Tailscale)

### 이미지 생성 (Mac Studio)
- **Mac Studio M4 Max** (32코어 GPU / 36GB)
- macOS 26.3.1
- ComfyUI 0.20.1 (launchd 서비스, port 8188)
- FLUX.1-schnell (4-step, cfg=1.0, euler sampler)
- Tailscale (Hermes VPS ↔ Mac Studio 터널)

---

## 🚀 실행 가이드

### 환경 변수 (`.env`)
```env
GHOST_URL=https://newsroom.ubion.global
GHOST_ADMIN_API_KEY=your_admin_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=your_deepseek_key
```

### 수동 실행
```bash
cd /root/newsroom-analysis/newsroom/scripts

# 1. 이미지 사전 생성 (ComfyUI)
python3 /tmp/pregen-article-images.py

# 2. Ghost 발행
node publish-ghost-fixed.js

# 3. QC 실행
python3 article-qc.py --fix --report

# 4. AI 테크 브리핑
python3 ai-tech-brief.py --publish --time-slot morning
```

### Cron 일정
| 작업 | 일정 (UTC) | 설명 |
|------|-----------|------|
| 뉴스룸 오전 | 08:00 | 오전 뉴스 수집→발행 |
| 뉴스룸 오후 | 18:00 | 오후 뉴스 수집→발행 |
| AI 테크 브리핑 오전 | 00:00 (평일) | 오전 테크 브리핑 |
| AI 테크 브리핑 오후 | 09:00 (평일) | 오후 테크 브리핑 |
| 논문 요약 | 05:00 | arXiv 논문 요약 발행 |
| QC | 02:00 | 일일 품질 검사 |

---

## 🌍 국가별 이미지 매핑

| 국가 | scene variants | 비고 |
|------|---------------|------|
| 인도 | 3 | 전통/노트북/스마트스쿨 |
| 미국 | 3 | 교실/협업/강의실 |
| 일본 | 3 | 교실/태블릿/대학연구실 |
| 싱가포르 | 3 | 하이테크/스마트스쿨/협업 |
| 유럽 | 3 | 교실/교환학생/캠퍼스 |
| 외 7개국 | 2~3 | 국가별 특화 scene |

variant는 `hash(헤드라인) % len(variants)`로 결정되어, **같은 헤드라인은 항상 같은 이미지 스타일** 유지.

---

## 🔒 보안

- ✅ API Key는 `.gitignore` 및 `/shared/config/`에서 제외
- ✅ Ghost JWT: 5분 만료 HS256 (자동 갱신)
- ✅ SSH 키 인증 (Mac Studio)
- ✅ 민감 파일 전면 보호

---

## 📊 통계

- **발행 기사**: 80개+
- **일일 발행량**: ~15-20개 (뉴스 10~12개 + 브리핑 2개 + 논문 1~3개)
- **이미지 생성 성공률**: ~95% (ComfyUI 기준)
- **중복 검출률**: 3단계로 95%+ (trigram 기반)
- **QC 통과율**: ~85%

---

## 📖 문서

- **[newsroom-executor 스킬](https://hermes-agent.nousresearch.com/docs)** — Hermes Agent 기반 뉴스룸 executor 상세
- **Ghost CMS**: https://newsroom.ubion.global
- **브랜치 전략**: `main` (안정) → `fix/*` (수정사항 아카이빙)

---

## 📝 License

MIT © UBION & AskedTech
