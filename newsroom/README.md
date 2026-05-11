     1|# AskedTech 뉴스룸 — 7 에이전트 자동화 시스템
     2|
     3|**파일 기반 파이프라인 + OpenClaw 크론**으로 구현된 완전 자동 뉴스 생산 시스템.
     4|
     5|한국 뉴스룸의 편집 계층구조를 AI 에이전트로 구현하여, 수집 → 취재 → 작성 → 팩트체크 → 교열 → 발행까지 **완전 자동**으로 처리합니다.
     6|
     7|---
     8|
     9|## 🚀 배포 현황
    10|
    11|| 항목 | 상태 |
    12||------|------|
    13|| **GitHub** | ✅ https://github.com/scottnaddle/newsroom |
    14|| **발행 기사** | ✅ 76개+ |
    15|| **총 커밋** | ✅ 91개 |
    16|| **OpenClaw 호환** | ✅ 완벽 |
    17|| **새 서버 배포** | ✅ ~15분 |
    18|
    19|---
    20|
    21|## 🎯 주제 설정 (커스터마이징)
    22|
    23|### **빠른 설정 (2분)**
    24|```bash
    25|npm install
    26|node scripts/setup-topics.js
    27|
    28|# 또는 수동으로
    29|cp shared/config/topics.json.example shared/config/topics.json
    30|nano shared/config/topics.json
    31|```
    32|
    33|### **지원하는 주제**
    34|- 🤖 AI & Technology
    35|- 📚 AI & Education (기본값)
    36|- 🚀 Startup & Venture Capital
    37|- ⛓️ Blockchain & Cryptocurrency
    38|- 🧬 Biotech & Healthcare
    39|- 🌱 Climate Tech & Sustainability
    40|- 🇰🇷 한국 기술 & AI
    41|- 🎨 Custom (직접 지정)
    42|
    43|### **설정 후 파이프라인이 자동으로:**
    44|1. ✅ 당신의 주제로 뉴스 수집
    45|2. ✅ 지정된 톤/스타일로 기사 작성
    46|3. ✅ 타겟 오디언스에 맞게 편집
    47|4. ✅ 설정된 길이로 최적화
    48|
    49|**📖 상세 가이드:** [`CONFIG.md`](./CONFIG.md)
    50|
    51|---
    52|
    53|## 🏗️ 파이프라인 아키텍처
    54|
    55|```
    56|OpenClaw Cron (30분 주기)
    57|       │
    58|       ▼
    59|┌─────────────────┐
    60|│ Source Collector│  ← Brave Search로 AI 뉴스 수집
    61|└────────┬────────┘
    62|         │
    63|         ▼
    64|┌─────────────────┐
    65|│    Reporter     │  ← 보도 가능성 검증 & 맥락 조사
    66|└────────┬────────┘
    67|         │
    68|         ▼
    69|┌─────────────────┐
    70|│     Writer      │  ← 경향신문 스타일 기사 작성 (1600자+)
    71|└────────┬────────┘
    72|         │
    73|         ▼
    74|┌─────────────────────────┐
    75|│   Fact-Checker          │  ← web_search 기반 검증
    76|│   (신뢰도 점수 산출)     │
    77|└────────┬────────────────┘
    78|         │
    79|      신뢰도?
    80|      ↙      ↘
    81|   <75%      ≥75%
    82|    ↓         ↓
    83|[거절]    [편집자]
    84|          Editor-Desk
    85|             │
    86|             ↓
    87|        [교열기자]
    88|       Copy-Editor
    89|             │
    90|             ↓
    91|         [발행자]
    92|       Publisher
    93|             │
    94|             ▼
    95|       Ghost CMS
    96|         DRAFT
    97|             │
    98|             ▼
    99|       스캇에게 알림
   100|```
   101|
   102|### 파이프라인 단계
   103|
   104|```
   105|pipeline/
   106|├── 01-sourced/          ← Collector 수집 완료
   107|├── 03-reported/         ← Reporter 취재 완료
   108|├── 04-drafted/          ← Writer 초안 완성
   109|├── 05-fact-checked/     ← Fact-Checker 검증 완료
   110|├── 06-desk-approved/    ← Editor-Desk 승인
   111|├── 07-copy-edited/      ← Copy-Editor 교열 완료
   112|├── 08-published/        ← Publisher 발행 (Ghost DRAFT)
   113|├── rejected/            ← 신뢰도 < 75점 또는 품질 미달
   114|└── memory/              ← 파이프라인 상태 & 메타데이터
   115|```
   116|
   117|---
   118|
   119|## 📰 완전한 뉴스룸 생산 시스템
   120|
   121|### 3가지 콘텐츠 유형
   122|
   123|| 콘텐츠 | 설명 | 경로 | 상태 |
   124||--------|------|------|------|
   125|| **📰 기사** | 일반 뉴스 기사 (1600자+) | `pipeline/08-published/` | ✅ 완성 |
   126|| **🎨 만평** | AI 생성 만화/삽화 | `pipeline/cartoon/` | ✅ 완성 |
   127|| **💬 Colloquy** | AI 캐릭터 간 대화형 콘텐츠 | `pipeline/colloquy/` | ✅ 완성 |
   128|
   129|각 콘텐츠는 **독립적인 에이전트 팀**으로 생산:
   130|
   131|```
   132|메인 뉴스룸           만평 제작팀              대화형 콘텐츠팀
   133|(7개 에이전트)       (1개 에이전트)           (3개 에이전트)
   134|     │                    │                         │
   135|     ├─ 기사 생산       ├─ 만화 생성            ├─ 캐릭터 개발
   136|     ├─ 팩트체크      ├─ 캡션 작성            ├─ 시나리오 작성
   137|     └─ Ghost 발행    └─ Ghost 발행           └─ Ghost 발행
   138|```
   139|
   140|---
   141|
   142|## 🤖 7개 에이전트 (메인 뉴스룸)
   143|
   144|### 1️⃣ Source Collector (수집기)
   145|- **역할**: Brave Search로 AI 뉴스 수집
   146|- **입력**: 키워드 (config에서 정의)
   147|- **출력**: `01-sourced/*.json`
   148|- **스케줄**: 30분마다 (07:00~22:00)
   149|- **Job ID**: `2a7923e8-a292-435b-bd55-1ba0ec08032e`
   150|
   151|### 2️⃣ Reporter (취재기자)
   152|- **역할**: 기사의 보도 가능성 검증
   153|- **입력**: `01-sourced/*.json`
   154|- **출력**: `03-reported/*.json`
   155|- **검증**: 구체성, 뉴스 가치, 신뢰성
   156|- **Job ID**: `bf5d972c-df27-480b-8b19-b32fcc8b4c25`
   157|
   158|### 3️⃣ Writer (작성기자)
   159|- **역할**: 경향신문 스타일로 기사 작성
   160|- **입력**: `03-reported/*.json`
   161|- **출력**: `04-drafted/*.json` (HTML, 1600자+)
   162|- **구조**: 리드박스 + h2 섹션 + 참고자료 + AI 각주
   163|- **Job ID**: `d3c17519-5951-447f-af8b-f6d7494b82d9`
   164|
   165|### 4️⃣ Fact-Checker (팩트체커)
   166|- **역할**: web_search 기반 검증 & 신뢰도 산출
   167|- **입력**: `04-drafted/*.json`
   168|- **출력**: `05-fact-checked/*.json` (신뢰도 점수)
   169|- **기준**:
   170|  - ≥ 90점: 자동 통과
   171|  - 75~89점: FLAG (수동 검토)
   172|  - < 75점: 자동 거절
   173|- **Job ID**: `b0049592-2dac-4bb2-b718-f76fad8efdba`
   174|
   175|### 5️⃣ Editor-Desk (편집자)
   176|- **역할**: 기사 최종 검증 (제목-내용, 중복, 메타데이터)
   177|- **입력**: `05-fact-checked/*.json`
   178|- **출력**: `06-desk-approved/*.json`
   179|- **체크리스트**:
   180|  - 제목과 내용 일치도 (80%+)
   181|  - 중복 여부 (85% 이상 중복 제외)
   182|  - 본문 길이 (1500자+)
   183|  - 메타데이터 완정도
   184|- **Job ID**: `c20081e1-73be-4856-8768-029c326676d6`
   185|
   186|### 6️⃣ Copy-Editor (교열기자)
   187|- **역할**: 맞춤법, 톤, 명확성 최종 검토
   188|- **입력**: `06-desk-approved/*.json`
   189|- **출력**: `07-copy-edited/*.json`
   190|- **검토**:
   191|  - 문법 & 맞춤법
   192|  - 톤 & 일관성
   193|  - 가독성 & 명확성
   194|  - HTML 구조 검증
   195|- **Job ID**: `e57f7327-a883-492a-93eb-7ea54cb12d9e`
   196|
   197|### 7️⃣ Publisher (발행자)
   198|- **역할**: Ghost CMS에 DRAFT 발행
   199|- **입력**: `07-copy-edited/*.json`
   200|- **출력**: Ghost CMS (DRAFT 상태)
   201|- **기능**:
   202|  - JWT 인증 (HS256)
   203|  - 메타데이터 자동 생성 (meta_title, meta_description)
   204|  - 이미지 최적화 (Unsplash + OG 카드)
   205|- **주의**: 자동 publish 안 함 (스캇이 수동 검토 후 발행)
   206|- **Job ID**: `cecbf113-6ac7-4cc1-8694-d65a040324ed`
   207|
   208|---
   209|
   210|## 📋 에이전트 워크스페이스
   211|
   212|```
   213|workspaces/
   214|├── source-collector/
   215|│   ├── SOUL.md              ← 에이전트 정의
   216|│   ├── prompt.md            ← 프롬프트
   217|│   └── README.md
   218|├── reporter/
   219|│   ├── SOUL.md
   220|│   ├── prompt.md
   221|│   └── README.md
   222|├── writer/
   223|│   ├── SOUL.md
   224|│   ├── prompt.md
   225|│   └── README.md
   226|├── fact-checker/
   227|│   ├── SOUL.md
   228|│   ├── prompt.md
   229|│   └── README.md
   230|├── editor-desk/             ← 오케스트레이터 허브
   231|│   ├── SOUL.md
   232|│   ├── prompt.md
   233|│   └── README.md
   234|├── copy-editor/
   235|│   ├── SOUL.md
   236|│   ├── prompt.md
   237|│   └── README.md
   238|└── publisher/
   239|    ├── SOUL.md
   240|    ├── prompt.md
   241|    └── README.md
   242|```
   243|
   244|각 워크스페이스는:
   245|- ✅ OpenClaw 세션으로 독립 실행
   246|- ✅ SOUL.md로 역할 & 규칙 정의
   247|- ✅ 파일 I/O로 통신 (JSON)
   248|- ✅ 크론 작업으로 자동 실행
   249|
   250|---
   251|
   252|## 🔄 통신 프로토콜
   253|
   254|### 파일 기반 파이프라인
   255|
   256|각 에이전트는 **폴더 간 파일 이동**으로 통신:
   257|
   258|```
   259|01-sourced/*.json (수집기 출력)
   260|    ↓
   261|read()
   262|    ↓
   263|Reporter SOUL.md 규칙 적용
   264|    ↓
   265|03-reported/*.json (Reporter 출력)
   266|    ↓
   267|...계속...
   268|```
   269|
   270|### JSON 구조
   271|
   272|```json
   273|{
   274|  "id": "uuid",
   275|  "title": "기사 제목",
   276|  "content": "기사 내용",
   277|  "html": "<html>...</html>",
   278|  "metadata": {
   279|    "category": "policy",
   280|    "author": "에이전트명",
   281|    "created_at": "2026-03-10T14:00:00Z",
   282|    "status": "drafted"
   283|  },
   284|  "quality": {
   285|    "score": 85,
   286|    "flag": false,
   287|    "issues": []
   288|  }
   289|}
   290|```
   291|
   292|---
   293|
   294|## 🚀 실행 방법
   295|
   296|### 방법 1: OpenClaw 크론 (자동)
   297|
   298|MEMORY.md의 Job ID를 OpenClaw에 등록:
   299|
   300|```bash
   301|openclaw cron add \
   302|  --jobId 2a7923e8-a292-435b-bd55-1ba0ec08032e \
   303|  --schedule "*/30 7-22 * * *" \
   304|  --payload '{"kind":"agentTurn","message":"수집...","model":"anthropic/claude-sonnet-4-6"}'
   305|```
   306|
   307|### 방법 2: 수동 실행
   308|
   309|```bash
   310|# 단일 에이전트 실행
   311|node scripts/run-<agent>.js
   312|
   313|# 전체 파이프라인
   314|npm start
   315|```
   316|
   317|---
   318|
   319|## 📊 성능 통계
   320|
   321|| 메트릭 | 수치 |
   322||--------|------|
   323|| **발행된 기사** | 76개+ |
   324|| **총 커밋** | 91개 |
   325|| **파이프라인 단계** | 7개 |
   326|| **예상 처리 시간** | 45분 (수집~발행) |
   327|| **신뢰도 90점 이상** | ~70% |
   328|| **기사 길이 평균** | 1400자+ |
   329|
   330|---
   331|
   332|## 🔧 주요 스크립트
   333|
   334|| 스크립트 | 설명 |
   335||---------|------|
   336|| `pipeline-runner.js` | 메인 파이프라인 실행 |
   337|| `run-orchestrator.js` | 오케스트레이터 실행 |
   338|| `generate-og-card.js` | OG 카드 이미지 생성 |
   339|| `get-feature-image.js` | Unsplash 이미지 선택 |
   340|| `find-duplicates-local.js` | 기사 중복 검사 |
   341|| `sync-published-to-ghost.js` | Ghost 동기화 |
   342|
   343|---
   344|
   345|## 📁 디렉토리 구조
   346|
   347|```
   348|newsroom/
   349|├── prompts/
   350|│   └── pipeline-orchestrator.md    ← 오케스트레이터
   351|├── scripts/                        ← 50+ 유틸 스크립트
   352|├── workspaces/                     ← 7개 에이전트
   353|├── shared/
   354|│   ├── config/
   355|│   │   ├── ghost.json.example
   356|│   │   └── llm-keys.json.example
   357|│   └── schemas/
   358|├── control-center/                 ← 대시보드
   359|├── pipeline/                       ← 파이프라인 (자동 생성)
   360|├── DEPLOYMENT.md                   ← 배포 가이드
   361|├── OPERATIONS.md                   ← 운영 가이드
   362|├── QUALITY_IMPROVEMENT_GUIDE.md    ← 품질 관리
   363|└── README.md
   364|```
   365|
   366|---
   367|
   368|## 🎯 OpenClaw 크론 Job ID
   369|
   370|모두 MEMORY.md에 문서화되어 있습니다:
   371|
   372|```
   373|Source Collector: 2a7923e8-a292-435b-bd55-1ba0ec08032e
   374|Reporter:        bf5d972c-df27-480b-8b19-b32fcc8b4c25
   375|Writer:          d3c17519-5951-447f-af8b-f6d7494b82d9
   376|Fact-Checker:    b0049592-2dac-4bb2-b718-f76fad8efdba
   377|Editor-Desk:     c20081e1-73be-4856-8768-029c326676d6
   378|Copy-Editor:     e57f7327-a883-492a-93eb-7ea54cb12d9e
   379|Publisher:       cecbf113-6ac7-4cc1-8694-d65a040324ed
   380|```
   381|
   382|---
   383|
   384|## 🔒 필수 설정
   385|
   386|### Ghost API (shared/config/ghost.json)
   387|
   388|```json
   389|{
   390|  "apiUrl": "https://newsroom.ubion.global",
   391|  "adminApiKey": "kid:secret"
   392|}
   393|```
   394|
   395|### LLM Keys (shared/config/llm-keys.json)
   396|
   397|```json
   398|{
   399|  "anthropic": "sk-ant-...",
   400|  "google": "YOUR_KEY",
   401|  "zhipu": "YOUR_KEY",
   402|  "openai": "sk-..."
   403|}
   404|```
   405|
   406|---
   407|
   408|## 🎨 만평 시스템 (Cartoon Agent)
   409|
   410|### 역할
   411|- **자동 만화 생성**: 주요 뉴스를 풍자적인 만화/삽화로 표현
   412|- **AI 캡션**: 만화에 대한 설명 자동 작성
   413|- **일일 발행**: 매일 1-3개 만평 자동 생성
   414|
   415|### 파이프라인
   416|```
   417|기사 수집
   418|    ↓
   419|만평 아이디어 추출
   420|(기사의 중심 주제 분석)
   421|    ↓
   422|이미지 프롬프트 생성
   423|(DALL-E, Midjourney 스타일)
   424|    ↓
   425|만화 이미지 생성
   426|    ↓
   427|캡션 작성
   428|(신랄하고 위트있는 해설)
   429|    ↓
   430|Ghost 발행
   431|```
   432|
   433|### 저장 위치
   434|```
   435|pipeline/cartoon/
   436|├── 2026-03-12.json      ← JSON 형식 (메타데이터 + 캡션)
   437|├── 2026-03-11.json
   438|└── ...
   439|```
   440|
   441|### 샘플
   442|```json
   443|{
   444|  "date": "2026-03-12",
   445|  "article_topic": "AI 교육 정책",
   446|  "image_prompt": "AI 로봇이 학생을 가르치는 만화 스타일",
   447|  "caption": "AI가 선생님이 되는 날이 오면... 시험은 통과하지만 마음은 남는다?",
   448|  "style": "witty, satirical",
   449|  "image_url": "https://..."
   450|}
   451|```
   452|
   453|---
   454|
   455|## 💬 Colloquy 시스템 (대화형 콘텐츠)
   456|
   457|### 개념
   458|**3명의 AI 캐릭터**가 주요 뉴스를 놓고 벌이는 **지적 대화**
   459|
   460|| 캐릭터 | 역할 | 성격 |
   461||--------|------|------|
   462|| **📚 Research Char** | 데이터 & 팩트 | 분석적, 논리적 |
   463|| **🎓 Student Char** | 질문 & 호기심 | 열정적, 궁금증 많음 |
   464|| **👨‍🏫 Expert Char** | 해설 & 통찰 | 경험담, 미래 전망 |
   465|
   466|### 파이프라인
   467|```
   468|기사 수집
   469|    ↓
   470|토픽 선택 (가장 중요한 뉴스)
   471|    ↓
   472|시나리오 작성
   473|(3인이 나눌 대화 구성)
   474|    ↓
   475|캐릭터별 대사 작성
   476|(각자의 성격에 맞게)
   477|    ↓
   478|Q&A 형식으로 포맷팅
   479|    ↓
   480|Ghost 발행
   481|```
   482|
   483|### 저장 위치
   484|```
   485|pipeline/colloquy/
   486|├── 2026-03-12_colloquy.json    ← 대화 내용
   487|├── 2026-03-11_colloquy.json
   488|└── memory/
   489|    ├── researcher.json         ← 캐릭터 메모리 (학습한 내용)
   490|    ├── student.json
   491|    └── expert.json
   492|```
   493|
   494|### 샘플
   495|```json
   496|{
   497|  "date": "2026-03-12",
   498|  "topic": "GPT-5 출시 소식",
   499|  "conversation": [
   500|    {
   501|
      "question": "GPT-5가 뭐가 다른데요?"
    },
    {
      "speaker": "researcher",
      "answer": "파라미터가 2조 개에서 5조 개로 늘었고..."
    },
    {
      "speaker": "expert",
      "insight": "이건 실제로 산업에 큰 변화를 가져올 거예요..."
    }
  ],
  "memory_updated": {
    "researcher": "GPT-5 파라미터 수, 성능 지표",
    "student": "GPT 진화 과정 이해",
    "expert": "산업 전망 분석"
  }
}
```

