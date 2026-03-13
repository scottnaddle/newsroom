const fs = require('fs');
const path = require('path');

console.log('\n🔬 심화 진단 리포트\n' + '='.repeat(70));

// 1. 크론 작업 상태 확인
console.log('\n📅 크론 작업 상태');
const cronJobs = {
  '소스수집기': '2a7923e8-a292-435b-bd55-1ba0ec08032e',
  '에디터/데스크': 'c20081e1-73be-4856-8768-029c326676d6',
  '취재기자': 'bf5d972c-df27-480b-8b19-b32fcc8b4c25',
  '작성기자': 'd3c17519-5951-447f-af8b-f6d7494b82d9',
  '팩트체커': 'b0049592-2dac-4bb2-b718-f76fad8efdba',
  '교열기자': 'e57f7327-a883-492a-93eb-7ea54cb12d9e',
  '발행에이전트': 'cecbf113-6ac7-4cc1-8694-d65a040324ed'
};

for (const [agent, jobId] of Object.entries(cronJobs)) {
  console.log(`  ${agent}: ${jobId}`);
}

// 2. 파이프라인 흐름 확인
console.log('\n🔄 파이프라인 흐름');
const stages = [
  '01-sourced',
  '02-assigned',
  '03-reported',
  '04-drafted',
  '05-fact-checked',
  '06-desk-approved',
  '07-copy-edited',
  '08-published'
];

for (const stage of stages) {
  const dir = path.join(__dirname, '../pipeline', stage);
  if (!fs.existsSync(dir)) {
    console.log(`  ${stage}: ❌ 없음`);
    continue;
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const status = files.length === 0 ? '(empty)' : `${files.length}개`;
  
  if (files.length > 0) {
    // 최근 기사 확인
    const recent = files.sort().pop();
    console.log(`  ${stage}: ✅ ${status} [최근: ${recent.substring(0, 40)}...]`);
  } else {
    console.log(`  ${stage}: ⚠️  ${status}`);
  }
}

// 3. 발행 기사 검증
console.log('\n📰 발행 기사 (08-published) 상세 검사');
const pubDir = path.join(__dirname, '../pipeline/08-published');
if (fs.existsSync(pubDir)) {
  const files = fs.readdirSync(pubDir).filter(f => f.endsWith('.json'));
  console.log(`  총 ${files.length}개 기사`);

  let stats = {
    withPublishResult: 0,
    withoutPublishResult: 0,
    validHTML: 0,
    invalidHTML: 0,
    withImages: 0,
    withoutImages: 0
  };

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(pubDir, file), 'utf8'));
      
      if (content.publish_result) stats.withPublishResult++;
      else stats.withoutPublishResult++;

      if (content.draft && content.draft.html && content.draft.html.length > 500) {
        stats.validHTML++;
      } else {
        stats.invalidHTML++;
      }

      if (content.draft && content.draft.feature_image && content.draft.og_image) {
        stats.withImages++;
      } else {
        stats.withoutImages++;
      }
    } catch (e) {
      console.log(`    ⚠️  ${file}: 파싱 오류`);
    }
  }

  console.log(`\n  publish_result 필드:`);
  console.log(`    ✅ 있음: ${stats.withPublishResult}개`);
  console.log(`    ❌ 없음: ${stats.withoutPublishResult}개`);
  
  console.log(`\n  HTML 유효성:`);
  console.log(`    ✅ 유효: ${stats.validHTML}개`);
  console.log(`    ❌ 무효: ${stats.invalidHTML}개`);
  
  console.log(`\n  이미지 완정도:`);
  console.log(`    ✅ 완전: ${stats.withImages}개`);
  console.log(`    ⚠️  불완전: ${stats.withoutImages}개`);
}

// 4. Ghost 연동 확인
console.log('\n👻 Ghost 연동 상태');
const configPath = path.join(__dirname, '../shared/config/ghost.json');
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`  API URL: ${config.apiUrl}`);
    console.log(`  API Key: ${config.adminApiKey ? '✅ 설정됨' : '❌ 없음'}`);
  } catch (e) {
    console.log(`  ❌ 설정 파일 오류: ${e.message}`);
  }
}

// 5. 최근 에이전트 활동
console.log('\n📊 최근 활동 (48시간)');
const now = Date.now();
const twoHoursAgo = now - 2 * 60 * 60 * 1000;

let recentFiles = [];
for (const stage of stages) {
  const dir = path.join(__dirname, '../pipeline', stage);
  if (!fs.existsSync(dir)) continue;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.mtime.getTime() > twoHoursAgo) {
      recentFiles.push({ stage, file, time: stat.mtime });
    }
  }
}

if (recentFiles.length > 0) {
  recentFiles.sort((a, b) => b.time - a.time);
  console.log(`  최근 ${recentFiles.length}개 파일:`);
  for (const item of recentFiles.slice(0, 5)) {
    const timeStr = item.time.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log(`    ${item.stage}: ${item.file.substring(0, 40)}... (${timeStr})`);
  }
} else {
  console.log(`  ⚠️  최근 2시간 내 활동 없음`);
}

console.log('\n' + '='.repeat(70) + '\n');
