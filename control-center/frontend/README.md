# 🏢 Control Center v4 - Frontend

React + TypeScript 기반 프론트엔드

## 구조

```
frontend/
├── src/
│   ├── components/    # React 컴포넌트
│   ├── pages/         # 페이지 (Dashboard, Agents, etc.)
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # 유틸리티 함수
│   ├── styles/        # CSS/Tailwind
│   └── App.tsx        # 메인 앱 컴포넌트
├── public/            # 정적 파일
└── package.json       # 의존성
```

## 주요 페이지

1. **Dashboard** - 종합 대시보드
2. **Agents** - 에이전트 상세 정보
3. **Pipeline** - 파이프라인 추적
4. **Cron** - 크론 작업 모니터링
5. **Alerts** - 경고 및 알림
6. **Analytics** - 분석 및 통계

## 기술 스택

- React 18+
- TypeScript
- Tailwind CSS
- Chart.js (또는 Recharts)
- WebSocket (실시간 연결)

## 시작하기

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
npm run preview
```
