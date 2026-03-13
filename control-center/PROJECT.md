# 🏢 UBION Control Center v4

**개발 환경**: opencode  
**상태**: 🟡 개발 시작  
**버전**: 4.0.0

---

## 📋 프로젝트 개요

UBION AI News Management System의 실시간 모니터링 및 관제 시스템입니다.

### 이전 버전 대비 개선사항
- ✅ opencode로 통합 개발
- ✅ 더 나은 코드 구조
- ✅ 향상된 성능
- ✅ 확장성 증대

---

## 🏗️ 아키텍처

```
Backend (FastAPI + Python)
    ↓
Database (SQLite)
    ↓
API Routes
    ↓
Frontend (React + TypeScript)
    ↓
Real-time Monitoring UI
```

---

## 📁 디렉토리 구조

```
control-center-v4/
├── backend/           # Python FastAPI 백엔드
├── frontend/          # React TypeScript 프론트엔드
├── database/          # SQLite 데이터베이스
├── docs/              # 프로젝트 문서
├── scripts/           # 유틸리티 스크립트
├── .opencode/         # opencode 설정
└── PROJECT.md         # 이 파일
```

---

## 🎯 주요 기능

### 대시보드
- 실시간 에이전트 모니터링
- 파이프라인 단계별 상태
- 발행/거부/실패 통계
- 경고 및 알림

### 에이전트 관리
- 7개 에이전트 활동 로그
- 성공률 추적
- 성능 분석

### 파이프라인 추적
- 기사 ID 검색
- 단계별 진행 상황
- 이력 추적

### 분석
- 시간대별 그래프
- 성능 통계
- 트렌드 분석

---

## 🚀 개발 단계

- [ ] Phase 1: 백엔드 구축 (FastAPI + SQLite)
- [ ] Phase 2: 프론트엔드 구축 (React UI)
- [ ] Phase 3: API 연동
- [ ] Phase 4: 파이프라인 모니터 통합
- [ ] Phase 5: 배포 및 최적화

---

## 📝 개발 규칙

1. **모든 개발은 opencode에서 진행**
2. **commit 메시지는 명확하게**
3. **주요 결정사항은 MEMORY.md에 기록**
4. **테스트 코드 포함**

---

## 🔗 관련 링크

- 이전 버전: `/root/.openclaw/workspace/newsroom/control-center` (삭제됨)
- 파이프라인: `/root/.openclaw/workspace/newsroom/pipeline/`
- MEMORY: `/root/.openclaw/workspace/MEMORY.md`

---

**시작일**: 2026-03-06 13:16 KST  
**개발자**: Hailey (AI Assistant)  
**상태**: 초기화 완료
