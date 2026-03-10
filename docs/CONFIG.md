# 📋 Configuration Reference

## newsroom

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | "My AI Newsroom" | 뉴스룸 이름 |
| `language` | string | "ko" | 기사 언어 (ko, en, ja, zh) |
| `timezone` | string | "Asia/Seoul" | 스케줄 기준 시간대 |

## topics

배열. 최소 1개 필수.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | 주제 이름 |
| `keywords` | string[] | ✅ | 검색 키워드 |
| `category` | string | | 카테고리 ID |
| `accent_color` | string | "#4338ca" | 테마 색상 |

## agents

### collector (소스 수집기)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | true | 활성화 |
| `schedule` | cron | "*/30 * * * *" | 실행 스케줄 |
| `max_articles_per_run` | number | 5 | 실행당 최대 수집 |
| `min_relevance_score` | number | 60 | 최소 관련성 점수 |
| `dedup_window_hours` | number | 72 | 중복 체크 기간 |
| `backoff.enabled` | bool | true | 스마트 백오프 |
| `backoff.multiplier` | number | 2 | 백오프 배수 |
| `backoff.max_interval_minutes` | number | 180 | 최대 간격 (분) |

### reporter (취재기자)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `depth` | string | "standard" | quick / standard / deep |
| `max_sources` | number | 5 | 최대 소스 수 |

### writer (작성기자)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `style` | string | "news" | news / blog / academic / casual |
| `tone` | string | "formal" | formal / conversational / neutral |
| `min_word_count` | number | 300 | 최소 단어 수 |
| `max_word_count` | number | 1500 | 최대 단어 수 |

### fact_checker (팩트체커)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `strictness` | string | "medium" | low / medium / high |
| `auto_reject_below` | number | 60 | 자동 거부 점수 |

### editor (에디터/데스크)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `auto_approve_above` | number | 90 | 자동 승인 점수 |
| `auto_reject_below` | number | 75 | 자동 거부 점수 |
| `check_duplicates` | bool | true | 중복 검사 |
| `duplicate_threshold` | number | 85 | 중복 판단 % |

### publisher (발행에이전트)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `publish_as` | string | "draft" | draft / published |

## cms

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | ghost / markdown |
| `url` | string | CMS URL (Ghost) |
| `api_key` | string | Admin API Key (환경변수 가능) |

## llm

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | openai / anthropic / zhipu / moonshot |
| `model` | string | 모델 ID |
| `api_key` | string | API Key (환경변수 가능) |
| `fallbacks` | array | 대체 모델 목록 |

## optimization

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pre_check` | bool | true | 사전 필터링 |
| `prompt_mode` | string | "minimal" | minimal / standard / full |
| `smart_scheduling.enabled` | bool | true | 스마트 스케줄링 |
| `smart_scheduling.off_hours` | number[] | [23, 7] | 야간 시간대 |
| `smart_scheduling.weekend_mode` | string | "reduced" | reduced / normal |
| `budget.daily_token_limit` | number | 0 | 일일 토큰 상한 (0=무제한) |

## design

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `template` | string | "modern" | modern / classic / minimal |
| `font` | string | "Noto Sans KR" | 기사 폰트 |
| `show_ai_disclaimer` | bool | true | AI 작성 고지 표시 |

## dashboard

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | true | 대시보드 활성화 |
| `port` | number | 3848 | 대시보드 포트 |

---

## Environment Variables

config.yaml에서 `${ENV_VAR}` 문법으로 환경변수를 참조할 수 있습니다.

```yaml
llm:
  api_key: "${OPENAI_API_KEY}"
cms:
  api_key: "${GHOST_API_KEY}"
```
