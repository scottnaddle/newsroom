#!/usr/bin/env node
/**
 * 중복 기사 강제 삭제 (파일 완전 제거)
 * 사용법: node force-remove-duplicates.js
 */

const fs = require('fs');
const path = require('path');

const ANALYSIS_FILE = '/root/.openclaw/workspace/newsroom/pipeline/_status/duplicate-analysis.json';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const BACKUP_DIR = '/root/.openclaw/workspace/newsroom/pipeline/_backup-duplicates';

async function forceRemove() {
  try {
    console.log('📖 분석 결과 로드 중...\n');
    
    if (!fs.existsSync(ANALYSIS_FILE)) {
      console.log('❌ 분석 파일이 없습니다.');
      process.exit(1);
    }
    
    const analysis = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf8'));
    
    // 백업 디렉토리 생성
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    console.log(`✅ ${analysis.articlesToMove}개 중복 기사 제거 시작\n`);
    
    let removedCount = 0;
    let backupCount = 0;
    let errorCount = 0;
    
    // 각 그룹별로 처리
    for (const group of analysis.groups) {
      console.log(`\n📌 그룹 ${group.groupId}:`);
      console.log(`   유지: ${group.keep.filename}`);
      console.log(`   제거 대상: ${group.moveToDraft.length}개\n`);
      
      // 중복 기사 제거
      for (const article of group.moveToDraft) {
        try {
          const sourceFile = path.join(PUBLISHED_DIR, article.filename);
          
          if (!fs.existsSync(sourceFile)) {
            console.log(`   ⚠️  파일 없음: ${article.filename}`);
            continue;
          }
          
          // 1. 백업 디렉토리로 복사
          const backupFile = path.join(BACKUP_DIR, article.filename);
          fs.copyFileSync(sourceFile, backupFile);
          backupCount++;
          
          // 2. 원본 파일 삭제
          fs.unlinkSync(sourceFile);
          
          console.log(`   ✅ 제거: ${article.filename}`);
          removedCount++;
          
        } catch (error) {
          console.error(`   ❌ 오류 (${article.filename}):`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n═'.repeat(100));
    console.log(`\n✅ 작업 완료!\n`);
    console.log(`📊 결과:`);
    console.log(`   - 제거된 파일: ${removedCount}개`);
    console.log(`   - 백업된 파일: ${backupCount}개`);
    console.log(`   - 오류: ${errorCount}개`);
    
    console.log(`\n📁 변경 사항:`);
    console.log(`   - 08-published에서 ${removedCount}개 파일 완전 제거`);
    console.log(`   - 백업: ${BACKUP_DIR}`);
    
    console.log(`\n🔍 확인:`);
    const remaining = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json')).length;
    console.log(`   - Published 남은 기사: ${remaining}개`);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

forceRemove().catch(console.error);
