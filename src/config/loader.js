/**
 * config/loader.js — config.yaml 로딩 및 검증
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { validate, mergeDefaults, resolveEnvVars } = require('./schema');

/**
 * config.yaml 로드
 */
function loadConfig(configPath) {
  const fullPath = path.resolve(configPath || 'config.yaml');
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`설정 파일을 찾을 수 없습니다: ${fullPath}\n  ubion-newsroom init 으로 생성하세요.`);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const userConfig = yaml.load(raw);
  
  // 기본값 병합
  const config = mergeDefaults(userConfig);
  
  // 환경변수 치환
  const resolved = resolveEnvVars(config);

  // 검증
  const { valid, errors, warnings } = validate(resolved);
  
  if (!valid) {
    const errorMsg = errors.map(e => `  ❌ ${e}`).join('\n');
    throw new Error(`설정 오류:\n${errorMsg}`);
  }

  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
  }

  return resolved;
}

/**
 * 설정에서 파이프라인 경로 생성
 */
function getPipelinePaths(config) {
  const base = config._basePath || process.cwd();
  const pipelineDir = path.join(base, 'pipeline');

  const stages = [
    '00-intake', '01-sourced', '02-assigned', '03-reported',
    '04-drafted', '05-fact-checked', '06-desk-approved',
    '07-copy-edited', '08-published', 'rejected', 'memory'
  ];

  // 메인 파이프라인
  const paths = { base: pipelineDir };
  stages.forEach(stage => {
    paths[stage] = path.join(pipelineDir, stage);
  });

  // 추가 채널 파이프라인
  if (config.channels?.digest?.enabled) {
    paths.digest = {
      '01-sourced': path.join(pipelineDir, 'digest', '01-sourced'),
      '02-drafted': path.join(pipelineDir, 'digest', '02-drafted'),
      '03-published': path.join(pipelineDir, 'digest', '03-published')
    };
  }

  if (config.channels?.papers?.enabled) {
    paths.papers = {
      '01-sourced': path.join(pipelineDir, 'papers', '01-sourced'),
      '02-summarized': path.join(pipelineDir, 'papers', '02-summarized'),
      '03-published': path.join(pipelineDir, 'papers', '03-published')
    };
  }

  return paths;
}

/**
 * 파이프라인 디렉토리 생성
 */
function ensurePipelineDirs(paths) {
  const createDir = (p) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  };

  Object.values(paths).forEach(p => {
    if (typeof p === 'string') createDir(p);
    else if (typeof p === 'object') Object.values(p).forEach(createDir);
  });
}

module.exports = { loadConfig, getPipelinePaths, ensurePipelineDirs };
