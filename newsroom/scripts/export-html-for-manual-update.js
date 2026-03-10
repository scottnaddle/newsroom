#!/usr/bin/env node
/**
 * export-html-for-manual-update.js
 * 
 * Ghost Admin UI에서 수동으로 복사/붙여넣기할 수 있도록
 * HTML을 정리된 형식으로 출력
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const PUBLISHED_DIR = path.join(PIPELINE_DIR, '08-published');
const OUTPUT_FILE = path.join(PIPELINE_DIR, 'html-for-manual-update.md');

console.log('📋 Ghost 수동 업데이트용 HTML 정리 중...\n');

const files = fs.readdirSync(PUBLISHED_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

let output = `# Ghost Admin 수동 HTML 업데이트 가이드\n\n`;
output += `생성일시: ${new Date().toISOString()}\n`;
output += `총 기사: ${files.length}개\n\n`;
output += `---\n\n`;

let count = 0;

for (const file of files) {
  try {
    const art = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8'));
    
    if (!art.draft?.html || !art.draft?.headline) continue;

    count++;
    
    const headline = art.draft.headline;
    const ghostId = art.ghost_id || '(ID 없음)';
    const html = art.draft.html;
    
    output += `## ${count}. ${headline}\n\n`;
    output += `**파일:** \`${file}\`\n`;
    output += `**Ghost ID:** \`${ghostId}\`\n`;
    output += `**문자수:** ${html.length}자\n\n`;
    output += `### HTML (복사해서 Ghost Admin Editor에 붙여넣기)\n\n`;
    output += `\`\`\`html\n${html}\n\`\`\`\n\n`;
    output += `---\n\n`;
    
  } catch (e) {
    // skip
  }
}

fs.writeFileSync(OUTPUT_FILE, output);

console.log(`✅ 완료: ${count}개 기사`);
console.log(`📁 파일: ${OUTPUT_FILE}`);
console.log(`\n사용법:`);
console.log(`1. 위 파일을 열기`);
console.log(`2. 각 \`\`\`html...\`\`\` 블록을 선택 → 복사`);
console.log(`3. Ghost Admin Editor에 붙여넣기`);
console.log(`4. Status: draft로 변경 후 Save`);
