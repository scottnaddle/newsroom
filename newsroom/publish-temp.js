const crypto = require('crypto');

// JWT 생성
const apiKey = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const [kid, secret] = apiKey.split(':');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
const now = Math.floor(Date.now()/1000);
const payload = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
const signature = crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(header+'.'+payload).digest('base64url');
const token = header+'.'+payload+'.'+signature;

// 태그 배열 구성
const tags = [
  {id: '69a78cc8659ea80001153beb'}, // ai-digest (필수)
  {name: 'ai'},
  {name: 'alibaba'},
  {name: 'qwen'},
  {name: 'opensource'}
];

// HTML 본문
const html = `<!--kg-card-begin: html-->
<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;max-width:680px;margin:0 auto;color:#1a1a2e;font-size:17px;line-height:1.9;">

  <!-- 다이제스트 배지 (오렌지) -->
  <div style="margin-bottom:28px;">
    <span style="display:inline-flex;align-items:center;gap:6px;background:#fff4ee;border:1px solid #fed7aa;padding:4px 12px;border-radius:20px;font-size:13px;color:#c2410c;font-weight:500;">
      ⚡ AI Digest
    </span>
  </div>

  <!-- 리드 박스 -->
  <div style="border-left:4px solid #FF6B35;padding:16px 20px;background:#fff9f6;border-radius:0 8px 8px 0;margin-bottom:40px;">
    <p style="margin:0;font-size:17px;line-height:1.85;color:#1a1a2e;">알리바바의 오픈소스 AI 모델 'Qwen'을 이끌어온 기술 리더 준양 린(Junyang Lin)이 핵심 연구원들과 함께 사임했다. 6억 회 다운로드를 기록한 Qwen을 글로벌 오픈소스 AI 리더로 성장시킨 핵심 인물들의 이탈로 알리바바의 오픈소스 전략에 우려가 커지고 있다.</p>
  </div>

  <!-- 본문 섹션 -->
  <h2 style="font-size:18px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin:36px 0 16px;">배경</h2>
  <p style="margin:0 0 28px;">준양 린은 최신 소형 모델 시리즈 'Qwen3.5'를 공개한 지 24시간 만에 사임을 발표했다. 그는 X(트위터)에서 "me stepping down. bye my beloved qwen"이라며 작별을 고했다. 함께 연구원 빈위안 후이(Binyuan Hui)와 인턴 카이신 리(Kaixin Li)도 동시에 팀을 떠났다. 알리바바는 이들의 사임을 수용하고 CEO 에디 우가 직접 참여하는 '파운데이션 모델 태스크포스'를 신설해 AI 개발을 가속화하겠다고 발표했다.</p>

  <h2 style="font-size:18px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin:36px 0 16px;">의미와 전망</h2>
  <p style="margin:0 0 28px;">업계에서는 구글 딥마인드 제미니 팀 출신 하오 저우가 새 리더로 영입된 점을 주목하고 있다. 이는 '연구 중심'에서 '지표 중심(metric-driven)' 리더십으로의 전환을 의미하며, Qwen의 오픈소스 전략이 약화될 수 있다는 우려가 나온다. 현재 9만 개 이상의 기업이 Qwen을 사용 중이며, 향후 모델이 유료 API로 전환될 가능성에 대한 논의도 나오고 있다.</p>

  <!-- 에듀테크 시사점 (필수) -->
  <h2 style="font-size:18px;font-weight:700;color:#FF6B35;border-bottom:1px solid #fed7aa;padding-bottom:8px;margin:36px 0 16px;">🎓 에듀테크 시사점</h2>
  <p style="margin:0 0 28px;">Qwen은 라즈베리파이나 저사양 노트북에서도 구동 가능한 경량 모델을 오픈소스로 제공해 교육 현장과 에듀테크 스타트업에게 접근 가능한 AI 대안이었다. 핵심 리더진 이탈과 이어질 수 있는 오픈소스 전략 약화는 교육용 AI 생태계에도 직접적인 영향을 미칠 수 있다. Qwen 기반 교육 서비스를 구축한 기관들은 향후 라이선스 정책 변화에 대비할 필요가 있다.</p>

  <!-- 원문 출처 -->
  <div style="margin-top:36px;padding:14px 18px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
    <p style="margin:0;font-size:14px;color:#64748b;">📎 원문: <a href="https://venturebeat.com/technology/did-alibaba-just-kneecap-its-powerful-qwen-ai-team-key-figures-depart-in" style="color:#FF6B35;text-decoration:none;">VentureBeat</a> | <a href="https://www.bloomberg.com/news/articles/2026-03-04/alibaba-qwen-head-who-warned-of-openai-gap-steps-down" style="color:#FF6B35;text-decoration:none;">Bloomberg</a> | <a href="https://www.reuters.com/world/asia-pacific/alibaba-ceo-confirms-departure-qwen-ai-division-head-2026-03-05/" style="color:#FF6B35;text-decoration:none;">Reuters</a></p>
  </div>

  <!-- AI 각주 -->
  <p style="margin:28px 0 0;padding-top:14px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>

</div>
<!--kg-card-end: html-->`;

// 발행 데이터
const postData = {
  posts: [{
    title: '알리바바 Qwen 핵심 리더진 집단 사임…오픈소스 AI 미래 불확실',
    html: html,
    status: 'published',
    featured: false,
    tags: tags,
    meta_title: '알리바바 Qwen 핵심 리더진 사임, 오픈소스 AI 미래 불확실',
    meta_description: '알리바바 Qwen 기술 리더 준양 린과 핵심 연구원들이 집단 사임했다. 6억 다운로드 오픈소스 AI의 미래와 교육·에듀테크 영향 분석.',
    feature_image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&h=630&fit=crop&q=85&auto=format',
    codeinjection_foot: ''
  }]
};

async function publish() {
  const response = await fetch('https://insight.ubion.global/ghost/api/admin/posts/?source=html', {
    method: 'POST',
    headers: {
      'Authorization': 'Ghost ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postData)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('ERROR:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  
  const post = result.posts[0];
  console.log(JSON.stringify({
    success: true,
    postId: post.id,
    slug: post.slug,
    url: post.url,
    publishedAt: post.published_at
  }, null, 2));
}

publish();
