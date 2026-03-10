/**
 * setup/openclaw-config.js — openclaw.json 설정 생성기
 * 
 * config.yaml을 기반으로 OpenClaw에 필요한 설정을 생성합니다.
 * - LLM 프로바이더 등록 (models.providers)
 * - 인증 프로파일 (auth.profiles)
 * - 에이전트 기본값 (agents.defaults)
 */

const fs = require('fs');
const path = require('path');

// LLM 프로바이더별 설정
const PROVIDER_CONFIGS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    api: 'openai-completions',
    models: {
      'gpt-4o': { name: 'GPT-4o', contextWindow: 128000, maxTokens: 16384 },
      'gpt-4o-mini': { name: 'GPT-4o Mini', contextWindow: 128000, maxTokens: 16384 }
    }
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    api: 'anthropic-messages',
    models: {
      'claude-opus-4-6': { name: 'Claude Opus 4.6', contextWindow: 200000, maxTokens: 8192 },
      'claude-sonnet-4-6': { name: 'Claude Sonnet 4.6', contextWindow: 200000, maxTokens: 8192 }
    }
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    api: 'openai-completions',
    models: {
      'glm-5': { name: 'GLM-5', contextWindow: 128000, maxTokens: 4096 }
    }
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    api: 'openai-completions',
    models: {
      'kimi-k2.5': { name: 'Kimi K2.5', contextWindow: 131072, maxTokens: 8192 }
    }
  }
};

/**
 * OpenClaw 설정 패치 생성
 */
function generateOpenClawPatch(config, basePath) {
  const patch = {};
  const llm = config.llm || {};

  // 1. 모델 프로바이더 등록
  const providerConfig = PROVIDER_CONFIGS[llm.provider];
  if (providerConfig) {
    const providerKey = llm.provider === 'zhipu' ? 'zai' : llm.provider;
    
    const modelDef = providerConfig.models[llm.model];
    const models = [{
      id: llm.model,
      name: modelDef?.name || llm.model,
      api: providerConfig.api,
      reasoning: false,
      input: ['text'],
      contextWindow: modelDef?.contextWindow || 128000,
      maxTokens: modelDef?.maxTokens || 8192
    }];

    patch[`models.providers.${providerKey}`] = {
      baseUrl: providerConfig.baseUrl,
      apiKey: llm.api_key || `\${${llm.provider.toUpperCase()}_API_KEY}`,
      api: providerConfig.api,
      models
    };

    // 인증 프로파일
    patch[`auth.profiles.${providerKey}:default`] = {
      provider: providerKey,
      mode: 'token'
    };
  }

  // 2. 폴백 모델 등록
  (llm.fallbacks || []).forEach(fb => {
    const fbProvider = typeof fb === 'string' ? fb.split('/')[0] : fb.provider;
    const fbModel = typeof fb === 'string' ? fb.split('/')[1] : fb.model;
    const fbConfig = PROVIDER_CONFIGS[fbProvider];
    
    if (fbConfig) {
      const provKey = fbProvider === 'zhipu' ? 'zai' : fbProvider;
      const modelDef = fbConfig.models[fbModel];
      
      if (!patch[`models.providers.${provKey}`]) {
        patch[`models.providers.${provKey}`] = {
          baseUrl: fbConfig.baseUrl,
          apiKey: `\${${fbProvider.toUpperCase()}_API_KEY}`,
          api: fbConfig.api,
          models: [{
            id: fbModel,
            name: modelDef?.name || fbModel,
            api: fbConfig.api,
            reasoning: false,
            input: ['text'],
            contextWindow: modelDef?.contextWindow || 128000,
            maxTokens: modelDef?.maxTokens || 8192
          }]
        };
        
        patch[`auth.profiles.${provKey}:default`] = {
          provider: provKey,
          mode: 'token'
        };
      }
    }
  });

  // 3. 에이전트 기본값
  const primaryModel = llm.provider === 'zhipu' 
    ? `zai/${llm.model}` 
    : `${llm.provider}/${llm.model}`;
  
  const fallbackModels = (llm.fallbacks || []).map(fb => {
    if (typeof fb === 'string') return fb;
    const prov = fb.provider === 'zhipu' ? 'zai' : fb.provider;
    return `${prov}/${fb.model}`;
  });

  patch['agents.defaults.model'] = fallbackModels.length > 0
    ? { primary: primaryModel, fallbacks: fallbackModels }
    : primaryModel;

  patch['agents.defaults.workspace'] = basePath;

  return patch;
}

