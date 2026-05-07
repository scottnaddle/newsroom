#!/usr/bin/env python3
"""
Featured Post Selector for UBION Newsroom v3 (2026-05-07)
===========================================================
정책: 시평/테크브리핑은 발행 시점에 featured=true (publisher가 처리).
이 스크립트는 ai-paper(논문)에 대해서만 featured를 관리하고,
시평/테크브리핑의 featured 상태를 절대 변경하지 않음.
"""
import json, os, subprocess, sys

WORKSPACE = '/root/.openclaw/workspace/newsroom'

# Featured 보존 대상 태그 (이 태그가 있는 게시물은 절대 unfeature하지 않음)
PRESERVED_TAGS = ['시평', 'editorial', '테크브리핑', 'tech-brief', 'ai-tech-brief']

def run_node(js_code):
    result = subprocess.run(
        ['node', '-e', js_code],
        capture_output=True, text=True, cwd=WORKSPACE, timeout=60
    )
    return result.stdout, result.stderr

def main():
    print('⭐ Featured Post Selector v3 시작...\n')
    print('   정책: 시평/테크브리핑 featured 보존, ai-paper만 관리\n')

    js = """
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const envText = fs.readFileSync('.env', 'utf8');
const apiKey = envText.match(/GHOST_ADMIN_API_KEY=(.+)/)[1].trim();
const ghostUrl = new URL(envText.match(/GHOST_URL=(.+)/)[1].trim());
const [id, secret] = apiKey.split(':');

const PRESERVED_TAGS = ['시평', 'editorial', '테크브리핑', 'tech-brief', 'ai-tech-brief'];

function makeJWT() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function ghostReq(method, path, body) {
  return new Promise((resolve) => {
    const j = makeJWT();
    const headers = { 'Authorization': 'Ghost '+j, 'Content-Type': 'application/json; charset=utf-8' };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const opts = { hostname: ghostUrl.hostname, path, method, headers };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', () => resolve({}));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function hasPreservedTag(post) {
  const tagNames = (post.tags || []).map(t => (t.name || t.slug || '').toLowerCase());
  return PRESERVED_TAGS.some(pt => tagNames.some(tn => tn.includes(pt)));
}

(async () => {
  const allPosts = await ghostReq('GET', '/ghost/api/admin/posts/?limit=80&status=published&include=tags&formats=html');
  const posts = allPosts.posts || [];
  console.log('Total posts: ' + posts.length);

  // 1. 카테고리별 분류
  const paperPosts = [];
  const newsPosts = [];
  let preservedCount = 0;

  for (const p of posts) {
    const tags = (p.tags || []).map(t => t.slug || t.name);
    if (hasPreservedTag(p)) {
      preservedCount++;
      continue; // 시평/테크브리핑은 건드리지 않음
    }
    if (tags.includes('ai-paper')) paperPosts.push(p);
    else newsPosts.push(p); // 일반 뉴스
  }

  console.log('Papers (ai-paper): ' + paperPosts.length);
  console.log('News (일반): ' + newsPosts.length);
  console.log('Preserved (시평/테크브리핑): ' + preservedCount);

  // 2. 기존 ai-paper featured 정리 (unfeature old)
  let unfeatureCount = 0;
  for (const p of [...paperPosts, ...newsPosts]) {
    if (p.featured) {
      const getPost = await ghostReq('GET', '/ghost/api/admin/posts/' + p.id + '/?fields=id,updated_at');
      const updatedAt = getPost.posts ? getPost.posts[0].updated_at : null;
      if (updatedAt) {
        await ghostReq('PUT', '/ghost/api/admin/posts/' + p.id + '/?updated_at=' + encodeURIComponent(updatedAt), {
          posts: [{ id: p.id, featured: false, updated_at: updatedAt }]
        });
        unfeatureCount++;
      }
    }
  }
  console.log('Unfeatured old: ' + unfeatureCount);

  // 3. ai-paper 중 가장 긴 논문 1개 featured
  let paperFeaturedId = null, paperFeaturedTitle = null;

  if (paperPosts.length > 0) {
    const bestPaper = paperPosts.reduce((best, p) =>
      (p.html || '').length > (best.html || '').length ? p : best
    );
    const getPaper = await ghostReq('GET', '/ghost/api/admin/posts/' + bestPaper.id + '/?fields=id,updated_at');
    const upd = getPaper.posts ? getPaper.posts[0].updated_at : null;
    if (upd) {
      await ghostReq('PUT', '/ghost/api/admin/posts/' + bestPaper.id + '/?updated_at=' + encodeURIComponent(upd), {
        posts: [{ id: bestPaper.id, featured: true, updated_at: upd }]
      });
      console.log('**FEATURED_PAPER** ' + bestPaper.id + ' || ' + (bestPaper.title || ''));
      paperFeaturedId = bestPaper.id;
      paperFeaturedTitle = bestPaper.title || '';
    }
  }

  // JSON output
  const out = JSON.stringify({
    totalPosts: posts.length,
    preserved: preservedCount,
    paperFeaturedId: paperFeaturedId,
    paperFeaturedTitle: paperFeaturedTitle,
    note: '시평/테크브리핑 featured는 publisher가 관리합니다.'
  });
  console.log('---RESULT_START---');
  console.log(out);
})();
"""

    stdout, stderr = run_node(js)

    if stderr.strip():
        print('⚠️  Stderr:', stderr[:500])

    result_data = {}
    if '---RESULT_START---' in stdout:
        json_part = stdout.split('---RESULT_START---')[1].strip()
        lines = json_part.split('\n')
        for line in lines:
            try:
                result_data = json.loads(line)
                break
            except:
                pass

    if result_data:
        print(f'✅ 전체 게시물: {result_data.get("totalPosts", 0)}개')
        print(f'   보존(시평/테크브리핑): {result_data.get("preserved", 0)}개')
        print()
        ptitle = result_data.get('paperFeaturedTitle', '')
        if ptitle:
            print(f'⭐ Featured 논문: {ptitle[:50]}')
        else:
            print('   (featured할 논문 없음)')
    else:
        print('Stdout:', stdout[:1000])

    print('\n---CRON_JSON---')
    print(json.dumps(result_data))

    return 0

if __name__ == '__main__':
    sys.exit(main())
