const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const env = fs.readFileSync('/root/.openclaw/workspace/newsroom/.env', 'utf8');
const apiKey = env.match(/GHOST_ADMIN_API_KEY=(.+)/)[1];
const ghostUrl = new URL(env.match(/GHOST_URL=(.+)/)[1].trim());
const [id, secret] = apiKey.split(':');

const PIXABAY_KEY = '54902516-d932913bad0f64bb4b30c3cdf';

// 한글→영문 키워드 매핑 (교육/AI 특화)
const KEYWORD_MAP = {
  'AI': 'artificial intelligence', '인공지능': 'artificial intelligence',
  '교육': 'education', '학습': 'learning', '학교': 'school',
  '대학': 'university', '학생': 'student', '교사': 'teacher',
  '교실': 'classroom', '수업': 'classroom', '에듀테크': 'edtech',
  '논문': 'research paper', '연구': 'research', 'AI연구': 'ai research',
  '자연어': 'natural language', '언어': 'language',
  '아프리카': 'africa', '인도네시아': 'indonesia',
  '싱가포르': 'singapore', '에스토니아': 'estonia',
  '미국': 'united states', '유럽': 'europe',
  '온라인': 'online learning', '원격': 'remote learning',
  '성격': 'personality', '채점': 'grading',
  '만족도': 'satisfaction', '예측': 'prediction',
  '리터러시': 'digital literacy', '튜터': 'tutoring',
  '교육정책': 'education policy', '디지털': 'digital',
  '혁신': 'innovation', '미래': 'future',
  '코딩': 'coding', '프로그래밍': 'programming',
  '데이터': 'data', '분석': 'analytics',
  '로봇': 'robot', '가상현실': 'virtual reality',
  '메타버스': 'metaverse', '게임': 'gaming',
  '인재': 'talent', '취업': 'career',
  '평가': 'assessment', '시험': 'exam',
  '출범': 'launch', '성과': 'achievement',
  '위기': 'crisis', '변화': 'change',
  '차별': 'bias', '윤리': 'ethics',
  '보안': 'security', '개인정보': 'privacy',
  '고등교육': 'higher education', '초등': 'elementary',
}

// 한글 감지
function hasKorean(text) {
  return /[\uAC00-\uD7AF]/.test(text);
}

// 키워드 추출 (한글→영문 변환)
function extractPixabayKeyword(headline, tags) {
  // 태그 우선
  for (const t of (tags || [])) {
    if (t === '에듀테크') return 'education technology';
    if (t === '자연어처리') return 'natural language processing';
    if (t === 'AI연구' || t === 'ai-paper') return 'ai research';
    if (t === 'ai-edu') return 'artificial intelligence education';
  }
  
  const text = headline || '';
  
  // 한글→키워드 매핑
  const found = [];
  for (const [korean, english] of Object.entries(KEYWORD_MAP)) {
    if (text.includes(korean)) {
      found.push(english);
    }
  }
  
  if (found.length > 0) {
    // 중복 제거 후 최대 3개 반환
    return [...new Set(found)].slice(0, 3).join(' ');
  }
  
  // 기본
  return 'artificial intelligence education';
}

function searchPixabay(keyword) {
  return new Promise((resolve) => {
    const url = `/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(keyword)}&per_page=3&safesearch=true&image_type=photo&orientation=horizontal&min_width=1200`;
    
    const req = https.get({
      hostname: 'pixabay.com',
      path: url,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const hits = result.hits || [];
          if (hits.length > 0) {
            // 랜덤하게 선택 (다양성)
            const idx = Math.floor(Math.random() * Math.min(hits.length, 3));
            const img = hits[idx];
            // 웹용 1280px 크기 사용
            const imageUrl = img.webformatURL.replace('_640', '_1280') || img.webformatURL;
            resolve(imageUrl);
          } else {
            resolve(null);
          }
        } catch(e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// 폴백 이미지 풀 (교육/AI 다양성)
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80',
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80',
  'https://images.unsplash.com/photo-1523050854058-8df90110c7f1?w=1200&q=80',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80',
  'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=1200&q=80',
  'https://images.unsplash.com/photo-1452860606245-08a4f54d129b?w=1200&q=80',
  'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&q=80',
  'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1200&q=80',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=80',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80',
  'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=1200&q=80',
];

function getFallbackImage() {
  return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

function jwt() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function ghostReq(method, path, body) {
  return new Promise((resolve) => {
    const j = jwt();
    const opts = {
      hostname: ghostUrl.hostname,
      path: path,
      method: method,
      headers: {
        'Authorization': 'Ghost '+j,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', () => resolve({}));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const dir = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited';
  let files;
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch(e) { files = []; }
  
  if (files.length === 0) {
    console.log('📂 No files to publish in pipeline/07-copy-edited/');
    return;
  }
  
  console.log(`📰 Publishing ${files.length} articles with Pixabay images...\n`);
  
  let success = 0, fail = 0;
  
  for (const f of files.sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const draft = data.draft || {};
    const headline = draft.headline || 'AI 교육 소식';
    const html = draft.html || '';
    const tags = draft.ghost_tags || ['ai-edu'];
    const src = data.source || {};
    
    // Pixabay 이미지 검색
    const keyword = extractPixabayKeyword(headline, tags);
    console.log(`  🔍 "${headline.substring(0, 35)}..." → Pixabay: "${keyword}"`);
    
    let featureImage = await searchPixabay(keyword);
    if (featureImage) {
      console.log(`     📷 Pixabay: ${featureImage.substring(0, 60)}...`);
    } else {
      featureImage = getFallbackImage();
      console.log(`     📷 Fallback pool: ${featureImage.substring(0, 50)}...`);
    }
    
    try {
      const postData = {
        posts: [{
          title: headline,
          html: html,
          status: 'published',
          featured: false,
          tags: tags.map(t => ({ name: t, slug: t })),
          custom_excerpt: headline.substring(0, 100),
          feature_image: featureImage
        }]
      };
      
      const response = await ghostReq('POST', '/ghost/api/admin/posts/?source=html', postData);
      
      if (response.posts && response.posts[0]) {
        const post = response.posts[0];
        console.log(`  ✅ ${headline.substring(0, 30)} → published (${post.id})`);
        success++;
        
        const pubDir = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
        if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, {recursive: true});
        fs.renameSync(path.join(dir, f), path.join(pubDir, f));
      } else {
        console.log(`  ❌ ${headline.substring(0, 30)} → ${JSON.stringify(response).substring(0, 100)}`);
        fail++;
      }
    } catch (e) {
      console.log(`  ❌ ${headline.substring(0, 30)} → ${e.message}`);
      fail++;
    }
  }
  
  console.log(`\n=== 결과: ${success}개 성공, ${fail}개 실패 ===`);
}

main().catch(console.error);
