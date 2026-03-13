const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = path.join(__dirname, '../pipeline');
const AGENTS = [
  { name: '소스수집기', folder: '01-sourced', expectedFields: ['source'] },
  { name: '취재기자', folder: '03-reported', expectedFields: ['reporting_brief'] },
  { name: '작성기자', folder: '04-drafted', expectedFields: ['draft'] },
  { name: '팩트체커', folder: '05-fact-checked', expectedFields: ['fact_check'] },
  { name: '에디터/데스크', folder: '06-desk-approved', expectedFields: ['desk_decision'] },
  { name: '교열기자', folder: '07-copy-edited', expectedFields: ['copy_edit_report'] },
  { name: '발행에이전트', folder: '08-published', expectedFields: ['publish_result'] }
];

console.log('\n🔍 전체 에이전트 헬스 체크\n' + '='.repeat(60));

let totalIssues = 0;
let agentReports = [];

for (const agent of AGENTS) {
  const folderPath = path.join(PIPELINE_DIR, agent.folder);
  
  if (!fs.existsSync(folderPath)) {
    console.log(`\n❌ ${agent.name} (${agent.folder})`);
    console.log('   폴더 없음');
    totalIssues++;
    continue;
  }

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  console.log(`\n📄 ${agent.name} (${agent.folder})`);
  console.log(`   파일 수: ${files.length}`);

  let issues = {
    missingFields: [],
    invalidHTML: [],
    missingImages: [],
    otherErrors: []
  };

  for (const file of files.slice(0, files.length)) { // 모든 파일 검사
    try {
      const content = JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf8'));
      
      // 필수 필드 확인
      for (const field of agent.expectedFields) {
        if (!content[field]) {
          issues.missingFields.push({ file, field });
        }
      }

      // HTML 검증 (04-drafted 이상)
      if (agent.folder >= '04-drafted' && content.draft && content.draft.html) {
        if (!content.draft.html.includes('<!--kg-card-begin: html-->')) {
          issues.invalidHTML.push(file);
        }
        if (content.draft.html.length < 500) {
          issues.invalidHTML.push(`${file} (HTML too short: ${content.draft.html.length})`);
        }
      }

      // 이미지 검증 (04-drafted 이상)
      if (agent.folder >= '04-drafted') {
        if (content.draft && (!content.draft.feature_image || !content.draft.og_image)) {
          issues.missingImages.push(file);
        }
      }

    } catch (e) {
      issues.otherErrors.push(`${file}: ${e.message}`);
    }
  }

  // 보고
  if (issues.missingFields.length > 0) {
    console.log(`   ⚠️  필수 필드 누락: ${issues.missingFields.length}개`);
    totalIssues += issues.missingFields.length;
  }
  if (issues.invalidHTML.length > 0) {
    console.log(`   ⚠️  HTML 검증 실패: ${issues.invalidHTML.length}개`);
    totalIssues += issues.invalidHTML.length;
  }
  if (issues.missingImages.length > 0) {
    console.log(`   ⚠️  이미지 누락: ${issues.missingImages.length}개`);
    totalIssues += issues.missingImages.length;
  }
  if (issues.otherErrors.length > 0) {
    console.log(`   ⚠️  기타 오류: ${issues.otherErrors.length}개`);
    totalIssues += issues.otherErrors.length;
  }

  if (Object.values(issues).every(arr => arr.length === 0)) {
    console.log(`   ✅ 정상`);
  }

  agentReports.push({ agent: agent.name, issues });
}

console.log('\n' + '='.repeat(60));
console.log(`\n📊 최종 결과: 총 ${totalIssues}개 이슈 발견\n`);

if (totalIssues === 0) {
  console.log('✅ 모든 에이전트가 정상적으로 작동합니다!\n');
} else {
  console.log('⚠️  일부 이슈가 발견되었습니다.\n');
  console.log('상세 정보:');
  for (const report of agentReports) {
    if (Object.values(report.issues).some(arr => arr.length > 0)) {
      console.log(`\n${report.agent}:`);
      if (report.issues.missingFields.length > 0) {
        console.log(`  - 필드 누락: ${report.issues.missingFields.slice(0, 3).map(x => `${x.file}(${x.field})`).join(', ')}`);
      }
      if (report.issues.invalidHTML.length > 0) {
        console.log(`  - HTML: ${report.issues.invalidHTML.slice(0, 2).join(', ')}`);
      }
      if (report.issues.missingImages.length > 0) {
        console.log(`  - 이미지: ${report.issues.missingImages.slice(0, 3).join(', ')}`);
      }
    }
  }
}
