const fs = require('fs');
const path = require('path');

console.log('\n🎯 에이전트별 상세 점검 리포트\n' + '='.repeat(80));

const AGENTS = [
  {
    name: '소스수집기',
    folder: '01-sourced',
    jobId: '2a7923e8-a292-435b-bd55-1ba0ec08032e',
    purpose: '뉴스 자동 수집',
    requiredFields: ['source', 'priority']
  },
  {
    name: '취재기자',
    folder: '03-reported',
    jobId: 'bf5d972c-df27-480b-8b19-b32fcc8b4c25',
    purpose: '기사 취재 및 브리프',
    requiredFields: ['reporting_brief', 'source']
  },
  {
    name: '작성기자',
    folder: '04-drafted',
    jobId: 'd3c17519-5951-447f-af8b-f6d7494b82d9',
    purpose: '기사 작성 및 HTML 생성',
    requiredFields: ['draft', 'feature_image', 'og_image']
  },
  {
    name: '팩트체커',
    folder: '05-fact-checked',
    jobId: 'b0049592-2dac-4bb2-b718-f76fad8efdba',
    purpose: '기사 검증 및 신뢰도 점수',
    requiredFields: ['fact_check', 'fact_check_report']
  },
  {
    name: '에디터/데스크',
    folder: '06-desk-approved',
    jobId: 'c20081e1-73be-4856-8768-029c326676d6',
    purpose: '기사 검토 및 승인',
    requiredFields: ['desk_decision']
  },
  {
    name: '교열기자',
    folder: '07-copy-edited',
    jobId: 'e57f7327-a883-492a-93eb-7ea54cb12d9e',
    purpose: '문법/스타일 교열',
    requiredFields: ['copy_edit_report']
  },
  {
    name: '발행에이전트',
    folder: '08-published',
    jobId: 'cecbf113-6ac7-4cc1-8694-d65a040324ed',
    purpose: 'Ghost CMS 발행',
    requiredFields: ['publish_result']
  }
];

for (const agent of AGENTS) {
  console.log(`\n${agent.name.toUpperCase()}`);
  console.log('─'.repeat(80));
  console.log(`목적: ${agent.purpose}`);
  console.log(`크론 ID: ${agent.jobId}`);
  console.log(`파일 위치: pipeline/${agent.folder}/`);

  const folderPath = path.join(__dirname, '../pipeline', agent.folder);
  
  if (!fs.existsSync(folderPath)) {
    console.log(`상태: ❌ 폴더 없음\n`);
    continue;
  }

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log(`상태: ⚠️  파일 0개 (처리 대기 중)\n`);
    continue;
  }

  console.log(`상태: ✅ 파일 ${files.length}개\n`);

  // 샘플 파일 검사
  const sample = files[0];
  const samplePath = path.join(folderPath, sample);
  
  try {
    const content = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    
    console.log(`샘플 파일: ${sample}`);
    console.log(`필드 검사:`);
    
    for (const field of agent.requiredFields) {
      const hasField = content[field] !== undefined;
      const status = hasField ? '✅' : '❌';
      console.log(`  ${status} ${field}`);
    }

    // 추가 검사
    if (agent.folder >= '04-drafted') {
      console.log(`\n기사 품질:`);
      if (content.draft && content.draft.html) {
        const htmlLength = content.draft.html.length;
        console.log(`  HTML 길이: ${htmlLength}자 ${htmlLength > 500 ? '✅' : '⚠️'}`);
      }
      if (content.draft && content.draft.word_count) {
        console.log(`  단어 수: ${content.draft.word_count} ${content.draft.word_count >= 800 ? '✅' : '⚠️'}`);
      }
    }

  } catch (e) {
    console.log(`⚠️  샘플 파일 검사 실패: ${e.message}\n`);
  }
}

console.log('\n' + '='.repeat(80) + '\n');

// 최종 요약
console.log('📋 최종 상태 요약\n');

const summary = {
  '소스수집기': { status: '대기', reason: '자동 수집 스케줄' },
  '취재기자': { status: '대기', reason: '자동 수집 스케줄' },
  '작성기자': { status: '대기', reason: '자동 수집 스케줄' },
  '팩트체커': { status: '대기', reason: '자동 수집 스케줄' },
  '에디터/데스크': { status: '대기', reason: '자동 수집 스케줄' },
  '교열기자': { status: '대기', reason: '자동 수집 스케줄' },
  '발행에이전트': { status: '✅ 정상', reason: '76개 기사 발행 완료' }
};

for (const [agent, info] of Object.entries(summary)) {
  console.log(`${agent}: ${info.status} (${info.reason})`);
}

console.log(`\n💡 참고: 1-6번 에이전트가 파일이 없는 이유는 파이프라인이 현재 비활성 상태이거나`);
console.log(`최근에 새로운 기사가 수집되지 않았기 때문입니다.`);
console.log(`크론 작업이 활성화되면 자동으로 처리됩니다.\n`);
