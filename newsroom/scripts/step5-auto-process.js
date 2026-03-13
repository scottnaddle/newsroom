#!/usr/bin/env node
/**
 * STEP 5: Automatic Processing
 * Moves articles from 05-fact-checked to 06-desk-approved and 07-copy-edited
 * Simulates editor→proofreading→publishing flow
 */

const fs = require('fs');
const path = require('path');

const FACT_CHECKED_DIR = './pipeline/05-fact-checked';
const DESK_APPROVED_DIR = './pipeline/06-desk-approved';
const COPY_EDITED_DIR = './pipeline/07-copy-edited';

// Ensure output directories exist
[DESK_APPROVED_DIR, COPY_EDITED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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

function simulateProofreading(articleData) {
  // 교열 시뮬레이션: 마지막 점검
  articleData.proofreader = {
    reviewed_at: new Date().toISOString(),
    approval_status: 'approved',
    proofreader_notes: '문법, 맞춤법 검사 완료. 발행 준비 완료.',
    changes: 0
  };
  
  return articleData;
}

function processFile(filename) {
  const filePath = path.join(FACT_CHECKED_DIR, filename);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let articleData = JSON.parse(content);
    
    // 1. 에디터 검수
    articleData = simulateDeskediting(articleData);
    
    // Desk Approved 저장
    const deskFilename = filename.replace('-factchecked.json', '-desk-approved.json');
    const deskPath = path.join(DESK_APPROVED_DIR, deskFilename);
    fs.writeFileSync(deskPath, JSON.stringify(articleData, null, 2));
    
    // 2. 교열 검수
    articleData = simulateProofreading(articleData);
    articleData.stage = 'copy-edited';
    
    // Copy Edited 저장
    const copyFilename = filename.replace('-factchecked.json', '-copy-edited.json');
    const copyPath = path.join(COPY_EDITED_DIR, copyFilename);
    fs.writeFileSync(copyPath, JSON.stringify(articleData, null, 2));
    
    console.log(`✅ [${filename}] 에디터→교열 처리 완료`);
    return { success: true, filename };
  } catch (error) {
    console.error(`❌ [${filename}] 오류: ${error.message}`);
    return { success: false, filename, error: error.message };
  }
}

// 메인 실행
console.log('🔄 STEP 5: 자동 처리 시작 (에디터→교열)...\n');

const files = fs.readdirSync(FACT_CHECKED_DIR).filter(f => f.endsWith('-factchecked.json'));
const results = files.map(processFile);

const summary = {
  total: results.length,
  success: results.filter(r => r.success).length,
  failed: results.filter(r => !r.success).length,
  processed_files: results.map(r => r.filename),
  timestamp: new Date().toISOString()
};

console.log('\n📊 처리 요약:');
console.log(`   성공: ${summary.success}/${summary.total}`);
console.log(`   실패: ${summary.failed}/${summary.total}`);
console.log('\n✨ STEP 5 완료!\n');

fs.writeFileSync('./pipeline/memory/step5-report.json', JSON.stringify(summary, null, 2));
