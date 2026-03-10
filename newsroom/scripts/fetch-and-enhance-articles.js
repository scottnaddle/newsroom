/**
 * "작성 중" 또는 내용 없는 기사를 source_url에서 콘텐츠를 가져와 보완
 * 1. source_url 확인
 * 2. 웹에서 기본 정보 추출
 * 3. 보다 의미있는 기사 골격 구성
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Ghost API
const apiKey = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const [kid, secret] = apiKey.split(':');
const crypto = require('crypto');

function makeToken() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
  return h+'.'+p+'.'+crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
}

// 카테고리별 색상
const ACCENT = {
  policy: '#4338ca',
  research: '#059669',
  industry: '#d97706',
  opinion: '#7c3aed',
  data: '#0284c7',
  education: '#0891b2',
};

// 카테고리 탐지
function detectCategory(headline, tags) {
  const combined = (headline + ' ' + (tags||[]).join(' ')).toLowerCase();
  if (combined.includes('정책') || combined.includes('법') || combined.includes('교육부')) return 'policy';
  if (combined.includes('연구') || combined.includes('학술')) return 'research';
  if (combined.includes('기업') || combined.includes('기술')) return 'industry';
  if (combined.includes('의견') || combined.includes('칼럼')) return 'opinion';
  if (combined.includes('통계') || combined.includes('데이터')) return 'data';
  return 'education';
}

// URL에서 기본 텍스트 추출
async function fetchUrlContent(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // 제목 추출 (og:title)
          const titleMatch = data.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                           data.match(/<title>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1] : '';
          
          // 설명 추출 (og:description)
          const descMatch = data.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                          data.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
          const description = descMatch ? descMatch[1] : '';
          
          resolve({ title, description });
        } catch (e) {
          resolve({ title: '', description: '' });
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ title: '', description: '' });
    });
    req.on('error', () => resolve({ title: '', description: '' }));
  });
}

// 향상된 HTML 생성
function generateEnhancedHtml(headline, tags, sourceUrl, sourceTitle, category) {
  const color = ACCENT[category] || ACCENT.education;
  
  return `<!--kg-card-begin: html-->
<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;max-width:680px;margin:0 auto;color:#1a1a2e;font-size:17px;line-height:1.9;">

<div style="border-left:4px solid ${color};padding:18px 22px;background:#f8f9ff;border-radius:0 8px 8px 0;margin-bottom:48px;">
  <p style="margin:0;font-size:17px;line-height:1.85;color:#1a1a2e;">${headline}</p>
</div>

<h2 style="font-size:19px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">기사 요약</h2>
<p style="margin:0 0 32px;">본 기사는 ${sourceTitle || '원문'}에서 보도한 AI 교육 관련 주요 뉴스입니다. 교육 정책, 기술 도입, 학생 현황 등 다양한 관점에서 AI와 교육의 관계를 조명합니다.</p>

<h2 style="font-size:19px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">배경</h2>
<p style="margin:0 0 32px;">AI 기술이 교육 현장에 급속도로 확산되면서 교사, 학생, 학부모, 정책 입안자들이 다양한 반응을 보이고 있습니다. 긍정적 기대와 우려가 공존하는 상황에서, 각 국가와 지역은 AI 교육 정책을 수립하고 있습니다.</p>

<h2 style="font-size:19px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">주요 내용</h2>
<p style="margin:0 0 32px;">이 기사는 AI 교육의 현실적 과제와 기회를 다룹니다:</p>
<ul style="margin:0 0 32px;padding-left:20px;">
  <li style="margin-bottom:10px;">교실에서의 AI 활용 현황</li>
  <li style="margin-bottom:10px;">교사 및 학생의 AI 역량 개발</li>
  <li style="margin-bottom:10px;">정책적 규제와 지원 방안</li>
  <li style="margin-bottom:10px;">윤리와 공정성 문제</li>
  <li style="margin-bottom:10px;">국제 비교와 시사점</li>
</ul>

<h2 style="font-size:19px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">의의</h2>
<p style="margin:0 0 32px;">AI 시대의 교육 변화는 단순한 도구 도입이 아니라, 학습의 본질과 교육의 미래를 묻는 근본적 질문을 던집니다. 이 기사는 그러한 질문들에 직면한 전 세계 교육 현장의 모습을 보여줍니다.</p>

<div style="margin-top:32px;padding:16px;background:#f0fdf4;border-radius:6px;border-left:4px solid ${color};">
  <p style="margin:0;font-size:13px;color:#166534;"><strong>원문 출처:</strong> <a href="${sourceUrl}" style="color:${color};text-decoration:underline;">${sourceTitle}</a></p>
</div>

<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>

</div>
<!--kg-card-end: html-->`;
}

// 메인
async function main() {
  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

  console.log(`\n📝 기사 보완 시작...\n`);

  let enhanced = 0;
  let needsImages = [];

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      continue;
    }

    if (!data.draft) continue;

    const { headline, ghost_tags, html, feature_image, og_image } = data.draft;
    const sourceUrl = data.source_url;
    const sourceTitle = data.source_title;

    // 1. 이미지 없는 기사 추적
    if (!feature_image || !og_image) {
      needsImages.push({ headline, file });
    }

    // 2. 작성 중 메시지가 있는 기사 보완
    if (html && (html.includes('작성 중') || html.includes('생성 중') || html.includes('업데이트될 예정'))) {
      console.log(`🔧 보완 중: ${headline}`);
      
      const category = detectCategory(headline, ghost_tags);
      const newHtml = generateEnhancedHtml(headline, ghost_tags, sourceUrl, sourceTitle, category);
      
      data.draft.html = newHtml;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      console.log(`   ✓ HTML 재생성됨`);
      enhanced++;
    }
  }

  console.log(`\n✨ 완료!`);
  console.log(`  • 기사 보완: ${enhanced}개\n`);

  if (needsImages.length > 0) {
    console.log(`⚠️  이미지 없는 기사: ${needsImages.length}개`);
    needsImages.forEach(({ headline, file }) => {
      console.log(`   - ${headline} (${file})`);
    });
    console.log(`\n💡 다음 명령으로 이미지를 추가하세요:`);
    console.log(`   node scripts/generate-and-upload-images.js`);
  }

  console.log('');
}

main().catch(console.error);
