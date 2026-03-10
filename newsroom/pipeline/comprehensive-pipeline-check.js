const fs = require('fs');
const path = require('path');

const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
let report = `# 🏗️ 파이프라인 전체 현황 점검 — ${new Date().toLocaleString('ko-KR')}\n\n`;

const stages = [
  '01-sourced',
  '02-assigned',
  '03-reported',
  '04-drafted',
  '05-fact-checked',
  '06-desk-approved',
  '07-copy-edited',
  '08-published',
  'rejected'
];

report += '## 📊 각 단계별 기사 수\n\n';
report += '| 단계 | 파일 수 | 상태 |\n';
report += '|------|--------|------|\n';

let stats = {};

stages.forEach(stage => {
  const dir = `./${stage}`;
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.startsWith('REVISE_') && !f.startsWith('DESK_'))
      .length;
    stats[stage] = files;
    const icon = files === 0 ? '✅' : files < 5 ? '⚠️' : '📋';
    report += `| ${stage} | ${files}개 | ${icon} |\n`;
  } else {
    stats[stage] = 0;
    report += `| ${stage} | 0개 | ❌ |\n`;
  }
});

report += `\n## 🔍 핵심 지표\n\n`;

// 발행율 계산
const published = stats['08-published'] || 0;
const sourced = stats['01-sourced'] || 0;
const publishRate = sourced > 0 ? ((published / sourced) * 100).toFixed(1) : 0;

report += `- **발행된 기사**: ${published}개\n`;
report += `- **수집된 기사**: ${sourced}개\n`;
report += `- **발행율**: ${publishRate}%\n`;
report += `- **rejected 기사**: ${stats['rejected'] || 0}개\n\n`;

// rejected 폴더 분석
if (fs.existsSync('./rejected')) {
  const rejectedFiles = fs.readdirSync('./rejected').filter(f => f.endsWith('.json'));
  if (rejectedFiles.length > 0) {
    report += `### ❌ 최근 거부된 기사\n\n`;
    rejectedFiles.slice(-5).forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(`./rejected/${file}`, 'utf8'));
        const headline = data.draft?.headline || data.headline || '제목 없음';
        const reason = data.rejection_reason || data.reason || '사유 미기재';
        report += `- **${headline}**\n  - 사유: ${reason}\n`;
      } catch (e) {
        report += `- ${file} (파싱 오류)\n`;
      }
    });
    report += `\n`;
  }
}

// 06-desk-approved 폴더 확인
if (fs.existsSync('./06-desk-approved')) {
  const deskFiles = fs.readdirSync('./06-desk-approved').filter(f => f.endsWith('.json'));
  report += `### 📋 데스크 승인 대기 (REVISE 포함)\n\n`;
  
  const activeArticles = deskFiles.filter(f => !f.startsWith('REVISE_'));
  const reviseRequests = deskFiles.filter(f => f.startsWith('REVISE_'));
  
  if (activeArticles.length > 0) {
    report += `**승인 대기 기사**: ${activeArticles.length}개\n\n`;
    activeArticles.forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(`./06-desk-approved/${file}`, 'utf8'));
        const headline = data.draft?.headline || '제목 없음';
        report += `- ${headline}\n`;
      } catch (e) {
        report += `- ${file}\n`;
      }
    });
    report += `\n`;
  }
  
  if (reviseRequests.length > 0) {
    report += `**수정 요청**: ${reviseRequests.length}개\n\n`;
    reviseRequests.forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(`./06-desk-approved/${file}`, 'utf8'));
        const articleId = data.article_id || file;
        const reason = data.reason || '사유 미기재';
        report += `- **${articleId}**\n  - 사유: ${reason}\n`;
      } catch (e) {
        report += `- ${file}\n`;
      }
    });
    report += `\n`;
  }
}

// 05-fact-checked 현황
if (fs.existsSync('./05-fact-checked')) {
  const factFiles = fs.readdirSync('./05-fact-checked')
    .filter(f => f.endsWith('.json') && !f.startsWith('REVISE_'));
  
  if (factFiles.length > 0) {
    report += `### 🔬 팩트체크 완료 (검증 대기)\n\n`;
    report += `**대기 기사**: ${factFiles.length}개\n\n`;
    
    factFiles.forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(`./05-fact-checked/${file}`, 'utf8'));
        const headline = data.draft?.headline || '제목 없음';
        const score = data.quality_report?.overall_confidence || '?';
        const verdict = data.quality_report?.verdict || '?';
        report += `- **${headline}**\n  - 신뢰도: ${score}% | ${verdict}\n`;
      } catch (e) {
        report += `- ${file}\n`;
      }
    });
    report += `\n`;
  }
}

// 문제 진단
report += `## 🚨 문제 진단\n\n`;

const problems = [];

if (stats['05-fact-checked'] > 0) {
  problems.push(`⚠️ **팩트체크 대기**: ${stats['05-fact-checked']}개 기사가 데스크 검증 대기 중`);
}

if (stats['04-drafted'] > 0) {
  problems.push(`⚠️ **작성 완료**: ${stats['04-drafted']}개 기사가 팩트체크 대기 중`);
}

if ((stats['rejected'] || 0) > 10) {
  problems.push(`🚨 **높은 거부율**: ${stats['rejected']}개 기사 거부 (파이프라인 품질 점검 필요)`);
}

if (publishRate < 30) {
  problems.push(`📉 **낮은 발행율**: ${publishRate}% (기사 품질 또는 처리 속도 문제)`);
}

if (problems.length > 0) {
  problems.forEach(p => report += `${p}\n`);
  report += `\n`;
} else {
  report += `✅ 주요 문제 없음\n\n`;
}

// 권고사항
report += `## 💡 권고사항\n\n`;

if (stats['05-fact-checked'] > 0) {
  report += `1. **즉시**: 05-fact-checked의 ${stats['05-fact-checked']}개 기사에 대한 데스크 검증 실행\n`;
  report += `   - SOUL.md의 7가지 체크리스트 적용\n`;
  report += `   - 신뢰도 기반 라우팅 실행\n\n`;
}

report += `2. **Writer 강화**: 팩트체크 신뢰도 개선\n`;
report += `   - 발표일, 인용 정확도 검증\n`;
report += `   - 메타데이터 완정도 확인\n\n`;

report += `3. **Publisher 점검**: HTML escape 문제 해결\n`;
report += `   - 이미지 URL 인코딩\n`;
report += `   - 메타데이터 정규화\n\n`;

// 파일 저장
const reportPath = `./PIPELINE_STATUS_COMPREHENSIVE_${timestamp}.md`;
fs.writeFileSync(reportPath, report);
console.log(report);
console.log(`\n💾 리포트 저장: ${reportPath}\n`);
