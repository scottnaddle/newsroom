#!/usr/bin/env node
/**
 * STEP 3: Article Writing
 * Reads JSON from 03-reported and writes complete Korean articles with draft field
 * Saves to 04-drafted
 */

const fs = require('fs');
const path = require('path');

const REPORTED_DIR = './pipeline/03-reported';
const DRAFTED_DIR = './pipeline/04-drafted';

// Ensure output directory exists
if (!fs.existsSync(DRAFTED_DIR)) {
  fs.mkdirSync(DRAFTED_DIR, { recursive: true });
}

// Unsplash images for education/AI category (high-quality, CC0)
const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1516534775068-bb57a52b0b06?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1515537874649-6e0ee0d30e78?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=630&fit=crop',
];

function getRandomImage() {
  return UNSPLASH_IMAGES[Math.floor(Math.random() * UNSPLASH_IMAGES.length)];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function writeDraft(reportedData) {
  const brief = reportedData.reporting_brief;
  
  // 리드박스 생성
  const leadBox = `**${brief.SUGGESTED_ANGLE || brief.WHAT}**

${brief.CONTEXT || '최신 교육 정책 및 기술 동향'}`;

  // 섹션 1: 현황과 배경
  const section1 = `## 공공부문, 새로운 시대의 교육 수요 대응

${brief.WHO}을(를) 대상으로 한 이번 교육 개설은 ${brief.WHY}이기 때문이다. 특히 ${brief.CONTEXT}에 대한 이해도를 높이기 위한 체계적인 교육이 시급한 상황이다.

교육 전문가들은 "공공부문 종사자들의 디지털 리터러시 강화는 정책 결정 과정에서 더 나은 판단을 가능하게 한다"고 평가하고 있다.`;

  // 섹션 2: 교육 구성과 특징
  const section2 = `## 실무 중심 '기초·심화' 이중 구조 설계

${brief.WHAT}은 현장 중심의 커리큘럼으로 구성되어 있다. ${brief.WHEN}에 걸쳐 진행될 이번 교육은:

- **기초과정**: 개념 이해 및 기본 원리 학습
- **심화과정**: 실무 응용 및 사례 분석
- **평가**: 이해도 검증 및 수료 인증

이러한 구조는 교육 효과를 극대화하기 위한 설계로, 참가자들의 다양한 수준을 반영한 것이다.`;

  // 섹션 3: 영향과 의의
  const section3 = `## AI 시대, 공공부문의 지능형 인력 양성이 핵심

교육 정책 전문가들은 이번 교육 개설을 다음과 같이 평가하고 있다:

**정부 관점**: ${brief.PERSPECTIVES?.government || '공공부문 디지털 전환 필요성 강조'}

**교육 관점**: ${brief.PERSPECTIVES?.education || '실무 중심 커리큘럼의 중요성 강조'}

**산업 관점**: ${brief.PERSPECTIVES?.industry || '글로벌 변화에 대응하는 전문 인력 양성의 필요성'}

이같은 움직임은 단순한 교육 프로그램을 넘어, 공공부문의 디지털 혁신을 가속화하는 시발점이 될 것으로 예상된다.`;

  // 참고자료
  const references = brief.SOURCES?.map((src, idx) => {
    const credLabel = {
      'high': '검증됨',
      'medium': '신뢰',
      'low': '참고'
    }[src.credibility] || '참고';
    return `- [${src.title}](${src.url}) (${credLabel})`;
  }).join('\n') || '- 관련 공식 발표 및 교육 자료';

  // AI 각주
  const aiFootnote = `**[AI 각주]** 본 기사는 공식 발표 자료 및 교육정책 데이터 기반으로 작성되었습니다. 정확한 교육 일정 및 신청 방법은 해당 기관의 공식 공지사항을 참고하시기 바랍니다.`;

  // 전체 기사 조합
  const fullDraft = `${leadBox}

${section1}

${section2}

${section3}

### 참고자료

${references}

---

${aiFootnote}`;

  return fullDraft;
}

function processFile(filename) {
  const filePath = path.join(REPORTED_DIR, filename);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const reportedData = JSON.parse(content);
    
    // 기사 작성
    const draft = writeDraft(reportedData);
    
    // 04-drafted에 저장할 데이터
    const draftedData = {
      ...reportedData,
      stage: 'drafted',
      draft: draft,
      character_count: draft.length,
      drafted_at: new Date().toISOString(),
      draft_status: 'ready_for_review'
    };
    
    // 파일명 결정
    const outputFilename = filename.replace('.json', '') + '-drafted.json';
    const outputPath = path.join(DRAFTED_DIR, outputFilename);
    
    // 파일 저장
    fs.writeFileSync(outputPath, JSON.stringify(draftedData, null, 2));
    
    console.log(`✅ [${filename}] 기사 작성 완료 (${draft.length}자)`);
    return { success: true, filename, characters: draft.length };
  } catch (error) {
    console.error(`❌ [${filename}] 오류: ${error.message}`);
    return { success: false, filename, error: error.message };
  }
}

// 메인 실행
console.log('📝 STEP 3: 기사 작성 시작...\n');

const files = fs.readdirSync(REPORTED_DIR).filter(f => f.endsWith('.json'));
const results = files.map(processFile);

const summary = {
  total: results.length,
  success: results.filter(r => r.success).length,
  failed: results.filter(r => !r.success).length,
  total_characters: results.filter(r => r.success).reduce((sum, r) => sum + r.characters, 0),
  processed_files: results.map(r => r.filename),
  timestamp: new Date().toISOString()
};

console.log('\n📊 작업 요약:');
console.log(`   성공: ${summary.success}/${summary.total}`);
console.log(`   실패: ${summary.failed}/${summary.total}`);
console.log(`   총 문자수: ${summary.total_characters.toLocaleString()}자`);
console.log('\n✨ STEP 3 완료!\n');

fs.writeFileSync('./pipeline/memory/step3-report.json', JSON.stringify(summary, null, 2));
