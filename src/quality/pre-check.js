/**
 * quality/pre-check.js — 사전 필터링 모듈
 * 
 * LLM 호출 전에 파일 존재 여부를 확인하여
 * 불필요한 토큰 소비를 방지합니다.
 */

const fs = require('fs');
const path = require('path');

class PreCheck {
  constructor(pipelinePath, config) {
    this.pipelinePath = pipelinePath;
    this.config = config;
    this.collectorStatePath = path.join(pipelinePath, 'memory', 'collector-state.json');
  }

  /**
   * 에이전트의 입력 폴더에 파일이 있는지 확인
   */
  checkFolder(stage) {
    const stagePath = path.join(this.pipelinePath, stage);
    try {
      const files = fs.readdirSync(stagePath).filter(f => f.endsWith('.json'));
      return { hasWork: files.length > 0, count: files.length, stage };
    } catch (e) {
      return { hasWork: false, count: 0, stage, error: e.message };
    }
  }

  /**
   * 여러 폴더 중 하나라도 파일이 있는지 확인
   */
  checkMultiple(stages) {
    const results = stages.map(s => this.checkFolder(s));
    const hasWork = results.some(r => r.hasWork);
    const total = results.reduce((sum, r) => sum + r.count, 0);
    return { hasWork, total, stages: results };
  }

  /**
   * 소스수집기 스마트 백오프
   */
  checkCollectorBackoff(collectorConfig) {
    const backoff = collectorConfig?.backoff || {};
    const minInterval = (backoff.min_interval_minutes || 30) * 60 * 1000;
    const multiplier = backoff.multiplier || 2;
    const maxInterval = (backoff.max_interval_minutes || 180) * 60 * 1000;

    let state = { lastRun: 0, consecutiveEmpty: 0, currentInterval: minInterval };

    try {
      if (fs.existsSync(this.collectorStatePath)) {
        state = JSON.parse(fs.readFileSync(this.collectorStatePath, 'utf8'));
      }
    } catch (e) { /* use defaults */ }

    const elapsed = Date.now() - (state.lastRun || 0);

    if (elapsed < state.currentInterval) {
      const remainMin = Math.round((state.currentInterval - elapsed) / 60000);
      return {
        hasWork: false,
        reason: `백오프 대기 중 (${remainMin}분 후)`,
        consecutiveEmpty: state.consecutiveEmpty
      };
    }

    return {
      hasWork: true,
      consecutiveEmpty: state.consecutiveEmpty
    };
  }

  /**
   * 수집 결과 후 상태 업데이트
   */
  updateCollectorState(foundNew) {
    const backoff = this.config?.agents?.collector?.backoff || {};
    const minInterval = (backoff.min_interval_minutes || 30) * 60 * 1000;
    const multiplier = backoff.multiplier || 2;
    const maxInterval = (backoff.max_interval_minutes || 180) * 60 * 1000;

    let state = { lastRun: 0, consecutiveEmpty: 0, currentInterval: minInterval };

    try {
      if (fs.existsSync(this.collectorStatePath)) {
        state = JSON.parse(fs.readFileSync(this.collectorStatePath, 'utf8'));
      }
    } catch (e) {}

    state.lastRun = Date.now();

    if (foundNew) {
      state.consecutiveEmpty = 0;
      state.currentInterval = minInterval;
    } else {
      state.consecutiveEmpty++;
      state.currentInterval = Math.min(state.currentInterval * multiplier, maxInterval);
    }

    const dir = path.dirname(this.collectorStatePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.collectorStatePath, JSON.stringify(state, null, 2));

    return state;
  }
}

module.exports = PreCheck;
