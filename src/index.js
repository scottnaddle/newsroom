/**
 * UBION Newsroom Kit — 메인 진입점
 */

const { loadConfig, getPipelinePaths, ensurePipelineDirs } = require('./config/loader');
const PipelineEngine = require('./pipeline/engine');
const PreCheck = require('./quality/pre-check');
const Validator = require('./quality/validator');

class NewsroomKit {
  constructor(configPath) {
    this.configPath = configPath || 'config.yaml';
    this.config = null;
    this.paths = null;
    this.engine = null;
    this.preCheck = null;
    this.validator = null;
  }

  /**
   * 초기화
   */
  async init() {
    console.log('📰 UBION Newsroom Kit v0.1.0\n');

    // 설정 로드
    this.config = loadConfig(this.configPath);
    console.log(`  📋 설정: ${this.configPath}`);
    console.log(`  🏷  이름: ${this.config.newsroom.name}`);
    console.log(`  🌐 언어: ${this.config.newsroom.language}`);
    console.log(`  🕐 시간대: ${this.config.newsroom.timezone}`);

    // 주제 출력
    console.log(`\n  📌 주제:`);
    this.config.topics.forEach(t => {
      console.log(`     • ${t.name} (${t.keywords.join(', ')})`);
    });

    // 파이프라인 경로 생성
    this.paths = getPipelinePaths(this.config);
    ensurePipelineDirs(this.paths);
    console.log(`\n  📁 파이프라인: ${this.paths.base}`);

    // 모듈 초기화
    this.preCheck = new PreCheck(this.paths.base, this.config);
    this.validator = new Validator(this.config);
    this.engine = new PipelineEngine(this.config, this.paths);

    // 이벤트 리스너
    this.engine.on('agent:skip', (data) => {
      // 조용히 스킵 (로그 최소화)
    });

    this.engine.on('agent:start', (data) => {
      console.log(`  ▶ ${data.agent} 실행 중...`);
    });

    this.engine.on('agent:complete', (data) => {
      console.log(`  ✅ ${data.agent} 완료`);
    });

    this.engine.on('agent:error', (data) => {
      console.error(`  ❌ ${data.agent}: ${data.error}`);
    });

    return this;
  }

  /**
   * 파이프라인 시작
   */
  async start() {
    if (!this.engine) await this.init();
    this.engine.start();

    // 대시보드 시작 (활성화된 경우)
    if (this.config.dashboard?.enabled) {
      const DashboardServer = require('./dashboard/server');
      this.dashboard = new DashboardServer(this.config, this.engine);
      this.dashboard.start();
    }
  }

  /**
   * 정지
   */
  stop() {
    this.engine?.stop();
    this.dashboard?.stop();
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return this.engine?.getState();
  }
}

module.exports = NewsroomKit;

// CLI에서 직접 실행
if (require.main === module) {
  const kit = new NewsroomKit(process.argv[2]);
  kit.start().catch(err => {
    console.error('❌ 시작 실패:', err.message);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    kit.stop();
    process.exit(0);
  });
}
