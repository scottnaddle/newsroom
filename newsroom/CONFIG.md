# ⚙️ Newsroom 주제 설정 가이드

이 가이드는 Newsroom을 **처음 설치할 때 원하는 주제별로 기사 작성을 커스터마이징**하는 방법을 설명합니다.

---

## 🎯 빠른 시작

### 1단계: 주제 설정 파일 생성
```bash
cd newsroom
cp shared/config/topics.json.example shared/config/topics.json
nano shared/config/topics.json
```

### 2단계: 원하는 주제 설정
```json
{
  "primary_topic": "AI & Technology",
  "subtopics": [
    "Machine Learning",
    "Natural Language Processing",
    "Computer Vision"
  ],
  "keywords": [
    "AI", "machine learning", "deep learning", "neural networks",
    "GPT", "transformers", "LLM"
  ],
  "target_audience": "Tech professionals and AI enthusiasts",
  "tone": "Professional, informative",
  "content_style": "News and analysis",
  "language": "English"
}
```

### 3단계: 파이프라인 시작
```bash
node scripts/pipeline-runner.js
```

---

## 📋 주제 설정 파일 형식

### **공식 필드 설명**

```json
{
  // 필수: 주요 주제
  "primary_topic": "당신의 뉴스의 중심 주제",
  
  // 선택: 소주제들 (배열)
  "subtopics": [
    "소주제 1",
    "소주제 2",
    "소주제 3"
  ],
  
  // 선택: 검색 키워드들
  "keywords": [
    "키워드1",
    "키워드2",
    "키워드3"
  ],
  
  // 선택: 타겟 오디언스
  "target_audience": "누가 읽을 건지",
  
  // 선택: 톤 & 스타일
  "tone": "Professional / Casual / Academic / Conversational",
  "content_style": "News / Analysis / Opinion / Tutorial",
  
  // 선택: 언어
  "language": "English / Korean / Chinese / Japanese",
  
  // 선택: 기사 길이 (단어 수)
  "article_length": {
    "min_words": 1200,
    "max_words": 2000,
    "target_words": 1500
  },
  
  // 선택: 기사당 이미지 수
  "images_per_article": 2,
  
  // 선택: 포함해야 할 섹션들
  "required_sections": [
    "Introduction",
    "Current Situation",
    "Key Points",
    "Analysis",
    "Future Outlook"
  ],
  
  // 선택: 제외할 주제들
  "exclude_topics": [
    "Politics",
    "Sports"
  ]
}
```

---

## 🎨 사전 설정된 주제 예시

### **1. AI & 기술 (기본값)**
```json
{
  "primary_topic": "AI & Technology",
  "subtopics": [
    "Machine Learning",
    "Natural Language Processing",
    "Computer Vision",
    "Robotics",
    "AI Safety"
  ],
  "keywords": [
    "AI", "artificial intelligence", "machine learning", "deep learning",
    "neural networks", "GPT", "transformers", "LLM", "generative AI"
  ],
  "target_audience": "Tech professionals, developers, AI researchers",
  "tone": "Professional, informative",
  "content_style": "News and analysis",
  "language": "English",
  "article_length": {
    "min_words": 1200,
    "max_words": 2000,
    "target_words": 1500
  }
}
```

### **2. 스타트업 & 벤처**
```json
{
  "primary_topic": "Startup & Venture Capital",
  "subtopics": [
    "Fundraising",
    "Venture Capital",
    "Scale-ups",
    "Exit Strategies",
    "Entrepreneurship"
  ],
  "keywords": [
    "startup", "venture capital", "VC funding", "Series A",
    "Series B", "IPO", "unicorn", "angel investor", "pitch"
  ],
  "target_audience": "Entrepreneurs, investors, startup enthusiasts",
  "tone": "Professional, optimistic",
  "content_style": "News and case studies",
  "language": "English"
}
```

### **3. 블록체인 & 암호화폐**
```json
{
  "primary_topic": "Blockchain & Cryptocurrency",
  "subtopics": [
    "Bitcoin",
    "Ethereum",
    "DeFi",
    "NFT",
    "Web3"
  ],
  "keywords": [
    "blockchain", "cryptocurrency", "bitcoin", "ethereum",
    "smart contracts", "DeFi", "NFT", "Web3", "crypto"
  ],
  "target_audience": "Crypto enthusiasts, traders, tech investors",
  "tone": "Professional, analytical",
  "content_style": "News, market analysis, tutorials",
  "language": "English"
}
```