### 특징
- ✅ 캐릭터별 독립적인 메모리 (학습 누적)
- ✅ 매 대화 후 캐릭터 지식 업데이트
- ✅ 이전 대화를 기반한 연속성
- ✅ 주제별 심화 토론 가능

---

## 🔄 3가지 콘텐츠의 관계

```
메인 기사 (7개 에이전트)
    ├─→ 만평 생성 (만화 캡션)
    ├─→ Colloquy (캐릭터 대화)
    └─→ Ghost 발행

일일 출력:
  - 📰 기사: 10~20개
  - 🎨 만평: 1~3개
  - 💬 Colloquy: 1~2개
```

---

## 📖 더 알아보기

- **[../DEPLOYMENT.md](../DEPLOYMENT.md)** — 새 서버 배포 가이드
- **[../MEMORY.md](../MEMORY.md)** — 프로젝트 문맥 & 크론 Job ID
- **[OPERATIONS.md](OPERATIONS.md)** — 운영 및 모니터링
- **[QUALITY_IMPROVEMENT_GUIDE.md](QUALITY_IMPROVEMENT_GUIDE.md)** — 품질 관리

---

## 📊 Dashboard

```bash
cd control-center
node backend/server.js
# → http://localhost:3848
```

실시간 추적:
- 파이프라인 각 단계 기사 수
- 에이전트 처리 속도
- 24시간 발행량
- 병목 자동 감지

---

**완전 자동화된 AI 뉴스룸 시스템입니다!** 🚀
