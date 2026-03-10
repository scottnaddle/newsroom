#!/usr/bin/env node
/**
 * pre-check-digest.js — Digest 파이프라인 사전 필터링
 * 
 * Exit 0 = skip, Exit 1 = run
 */
const fs = require('fs');
const path = require('path');

const DIGEST_PIPELINE = '/root/.openclaw/workspace/newsroom/pipeline/digest';

const AGENT_INPUTS = {
  'digest-writer': '01-sourced',
  'digest-publisher': '02-drafted',
};

const agentId = process.argv[2];
if (!agentId || !AGENT_INPUTS[agentId]) {
  // digest-collector는 항상 실행 (검색 에이전트)
  if (agentId === 'digest-collector') {
    console.log(JSON.stringify({ action: 'run', agent: 'digest-collector' }));
    process.exit(1);
  }
  console.error('Usage: node pre-check-digest.js <digest-writer|digest-publisher>');
  process.exit(1);
}

const folder = path.join(DIGEST_PIPELINE, AGENT_INPUTS[agentId]);
try {
  const count = fs.readdirSync(folder).filter(f => f.endsWith('.json')).length;
  if (count === 0) {
    console.log(JSON.stringify({ action: 'skip', agent: agentId, folder: AGENT_INPUTS[agentId], count: 0 }));
    process.exit(0);
  }
  console.log(JSON.stringify({ action: 'run', agent: agentId, folder: AGENT_INPUTS[agentId], count }));
  process.exit(1);
} catch (e) {
  console.log(JSON.stringify({ action: 'skip', agent: agentId, error: e.message }));
  process.exit(0);
}
