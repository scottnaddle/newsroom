/**
 * Unsplash 스마트 이미지 검색 (v1)
 * 기사 제목 + 본문 → 키워드 추출 → Unsplash API 검색
 * 기사 내용과 관련성이 높은 이미지 자동 선택
 */

const https = require('https');

// Unsplash API Key
const UNSPLASH_API_KEY = 'aQhPL39y1aOHxUIvjZLd0W3MuGLJpz46J7VwNEaVrAk';

// 한글 → 영문 키워드 매핑
const KEYWORD_MAP = {
  'AI': 'artificial intelligence',
  '교육': 'education',
  '학교': 'school',
  '대학': 'university',
  '학생': 'student',
  '교사': 'teacher',
  '기술': 'technology',
  '안전': 'safety',
  '윤리': 'ethics',
  '데이터': 'data',
  '분석': 'analytics',
  '칩': 'chip',
  '반도체': 'semiconductor',
  '기업': 'business',
  '투자': 'investment',
  '정책': 'policy',
  '규제': 'regulation',
  '국방': 'defense',
  '정부': 'government',
  '연구': 'research',
  '혁신': 'innovation',
  '디지털': 'digital',
  '개발': 'development',
  '인재': 'talent',
  '교육부': 'education ministry',
};

/**
 * HTML에서 텍스트 추출
 */
function extractTextFromHtml(html) {
  if (!html) return '';
  // HTML 태그 제거
  const text = html.replace(/<[^>]*>/g, ' ');
  return text.substring(0, 1000); // 처음 1000자만
}

/**
 * 제목과 본문에서 핵심 키워드 추출
 */
function extractKeywords(headline, bodyText) {
  const combinedText = (headline + ' ' + bodyText).toLowerCase();
  const extractedKeywords = [];

  // 매핑된 한글 키워드 찾기
  for (const [korean, english] of Object.entries(KEYWORD_MAP)) {
    if (combinedText.includes(korean.toLowerCase())) {
      extractedKeywords.push(english);
    }
  }

  // 중복 제거 및 가중치 조정
  const uniqueKeywords = [...new Set(extractedKeywords)];
  
  // 없으면 "technology" 기본값
  return uniqueKeywords.length > 0 ? uniqueKeywords : ['technology', 'innovation'];
}

/**
 * Unsplash API에서 이미지 검색
 */
function searchUnsplash(keyword) {
  return new Promise((resolve) => {
    const url = `/api/search/photos?query=${encodeURIComponent(keyword)}&page=1&per_page=5&order_by=relevant`;
    
    const options = {
      hostname: 'api.unsplash.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_API_KEY}`,
        'Accept-Version': 'v1',
        'User-Agent': 'AskedTech-NewsBot/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          
          if (result.results && Array.isArray(result.results) && result.results.length > 0) {
            // 가장 관련성 높은 이미지 반환
            const image = result.results[0];
            if (image.urls && image.urls.regular) {
              const imageUrl = image.urls.regular + '?w=1200&h=630&fit=crop&q=85&auto=format';
              resolve({
                url: imageUrl,
                keyword: keyword,
                photographer: image.user ? image.user.name : 'Unknown',
                photoId: image.id
              });
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      resolve(null);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
    
    req.end();
  });
}

/**
 * 여러 키워드로 순차 검색
 */
async function getSmartFeatureImage({ headline, bodyHtml, tags }) {
  const bodyText = extractTextFromHtml(bodyHtml);
  const keywords = extractKeywords(headline, bodyText);

  console.log(`🔍 키워드 추출: ${keywords.join(', ')}`);

  // 각 키워드로 순차 검색
  for (const keyword of keywords) {
    console.log(`🔎 Unsplash 검색: "${keyword}"`);
    const result = await searchUnsplash(keyword);
    
    if (result) {
      console.log(`✅ 찾음: "${keyword}" by ${result.photographer}`);
      return result.url;
    }

    // 검색 간 딜레이 (API rate limit 회피)
    await new Promise(r => setTimeout(r, 300));
  }

  // 모든 키워드 검색 실패 시 "technology" 기본값
  console.log(`⚠️  키워드 검색 실패, 기본값으로 "technology" 검색`);
  const fallbackResult = await searchUnsplash('technology');
  if (fallbackResult) {
    return fallbackResult.url;
  }

  // 최후 수단: null 반환 (Publisher에서 처리)
  return null;
}

/**
 * CLI 사용 예
 * node unsplash-smart-search.js "기사 제목" "<html>본문</html>"
 */
if (require.main === module) {
  const headline = process.argv[2] || '';
  const bodyHtml = process.argv[3] || '';

  if (!headline) {
    console.error('❌ 사용법: node unsplash-smart-search.js "제목" "<html>본문</html>"');
    process.exit(1);
  }

  getSmartFeatureImage({ headline, bodyHtml })
    .then(url => {
      if (url) {
        console.log(url);
      } else {
        console.error('❌ Unsplash 이미지 검색 실패');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('❌ 오류:', err.message);
      process.exit(1);
    });
}

module.exports = { getSmartFeatureImage, extractKeywords, searchUnsplash };
