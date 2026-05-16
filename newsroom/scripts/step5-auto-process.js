#!/usr/bin/env node
/**
 * STEP 5: Automatic Processing
 * Moves articles from 05-fact-checked to 06-desk-approved and 07-copy-edited
 * Simulates editor→proofreading→publishing flow
 * 🚨 Added: Education relevance verification (final safety net)
 */

const fs = require('fs');
const path = require('path');

const FACT_CHECKED_DIR = './pipeline/05-fact-checked';
const DESK_APPROVED_DIR = './pipeline/06-desk-approved';
const REJECTED_DIR = './pipeline/rejected';

// Ensure output directories exist
[DESK_APPROVED_DIR, REJECTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 🔍 교육 관련성 최종 확인 (안전망)
function isEducationRelevant(data) {
  const draft = data.draft || {};
  const headline = draft.headline || '';
  const html = draft.html || '';
  const sourceTitle = (data.source && data.source.title) || '';
  const sourceDesc = (data.source && data.source.description) || '';
  
  const checkText = (headline + ' ' + sourceTitle + ' ' + sourceDesc + ' ' + html).toLowerCase();

  // 교육 관련 키워드 (한국어)
  const koreanEduKeywords = [
    '교육', '학교', '교실', '교사', '학생', '수업', '학원', '대학', '에듀테크',
    '교과', '교육과정', '리터러시', '학습', '교수', '대학교', '강의', '튜터',
    '강좌', '직업교육', '학술', '교재', '입시', '학부모', '교육청', '교육부',
    '학령', '교원', '학위', '학년', '교과서', '방과후', '진학', '장학',
    '연수', '자격증', '면학', '평생교육', '인재양성', '인재', '교육자',
    '교직', '교육학', '교육기관', '교육계', '교육현장'
  ];

  // 교육 관련 키워드 (영어)
  const englishEduKeywords = [
    'education', 'school', 'classroom', 'teacher', 'student', 'curriculum',
    'literacy', 'learning', 'teaching', 'pedagogy', 'pedagogical',
    'academic', 'university', 'college', 'training', 'course', 'edtech',
    'k-12', 'k–12', 'k12', 'lecture', 'tutorial', 'tutoring', 'tutor',
    'graduate', 'undergraduate', 'degree', 'scholarship', 'campus',
    'lesson', 'homework', 'exam', 'coursework',
    'higher education', 'vocational', 'homeschool', 'preschool',
    'kindergarten', 'elementary', 'secondary', 'high school',
    'student learning', 'student outcomes', 'instructional',
    'online learning', 'remote learning', 'educational technology',
    'teacher training', 'faculty', 'professor', 'lecturer',
    'didactic', 'course design', 'learning outcomes',
    'educational', 'schooling'
  ];

  // 비교육 신호 (교육과 무관한 AI 기사 걸러내기)
  const nonEduSignals = [
    '의료', '병원', '진단', '치료', '수술', '약물', '환자', '임상',
    '단백질', '유전자', '게놈', 'DNA', 'RNA', '세포', '바이러스',
    'medical', 'diagnosis', 'cancer', 'clinical', 'protein',
    'genome', 'genetic', 'drug', 'patient', 'surgery',
    'startup funding', 'series a', 'series b', 'venture capital',
    'IPO', 'funding round', 'acquisition'
  ];

  let eduScore = 0;
  for (const kw of koreanEduKeywords) {
    if (checkText.includes(kw)) eduScore += 2;
  }
  for (const kw of englishEduKeywords) {
    if (checkText.includes(kw)) eduScore += 1;
  }

  let nonEduScore = 0;
  for (const sig of nonEduSignals) {
    if (checkText.includes(sig)) nonEduScore += 2;
  }

  return eduScore >= 2 && eduScore > nonEduScore;
}

function simulateDeskediting(articleData) {
  // 에디터 검수 시뮬레이션: 메타데이터 강화
  articleData.editor = {
    reviewed_at: new Date().toISOString(),
    approval_status: 'approved',
    editor_notes: '기사 구조 양호, 사실관계 검증 완료. 발행 승인.',
    edits: []
  };
  
  return articleData;
}

function processFile(filename) {
  const filePath = path.join(FACT_CHECKED_DIR, filename);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let articleData = JSON.parse(content);
    
    // 🚨 교육 관련성 최종 확인
    if (!isEducationRelevant(articleData)) {
      const headline = (articleData.draft && articleData.draft.headline) || filename;
      console.log(`⛔ [${filename}] 교육 관련성 없음 → REJECTED`);
      console.log(`   헤드라인: "${headline.substring(0, 60)}..."`);
      
      // Rejected로 이동
      const rejectPath = path.join(REJECTED_DIR, filename);
      fs.writeFileSync(rejectPath, JSON.stringify({
        ...articleData,
        editor: {
          reviewed_at: new Date().toISOString(),
          approval_status: 'rejected',
          rejection_reason: '교육 관련성 부족: 헤드라인/본문에 교육 관련 키워드 없음'
        }
      }, null, 2));
      fs.unlinkSync(filePath);
      return { success: false, filename, reason: 'education_relevance_fail' };
    }
    
    // 1. 에디터 검수
    articleData = simulateDeskediting(articleData);
    
    // Desk Approved 저장
    let deskFilename;
    if (filename.includes('-factchecked.json')) {
      deskFilename = filename.replace('-factchecked.json', '-desk-approved.json');
    } else {
      deskFilename = 'report-' + filename.replace('.json', '-desk-approved.json');
    }
    const deskPath = path.join(DESK_APPROVED_DIR, deskFilename);
    fs.writeFileSync(deskPath, JSON.stringify(articleData, null, 2));
    
    // Remove source file
    fs.unlinkSync(filePath);
    
    console.log(`✅ [${filename}] 에디터 검수 완료 → ${deskFilename}`);
    return { success: true, filename };
  } catch (error) {
    console.error(`❌ [${filename}] 오류: ${error.message}`);
    return { success: false, filename, error: error.message };
  }
}

// 메인 실행
console.log('🔄 STEP 5: 자동 처리 시작 (교육 관련성 검증 → 에디터 검수)...\n');

const files = fs.readdirSync(FACT_CHECKED_DIR).filter(f => f.endsWith('.json'));
const results = files.map(processFile);

const summary = {
  total: results.length,
  success: results.filter(r => r.success).length,
  failed: results.filter(r => !r.success).length,
  education_relevance_rejected: results.filter(r => r.reason === 'education_relevance_fail').length,
  processed_files: results.map(r => r.filename),
  timestamp: new Date().toISOString()
};

console.log('\n📊 처리 요약:');
console.log(`   전체: ${summary.total}`);
console.log(`   ✅ 승인: ${summary.success}`);
console.log(`   ⛔ 교육 무관 제외: ${summary.education_relevance_rejected}`);
console.log(`   ❌ 오류: ${summary.failed - summary.education_relevance_rejected}`);
console.log('\n✨ STEP 5 완료!\n');

fs.writeFileSync('./pipeline/memory/step5-report.json', JSON.stringify(summary, null, 2));
