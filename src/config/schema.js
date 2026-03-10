/**
 * config/schema.js — 설정 스키마 정의 및 검증
 * 
 * config.yaml의 구조를 정의하고 검증합니다.
 */

const DEFAULTS = {
  newsroom: {
    name: 'My AI Newsroom',
    language: 'ko',
    timezone: 'Asia/Seoul'
  },

  topics: [{
    name: 'AI 뉴스',
    keywords: ['AI news', '인공지능'],
    category: 'general',
    accent_color: '#4338ca'
  }],

  agents: {
    collector: {
      enabled: true,
      schedule: '*/30 * * * *',
      max_articles_per_run: 5,
      min_relevance_score: 60,
      dedup_window_hours: 72,
      backoff: {
        enabled: true,
        multiplier: 2,
        max_interval_minutes: 180
      }
    },
    reporter: {
      enabled: true,
      schedule: '*/15 * * * *',
      depth: 'standard',     // quick | standard | deep
      max_sources: 5
    },
    writer: {
      enabled: true,
      schedule: '*/10 * * * *',
      style: 'news',          // news | blog | academic | casual
      tone: 'formal',         // formal | conversational | neutral
      min_word_count: 300,
      max_word_count: 1500,
      include_sources: true
    },
    fact_checker: {
      enabled: true,
      schedule: '*/15 * * * *',
      strictness: 'medium',   // low | medium | high
      auto_reject_below: 60,
      cross_verify_claims: 3
    },
    editor: {
      enabled: true,
      schedule: '*/15 * * * *',
      auto_approve_above: 90,
      require_review_between: [75, 89],
      auto_reject_below: 75,
      check_duplicates: true,
      duplicate_threshold: 85
    },
    copy_editor: {
      enabled: true,
      schedule: '*/10 * * * *',
      check_grammar: true,
      check_tone: true,
      min_content_length: 1500
    },
    publisher: {
      enabled: true,
      schedule: '*/10 * * * *',
      publish_as: 'draft',    // draft | published
      generate_og_image: false,
      generate_feature_image: true
    }
  },

  channels: {
    digest: { enabled: false, schedule: '0 * * * *' },
    papers: { enabled: false, source: 'arxiv', categories: [] },
    cartoon: { enabled: false, schedule: '0 12 * * *' },
    opinion: { enabled: false, schedule: '0 20 * * *' }
  },

  cms: {
    provider: 'ghost',        // ghost | wordpress | markdown
    url: '',
    api_key: ''
  },

  llm: {
    provider: 'openai',       // openai | anthropic | zhipu | moonshot | local
    model: 'gpt-4o',
    api_key: '',
    fallbacks: [],
    tiers: {
      light: null,            // 간단한 작업용 모델 (미설정 시 기본 모델 사용)
      heavy: null             // 복잡한 작업용 모델
    }
  },

  optimization: {
    pre_check: true,
    prompt_mode: 'minimal',   // minimal | standard | full
    smart_scheduling: {
      enabled: true,
      off_hours: [23, 7],
      weekend_mode: 'reduced',
      idle_backoff: true
    },
    budget: {
      daily_token_limit: 0,   // 0 = 무제한
      alert_at_percent: 80
    }
  },

  design: {
    template: 'modern',       // modern | classic | minimal
    font: 'Noto Sans KR',
    show_ai_disclaimer: true,
    disclaimer_position: 'bottom',
    accent_colors: {
      policy: '#4338ca',
      research: '#059669',
      industry: '#d97706',
      opinion: '#7c3aed',
      data: '#0284c7',
      education: '#0891b2'
    }
  },

  dashboard: {
    enabled: true,
    port: 3848
  }
};

/**
 * 설정 검증
 */
function validate(config) {
  const errors = [];
  const warnings = [];

  // 필수 항목 체크
  if (!config.topics || config.topics.length === 0) {
    errors.push('topics: 최소 1개 주제가 필요합니다');
  }

  config.topics?.forEach((topic, i) => {
    if (!topic.name) errors.push(`topics[${i}].name: 주제 이름이 필요합니다`);
    if (!topic.keywords || topic.keywords.length === 0) {
      errors.push(`topics[${i}].keywords: 최소 1개 키워드가 필요합니다`);
    }
  });

  // CMS 설정 체크
  if (config.cms?.provider === 'ghost') {
    if (!config.cms.url) errors.push('cms.url: Ghost URL이 필요합니다');
    if (!config.cms.api_key) errors.push('cms.api_key: Ghost Admin API Key가 필요합니다');
  }

  // LLM 설정 체크
  if (!config.llm?.api_key && !config.llm?.api_key?.startsWith('$')) {
    warnings.push('llm.api_key: API 키가 설정되지 않았습니다 (환경변수 참조 가능: ${ENV_VAR})');
  }

  // 스케줄 형식 체크 (5-part cron)
  const cronRegex = /^(\*|[\d,\-\*\/]+)\s+(\*|[\d,\-\*\/]+)\s+(\*|[\d,\-\*\/]+)\s+(\*|[\d,\-\*\/]+)\s+(\*|[\d,\-\*\/]+)$/;
  Object.entries(config.agents || {}).forEach(([name, agent]) => {
    if (agent.schedule && !cronRegex.test(agent.schedule)) {
      warnings.push(`agents.${name}.schedule: 유효하지 않은 크론 표현식 "${agent.schedule}"`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 기본값과 병합
 */
function mergeDefaults(userConfig) {
  return deepMerge(DEFAULTS, userConfig);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * 환경변수 치환
 */
function resolveEnvVars(config) {
  const str = JSON.stringify(config);
  const resolved = str.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    return process.env[envVar] || '';
  });
  return JSON.parse(resolved);
}

module.exports = { DEFAULTS, validate, mergeDefaults, resolveEnvVars };
