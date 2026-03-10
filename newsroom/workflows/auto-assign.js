#!/usr/bin/env node
/**
 * Auto-Assign Script
 * 01-sourced → 02-assigned 자동 할당
 * 
 * 실행: node workflows/auto-assign.js
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const SOURCED_DIR = path.join(PIPELINE_DIR, '01-sourced');
const ASSIGNED_DIR = path.join(PIPELINE_DIR, '02-assigned');

console.log('📋 Auto-Assign 시작:', new Date().toLocaleString('ko-KR'));

// 01-sourced 폴더 확인
if (!fs.existsSync(SOURCED_DIR)) {
  console.log('❌ 01-sourced 폴더 없음');
  process.exit(0);
}

// 02-assigned 폴더 생성
if (!fs.existsSync(ASSIGNED_DIR)) {
  fs.mkdirSync(ASSIGNED_DIR, { recursive: true });
}

// 소싱된 기사 목록
const sourcedFiles = fs.readdirSync(SOURCED_DIR)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'));

if (sourcedFiles.length === 0) {
  console.log('✅ 할당할 기사 없음');
  process.exit(0);
}

console.log(`📄 할당 대상: ${sourcedFiles.length}개 기사`);

let assigned = 0;
let skipped = 0;

sourcedFiles.forEach(file => {
  try {
    const srcPath = path.join(SOURCED_DIR, file);
    const dstPath = path.join(ASSIGNED_DIR, file);
    
    // 이미 할당된 경우 스킵
    if (fs.existsSync(dstPath)) {
      console.log(`  ⏭️ 스킵 (이미 할당됨): ${file}`);
      skipped++;
      return;
    }
    
    // JSON 읽기
    const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    
    // stage 업데이트
    data.stage = 'assigned';
    data.assigned_at = new Date().toISOString();
    data.assigned_to = 'reporter';
    
    // audit_log 추가
    if (!data.audit_log) data.audit_log = [];
    data.audit_log.push({
      agent: 'auto-assign',
      action: 'assigned',
      timestamp: new Date().toISOString(),
      note: `자동 할당: ${file}`
    });
    
    // 할당 폴더로 이동
    fs.writeFileSync(dstPath, JSON.stringify(data, null, 2));
    fs.unlinkSync(srcPath);
    
    console.log(`  ✅ 할당 완료: ${file}`);
    assigned++;
    
  } catch (err) {
    console.log(`  ❌ 오류: ${file} - ${err.message}`);
  }
});

console.log('');
console.log('📊 결과:');
console.log(`  - 할당 완료: ${assigned}개`);
console.log(`  - 스킵: ${skipped}개`);
console.log('');
console.log('✅ Auto-Assign 완료:', new Date().toLocaleString('ko-KR'));
