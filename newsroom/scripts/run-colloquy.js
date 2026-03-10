#!/usr/bin/env node

/**
 * AI Colloquy - AI+교육 패널 토의 (GLM-5 전용)
 * 
 * 고정 캐릭터들이 매일 다른 주제로 대화를 이어감
 * - 이전 대화 기록을 기억하여 지속성 유지
 * - 각 캐릭터는 고유한 이름과 배경을 가짐
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ============================================
// Configuration
// ============================================

const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const COLLOQUY_DIR = `${WORKSPACE}/pipeline/colloquy`;
const MEMORY_DIR = `${COLLOQUY_DIR}/memory`;

// API Keys
const GLM_API_KEY = '95087f94d2dd4c6dacc1689483d3313a.ouEapRwsgNG0xAJ5';

// Ghost
const GHOST_URL = 'https://insight.ubion.global';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// ============================================
// 고정 캐릭터 (GLM-5 전용)
// ============================================

const CHARACTERS = [
  {
    id: 'teacher',
    name: '은지',
    fullName: '김은지',
    role: '👩‍🏫 선생님',
    age: 34,
    background: `서울의 한 중학교에서 국어를 가르친 지 10년 차. 
학생들의 글쓰기 교육에 특히 관심이 많으며, 최근 AI를 수업에 활용하는 방법을 연구 중.
따뜻하고 공감 능력이 뛰어나며, 학생 개개인의 상황을 이해하려 노력함.
"기술은 도구일 뿐, 교육의 본질은 사람 사이의 연결"이라는 신념을 가짐.`,
    personality: '따뜻함, 현실적, 학생 중심, 신중함',
    speakingStyle: '구체적인 교실 사례를 들며 설명, 학생 입장에서 고민'
  },
  {
    id: 'student',
    name: '준호',
    fullName: '이준호',
    role: '👨‍🎓 학생',
    age: 17,
    background: `서울의 한 고등학교 2학년.
AI 도구를 일상적으로 사용하는 Z세대로, ChatGPT로 숙제를 하고 AI로 영어 회화를 연습함.
새로운 기술에 빠르게 적응하지만, AI에 의존하는 것에 대한 고민도 있음.
친구들 사이에서 'AI 고수'로 불리며 AI 활용 팁을 공유해주는 역할.`,
    personality: '솔직함, 호기심 많음, 실용적, 약간의 반항심',
    speakingStyle: '실제 경험담 위주, 또래 학생들의 반응 전달, 솔직한 고민 토로'
  },
  {
    id: 'researcher',
    name: '성민',
    fullName: '박성민 교수',
    role: '🔬 연구자',
    age: 45,
    background: `국립대학교 교육학과 교수. AI 교육 효과성 연구 15년 차.
국내외 학술지에 AI 교육 관련 논문 50편 이상 발표.
데이터와 증거를 중시하며, 감상적인 접근보다 실증적 분석을 선호.
하지만 연구실 밖의 현실과 연구 결과 사이의 간극을 항상 고민함.`,
    personality: '분석적, 신중함, 데이터 중심, 이론과 실제의 간극 고민',
    speakingStyle: '연구 결과 인용, 통계 자료 제시, "한 연구에 따르면..." 스타일'
  },
  {
    id: 'policymaker',
    name: '정희',
    fullName: '최정희 국장',
    role: '🏛️ 정책입안자',
    age: 52,
    background: `교육부에서 교육정책을 담당하는 국장.
30년 공무원 경력으로 다양한 교육 정책을 입안하고 실행.
모든 학생에게 공평한 교육 기회를 보장하는 것이 최우선 과제.
AI 교육 도입이 교육 격차를 줄일지, 늘릴지에 대한 고민이 깊음.`,
    personality: '신중함, 공평성 중시, 현실적 제약 인식, 포용적',
    speakingStyle: '제도적 관점, 예산과 인력의 현실적 고려, "모든 학생을 위해..."'
  }
];

// ============================================
// 주제 (15개)
// ============================================

const TOPICS = [
  {
    id: 'ai-tutor',
    title: 'AI 튜터가 인간 교사를 대체할 수 있을까?',
    description: '개인화된 AI 튜터의 발전이 인간 교사의 역할을 어떻게 변화시킬지 토론',
    context: '최근 GPT-4o, Claude 3.5와 같은 멀티모달 AI가 개인 튜터링에서 인간 수준의 성과를 보여주고 있습니다.'
  },
  {
    id: 'ai-usage-limit',
    title: '학생의 AI 사용, 어디까지 허용해야 할까?',
    description: '숙제, 시험, 창작 등 다양한 상황에서 AI 도구 사용의 경계선 토론',
    context: 'ChatGPT 등장 후 학교에서 AI 사용 금지와 허용 사이에서 논란이 계속되고 있습니다.'
  },
  {
    id: 'core-competency',
    title: 'AI 시대에 학생들이 배워야 할 핵심 역량은?',
    description: 'AI가 많은 작업을 대신하는 시대에 교육이 집중해야 할 능력 토론',
    context: '암기 위주 교육에서 벗어나 새로운 역량이 필요하다는 공감대가 형성되고 있습니다.'
  },
  {
    id: 'public-education',
    title: 'AI 교육, 공교육에서 어떻게 도입해야 할까?',
    description: '국공립 학교에서 AI 교육을 의무화할지, 어떻게 단계적으로 도입할지 토론',
    context: '한국의 AI 기본법, 미국의 AI 교육 가이드라인 등 정부 차원의 노력이 이어지고 있습니다.'
  },
  {
    id: 'assessment',
    title: 'AI가 평가 방식을 어떻게 바꿔야 할까?',
    description: 'AI 시대에 적합한 학생 평가 방식과 성적 산출 방법 토론',
    context: '기존 시험 중심 평가로는 AI 활용 능력을 측정하기 어렵다는 지적이 나옵니다.'
  },
  {
    id: 'digital-divide',
    title: 'AI 교육 격차, 어떻게 해결할까?',
    description: 'AI 교육 기회의 불평등 문제와 디지털 격차 해결 방안 토론',
    context: 'AI 도구에 접근할 수 있는 학생과 그렇지 않은 학생 사이의 격차가 우려됩니다.'
  },
  {
    id: 'creative-writing',
    title: 'AI로 창의적 글쓰기를 가르칠 수 있을까?',
    description: 'AI 작문 도구가 창의성 교육에 미치는 영향과 교수법 변화 토론',
    context: 'ChatGPT로 에세이를 쉽게 쓸 수 있는 시대에 창의적 글쓰기 교육의 의미가 재정립되고 있습니다.'
  },
  {
    id: 'teacher-training',
    title: 'AI 교사 훈련, 무엇이 우선일까?',
    description: '현직 교사들이 AI를 교육에 활용하기 위해 어떤 훈련이 필요한지 토론',
    context: '많은 교사가 AI 도구를 사용하는 방법을 몰라 수업 활용에 어려움을 겪고 있습니다.'
  },
  {
    id: 'special-education',
    title: 'AI가 특수교육을 어떻게 변화시킬까?',
    description: '장애 학생, 학습 장애 학생을 위한 AI 기반 개별화 교육의 가능성과 한계 토론',
    context: 'AI가 개별화된 학습 지원을 제공하면서 특수교육 분야에서 혁신이 기대됩니다.'
  },
  {
    id: 'ai-ethics',
    title: 'AI 교육의 윤리, 무엇을 가르쳐야 할까?',
    description: '학생들에게 AI 윤리, 편향성, 프라이버시 등 무엇을 어떻게 가르칠지 토론',
    context: 'AI 활용 능력과 함께 AI 윤리 교육의 필요성이 대두되고 있습니다.'
  },
  {
    id: 'college-admission',
    title: '대학 입시에서 AI 활용을 어떻게 평가할까?',
    description: '대학 입시 전형에서 학생의 AI 활용 능력을 어떻게 반영할지 토론',
    context: 'AI 시대에 대학 입시 제도의 변화가 불가피하다는 의견이 많습니다.'
  },
  {
    id: 'language-learning',
    title: 'AI로 외국어 교육이 어떻게 변할까?',
    description: 'AI 번역, 대화 파트너 등이 외국어 학습 방식을 어떻게 바꿀지 토론',
    context: 'AI 언어 모델이 원어민 수준의 대화가 가능해지면서 외국어 교육의 목표가 재정립됩니다.'
  },
  {
    id: 'content-creation',
    title: 'AI 교육 콘텐츠, 누가 만들어야 할까?',
    description: '교육용 AI 콘텐츠의 개발 주체와 품질 관리 방안 토론',
    context: '교육부, 교육청, 민간 기업, 교사 등 다양한 주체가 AI 교육 콘텐츠를 개발하고 있습니다.'
  },
  {
    id: 'ai-collaboration',
    title: 'AI와 협업하는 교실, 어떤 모습일까?',
    description: '교사와 AI가 협력하는 미래 교실의 모습과 수업 방식 토론',
    context: 'AI가 교사의 업무를 보조하면서 교사는 더 본질적인 역할에 집중할 수 있다는 전망이 있습니다.'
  },
  {
    id: 'privacy',
    title: 'AI 교육에서 학생 프라이버시, 어떻게 보호할까?',
    description: 'AI 교육 도구가 수집하는 학생 데이터의 보호 방안 토론',
    context: 'AI 학습 플랫폼이 학생의 학습 데이터를 수집하면서 프라이버시 우려가 커지고 있습니다.'
  }
];

// ============================================
// API Functions
// ============================================

function generateJWT() {
  const [kid, secret] = GHOST_API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
  hmac.update(header + '.' + payload);
  return header + '.' + payload + '.' + hmac.digest('base64url');
}

async function callGLM(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'glm-4-plus',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 1200
    });
    
    const req = https.request({
      hostname: 'open.bigmodel.cn',
      port: 443,
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices?.[0]) {
            resolve(parsed.choices[0].message.content);
          } else {
            reject(new Error('GLM error: ' + data));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function ghostRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, GHOST_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${generateJWT()}`
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve(parsed);
        } catch (e) {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============================================
// Memory Functions
// ============================================

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function loadCharacterMemory(characterId) {
  ensureMemoryDir();
  const filepath = path.join(MEMORY_DIR, `${characterId}.json`);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return {
    characterId,
    keyExperiences: [],
    opinions: [],
    relationships: {},
    lastTopics: [],
    createdAt: new Date().toISOString()
  };
}

function saveCharacterMemory(characterId, memory) {
  ensureMemoryDir();
  const filepath = path.join(MEMORY_DIR, `${characterId}.json`);
  fs.writeFileSync(filepath, JSON.stringify(memory, null, 2));
}

function loadLastColloquy() {
  ensureMemoryDir();
  const files = fs.readdirSync(COLLOQUY_DIR)
    .filter(f => f.endsWith('.json') && f.includes('colloquy'))
    .sort()
    .reverse();
  
  if (files.length > 0) {
    const lastFile = path.join(COLLOQUY_DIR, files[0]);
    return JSON.parse(fs.readFileSync(lastFile, 'utf8'));
  }
  return null;
}

function updateMemoryFromColloquy(character, colloquy, myMessages) {
  const memory = loadCharacterMemory(character.id);
  
  // 오늘 발언에서 핵심 의견 추출
  myMessages.forEach(msg => {
    if (msg.length > 100) {
      memory.opinions.push({
        topic: colloquy.topic.title,
        opinion: msg.slice(0, 200),
        date: colloquy.date
      });
    }
  });
  
  // 최근 주제 유지 (최대 10개)
  memory.lastTopics.unshift(colloquy.topic.title);
  memory.lastTopics = memory.lastTopics.slice(0, 10);
  
  // 의견도 최대 50개로 제한
  memory.opinions = memory.opinions.slice(-50);
  
  memory.lastUpdated = new Date().toISOString();
  saveCharacterMemory(character.id, memory);
  
  return memory;
}

// ============================================
// Colloquy Logic
// ============================================

function selectTopic() {
  // 테스트: 다른 주제 강제 선택
  const topicIds = ['ai-tutor', 'ai-usage-limit', 'core-competency', 'public-education', 'assessment', 
                    'digital-divide', 'creative-writing', 'teacher-training', 'special-education', 'ai-ethics',
                    'college-admission', 'language-learning', 'content-creation', 'ai-collaboration', 'privacy'];
  
  // 오늘 날짜 기준으로 다른 주제 선택
  const today = new Date();
  const hour = today.getHours();
  const topicIndex = (hour + today.getDate()) % TOPICS.length;
  
  return TOPICS[topicIndex];
}

function selectCharacters() {
  // 3명 랜덤 선택
  const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function generatePrompt(character, topic, conversationHistory, round, memory, lastColloquy) {
  // 이전 대화 기록
  const history = conversationHistory.map(h => 
    `${h.character.role} ${h.character.name}: ${h.message}`
  ).join('\n\n');
  
  // 기억에서 관련 의견 찾기
  const relevantOpinions = memory.opinions
    .filter(o => o.topic !== topic.title)
    .slice(-3)
    .map(o => `- ${o.opinion}`)
    .join('\n');
  
  // 이전 회차 정보
  const lastSession = lastColloquy ? `\n📌 지난 회차 주제: "${lastColloquy.topic.title}"` : '';
  
  const basePrompt = `당신은 이제부터 "${character.name}"(${character.fullName})이라는 캐릭터가 됩니다.

═══════════════════════════════════════
🎭 캐릭터 프로필
═══════════════════════════════════════

이름: ${character.name} (${character.fullName})
역할: ${character.role}
나이: ${character.age}세

배경:
${character.background}

성격: ${character.personality}

말투 스타일: ${character.speakingStyle}

═══════════════════════════════════════
📚 기억 (이전 경험과 의견)
═══════════════════════════════════════

${relevantOpinions || '아직 이전 의견이 없습니다.'}
${lastSession}

═══════════════════════════════════════
🗣️ 오늘의 토론
═══════════════════════════════════════

주제: "${topic.title}"

설명: ${topic.description}

배경: ${topic.context}

${round === 1 ? `
【첫 번째 발언 - 입장 제시】
이 토론의 첫 발언자입니다. "${character.name}"의 관점에서 이 주제에 대한 **명확한 입장**을 제시하세요.

중요사항:
1. 반드시 600자 이상 1000자 이내로 작성하세요
2. "나는 찬성/반대한다" 또는 "나는 ~라고 생각한다"로 시작하며 명확한 입장을 표현하세요
3. 당신의 배경과 경험을 구체적으로 인용하세요
4. 다른 패널리스트들이 반박할 수 있는 구체적 주장을 제시하세요
5. "${character.name}"의 말투와 성격을 반영하세요

주의: 무조건적인 찬성이나 모호한 입장은 피하세요. 비판적 관점에서 명확한 주장을 하세요.
` : `
【${round}번째 발언 - 반박과 재입장】
지금까지의 대화:

${history}

위 대화를 바탕으로 "${character.name}"의 관점에서 **비판적으로 응답**하세요.

중요사항:
1. 먼저 이전 발언자들에 대한 **구체적 찬성 또는 반박**을 제시하세요
   - "은지 선생님의 의견에는 동의하지만, ~부분은 다르게 생각합니다"
   - "준호 학생의 경험은 이해하지만, 그건 특수한 경우입니다"
   - "성민 교수님의 연구 결과에 의문을 제기합니다"
2. 당신만의 새로운 근거나 반례를 제시하세요
3. 600자 이상 1000자 이내로 작성하세요
4. 질문으로 토론을 이끌어가세요 ("그렇다면 ~은 어떻게 설명하시겠습니까?")
5. "${character.name}"의 말투와 성격을 유지하세요

주의: 단순 동의나 요약이 아닌, 비판적 대화를 이어가세요.
`}

이제 "${character.name}"으로서 자연스럽게 발언해주세요. 캐릭터 이름을 부르지 말고 바로 내용을 시작하세요.`;

  return basePrompt;
}

async function runColloquy() {
  console.log('🎭 AI Colloquy 시작!\n');
  
  // 1. 주제 선정
  const topic = selectTopic();
  console.log(`📌 오늘의 주제: ${topic.title}`);
  console.log(`   ${topic.description}\n`);
  
  // 2. 캐릭터 선정
  const selectedCharacters = selectCharacters();
  console.log(`👥 오늘의 패널:`);
  selectedCharacters.forEach(c => console.log(`   ${c.role} ${c.name} (${c.fullName})`));
  console.log('');
  
  // 3. 이전 기록 로드
  const lastColloquy = loadLastColloquy();
  if (lastColloquy) {
    console.log(`📖 지난 회차: "${lastColloquy.topic.title}"\n`);
  }
  
  // 4. 대화 진행 (3라운드)
  const conversation = [];
  const characterMessages = {}; // 각 캐릭터별 메시지 저장
  
  for (let round = 1; round <= 3; round++) {
    console.log(`\n📢 라운드 ${round}/3`);
    
    for (const character of selectedCharacters) {
      const memory = loadCharacterMemory(character.id);
      const prompt = generatePrompt(character, topic, conversation, round, memory, lastColloquy);
      
      console.log(`   ${character.role} ${character.name} 발언 중...`);
      
      try {
        let response = await callGLM(prompt);
        
        // 길이 검증
        if (response.length < 150) {
          console.log(`      ⚠️ 너무 짧음 (${response.length}자), 재시도...`);
          response = await callGLM(prompt + '\n\n중요: 반드시 300자 이상 작성해주세요!');
        }
        
        conversation.push({
          character: {
            id: character.id,
            name: character.name,
            fullName: character.fullName,
            role: character.role
          },
          message: response,
          round,
          timestamp: new Date().toISOString()
        });
        
        // 캐릭터별 메시지 저장
        if (!characterMessages[character.id]) characterMessages[character.id] = [];
        characterMessages[character.id].push(response);
        
        console.log(`      ✅ 완료 (${response.length}자)`);
        
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        console.error(`      ❌ 실패: ${error.message}`);
      }
    }
  }
  
  // 5. 기억 업데이트
  console.log('\n🧠 기억 업데이트 중...');
  for (const character of selectedCharacters) {
    updateMemoryFromColloquy(character, { topic, date: new Date().toISOString() }, characterMessages[character.id] || []);
  }
  console.log('   ✅ 완료');
  
  // 6. 결론 생성
  console.log('\n📝 결론 작성 중...');
  
  const summaryPrompt = `다음은 "${topic.title}" 주제에 대한 패널 토의 기록입니다.

${conversation.map(h => `${h.character.role} ${h.character.name}:\n${h.message}`).join('\n\n---\n\n')}

이 토의의 핵심 요점을 정리해주세요:
1. 각 패널리스트의 주요 주장 (한 문장씩)
2. 토의에서 드러난 공통점과 차이점
3. 결론적으로 제언할 수 있는 내용

3-5문장으로 작성해주세요.`;

  let summary = '';
  try {
    summary = await callGLM(summaryPrompt);
    console.log('   ✅ 완료');
  } catch (e) {
    summary = '결론 생성 중 오류가 발생했습니다.';
    console.error('   ❌ 실패:', e.message);
  }
  
  return { topic, characters: selectedCharacters, conversation, summary, date: new Date().toISOString() };
}

// ============================================
// HTML Generation
// ============================================

function generateHtml(colloquy) {
  const { topic, characters, conversation, summary } = colloquy;
  
  const characterColors = {
    'teacher': '#059669',
    'student': '#3b82f6',
    'researcher': '#8b5cf6',
    'policymaker': '#f59e0b'
  };
  
  const panelistsHtml = characters.map(c => 
    `<li>${c.role} <strong>${c.name}</strong> (${c.fullName}): ${c.background.split('\n')[0]}</li>`
  ).join('\n    ');
  
  const conversationHtml = conversation.map(entry => {
    const color = characterColors[entry.character.id] || '#64748b';
    
    return `
    <div style="margin:0 0 36px;">
      <h3 style="font-size:18px;font-weight:700;color:${color};margin:0 0 12px;">
        ${entry.character.role} ${entry.character.name}
        <span style="font-size:13px;font-weight:400;color:#94a3b8;margin-left:10px;">라운드 ${entry.round}</span>
      </h3>
      <p style="margin:0;line-height:1.9;color:#1a1a2e;">${entry.message.replace(/\n/g, '<br>')}</p>
    </div>`;
  }).join('\n');
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${topic.title} | AI Colloquy</title>
</head>
<body style="font-family:'Noto Sans KR',sans-serif;max-width:680px;margin:0 auto;padding:20px;font-size:17px;line-height:1.9;color:#1a1a2e;">

  <!-- 헤더 -->
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:32px 28px;border-radius:12px;margin-bottom:40px;">
    <p style="margin:0 0 8px;font-size:14px;opacity:0.9;">🎭 AI Colloquy — AI+교육 패널 토의</p>
    <h1 style="margin:0;font-size:24px;font-weight:700;line-height:1.4;">${topic.title}</h1>
    <p style="margin:12px 0 0;font-size:15px;opacity:0.9;">${topic.description}</p>
    <p style="margin:8px 0 0;font-size:13px;opacity:0.7;">${new Date(colloquy.date).toLocaleDateString('ko-KR')}</p>
  </div>

  <!-- 배경 -->
  <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:18px 22px;border-radius:0 8px 8px 0;margin-bottom:40px;">
    <p style="margin:0;font-size:15px;color:#92400e;"><strong>📋 배경:</strong> ${topic.context}</p>
  </div>

  <!-- 패널리스트 -->
  <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:0 0 20px;color:#1a1a2e;">👥 오늘의 패널</h2>
  <ul style="margin:0 0 40px;padding-left:24px;line-height:2;">
    ${panelistsHtml}
  </ul>

  <!-- 대화 기록 -->
  <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:0 0 24px;color:#1a1a2e;">💬 패널 토의</h2>
  ${conversationHtml}

  <!-- 결론 -->
  <div style="background:#f0fdf4;border-left:4px solid #059669;padding:18px 22px;border-radius:0 8px 8px 0;margin:48px 0 32px;">
    <h2 style="font-size:17px;font-weight:700;margin:0 0 12px;color:#059669;">📝 토의 결론</h2>
    <p style="margin:0;line-height:1.9;color:#1a1a2e;">${summary.replace(/\n/g, '<br>')}</p>
  </div>

  <!-- AI 각주 -->
  <p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">
    본 대화는 GLM-5가 각 캐릭터의 페르소나로 진행한 AI 패널 토의입니다. 캐릭터들은 이전 대화를 기억하며 지속적으로 성장합니다. — AI Colloquy
  </p>

</body>
</html>`;
}

// ============================================
// Publish
// ============================================

async function publish(colloquy) {
  const html = generateHtml(colloquy);
  
  // AI Colloquy 고정 대표 이미지 (토론/대담 이미지)
  const COLLOQUY_FEATURE_IMAGE = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format';

  const result = await ghostRequest('POST', '/ghost/api/admin/posts/?source=html', {
    posts: [{
      title: `🎭 AI Colloquy: ${colloquy.topic.title}`,
      html: html,
      status: 'published',
      tags: [{ name: 'ai-colloquy' }],
      meta_title: `${colloquy.topic.title} | AI Colloquy`,
      meta_description: colloquy.topic.description,
      feature_image: COLLOQUY_FEATURE_IMAGE,
      feature_image_alt: 'AI Colloquy — AI 교육 패널 토의'
    }]
  });
  
  return result;
}

// ============================================
// Main
// ============================================

async function generatePodcastAudio(colloquy) {
  console.log('\n🎙️ 팟캐스트 오디오 생성 중...');
  
  const audioParts = [];
  
  // 인트로
  const intro = `안녕하세요, AI Colloquy 패널 토의입니다. 오늘의 주제는 "${colloquy.topic.title}"입니다. ${colloquy.description} 패널리스트 소개합니다. ${colloquy.characters.map(c => `${c.role} ${c.name}님`).join(', ')}입니다. 그럼 토의를 시작하겠습니다.`;
  
  try {
    const introAudio = await generateTTS(intro, 'intro');
    if (introAudio) audioParts.push({ speaker: '진행자', text: intro, audio: introAudio });
    console.log('   ✅ 인트로 완료');
  } catch (e) {
    console.log('   ⚠️ 인트로 스킵:', e.message);
  }
  
  // 각 발언
  for (const entry of colloquy.conversation) {
    const speaker = `${entry.character.role} ${entry.character.name}`;
    const text = entry.message;
    
    try {
      const audio = await generateTTS(text, entry.character.id);
      if (audio) {
        audioParts.push({ speaker, text, audio });
        console.log(`   ✅ ${entry.character.name} 발언 오디오 완료`);
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log(`   ⚠️ ${entry.character.name} 스킵:`, e.message);
    }
  }
  
  // 아웃트로
  const outro = `이상으로 "${colloquy.topic.title}"에 대한 패널 토의를 마칩니다. 들어주셔서 감사합니다.`;
  
  try {
    const outroAudio = await generateTTS(outro, 'outro');
    if (outroAudio) audioParts.push({ speaker: '진행자', text: outro, audio: outroAudio });
    console.log('   ✅ 아웃트로 완료');
  } catch (e) {
    console.log('   ⚠️ 아웃트로 스킵:', e.message);
  }
  
  return audioParts;
}

// TTS 생성 (임시 - 실제로는 외부 API 사용)
async function generateTTS(text, voiceId) {
  // TODO: ElevenLabs 또는 다른 TTS API 연동
  // 현재는 플레이스홀더 반환
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  🎭 AI Colloquy — AI+교육 패널 토의');
  console.log('     캐릭터들이 기억하며 대화를 이어갑니다');
  console.log('═══════════════════════════════════════════\n');
  
  try {
    const colloquy = await runColloquy();
    
    // 저장
    if (!fs.existsSync(COLLOQUY_DIR)) fs.mkdirSync(COLLOQUY_DIR, { recursive: true });
    
    const filename = `${new Date().toISOString().slice(0, 10)}_colloquy.json`;
    const filepath = path.join(COLLOQUY_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(colloquy, null, 2));
    console.log(`\n💾 저장: ${filepath}`);
    
    // Ghost 발행
    console.log('\n🚀 Ghost 발행 중...');
    const result = await publish(colloquy);
    
    const slug = result.posts?.[0]?.slug;
    const publicUrl = `https://insight.ubion.global/${slug}/`;
    
    console.log('\n✅ 발행 완료!');
    console.log(`🔗 ${publicUrl}`);
    
    console.log('\n─────────────────────────────────────────');
    console.log(`📊 결과 요약:`);
    console.log(`   주제: ${colloquy.topic.title}`);
    console.log(`   패널: ${colloquy.characters.map(c => c.name).join(', ')}`);
    console.log(`   발언 수: ${colloquy.conversation.length}`);
    console.log(`   URL: ${publicUrl}`);
    console.log('─────────────────────────────────────────\n');
    
  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
