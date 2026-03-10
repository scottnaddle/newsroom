#!/usr/bin/env node
/**
 * UBION Newsroom Kit — CLI
 * 
 * OpenClaw 기반 AI 뉴스룸 자동화
 * 
 * Commands:
 *   init       대화형 설정 생성
 *   setup      OpenClaw 크론 작업 등록
 *   status     파이프라인 상태 확인
 *   dashboard  관제센터 시작
 *   validate   설정 검증
 *   reset      크론 작업 삭제
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const command = process.argv[2] || 'help';
const BASE = process.cwd();

// ===== INIT =====
async function init() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('\n🤖 UBION Newsroom Kit 초기 설정\n');

  const name = await ask('📰 뉴스룸 이름: ') || 'My AI Newsroom';
  
  const langChoice = await ask('🌐 언어 (1:한국어 2:English 3:日本語): ') || '1';
  const langMap = { '1': 'ko', '2': 'en', '3': 'ja' };
  const language = langMap[langChoice] || 'ko';
  
  const timezone = await ask('🕐 시간대 (기본: Asia/Seoul): ') || 'Asia/Seoul';

  // 주제
  console.log('\n📋 주제를 추가하세요 (최소 1개):');
  const topics = [];
  for (let i = 1; i <= 5; i++) {
    const topicName = await ask(`  주제 ${i}: `);
    if (!topicName) break;
    const keywords = await ask(`  키워드 (쉼표 구분): `);
    topics.push({
      name: topicName,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      category: 'general',
      accent_color: '#4338ca'
    });
  }
  if (topics.length === 0) {
    topics.push({ name: 'AI 뉴스', keywords: ['AI', '인공지능'], category: 'general', accent_color: '#4338ca' });
  }

  // CMS
  console.log('\n🔗 CMS 연동:');
  console.log('  [1] Ghost');
  console.log('  [2] Markdown 파일 (CMS 없이)');
  const cmsChoice = await ask('  선택: ') || '2';
  
  let cmsUrl = '', cmsApiKey = '';
  if (cmsChoice === '1') {
    cmsUrl = await ask('  Ghost URL: ');
    cmsApiKey = await ask('  Admin API Key (kid:secret): ');
  }

  // 발행 모드
  const publishChoice = await ask('\n📝 발행 모드 (1:Draft 2:자동발행): ') || '1';
  const publishAs = publishChoice === '2' ? 'published' : 'draft';

  // 스케줄
  const scheduleMin = await ask('\n⏱  에이전트 실행 간격 (분, 기본 30): ') || '30';

  rl.close();

  // config.yaml 생성
  const config = `# UBION Newsroom Kit — config.yaml
# 생성일: ${new Date().toISOString()}
# OpenClaw 기반 AI 뉴스룸 자동화

newsroom:
  name: "${name}"
  language: ${language}
  timezone: ${timezone}

topics:
${topics.map(t => `  - name: "${t.name}"
    keywords: [${t.keywords.map(k => `"${k}"`).join(', ')}]
    category: ${t.category}
    accent_color: "${t.accent_color}"`).join('\n')}

agents:
  collector:
    enabled: true
    schedule_minutes: ${scheduleMin}
    sources:
      brave_search:
        enabled: true
        freshness: "pw"

  editor:
    enabled: true
    schedule_minutes: ${scheduleMin}
    auto_approve_above: 90
    auto_reject_below: 75
    duplicate_threshold: 85

  reporter:
    enabled: true
    schedule_minutes: ${scheduleMin}
    depth: standard

  writer:
    enabled: true
    schedule_minutes: ${scheduleMin}
    style: news
    tone: formal
    min_word_count: 300
    max_word_count: 1500

  fact_checker:
    enabled: true
    schedule_minutes: ${scheduleMin}
    strictness: medium
    auto_reject_below: 60

  copy_editor:
    enabled: true
    schedule_minutes: ${scheduleMin}
    min_content_length: 1500

  publisher:
    enabled: true
    schedule_minutes: ${scheduleMin}
    publish_as: ${publishAs}

cms:
  provider: ${cmsChoice === '1' ? 'ghost' : 'markdown'}
  url: "${cmsUrl}"
  api_key: "${cmsApiKey}"

optimization:
  pre_check: true
  prompt_mode: minimal
  smart_scheduling:
    enabled: true
    off_hours: [23, 7]
    weekend_mode: reduced

dashboard:
  enabled: true
  port: 3848
`;

  fs.writeFileSync(path.join(BASE, 'config.yaml'), config);
  
  // Ghost 설정 파일 생성
  if (cmsChoice === '1' && cmsUrl && cmsApiKey) {
    const sharedDir = path.join(BASE, 'shared', 'config');
    if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
    fs.writeFileSync(path.join(sharedDir, 'ghost.json'), JSON.stringify({
      apiUrl: cmsUrl,
      adminApiKey: cmsApiKey
    }, null, 2));
  }

  // 파이프라인 디렉토리 생성
  const stages = ['01-sourced', '02-assigned', '03-reported', '04-drafted',
    '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published',
    'rejected', 'memory'];
  stages.forEach(s => {
    const dir = path.join(BASE, 'pipeline', s);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  console.log(`\n✅ 초기 설정 완료!`);
  console.log(`\n다음 단계:`);
  console.log(`  1. config.yaml 확인/수정`);
  console.log(`  2. node bin/cli.js setup   (OpenClaw 크론 등록)`);
  console.log(`  3. node bin/cli.js status  (상태 확인)\n`);
}

// ===== SETUP =====
async function setup() {
  const { loadConfig } = require('../src/config/loader');
  const { generateCronJobs } = require('../src/setup/cron-register');
  const { writeOpenClawConfig } = require('../src/setup/openclaw-config');
  
  const config = loadConfig(process.argv[3] || 'config.yaml');

  console.log('\n🔧 OpenClaw 설정 생성 중...\n');

  // 1. openclaw.json 템플릿 생성
  const openclawPath = path.join(BASE, 'openclaw-config.json');
  writeOpenClawConfig(config, BASE, openclawPath);

  // 2. 크론 작업 정의 생성
  const jobs = generateCronJobs(config, BASE);
  const cronPath = path.join(BASE, 'cron-jobs.json');
  fs.writeFileSync(cronPath, JSON.stringify(jobs, null, 2));

  console.log(`\n🕐 크론 작업 ${jobs.length}개 생성:\n`);
  jobs.forEach((job, i) => {
    console.log(`  ${i + 1}. ${job.name} (${job.schedule.everyMs / 60000}분)`);
  });

  console.log(`\n📄 생성된 파일:`);
  console.log(`  • ${openclawPath}  — OpenClaw 설정 (models, auth, agents)`);
  console.log(`  • ${cronPath}       — 크론 작업 정의`);

  console.log(`\n📌 적용 방법:`);
  console.log(`  1. openclaw-config.json → ~/.openclaw/openclaw.json에 병합`);
  console.log(`  2. API 키 환경변수 설정 (또는 openclaw.json에 직접 입력)`);
  console.log(`  3. openclaw gateway restart`);
  console.log(`  4. OpenClaw 채팅: "cron-jobs.json을 읽고 크론 작업을 등록해줘"\n`);
}

// ===== STATUS =====
async function status() {
  console.log('\n📊 UBION Newsroom 파이프라인 상태\n');

  const pipelineDir = path.join(BASE, 'pipeline');
  if (!fs.existsSync(pipelineDir)) {
    console.log('  ❌ pipeline/ 디렉토리 없음. init을 먼저 실행하세요.\n');
    return;
  }

  const stages = ['01-sourced', '02-assigned', '03-reported', '04-drafted',
    '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published', 'rejected'];
  const names = {
    '01-sourced': '수집', '02-assigned': '배정', '03-reported': '취재',
    '04-drafted': '초안', '05-fact-checked': '팩트체크', '06-desk-approved': '승인',
    '07-copy-edited': '교열', '08-published': '발행', 'rejected': '거부'
  };

  let total = 0;
  stages.forEach(stage => {
    const dir = path.join(pipelineDir, stage);
    let count = 0;
    try {
      count = fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
    } catch (e) {}
    total += count;
    const bar = '█'.repeat(Math.min(count, 20));
    const icon = count > 0 ? '📌' : '  ';
    console.log(`  ${icon} ${names[stage] || stage}: ${count} ${bar}`);
  });

  console.log(`\n  합계: ${total}개 기사`);

  // config 정보
  try {
    const { loadConfig } = require('../src/config/loader');
    const config = loadConfig(process.argv[3] || 'config.yaml');
    console.log(`\n  ⚙️  ${config.newsroom.name}`);
    console.log(`  🌐 ${config.newsroom.language} / ${config.newsroom.timezone}`);
    console.log(`  📌 주제: ${config.topics.map(t => t.name).join(', ')}`);
  } catch (e) {}

  console.log();
}

// ===== DASHBOARD =====
async function dashboard() {
  const { loadConfig } = require('../src/config/loader');
  const config = loadConfig(process.argv[3] || 'config.yaml');
  const DashboardServer = require('../src/dashboard/server');
  
  // 간단한 엔진 mock (대시보드는 파이프라인 스캔만 필요)
  const PipelineEngine = require('../src/pipeline/engine');
  const { getPipelinePaths, ensurePipelineDirs } = require('../src/config/loader');
  const paths = getPipelinePaths(config);
  ensurePipelineDirs(paths);
  
  const engine = new PipelineEngine(config, paths);
  const server = new DashboardServer(config, engine);
  server.start();

  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
}

// ===== VALIDATE =====
async function validateConfig() {
  const { loadConfig } = require('../src/config/loader');
  try {
    const config = loadConfig(process.argv[3] || 'config.yaml');
    console.log('\n✅ 설정이 유효합니다!');
    console.log(`   뉴스룸: ${config.newsroom.name}`);
    console.log(`   에이전트: ${Object.entries(config.agents).filter(([_,a]) => a.enabled).length}개 활성\n`);
  } catch (e) {
    console.error(`\n❌ 설정 오류:\n${e.message}\n`);
    process.exit(1);
  }
}

// ===== RESET =====
async function reset() {
  const cronFile = path.join(BASE, 'cron-jobs.json');
  if (fs.existsSync(cronFile)) {
    fs.unlinkSync(cronFile);
    console.log('\n✅ cron-jobs.json 삭제됨');
  }
  console.log('\n📌 OpenClaw 크론 작업을 삭제하려면:');
  console.log('   OpenClaw 채팅에서 "뉴스룸 크론 작업 전부 삭제해줘"라고 요청하세요.\n');
}

// ===== HELP =====
async function help() {
  console.log(`
📰 UBION Newsroom Kit v0.1.0
   OpenClaw 기반 AI 뉴스룸 자동화

Commands:
  init       대화형 설정 생성 (config.yaml + 파이프라인 디렉토리)
  setup      OpenClaw 크론 작업 정의 생성
  status     파이프라인 상태 확인
  dashboard  관제센터 시작 (기본 포트 3848)
  validate   설정 파일 검증
  reset      크론 작업 정의 삭제
  help       이 도움말

Quick Start:
  1. node bin/cli.js init       # 설정 생성
  2. config.yaml 확인/수정
  3. node bin/cli.js setup      # 크론 정의 생성
  4. OpenClaw에서 크론 등록
  5. node bin/cli.js status     # 상태 확인

Requirements:
  - OpenClaw (실행 중)
  - Node.js 18+
  - LLM API Key
`);
}

// ===== MAIN =====
const commands = { init, setup, status, dashboard, validate: validateConfig, reset, help };
const fn = commands[command];

if (!fn) {
  console.error(`알 수 없는 명령: ${command}`);
  help();
  process.exit(1);
}

fn().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
