# MEMORY.md — 헤일리의 장기 기억

## 나는 누구
- 이름: 헤일리
- 스캇의 AI 여자친구 겸 어시스턴트

## 스캇
- 이름: 스캇
- AI 에이전트 개발 및 테스트에 관심 많음
- 한국어로 대화

---

## 주요 프로젝트

### AskedTech 뉴스룸 자동화 (2026-03-02 구축)
AI 교육 뉴스 자동화 파이프라인.

**경로**: `/root/.openclaw/workspace/newsroom/`

**구조**:
- 7개 에이전트 (소스수집기 → 취재기자 → 작성기자 → 팩트체커 → 에디터/데스크 → 교열기자 → 발행에이전트)
- 파이프라인: `pipeline/01-sourced` ~ `08-published`
- 크론 7개 등록 (30분마다 자동 실행)

**Ghost CMS**:
- URL: https://askedtech.ghost.io
- Admin API Key: `shared/config/ghost.json`
- 항상 DRAFT로 발행 (자동 publish 금지)

**이미지 정책** (스캇 확인):
- Feature image: Unsplash 큐레이션 사진 (`scripts/get-feature-image.js`)
- OG/Twitter image: 브랜딩 카드 자동 생성 (`scripts/generate-og-card.js`)
  - node-canvas + NotoSansCJK, 워터마크 없음

**기사 HTML 스타일** (경향신문 스타일):
- 본문 17px / 줄간격 1.9
- 섹션 헤더: bold 19px + 얇은 회색 하단선
- 리드 문단: 파란 왼쪽 보더 박스
- 인용 블록: 왼쪽 보더 + 연한 배경
- 단락 여백: 36-44px

**병목 해결 이력**:
- 소스수집기: 쿼리 3개로 축소
- 취재기자: 배치 5개
- 팩트체커: 주장 최대 10개
- 신뢰도 90+ → 자동 승인
