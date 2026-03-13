#!/usr/bin/env node

/**
 * 🎯 Interactive Topic Setup Script
 * Newsroom 설치 시 원하는 주제를 설정하는 인터랙티브 스크립트
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const TOPICS_DIR = path.join(__dirname, '../shared/config');
const TOPICS_FILE = path.join(TOPICS_DIR, 'topics.json');

// 사전 설정 주제들
const PRESET_TOPICS = {
  'ai-education': {
    name: 'AI & Education',
    config: {
      primary_topic: 'AI & Education',
      subtopics: [
        'AI Education Policy',
        'AI Learning Technology',
        'University AI Programs',
        'K-12 AI Education',
        'AI Skills Training'
      ],
      keywords: [
        'AI', 'artificial intelligence', 'education', 'learning',
        'machine learning', 'AI literacy', 'digital transformation'
      ],
      target_audience: 'Educators, students, policymakers, investors',
      tone: 'Professional, informative, balanced',
      content_style: 'News and analysis',
      language: 'English'
    }
  },
  'ai-tech': {
    name: 'AI & Technology',
    config: {
      primary_topic: 'AI & Technology',
      subtopics: [
        'Machine Learning',
        'Natural Language Processing',
        'Computer Vision',
        'Robotics',
        'AI Safety'
      ],
      keywords: [
        'AI', 'machine learning', 'deep learning', 'neural networks',
        'GPT', 'transformers', 'LLM', 'generative AI'
      ],
      target_audience: 'Tech professionals, developers, researchers',
      tone: 'Professional, technical',
      content_style: 'News and analysis',
      language: 'English'
    }
  },
  'startup': {
    name: 'Startup & Venture Capital',
    config: {
      primary_topic: 'Startup & Venture Capital',
      subtopics: [
        'Fundraising',
        'Venture Capital',
        'Scale-ups',
        'Exit Strategies',
        'Entrepreneurship'
      ],
      keywords: [
        'startup', 'venture capital', 'VC funding', 'Series A',
        'fundraising', 'angel investor', 'pitch'
      ],
      target_audience: 'Entrepreneurs, investors, startup enthusiasts',
      tone: 'Professional, optimistic',
      content_style: 'News and case studies',
      language: 'English'
    }
  },
  'blockchain': {
    name: 'Blockchain & Cryptocurrency',
    config: {
      primary_topic: 'Blockchain & Cryptocurrency',
      subtopics: [
        'Bitcoin',
        'Ethereum',
        'DeFi',
        'NFT',
        'Web3'
      ],
      keywords: [
        'blockchain', 'cryptocurrency', 'bitcoin', 'ethereum',
        'smart contracts', 'DeFi', 'NFT', 'Web3'
      ],
      target_audience: 'Crypto enthusiasts, traders, investors',
      tone: 'Professional, analytical',
      content_style: 'News and market analysis',
      language: 'English'
    }
  },
  'biotech': {
    name: 'Biotech & Healthcare',
    config: {
      primary_topic: 'Biotech & Healthcare Innovation',
      subtopics: [
        'Gene Therapy',
        'Medical AI',
        'Drug Development',
        'Telemedicine',
        'Healthcare Tech'
      ],
      keywords: [
        'biotech', 'healthcare', 'AI medicine', 'gene therapy',
        'medical innovation', 'clinical trials'
      ],
      target_audience: 'Healthcare professionals, investors, scientists',
      tone: 'Professional, scientific',
      content_style: 'News and research analysis',
      language: 'English'
    }
  },
  'climate': {
    name: 'Climate Tech & Sustainability',
    config: {
      primary_topic: 'Climate Tech & Sustainability',
      subtopics: [
        'Renewable Energy',
        'Carbon Capture',
        'Sustainable Agriculture',
        'Green Building',
        'Environmental Technology'
      ],
      keywords: [
        'climate tech', 'sustainability', 'green energy',
        'carbon neutral', 'renewable', 'ESG'
      ],
      target_audience: 'Environmental advocates, investors, enthusiasts',
      tone: 'Professional, optimistic',
      content_style: 'News and impact analysis',
      language: 'English'
    }
  },
  'korea-ai': {
    name: '한국 기술 & AI',
    config: {
      primary_topic: '한국 AI & 기술',
      subtopics: [
        'AI 정책',
        'AI 교육',
        '스타트업 생태계',
        '기술 혁신',
        '투자 트렌드'
      ],
      keywords: [
        '한국', 'AI', '인공지능', '스타트업',
        '벤처캐피탈', '기술정책', '디지털전환'
      ],
      target_audience: '기술 관심층, 창업가, 투자자, 학생',
      tone: '친근하고 전문적',
      content_style: '뉴스와 분석',
      language: 'Korean'
    }
  },
  'custom': {
    name: 'Custom Topic',
    config: null
  }
};

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

function printWelcome() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        🎯 Newsroom Topic Setup - 뉴스룸 주제 설정           ║');
  console.log('║                                                            ║');
  console.log('║  이 스크립트는 당신의 뉴스룸이 작성할 주제를 설정합니다.   ║');
  console.log('║                                                            ║');
  console.log('║  설정 후 파이프라인이 정해진 주제로 기사를 자동 작성합니다║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

function printPresets() {
  console.log('\n📋 사전 설정된 주제들:\n');
  
  Object.entries(PRESET_TOPICS).forEach(([key, topic], idx) => {
    if (key !== 'custom') {
      console.log(`  ${idx + 1}. ${topic.name}`);
    }
  });
  
  console.log(`  ${Object.keys(PRESET_TOPICS).length}. Custom (직접 입력)\n`);
}

async function selectPreset() {
  printPresets();
  
  const choice = await question('선택하세요 (번호): ');
  const presetKeys = Object.keys(PRESET_TOPICS).filter(k => k !== 'custom');
  
  if (choice == presetKeys.length + 1) {
    return 'custom';
  }
  
  return presetKeys[parseInt(choice) - 1];
}

async function getCustomTopic() {
  console.log('\n\n📝 커스텀 주제 입력 (엔터로 생략 가능)\n');
  
  const primary_topic = await question('📌 주요 주제: ');
  if (!primary_topic) {
    console.log('❌ 주요 주제는 필수입니다.');
    return getCustomTopic();
  }
  
  const subtopics_str = await question('📌 소주제들 (쉼표로 구분): ');
  const subtopics = subtopics_str
    ? subtopics_str.split(',').map(s => s.trim())
    : [];
  
  const keywords_str = await question('🔑 키워드들 (쉼표로 구분): ');
  const keywords = keywords_str
    ? keywords_str.split(',').map(k => k.trim())
    : [];
  
  const target_audience = await question('👥 타겟 오디언스 (선택): ') || 'General audience';
  const tone = await question('🎤 톤 (Professional/Casual/Academic) [기본값: Professional]: ') || 'Professional';
  const content_style = await question('📰 스타일 (News/Analysis/Opinion) [기본값: News]: ') || 'News';
  const language = await question('🌍 언어 (English/Korean) [기본값: English]: ') || 'English';
  
  return {
    primary_topic,
    subtopics,
    keywords,
    target_audience,
    tone,
    content_style,
    language,
    article_length: {
      min_words: 1200,
      max_words: 2000,
      target_words: 1500
    },
    images_per_article: 2,
    required_sections: [
      'Introduction',
      'Current Situation',
      'Key Points',
      'Analysis',
      'Future Outlook'
    ]
  };
}

async function reviewConfig(config) {
  console.log('\n\n✅ 설정 확인\n');
  console.log('═'.repeat(60));
  
  console.log(`\n📌 주요 주제: ${config.primary_topic}`);
  
  if (config.subtopics.length > 0) {
    console.log(`📌 소주제들: ${config.subtopics.join(', ')}`);
  }
  
  if (config.keywords.length > 0) {
    console.log(`🔑 키워드: ${config.keywords.join(', ')}`);
  }
  
  console.log(`👥 타겟: ${config.target_audience}`);
  console.log(`🎤 톤: ${config.tone}`);
  console.log(`📰 스타일: ${config.content_style}`);
  console.log(`🌍 언어: ${config.language}`);
  console.log(`📏 기사 길이: ${config.article_length.min_words}-${config.article_length.max_words} 단어`);
  
  console.log('\n' + '═'.repeat(60) + '\n');
  
  const confirm = await question('이 설정으로 저장하시겠습니까? (yes/no): ');
  return confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y';
}

async function saveConfig(config) {
  try {
    // 디렉토리 생성
    if (!fs.existsSync(TOPICS_DIR)) {
      fs.mkdirSync(TOPICS_DIR, { recursive: true });
    }
    
    // 파일 저장
    fs.writeFileSync(TOPICS_FILE, JSON.stringify(config, null, 2));
    
    console.log('\n✅ 설정이 저장되었습니다!');
    console.log(`📁 위치: ${TOPICS_FILE}\n`);
    
    return true;
  } catch (error) {
    console.error('❌ 설정 저장 실패:', error.message);
    return false;
  }
}

async function main() {
  printWelcome();
  
  try {
    const preset = await selectPreset();
    
    let config;
    if (preset === 'custom') {
      config = await getCustomTopic();
    } else {
      config = PRESET_TOPICS[preset].config;
      console.log(`\n✅ "${PRESET_TOPICS[preset].name}" 주제 선택됨\n`);
    }
    
    const approved = await reviewConfig(config);
    
    if (approved) {
      const saved = await saveConfig(config);
      
      if (saved) {
        console.log('\n🚀 다음 단계:');
        console.log('   npm install');
        console.log('   node scripts/pipeline-runner.js\n');
      }
    } else {
      console.log('\n취소되었습니다. 다시 시도하세요.\n');
      await main();
    }
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    rl.close();
  }
}

main();
