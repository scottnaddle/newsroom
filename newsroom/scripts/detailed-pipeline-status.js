const fs = require('fs');
const path = require('path');

console.log('\n🔬 파이프라인 상세 상태 분석\n' + '='.repeat(80));
console.log(`점검 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`);

const PIPELINE_DIR = path.join(__dirname, '../pipeline');

// 취재기자 (03-reported)
console.log('📋 취재기자 (03-reported) - 1개 기사\n');
const reportedDir = path.join(PIPELINE_DIR, '03-reported');
if (fs.existsSync(reportedDir)) {
  const files = fs.readdirSync(reportedDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(reportedDir, file), 'utf8'));
      const stat = fs.statSync(path.join(reportedDir, file));
      
      const title = content.source?.title || '제목 없음';
      const time = stat.mtime.toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      console.log(`  📄 ${file}`);
      console.log(`     제목: ${title.substring(0, 60)}`);
      console.log(`     생성: ${time}`);
      console.log(`     상태: ⏳ 작성기자에서 처리 대기`);
    } catch (e) {
      console.log(`  ⚠️  ${file}: 파싱 오류`);
    }
  }
}

// 교열기자 (07-copy-edited)
console.log('\n📋 교열기자 (07-copy-edited) - 3개 기사\n');
const copyDir = path.join(PIPELINE_DIR, '07-copy-edited');
if (fs.existsSync(copyDir)) {
  const files = fs.readdirSync(copyDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(copyDir, file), 'utf8'));
      const stat = fs.statSync(path.join(copyDir, file));
      
      const title = content.draft?.headline || content.source?.title || '제목 없음';
      const time = stat.mtime.toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      console.log(`  📄 ${file}`);
      console.log(`     제목: ${title.substring(0, 60)}`);
      console.log(`     생성: ${time}`);
      console.log(`     상태: ✅ 발행 대기 (다음 크론에서 Ghost에 발행)`);
    } catch (e) {
      console.log(`  ⚠️  ${file}: 파싱 오류`);
    }
  }
}

// 발행에이전트 최근 발행
console.log('\n📋 발행에이전트 (08-published) - 최근 발행 5개\n');
const pubDir = path.join(PIPELINE_DIR, '08-published');
if (fs.existsSync(pubDir)) {
  const files = fs.readdirSync(pubDir).filter(f => f.endsWith('.json'));
  const sorted = files.sort((a, b) => {
    const statA = fs.statSync(path.join(pubDir, a));
    const statB = fs.statSync(path.join(pubDir, b));
    return statB.mtime - statA.mtime;
  });

  for (const file of sorted.slice(0, 5)) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(pubDir, file), 'utf8'));
      const stat = fs.statSync(path.join(pubDir, file));
      
      const title = content.draft?.headline || content.source?.title || '제목 없음';
      const time = stat.mtime.toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      console.log(`  📄 ${file}`);
      console.log(`     제목: ${title.substring(0, 60)}`);
      console.log(`     발행: ${time}`);
      console.log(`     상태: ✅ 발행 완료`);
    } catch (e) {
      console.log(`  ⚠️  ${file}: 파싱 오류`);
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('\n📊 처리 흐름\n');
console.log('03-reported (1개) ');
console.log('    ↓ (다음 크론: ~00:30)');
console.log('04-drafted');
console.log('    ↓ (다음 크론: ~01:00)');
console.log('05-fact-checked');
console.log('    ↓ (다음 크론: ~01:30)');
console.log('06-desk-approved');
console.log('    ↓ (다음 크론: ~02:00)');
console.log('07-copy-edited (3개) ← 현재 대기');
console.log('    ↓ (다음 크론: ~02:30)');
console.log('08-published (76개) ← 발행 완료\n');

console.log('💡 참고');
console.log('- 교열기자에 있는 3개 기사는 최대 30분 내 발행됨');
console.log('- 취재기자의 1개 기사는 계속해서 파이프라인 처리 중\n');
