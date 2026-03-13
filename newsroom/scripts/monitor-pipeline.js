const fs = require('fs');
const path = require('path');

console.log('\n🚀 파이프라인 흐름 추적 중...\n' + '='.repeat(80));

const PIPELINE_DIR = path.join(__dirname, '../pipeline');

// 모든 단계를 추적하며 동일한 기사를 찾기
const sourceFiles = fs.readdirSync(path.join(PIPELINE_DIR, '01-sourced')).filter(f => f.endsWith('.json'));

console.log(`\n📥 입력: 소스수집기 (${sourceFiles.length}개)`);

for (const sourceFile of sourceFiles) {
  const sourcePath = path.join(PIPELINE_DIR, '01-sourced', sourceFile);
  const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const sourceTitle = sourceContent.source.title;

  console.log(`\n  📄 ${sourceTitle.substring(0, 50)}`);
  console.log(`     파일: ${sourceFile}`);
  console.log(`     ID: ${sourceContent.id}`);

  // 다음 단계들에서 같은 기사 찾기
  const stages = ['02-assigned', '03-reported', '04-drafted', '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published'];
  let found = false;

  for (const stage of stages) {
    const stagePath = path.join(PIPELINE_DIR, stage);
    if (!fs.existsSync(stagePath)) continue;

    const files = fs.readdirSync(stagePath).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(stagePath, file), 'utf8'));
        
        // 제목으로 비교
        const stageTitle = content.draft?.headline || content.source?.title || '';
        
        if (stageTitle.includes(sourceTitle.substring(0, 20)) || 
            sourceTitle.includes(stageTitle.substring(0, 20))) {
          console.log(`     ✅ 발견: ${stage} → ${file}`);
          found = true;
          break;
        }
      } catch (e) {}
    }
    
    if (found) break;
  }

  if (!found) {
    console.log(`     ⏳ 아직 처리 중...`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('\n📊 파이프라인 상태 분석\n');

// 전체 카운트
const allStages = {
  '01-sourced': '소스수집기',
  '03-reported': '취재기자',
  '04-drafted': '작성기자',
  '05-fact-checked': '팩트체커',
  '06-desk-approved': '에디터/데스크',
  '07-copy-edited': '교열기자',
  '08-published': '발행에이전트'
};

let stageCounts = {};
for (const [stage, label] of Object.entries(allStages)) {
  const stagePath = path.join(PIPELINE_DIR, stage);
  if (fs.existsSync(stagePath)) {
    const files = fs.readdirSync(stagePath).filter(f => f.endsWith('.json'));
    stageCounts[stage] = files.length;
  }
}

console.log('각 단계별 기사 수:');
for (const [stage, label] of Object.entries(allStages)) {
  const count = stageCounts[stage] || 0;
  const status = count === 0 ? '(대기)' : `[${count}개]`;
  console.log(`  ${label.padEnd(15)} ${status}`);
}

console.log('\n💡 참고');
console.log('- 새 기사가 들어오면 약 30분 후 다음 단계로 이동합니다 (크론 주기)');
console.log('- 소스수집기의 기사는 취재기자 → 작성기자 → ... → 발행 순서로 처리됩니다\n');