/**
 * openclaw.json 예시 생성
 */
function generateFullConfig(config, basePath) {
  const llm = config.llm || {};
  const providerKey = llm.provider === 'zhipu' ? 'zai' : llm.provider;
  const providerConfig = PROVIDER_CONFIGS[llm.provider] || PROVIDER_CONFIGS.openai;
  const modelDef = providerConfig.models[llm.model] || {};

  const primaryModel = `${providerKey}/${llm.model}`;
  const fallbackModels = (llm.fallbacks || []).map(fb => {
    if (typeof fb === 'string') return fb;
    const prov = fb.provider === 'zhipu' ? 'zai' : fb.provider;
    return `${prov}/${fb.model}`;
  });

  const openclawConfig = {
    auth: {
      profiles: {
        [`${providerKey}:default`]: {
          provider: providerKey,
          mode: 'token'
        }
      }
    },
    models: {
      providers: {
        [providerKey]: {
          baseUrl: providerConfig.baseUrl,
          apiKey: llm.api_key || '${LLM_API_KEY}',
          api: providerConfig.api,
          models: [{
            id: llm.model,
            name: modelDef.name || llm.model,
            api: providerConfig.api,
            reasoning: false,
            input: ['text'],
            contextWindow: modelDef.contextWindow || 128000,
            maxTokens: modelDef.maxTokens || 8192
          }]
        }
      }
    },
    agents: {
      defaults: {
        model: fallbackModels.length > 0
          ? { primary: primaryModel, fallbacks: fallbackModels }
          : primaryModel,
        workspace: basePath,
        userTimezone: config.newsroom?.timezone || 'Asia/Seoul'
      }
    },
    channels: {
      _comment: 'Telegram, Discord 등 채널 설정은 openclaw configure로 설정하세요'
    }
  };

  // 폴백 프로바이더 추가
  (llm.fallbacks || []).forEach(fb => {
    const fbProvider = typeof fb === 'string' ? fb.split('/')[0] : fb.provider;
    const fbModel = typeof fb === 'string' ? fb.split('/')[1] : fb.model;
    const fbConfig = PROVIDER_CONFIGS[fbProvider === 'zai' ? 'zhipu' : fbProvider];
    
    if (fbConfig) {
      const provKey = fbProvider === 'zhipu' ? 'zai' : fbProvider;
      const md = fbConfig.models[fbModel] || {};
      
      openclawConfig.auth.profiles[`${provKey}:default`] = {
        provider: provKey,
        mode: 'token'
      };
      
      openclawConfig.models.providers[provKey] = {
        baseUrl: fbConfig.baseUrl,
        apiKey: `\${${(fbProvider === 'zai' ? 'ZHIPU' : fbProvider).toUpperCase()}_API_KEY}`,
        api: fbConfig.api,
        models: [{
          id: fbModel,
          name: md.name || fbModel,
          api: fbConfig.api,
          reasoning: false,
          input: ['text'],
          contextWindow: md.contextWindow || 128000,
          maxTokens: md.maxTokens || 8192
        }]
      };
    }
  });

  return openclawConfig;
}

/**
 * 설정 파일 출력
 */
function writeOpenClawConfig(config, basePath, outputPath) {
  const openclawConfig = generateFullConfig(config, basePath);
  const output = JSON.stringify(openclawConfig, null, 2);
  
  fs.writeFileSync(outputPath, output);
  console.log(`\n✅ OpenClaw 설정 생성: ${outputPath}`);
  console.log(`\n📌 사용법:`);
  console.log(`  1. 이 파일을 ~/.openclaw/openclaw.json에 병합하세요`);
  console.log(`  2. 또는: openclaw gateway config.patch 로 적용\n`);
  console.log(`  ⚠️  API 키를 환경변수로 설정하거나 직접 입력하세요`);
  
  return openclawConfig;
}

module.exports = { generateOpenClawPatch, generateFullConfig, writeOpenClawConfig, PROVIDER_CONFIGS };
