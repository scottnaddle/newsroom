#!/usr/bin/env node
/**
 * smart-schedule.js — 시간대별 스케줄 조정
 * 
 * 사용법: node smart-schedule.js
 * 
 * 현재 시간(KST) 기준으로 실행 여부 판단:
 * - 야간 (23~07시): skip (소스수집기만 3시간 간격)
 * - 주말: 빈도 50% 감소 (2회 중 1회 skip)
 * - 피크타임 (9~12, 14~18): 항상 실행
 * 
 * Exit 0 = skip, Exit 1 = run
 */

const now = new Date();
// KST = UTC+9
const kstHour = (now.getUTCHours() + 9) % 24;
const kstDay = new Date(now.getTime() + 9 * 60 * 60 * 1000).getDay(); // 0=일 6=토
const isWeekend = kstDay === 0 || kstDay === 6;
const isNight = kstHour >= 23 || kstHour < 7;
const isPeak = (kstHour >= 9 && kstHour < 12) || (kstHour >= 14 && kstHour < 18);

const agentId = process.argv[2] || 'unknown';

// 야간: 무조건 skip
if (isNight) {
  console.log(JSON.stringify({
    action: 'skip',
    reason: `야간 시간대 (KST ${kstHour}시)`,
    kstHour,
    isWeekend,
    agent: agentId
  }));
  process.exit(0);
}

// 주말 + 비피크: 50% 확률로 skip
if (isWeekend && !isPeak) {
  // 분 단위로 짝수/홀수 교대
  const shouldSkip = now.getMinutes() % 2 === 0;
  if (shouldSkip) {
    console.log(JSON.stringify({
      action: 'skip',
      reason: `주말 비피크 시간 감소 (KST ${kstHour}시)`,
      kstHour,
      isWeekend,
      agent: agentId
    }));
    process.exit(0);
  }
}

// 실행
console.log(JSON.stringify({
  action: 'run',
  kstHour,
  isWeekend,
  isPeak,
  agent: agentId
}));
process.exit(1);
