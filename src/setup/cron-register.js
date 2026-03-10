/**
 * setup/cron-register.js — OpenClaw 크론 작업 자동 등록
 * 
 * config.yaml을 읽고 7개 에이전트의 크론 작업을 OpenClaw에 등록합니다.
 */

const fs = require('fs');
const path = require('path');

// 에이전트 정의
const AGENT_DEFS = [
  {
    id: 'collector',
    name: '소스 수집기',
    inputStages: [],
    outputStage: '01-sourced',
    defaultScheduleMs: 1800000  // 30분
  },
  {
    id: 'editor',
    name: '에디터/데스크',
    inputStages: ['01-sourced', '05-fact-checked'],
    outputStage: '02-assigned',
    defaultScheduleMs: 1800000
  },
  {
    id: 'reporter',
    name: '취재기자',
    inputStages: ['02-assigned'],
    outputStage: '03-reported',
    defaultScheduleMs: 1800000
  },
  {
    id: 'writer',
    name: '작성기자',
    inputStages: ['03-reported'],
    outputStage: '04-drafted',
    defaultScheduleMs: 1800000
  },
  {
    id: 'fact_checker',
    name: '팩트체커',
    inputStages: ['04-drafted'],
    outputStage: '05-fact-checked',
    defaultScheduleMs: 1800000
  },
  {
    id: 'copy_editor',
    name: '교열기자',
    inputStages: ['06-desk-approved'],
    outputStage: '07-copy-edited',
    defaultScheduleMs: 1800000
  },
  {
    id: 'publisher',
    name: '발행에이전트',
    inputStages: ['07-copy-edited'],
    outputStage: '08-published',
    defaultScheduleMs: 1800000
  }
];

/**
 * 에이전트별 크론 메시지 생성
 */
function buildCronMessage(agentDef, config, basePath) {
  const promptMode = config.optimization?.prompt_mode || 'minimal';
  const preCheck = config.optimization?.pre_check !== false;

  const promptFile = promptMode === 'minimal'
    ? path.join(basePath, 'agents', 'prompts', `${agentDef.id.replace('_', '-')}-minimal.md`)
    : path.join(basePath, 'agents', 'soul', `${agentDef.id.replace('_', '-')}.md`);

  const preCheckScript = path.join(basePath, 'src', 'scripts', 'pre-check.js');
  const agentKey = agentDef.id.replace('_', '-');

  let message = '';

  if (preCheck && agentDef.inputStages.length > 0) {
    message = `먼저 사전 체크: node ${preCheckScript} ${agentKey}\n\n`
      + `exit 0 → 출력된 JSON reason을 답하고 종료.\n`
      + `exit 1 → ${promptFile} 를 읽고 실행.`;
  } else if (agentDef.id === 'collector') {
    if (preCheck) {
      message = `먼저 사전 체크: node ${preCheckScript} ${agentKey}\n\n`
        + `exit 0 → 출력된 JSON reason을 답하고 종료.\n`
        + `exit 1 → ${promptFile} 를 읽고 실행.\n\n`
        + `수집 후 상태 업데이트: node ${preCheckScript} ${agentKey} update-state <true|false>`;
    } else {
      message = `${promptFile} 를 읽고 실행.`;
    }
  } else {
    message = `${promptFile} 를 읽고 실행.`;
  }

  return message;
}

/**
 * 크론 작업 목록 생성 (등록용)
 */
function generateCronJobs(config, basePath) {
  const jobs = [];
  const agents = config.agents || {};

  AGENT_DEFS.forEach((def, index) => {
    const agentConfig = agents[def.id];
    if (!agentConfig?.enabled) return;

    const scheduleMs = (agentConfig.schedule_minutes || 30) * 60 * 1000;
    // 5분씩 스태거 (동시 실행 방지)
    const staggerMs = index * 300000;

    jobs.push({
      name: `${index + 1}. ${def.name} (${agentConfig.schedule_minutes || 30}분)`,
      schedule: {
        kind: 'every',
        everyMs: scheduleMs,
        anchorMs: Date.now() + staggerMs
      },
      sessionTarget: 'isolated',
      payload: {
        kind: 'agentTurn',
        message: buildCronMessage(def, config, basePath),
        timeoutSeconds: 0
      },
      delivery: { mode: 'none' },
      enabled: true
    });
  });

  return jobs;
}

/**
 * OpenClaw 크론 API로 등록 (CLI에서 호출)
 */
function printSetupScript(jobs) {
  console.log('\n📋 OpenClaw 크론 등록 명령어:\n');
  console.log('# 아래 명령어를 OpenClaw 채팅에서 실행하거나,');
  console.log('# openclaw cron add 로 직접 등록하세요.\n');

  jobs.forEach((job, i) => {
    console.log(`# --- ${job.name} ---`);
    console.log(JSON.stringify(job, null, 2));
    console.log();
  });

  return jobs;
}

module.exports = { AGENT_DEFS, buildCronMessage, generateCronJobs, printSetupScript };