### **4. 바이오테크 & 헬스케어**
```json
{
  "primary_topic": "Biotech & Healthcare Innovation",
  "subtopics": [
    "Gene Therapy",
    "Medical AI",
    "Drug Development",
    "Telemedicine",
    "Healthcare Tech"
  ],
  "keywords": [
    "biotech", "healthcare", "AI medicine", "gene therapy",
    "medical innovation", "clinical trials", "FDA approval"
  ],
  "target_audience": "Healthcare professionals, investors, science enthusiasts",
  "tone": "Professional, scientific",
  "content_style": "News and research analysis",
  "language": "English"
}
```

### **5. 한국 기술 & 스타트업**
```json
{
  "primary_topic": "한국 기술 & 스타트업",
  "subtopics": [
    "K-Tech",
    "한국 AI",
    "스타트업 생태계",
    "정부 정책",
    "투자 트렌드"
  ],
  "keywords": [
    "한국", "스타트업", "벤처캐피탈", "기술정책",
    "AI교육", "디지털전환", "혁신기업"
  ],
  "target_audience": "한국 기술 관심층, 창업가, 투자자",
  "tone": "친근하고 전문적",
  "content_style": "뉴스와 분석",
  "language": "Korean",
  "article_length": {
    "min_words": 1000,
    "max_words": 1800,
    "target_words": 1400
  }
}
```

### **6. 클라이메이트 테크**
```json
{
  "primary_topic": "Climate Tech & Sustainability",
  "subtopics": [
    "Renewable Energy",
    "Carbon Capture",
    "Sustainable Agriculture",
    "Green Building",
    "Environmental Technology"
  ],
  "keywords": [
    "climate tech", "sustainability", "green energy",
    "carbon neutral", "renewable", "eco-friendly", "ESG"
  ],
  "target_audience": "Environmental advocates, investors, tech enthusiasts",
  "tone": "Professional, optimistic",
  "content_style": "News, impact analysis, case studies",
  "language": "English"
}
```

---

## 🔄 주제 설정이 적용되는 위치

### **1. Source Collector (소스 수집기)**
```bash
prompts/collector-prompts.md
```
↓ 설정된 주제로 검색 키워드 생성
↓ 해당 주제의 소식만 수집

### **2. Reporter (취재 기자)**
```bash
prompts/reporter-prompts.md
```
↓ 주제와 관련된 배경 리서치
↓ 신뢰도 기반 필터링

### **3. Writer (작성 기자)**
```bash
prompts/writer-prompts.md
```
↓ 설정된 톤/스타일로 기사 작성
↓ 필수 섹션 포함
↓ 목표 길이 맞춤

### **4. Fact-Checker (팩트체커)**
```bash
prompts/fact-checker-prompts.md
```
↓ 주제별 신뢰도 기준 적용
↓ 품질 평가

### **5. Editor-Desk (에디터/데스크)**
```bash
prompts/editor-desk-prompts.md
```
↓ 타겟 오디언스에 맞춘 검토
↓ 톤/스타일 일관성 확인

### **6. Copy-Editor (교열 기자)**
```bash
prompts/copy-editor-prompts.md
```
↓ 언어별 교열
↓ 기사 길이 최적화

---

## 🚀 고급: 커스텀 주제 만들기

### **Step 1: 주제 파일 생성**
```bash
cp shared/config/topics.json.example shared/config/topics.json
```

### **Step 2: 당신의 주제로 설정**
```json
{
  "primary_topic": "Your Custom Topic",
  "subtopics": [
    "Sub-topic 1",
    "Sub-topic 2"
  ],
  "keywords": [
    "keyword1",
    "keyword2"
  ],
  "target_audience": "Your audience description",
  "tone": "Your preferred tone",
  "content_style": "Your preferred style",
  "language": "Your preferred language"
}
```

### **Step 3: 파이프라인 에이전트 프롬프트 커스터마이징 (선택)**

각 에이전트의 SOUL.md 파일을 편집:
```bash
nano workspaces/source-collector/SOUL.md
nano workspaces/reporter/SOUL.md
nano workspaces/writer/SOUL.md
nano workspaces/fact-checker/SOUL.md
nano workspaces/editor-desk/SOUL.md
nano workspaces/copy-editor/SOUL.md
nano workspaces/publisher/SOUL.md
```

