const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// 기사별 이미지 매핑 (제목 키워드 기반)
const imageMap = {
  '미국 노동부, 국가 AI 리터러시': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop&q=85&auto=format',
  '세계가 앞질렀다, AI 교육 현장': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  '브로드컴 AI 칩 수익': 'https://images.unsplash.com/photo-1526374965328-7f5ae4e8290f?w=1200&h=630&fit=crop&q=85&auto=format',
  'LG AI 대학원 첫 학생': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  '게이오 대학': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop&q=85&auto=format',
  'AI 열풍, 스타트업 펀딩': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  'AI 규제': 'https://images.unsplash.com/photo-1450101499533-7e5f5236429b?w=1200&h=630&fit=crop&q=85&auto=format',
  '미 국방부': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format',
  'OpenAI의 국방부': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format',
  'AI 기업들, 데이터센터': 'https://images.unsplash.com/photo-1599720810694-cb38f64a98d0?w=1200&h=630&fit=crop&q=85&auto=format',
  '클로드, 군사용': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format'
};

function generateJWT() {
  const header = { alg: 'HS256', kid: GHOST_KEY, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 300, aud: '/admin/' };
  
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const message = `${headerEncoded}.${payloadEncoded}`;
  const secretBuffer = Buffer.from(GHOST_SECRET, 'hex');
  const signature = crypto.createHmac('sha256', secretBuffer).update(message).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${message}.${signature}`;
}

function getImageUrl(title) {
  for (const [keyword, url] of Object.entries(imageMap)) {
    if (title.includes(keyword)) {
      return url;
    }
  }
  // 기본값
  return 'https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format';
}

const jwt = generateJWT();

console.log('📸 이미지 없는 기사에 이미지 추가');
console.log('');

// 이미지 없는 12개 기사 ID
const articlesWithoutImage = [
  { id: '69a940c3e2eb440001d55d74', title: '미국 노동부, 국가 AI 리터러시 표준 수립 나섰다' },
  { id: '69a940c3e2eb440001d55d7d', title: '세계가 앞질렀다, AI 교육 현장 글로벌 경쟁 현황' },
  { id: '69a93e5ce2eb440001d55d6e', title: '브로드컴 AI 칩 수익 2배 증가, 2027년 1000억 달러 목표 선언' },
  { id: '69a93bf5e2eb440001d55d68', title: '"인간을 위한 기술" 실천한다, LG AI 대학원 첫 학생' },
  { id: '69a9372ae2eb440001d55d38', title: '미국 노동부, 국가 AI 리터러시 표준 수립 나섰다' },
  { id: '69a93041e2eb440001d55c98', title: '게이오 대학, 3년의 교훈 담은 AI 사용 지침 발표' },
  { id: '69a92da7e2eb440001d55c89', title: 'AI 열풍, 스타트업 펀딩 사상 최대 기록—2월 $189B 투자' },
  { id: '69a91f8de2eb440001d55c54', title: 'AI 규제의 우회로? 미국, 데이터센터 통제로 AI 발전 속도 조절' },
  { id: '69a91150e2eb440001d558da', title: '미 국방부, 방위업체에 Anthropic AI 도구 제거 명령' },
  { id: '69a8fc74e2eb440001d558c4', title: "OpenAI의 국방부 계약 체결에 직원들 반발, 안전장치 논쟁" },
  { id: '69a8edd6e2eb440001d5588c', title: 'AI 기업들, 데이터센터 인프라 비용 자체 부담 약속' },
  { id: '69a8d082e2eb440001d5586b', title: '클로드, 군사용 안전장치 유지 선택... 윤리 vs 가속화 딜레마' }
];

let updated = 0;

const updateArticles = (index) => {
  if (index >= articlesWithoutImage.length) {
    console.log('');
    console.log(`✅ 완료: ${updated}/${articlesWithoutImage.length}개 이미지 추가`);
    return;
  }
  
  const article = articlesWithoutImage[index];
  const imageUrl = getImageUrl(article.title);
  
  const updateData = {
    posts: [{
      feature_image: imageUrl
    }]
  };
  
  const putOptions = {
    hostname: GHOST_URL,
    path: `/ghost/api/admin/posts/${article.id}/?source=html`,
    method: 'PUT',
    headers: {
      'Authorization': `Ghost ${jwt}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(updateData))
    }
  };
  
  const putReq = https.request(putOptions, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        
        if (result.posts && result.posts.length > 0) {
          updated++;
          console.log(`${index + 1}. ✅ "${article.title.substring(0, 40)}..."`);
        } else {
          console.log(`${index + 1}. ❌ "${article.title.substring(0, 40)}..."`);
        }
      } catch (e) {
        console.log(`${index + 1}. ⚠️  "${article.title.substring(0, 40)}..."`);
      }
      
      setTimeout(() => updateArticles(index + 1), 300);
    });
  });
  
  putReq.on('error', (e) => {
    console.log(`${index + 1}. ❌ "${article.title.substring(0, 40)}..."`);
    setTimeout(() => updateArticles(index + 1), 300);
  });
  
  putReq.write(JSON.stringify(updateData));
  putReq.end();
};

updateArticles(0);
