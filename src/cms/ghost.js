/**
 * cms/ghost.js — Ghost CMS 연동
 */

const https = require('https');
const jwt = require('jsonwebtoken');

class GhostCMS {
  constructor(config) {
    this.url = config.url.replace(/\/$/, '');
    this.apiKey = config.api_key;
    
    // API Key 파싱: {kid}:{secret}
    const [kid, secret] = this.apiKey.split(':');
    this.kid = kid;
    this.secret = Buffer.from(secret, 'hex');
  }

  /**
   * JWT 토큰 생성
   */
  generateToken() {
    return jwt.sign({}, this.secret, {
      keyid: this.kid,
      algorithm: 'HS256',
      expiresIn: '5m',
      audience: '/admin/'
    });
  }

  /**
   * API 요청
   */
  async request(method, endpoint, body = null) {
    const token = this.generateToken();
    const url = new URL(`/ghost/api/admin/${endpoint}`, this.url);

    return new Promise((resolve, reject) => {
      const options = {
        method,
        headers: {
          'Authorization': `Ghost ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(`Ghost API ${res.statusCode}: ${JSON.stringify(parsed.errors || parsed)}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error(`Ghost API parse error: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Ghost API timeout')); });
      
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * 기사 발행 (draft)
   */
  async createPost(article) {
    const postData = {
      posts: [{
        title: article.title,
        html: article.html,
        status: article.status || 'draft',
        tags: (article.tags || []).map(t => typeof t === 'string' ? { name: t } : t),
        meta_title: article.meta_title,
        meta_description: article.meta_description,
        feature_image: article.feature_image || null
      }]
    };

    const result = await this.request('POST', 'posts/', postData);
    return result.posts[0];
  }

  /**
   * 기사 목록 조회
   */
  async getPosts(options = {}) {
    const params = new URLSearchParams({
      limit: options.limit || 15,
      filter: options.filter || 'status:draft',
      fields: options.fields || 'id,title,status,created_at,updated_at',
      order: 'created_at desc'
    });
    return this.request('GET', `posts/?${params}`);
  }

  /**
   * 기사 삭제
   */
  async deletePost(postId) {
    return this.request('DELETE', `posts/${postId}/`);
  }

  /**
   * 연결 테스트
   */
  async testConnection() {
    try {
      const result = await this.request('GET', 'site/');
      return { connected: true, site: result.site?.title || 'Unknown' };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }
}

module.exports = GhostCMS;
