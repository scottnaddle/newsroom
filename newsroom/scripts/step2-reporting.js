const fs = require('fs');
const path = require('path');

// Create directories if needed
['pipeline/03-reported', 'pipeline/memory'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Generate reporting briefs
const briefs = [
  {
    id: 'source-1773093643285-0',
    reporting_brief: {
      WHO: "UNESCO, 경제협력개발기구(OECD), 세계은행, 각국 정부 교육부",
      WHAT: "글로벌 교육 정책이 AI와 디지털 전환에 대응하기 위해 창의적 문제 해결, 비판적 사고 능력을 갖춘 미래형 인재 양성으로 전환 중",
      WHY: "팬데믹 이후 교육 격차 심화, AI 및 디지털 기술의 급속한 발전으로 기존 교육 시스템으로는 대응 불가",
      WHEN: "2026년 3월 현재 진행 중, 2025-2026년 데이터 기반 정책 수립 강화",
      CONTEXT: "글로벌 교육 격차 여전 - 초등교육 90%, 고등교육은 지역별 편차 심함. 디지털 문해력 격차 높음. UNESCO '2026 교육 미래 보고서' 발표.",
      SOURCES: [
        { title: "UNESCO 2026 교육 미래 보고서", url: "https://www.dailyan.com/news/article.html?no=765638", credibility: "high" },
        { title: "OECD 국제협력 권고안", url: "https://www.oecd.org/", credibility: "high" },
        { title: "세계은행 2025 교육통계", url: "https://data.worldbank.org/", credibility: "high" }
      ],
      PERSPECTIVES: {
        government: "각국 정부, 교육 혁신 위한 국제협력 강화 및 에듀테크 투자 확대 계획",
        education_sector: "교육 데이터 수집·분석으로 정책 효과성 검증 및 맞춤형 지원 강화",
        international: "SDG 달성, 기후변화 교육, 다문화 이해 등 새로운 교육 의제 부상"
      },
      SUGGESTED_ANGLE: "한국 AI 중점학교 도입과 글로벌 교육 정책 트렌드의 맥락화 - 각국 정부 투자 사례와의 비교"
    }
  },
  {
    id: 'source-1773093643286-1',
    reporting_brief: {
      WHO: "고등교육 기관 리더, 학생(92% AI 사용), 교사, Genio 및 에듀테크 회사",
      WHAT: "2026년 대학가에서 AI 사용률이 92%에 달했으나, 학생 역량 강화보다 의존도 심화 우려. AI 리터러시 부족 실태",
      WHY: "AI 도구의 대중화로 학생들이 사고 과정 없이 결과물만 의존, 학습 효과 감소. 36% 학생만 정식 교육 받음.",
      WHEN: "2026년 현재, 2024년 66% → 2026년 92% 사용률 급증",
      CONTEXT: "사회경제적 지위에 따른 AI 활용 편차 심함 - 고소득층은 심화학습에, 저소득층은 표면학습에만 사용. 53% 학생이 표절 우려로 사용 회피.",
      SOURCES: [
        { title: "HEPI-Kortext 학생 AI 조사 2025", url: "https://www.hepi.ac.uk/wp-content/uploads/2025/02/HEPI-Kortext-Student-Generative-AI-Survey-2025.pdf", credibility: "high" },
        { title: "DemandSage AI 교육통계", url: "https://www.demandsage.com/ai-in-education-statistics/", credibility: "high" },
        { title: "Turnitin 학생 행동 분석", url: "https://www.turnitin.com/blog/what-2025-generative-ai-trends-reveal-about-student-behavior", credibility: "medium" }
      ],
      PERSPECTIVES: {
        educators: "도구의 생산성 이득과 학습 저해 사이 균형 필요. AI를 사고 지원 도구로 재정의 필요",
        students: "AI 도구 접근성 불평등과 표절 우려로 인한 심리적 부담",
        institutions: "AI 가버넌스와 윤리적 리터러시 교육이 시급. 투명성 기반 정책 수립 필요"
      },
      SUGGESTED_ANGLE: "AI 네이티브 세대 vs AI 의존도: 대학가 AI 리터러시 교육의 긴급성"
    }
  },
  {
    id: 'source-1773093643287-2',
    reporting_brief: {
      WHO: "대학 행정부, EU 규제 당국, 교육 기술 업체, 대학교 리더",
      WHAT: "2026년 EU AI Act 고위험 AI 규정 시행(8월), 대학가 AI 가버넌스 체계 구축 필수. 학생 평가·입시·성과 모니터링 AI는 감사·편향 검증·인간 감시 필요",
      WHY: "규제 압박, 섀도우 AI 확산, 공중 신뢰 침식 우려. EDUCAUSE 조사: 80% 직원이 AI 사용하나 25% 미만만 정식 정책 인식",
      WHEN: "2026년 8월 EU AI Act 고위험 조항 시행. 현재 준비 단계",
      CONTEXT: "\"섀도우 AI\" 확산 - 미승인 도구로 연구 데이터, 학생 기록 유출. 대학 IT 부서 인식 밖의 AI 도구 다수 운영 중.",
      SOURCES: [
        { title: "EDUCAUSE 2024 AI 조사", url: "https://library.educause.edu/resources/2024/2/2024-educause-ai-landscape-study", credibility: "high" },
        { title: "EU AI Act", url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", credibility: "high" },
        { title: "UNESCO AI 윤리 권고안", url: "https://www.unesco.org/en/artificial-intelligence/recommendation-ethics", credibility: "high" }
      ],
      PERSPECTIVES: {
        regulators: "고위험 AI에 대한 엄격한 감시·감사·인간 감시 의무화",
        universities: "5단계 가버넌스 로드맵 필요 - 재고→정책→구조→리터러시→모니터링",
        researchers: "학생 데이터 보호와 학술 자유 사이 균형 필요"
      },
      SUGGESTED_ANGLE: "한국 대학가 AI 가버넌스 준비 현황 - EU 규제 선제적 대응 시급"
    }
  }
];

// Save reporting briefs
let savedCount = 0;
for (const brief of briefs) {
  // Load original source data
  try {
    const sourcePath = `pipeline/01-sourced/${brief.id}.json`;
    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    
    // Add reporting brief to source data
    sourceData.stage = 'reported';
    sourceData.reporting_brief = brief.reporting_brief;
    
    // Save to 03-reported
    fs.writeFileSync(
      `pipeline/03-reported/${brief.id}.json`,
      JSON.stringify(sourceData, null, 2)
    );
    
    // Remove from 01-sourced
    fs.unlinkSync(sourcePath);
    
    savedCount++;
  } catch (e) {
    console.error(`Error processing ${brief.id}: ${e.message}`);
  }
}

console.log(`STEP 2 완료: ${savedCount}개 기사 취재 완료 (01-sourced → 03-reported)`);
