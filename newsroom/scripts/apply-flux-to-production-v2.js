#!/usr/bin/env node
/**
 * FLUX 이미지로 기사 feature_image 교체 (v2 — 전체 post 데이터 사용)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

// 업로드된 운영 Ghost 이미지 URL (위 스크립트에서 업로드 완료된 것들)
const POST_UPDATES = [
  { id: '6a02c7f4ddba0bc2cb5ff245', imageUrl: 'https://newsroom.ubion.global/content/images/2026/05/flux-article-1778575800250.png', title: 'AI 리터러시, 학교 교육의 새로운 우선순위로' },
  { id: '6a02c7f1ddba0bc2cb5ff220', imageUrl: 'https://newsroom.ubion.global/content/images/2026/05/flux-article-1778575802522.png', title: '전국 69개 AI 배움터 가동' },
  { id: '6a02c7f0ddba0bc2cb5ff212', imageUrl: 'https://newsroom.ubion.global/content/images/2026/05/flux-article-1778575803467.png', title: '영국 학교, AI 리터러시 훈련 프레임워크 발표' },
  { id: '6a02c7f1ddba0bc2cb5ff227', imageUrl: 'https://newsroom.ubion.global/content/images/2026/05/flux-article-1778575804516.png', title: '美 CACE, AI 교육 위한 1년 교사 연수 시작' },
  { id: '6a02c7f6ddba0bc2cb5ff25b', imageUrl: 'https://newsroom.ubion.global/content/images/2026/05/flux-article-1778575805427.png', title: 'AI와 읽기 이해, 비판적 읽기의 새로운 지평' },
];

const GHOST_ADMIN_API = '69ce149033b7cdcca26cd56a:4d650e8af38b31d732f0d70c74120efcf9786f22fc04ff9e4c7bf58bf7b11304';

function getGhostToken(key) {
  const [id, secret] = key.split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function ghostRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'newsroom.ubion.global',
      path,
      method,
      headers: {
        'Authorization': `Ghost ${getGhostToken(GHOST_ADMIN_API)}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      const b = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(b);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) { reject(new Error(`Parse: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function updatePostFeatureImage(postId, newImageUrl) {
  // 1) 현재 게시물 데이터를 가져옴 (formats=html,mobiledoc 포함)
  const getResult = await ghostRequest('GET', `/ghost/api/admin/posts/${postId}/?formats=html,mobiledoc,lexical`);

  if (!getResult.posts || !getResult.posts[0]) {
    throw new Error('게시물을 찾을 수 없음');
  }

  const post = getResult.posts[0];

  // 2) 필수 필드만 추출해서 PUT 요청
  // Ghost v6.22는 lexical editor 사용 중일 수 있음
  const updateBody = {
    posts: [{
      // 필수: id, title, updated_at
      id: post.id,
      title: post.title,
      updated_at: post.updated_at,

      // mobiledoc 또는 lexical — 있는 것만 포함
      ...(post.mobiledoc ? { mobiledoc: post.mobiledoc } : {}),
      ...(post.lexical ? { lexical: post.lexical } : {}),

      // html은 READ ONLY — lexical이 있을 경우 생략, 없으면 포함
      ...(!post.lexical && !post.mobiledoc && post.html ? { html: post.html } : {}),

      // 기타 필요한 필드
      slug: post.slug,
      status: post.status,
      visibility: post.visibility,
      ...(post.custom_excerpt ? { custom_excerpt: post.custom_excerpt } : {}),
      ...(post.feature_image_alt ? { feature_image_alt: post.feature_image_alt } : {}),
      ...(post.feature_image_caption ? { feature_image_caption: post.feature_image_caption } : {}),
      ...(post.codeinjection_head ? { codeinjection_head: post.codeinjection_head } : {}),
      ...(post.codeinjection_foot ? { codeinjection_foot: post.codeinjection_foot } : {}),
      ...(post.meta_title ? { meta_title: post.meta_title } : {}),
      ...(post.meta_description ? { meta_description: post.meta_description } : {}),
      ...(post.canonical_url ? { canonical_url: post.canonical_url } : {}),
      ...(post.tags && post.tags.length ? { tags: post.tags.map(t => ({ id: t.id, name: t.name })) } : {}),
      ...(post.authors && post.authors.length ? { authors: post.authors.map(a => ({ id: a.id })) } : {}),

      // ✨ 새 이미지 URL
      feature_image: newImageUrl,
    }]
  };

  // 3) PUT 요청
  const result = await ghostRequest('PUT', `/ghost/api/admin/posts/${postId}/`, updateBody);

  if (result.errors) {
    throw new Error(`Update failed: ${JSON.stringify(result.errors)}`);
  }

  return result.posts?.[0]?.feature_image || 'ok';
}

async function main() {
  console.log('=== 기사 feature_image 교체 ===\n');

  for (const item of POST_UPDATES) {
    process.stdout.write(`[${item.title}] `);
    try {
      const result = await updatePostFeatureImage(item.id, item.imageUrl);
      console.log(`✅ ${item.imageUrl.split('/').pop()}`);
    } catch(err) {
      console.log(`❌ ${err.message.substring(0, 120)}`);
    }
  }

  console.log('\n=== 완료 ===');
}

main().catch(err => console.error('Fatal:', err.message));