각 파일에서 주제별 지침 추가:
```markdown
## 주제 지침

**주요 주제**: ${topics.primary_topic}
**소주제들**: ${topics.subtopics.join(', ')}
**타겟 오디언스**: ${topics.target_audience}
**톤**: ${topics.tone}

### 기사 작성 시 필수사항
1. 주제와 직접적인 관련성 확인
2. 타겟 오디언스에 적절한 수준의 설명
3. 필수 섹션 포함: ${topics.required_sections.join(', ')}
```

---

## 📊 주제별 이미지 및 카테고리 설정

### **이미지 설정**
```json
{
  "image_preferences": {
    "style": "professional / creative / illustrative",
    "tone": "serious / energetic / calm",
    "color_scheme": "warm / cool / neutral",
    "prefer_real_photos": true,
    "images_per_article": 2
  }
}
```

### **카테고리 태그**
```json
{
  "categories": [
    "Breaking News",
    "Analysis",
    "Tutorial",
    "Case Study",
    "Industry Report"
  ],
  "tags": [
    "tag1",
    "tag2",
    "tag3"
  ]
}
```

---

## 🎬 설정 후 실행

### **1단계: 설정 파일 확인**
```bash
cat shared/config/topics.json
```

### **2단계: 파이프라인 시작**
```bash
node scripts/pipeline-runner.js
```

### **3단계: 기사 확인**
```bash
# 발행된 기사 목록
ls -la pipeline/08-published/

# 최신 기사 읽기
cat pipeline/08-published/[latest-article].json
```

---

## 🔍 주제 설정 유효성 검사

주제 설정이 올바른지 확인하는 스크립트:

```bash
node scripts/validate-topics-config.js
```

**검증 항목:**
- ✅ primary_topic 필수 필드 확인
- ✅ keywords 배열 형식 확인
- ✅ language 지원 언어 확인
- ✅ tone/content_style 유효한 값 확인
- ✅ article_length 범위 유효성 확인

---

## 💡 팁

### **여러 주제로 병렬 실행**
```bash
# 다른 경로에 다른 주제로 설정
cp -r newsroom newsroom-tech
cp -r newsroom newsroom-biotech

cd newsroom-tech
nano shared/config/topics.json  # AI & Technology

cd newsroom-biotech
nano shared/config/topics.json  # Biotech

# 각각 실행
node scripts/pipeline-runner.js
```

### **주제 전환**
```bash
# 기존 주제 백업
cp shared/config/topics.json shared/config/topics.json.backup

# 새 주제로 변경
nano shared/config/topics.json

# 파이프라인 재실행
node scripts/pipeline-runner.js
```

---

## 📚 예시: 완전한 설정

### **예: 한국 AI 교육 뉴스**
```json
{
  "primary_topic": "AI & Education in Korea",
  "subtopics": [
    "AI교육 정책",
    "AI 교육 기술",
    "대학 AI 프로그램",
    "K-12 AI 교육",
    "기업 AI 교육"
  ],
  "keywords": [
    "AI", "인공지능", "교육", "학습",
    "한국", "정부정책", "디지털전환",
    "스타트업", "대학"
  ],
  "target_audience": "교육자, 학생, 정책입안자, 투자자",
  "tone": "Professional, informative, hopeful",
  "content_style": "News, analysis, case studies",
  "language": "Korean",
  "article_length": {
    "min_words": 1000,
    "max_words": 1800,
    "target_words": 1400
  },
  "images_per_article": 2,
  "required_sections": [
    "도입부",
    "현황",
    "주요 포인트",
    "분석",
    "향후 전망"
  ],
  "categories": [
    "정책",
    "기술",
    "사례",
    "분석"
  ],
  "exclude_topics": [
    "정치적 논쟁",
    "스포츠"
  ]
}
```

---

## ✅ 체크리스트

처음 설치할 때:

- [ ] `shared/config/topics.json` 생성
- [ ] 주요 주제 (primary_topic) 설정
- [ ] 소주제들 (subtopics) 추가
- [ ] 키워드 (keywords) 작성
- [ ] 타겟 오디언스 정의
- [ ] 톤 & 스타일 선택
- [ ] 언어 선택
- [ ] 기사 길이 설정
- [ ] 파이프라인 시작

---

**이제 당신의 주제로 뉴스를 만들 준비가 되었습니다!** 🚀
