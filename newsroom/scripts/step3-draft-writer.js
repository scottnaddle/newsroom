const fs = require('fs');
const path = require('path');

// Create directories if needed
['pipeline/04-drafted', 'pipeline/memory'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// HTML 템플릿
const generateArticleHTML = (headline, content, accent, references) => {
  const accentColors = {
    'policy': '#4338ca',
    'research': '#059669',
    'industry': '#d97706',
    'opinion': '#7c3aed',
    'data': '#0284c7',
    'education': '#0891b2'
  };
  
  const color = accentColors[accent] || '#4338ca';
  
  // 참고자료 HTML 생성
  const referencesHTML = references.map((ref, idx) => 
    `<li><a href="${ref.url}" target="_blank">${ref.title}</a></li>`
  ).join('\n');
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${headline}</title>
<style>
body { font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; }
.wrapper { max-width: 680px; margin: 0 auto; font-size: 17px; line-height: 1.9; color: #1a1a2e; }
.lead-box { border-left: 4px solid ${color}; background: #f8f9ff; padding: 18px 22px; border-radius: 0 8px 8px 0; margin-bottom: 48px; }
h2 { font-size: 19px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin: 44px 0 20px 0; }
p { margin: 0 0 32px 0; }
blockquote { border-left: 4px solid ${color}; background: #f8f9ff; padding: 18px 22px; font-style: italic; color: #374151; margin: 32px 0; border-radius: 0 4px 4px 0; }
.references { border-top: 1px solid #e2e8f0; margin-top: 48px; padding-top: 32px; }
.ai-footer { margin: 48px 0 0; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #cbd5e1; }
</style>
</head>
<body>
<div class="wrapper">
<div class="lead-box">${content.intro}</div>
${content.sections.map(s => `<h2>${s.title}</h2>\n<p>${s.body}</p>`).join('\n')}
<div class="references">
<h3>참고자료</h3>
<ol>${referencesHTML}</ol>
</div>
<p class="ai-footer">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>
</div>
</body>
</html>`;
};

// 기사 초안 생성
const articles = [
  {
    id: 'source-1773093643285-0',
    slug: 'global-education-ai-transformation-2026',
    headline: '글로벌 교육 정책, AI 시대 미래형 인재 양성으로 전환',
    subheadline: 'UNESCO·OECD 주도 교육 혁신, 창의성·비판적 사고 역량 강조',
    category: 'education',
    accent: 'education',
    references: [
      { title: "UNESCO 2026 교육 미래 보고서", url: "https://www.dailyan.com" },
      { title: "OECD 국제협력 프레임워크", url: "https://www.oecd.org" },
      { title: "세계은행 2025 교육통계", url: "https://data.worldbank.org" }
    ],
    content: {
      intro: "<strong>AI 시대 글로벌 교육 정책이 대전환을 맞고 있다.</strong> 단순 지식 습득을 넘어 창의적 문제 해결 능력과 비판적 사고를 갖춘 인재 양성이 새로운 표준으로 자리 잡으면서, 각국 정부와 국제기구가 교육 시스템 근본 개혁에 나섰다.",
      sections: [
        {
          title: "기술 발전, 교육의 판도를 바꾸다",
          body: "전 세계적으로 인공지능과 디지털 전환이 급속도로 진행되면서 기존의 국가 중심 교육 시스템으로는 국경 없는 학습 환경과 초개인화된 학습 요구를 충족할 수 없다는 인식이 확산되고 있다. UNESCO는 최근 발표한 '2026 교육 미래 보고서'를 통해 각국이 교육 시스템을 유연하게 재편하고 평생 학습 체계를 강화해야 한다고 촉구했다. 팬데믹 이후 심화된 교육 격차와 디지털 교육 전환이라는 두 가지 과제를 동시에 해결해야 한다는 판단이다."
        },
        {
          title: "국제기구의 투자와 협력 확대",
          body: "경제협력개발기구(OECD)와 세계은행 등 국제 기구들은 각국이 교육 혁신을 위한 국제 협력을 강화하고 에듀테크를 활용한 맞춤형 학습 모델 개발에 적극 투자할 것을 권고하고 있다. 2025년 세계은행 통계에 따르면 전 세계 초등 교육 이수율은 90%에 육박했으나 고등 교육 진학률은 지역별 편차가 심하며, 특히 디지털 문해력 격차는 여전히 높은 수준으로 나타났다. 이에 각국 정부는 교육 데이터를 수집·분석해 정책 효과성을 검증하고 취약 계층을 위한 맞춤형 지원 프로그램을 강화하는 데 주력하고 있다."
        },
        {
          title: "미래형 인재상의 재정의",
          body: "앞으로 글로벌 교육 정책은 지속 가능한 발전 목표(SDGs) 달성과 인류 보편적 가치 함양이라는 큰 틀 아래에서 진행될 전망이다. 디지털 역량 강화, 기후 변화 교육, 다문화 이해 등 새로운 교육 의제들이 핵심 과제로 부상하고 있다. 국제 사회의 연대와 협력을 통해 모든 학습자가 미래 사회의 주역으로 성장할 수 있는 포용적인 교육 생태계를 구축하는 것이 글로벌 교육 정책의 최종 목표가 되고 있다."
        }
      ]
    }
  },
  {
    id: 'source-1773093643286-1',
    slug: 'ai-literacy-crisis-higher-ed-2026',
    headline: '92% 학생이 AI 사용하나, 3분의 1만 정식 교육받아',
    subheadline: '의존도 심화·사회 격차 우려... 대학가 AI 리터러시 교육 시급',
    category: 'education',
    accent: 'data',
    references: [
      { title: "HEPI-Kortext 학생 AI 조사 2025", url: "https://www.hepi.ac.uk/wp-content/uploads/2025/02/HEPI-Kortext-Student-Generative-AI-Survey-2025.pdf" },
      { title: "DemandSage AI 교육통계", url: "https://www.demandsage.com/ai-in-education-statistics/" },
      { title: "Turnitin 학생 행동 분석", url: "https://www.turnitin.com/blog/what-2025-generative-ai-trends-reveal-about-student-behavior" }
    ],
    content: {
      intro: "<strong>대학생의 92%가 AI 도구를 사용하고 있지만, 36%만이 정식 교육을 받은 것으로 나타났다.</strong> 기술의 급속한 확산과 리터러시 교육의 부족이 심각한 격차를 낳으면서, 대학가에서 체계적인 AI 리터러시 교육의 필요성이 제기되고 있다.",
      sections: [
        {
          title: "제한된 교육, 급증하는 사용률",
          body: "2024년 66%에서 2026년 92%로 급증한 대학생의 AI 사용률은 기술 도입의 속도를 여실히 보여준다. 그러나 Higher Education Policy Institute(HEPI)의 조사에 따르면 36%의 학생만이 기관으로부터 정식 교육이나 지원을 받았다. 이는 학생들이 AI 도구의 기능과 한계, 윤리적 사용 방법에 대한 적절한 교육 없이 사용하고 있다는 의미다. 특히 53%의 학생이 표절 우려로 인한 심리적 불안감을 느끼고 있어, 투명하고 명확한 가이드라인 부재의 심각성을 드러낸다."
        },
        {
          title: "심화심, 표면학습 차이 - 사회 격차가 교육 격차로",
          body: "HEPI 조사의 가장 우려스러운 발견은 사회경제적 지위에 따른 AI 활용 양극화다. 고소득 가정 학생들은 AI를 '구조화 사고·심화 연구'처럼 고차원적 과제에 활용하는 반면, 저소득층 학생들은 '요약·기본 설명' 같은 표면적 과제에만 사용하는 것으로 나타났다. 이는 기술 접근성의 불평등이 학습 결과의 격차로 직결되고 있음을 의미한다. 교육 불평등 완화는 고사하고 오히려 심화시킬 수 있다는 경고다."
        },
        {
          title: "대학의 '인간 중심' AI 거버넌스",
          body: "이 같은 문제를 해결하기 위해 선도 대학들은 새로운 접근을 시도하고 있다. 첫째, 투명성 강화 - 학생이 사용 가능한 도구와 위험성을 명확히 알 수 있도록 함. 둘째, 형평성 보장 - 모든 학생이 윤리적이고 검증된 AI 도구에 접근 가능하도록 지원. 셋째, AI 공개 정책 도입 - 학생이 작업 과정에서 AI 활용 여부를 명시적으로 밝히도록 권장한다. 이를 통해 표절 두려움을 완화하고 책임감 있는 AI 사용 문화를 조성하려는 노력이 진행 중이다."
        }
      ]
    }
  },
  {
    id: 'source-1773093643287-2',
    slug: 'eu-ai-act-higher-ed-governance-2026',
    headline: 'EU AI Act 8월 시행 임박... 대학가 AI 가버넌스 준비 시급',
    subheadline: '섀도우 AI 확산, 규제 압박 속 80% 직원 AI 사용하나 정책 인식 25% 이하',
    category: 'policy',
    accent: 'policy',
    references: [
      { title: "EDUCAUSE 2024 AI 조사", url: "https://library.educause.edu/resources/2024/2/2024-educause-ai-landscape-study" },
      { title: "EU AI Act", url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai" },
      { title: "UNESCO AI 윤리 권고안", url: "https://www.unesco.org/en/artificial-intelligence/recommendation-ethics" }
    ],
    content: {
      intro: "<strong>올 8월, 유럽연합(EU)의 AI 규제안이 본격 시행된다.</strong> 대학의 학생 평가, 입시 심사, 성과 모니터링에 사용되는 AI 시스템이 '고위험' 범주로 분류되면서 편향 검증, 감사 추적, 인간 감시 의무가 대학가에 큰 부담으로 다가오고 있다.",
      sections: [
        {
          title: "미승인 도구의 무분별한 확산 '섀도우 AI'",
          body: "현재 대학 캠퍼스에서 벌어지고 있는 가장 심각한 문제는 'AI 가버넌스의 진공 상태'다. EDUCAUSE의 2024 AI 조사에 따르면 80%의 교직원이 AI 도구를 사용하고 있으나, 25% 미만만 자신의 기관이 정식 AI 정책을 갖추고 있음을 인식하고 있다. 이는 승인되지 않은 채 운영되는 '섀도우 AI'의 확산을 의미한다. IT 부서도 모르는 AI 도구들이 학생 기록, 미공개 연구 데이터, 지적 재산을 외부 플랫폼으로 유출시키고 있는 상황이다."
        },
        {
          title: "규제와 신뢰의 갈림길",
          body: "EU AI Act는 학생 평가, 입시 선발, 성과 모니터링에 사용되는 AI를 '고위험' 범주로 분류했다. 이는 단순한 기술 관리를 넘어 기관의 사회적 신뢰 문제를 다룬다. UNESCO의 'AI 윤리 권고안'도 투명성 부재로 인한 대학 신뢰도 침식을 경고하고 있다. 규제 불준수는 과태료로 이어질 수 있고, 더 중요한 것은 대학의 공신력 훼손이다."
        },
        {
          title: "5단계 가버넌스 로드맵 필수",
          body: "선도 대학들이 추진하는 AI 가버넌스 로드맵은 다음과 같다. 첫째, AI 인벤토리 - 캠퍼스 전역의 AI 도구를 파악. 둘째, 정책 수립 - 허용·승인·금지 범위 명확화. 셋째, 거버넌스 구조 - 횡단 위원회 구성, 의사결정 권한 정의. 넷째, 리터러시 프로그램 - 교직원 교육. 다섯째, 지속적 모니터링 - 분기별 공급업체 검토, 실시간 고위험 시스템 감시. 대학은 '기술 도입 속도'와 '신뢰 관리'라는 두 마리 토끼를 잡기 위해 지금 행동해야 한다."
        }
      ]
    }
  }
];

// Save drafted articles
let savedCount = 0;
for (const article of articles) {
  try {
    const sourcePath = `pipeline/03-reported/${article.id}.json`;
    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    
    // Generate HTML
    const html = generateArticleHTML(article.headline, article.content, article.accent, article.references);
    
    // Calculate word count (plain text without tags)
    const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(' ').length;
    
    // Add draft to source data
    sourceData.stage = 'drafted';
    sourceData.draft = {
      headline: article.headline,
      subheadline: article.subheadline,
      html: html,
      slug: article.slug,
      ghost_tags: ['AI', 'Education', 'Policy'],
      custom_excerpt: article.subheadline,
      references: article.references,
      word_count: wordCount,
      category: article.category
    };
    
    // Save to 04-drafted
    fs.writeFileSync(
      `pipeline/04-drafted/${article.id}.json`,
      JSON.stringify(sourceData, null, 2)
    );
    
    // Remove from 03-reported
    fs.unlinkSync(sourcePath);
    
    savedCount++;
  } catch (e) {
    console.error(`Error processing ${article.id}: ${e.message}`);
  }
}

console.log(`STEP 3 완료: ${savedCount}개 기사 작성 완료 (03-reported → 04-drafted)`);
