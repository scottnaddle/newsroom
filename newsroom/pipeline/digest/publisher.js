#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Configuration
const GHOST_API_URL = 'https://ubion.ghost.io/ghost/api/admin/';
// Using the API key from config file
const API_KEY = '69a41252e9865e00011c166a:f606281776c09b80680f09887a3bbe6bf28589da6fdc68b46ae9782f3c2dd8a0';
const DIGEST_TAG_ID = '69a78cc8659ea80001153beb';
const DRAFT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted/';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published/';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/rejected/';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

// Ensure directories exist
[PUBLISHED_DIR, REJECTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// JWT token generation
function generateJWT() {
  const [id, secret] = API_KEY.split(':');
  
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: id
  };
  
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    aud: '/admin/'
  };
  
  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(payload));
  
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest();
  
  const signatureEncoded = base64url(signature);
  
  return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
}

function base64url(input) {
  if (typeof input === 'string') {
    input = Buffer.from(input, 'utf8');
  }
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Feature image URL generator (using placeholder service)
function getFeatureImageUrl(digest) {
  // Use a simple placeholder based on digest content
  // In production, this could call an image API or use a specific service
  const hash = crypto
    .createHash('md5')
    .update(digest.headline)
    .digest('hex');
  
  return `https://picsum.photos/1200/630?random=${hash.substring(0, 8)}`;
}

// Ghost API call with retry logic
async function publishToGhost(postData, retries = 0) {
  return new Promise((resolve, reject) => {
    const token = generateJWT();
    const url = new URL('posts/?source=html', GHOST_API_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${token}`
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          const error = new Error(`HTTP ${res.statusCode}: ${data}`);
          error.statusCode = res.statusCode;
          error.response = data;
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(JSON.stringify(postData));
    req.end();
  });
}

// Validate HTML content
function validateHtml(html) {
  // Remove HTML tags for character count
  const text = html.replace(/<[^>]*>/g, '').trim();
  
  // Check character count (500+ chars for digest - they're concise by design)
  if (text.length < 500) {
    return { valid: false, reason: `Insufficient content (${text.length} chars, need 500+)` };
  }
  
  // Check word count (50+)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 50) {
    return { valid: false, reason: `Insufficient words (${words.length}, need 50+)` };
  }
  
  return { valid: true };
}

// Process a single digest file
async function processDigestFile(filename) {
  const filepath = path.join(DRAFT_DIR, filename);
  
  try {
    // Read the file
    const fileContent = fs.readFileSync(filepath, 'utf8');
    const digest = JSON.parse(fileContent);
    
    // Validate HTML
    const validation = validateHtml(digest.digest.html);
    if (!validation.valid) {
      throw new Error(`HTML validation failed: ${validation.reason}`);
    }
    
    // Prepare Ghost post data
    const featureImageUrl = getFeatureImageUrl(digest.digest);
    
    const postData = {
      posts: [
        {
          title: digest.digest.headline,
          html: digest.digest.html,
          status: 'published',
          feature_image: featureImageUrl,
          og_image: featureImageUrl,
          twitter_image: featureImageUrl,
          meta_title: digest.digest.meta_title,
          meta_description: digest.digest.meta_description,
          tags: [
            {
              id: DIGEST_TAG_ID,
              name: 'ai-digest'
            },
            ...digest.digest.ghost_tags
              .filter(tag => tag !== 'ai-digest')
              .map(tag => ({ name: tag }))
          ]
        }
      ]
    };
    
    // Publish with retry logic
    let response;
    let lastError;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Publishing: ${digest.digest.headline} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        response = await publishToGhost(postData);
        break;
      } catch (error) {
        lastError = error;
        console.error(`  Attempt ${attempt + 1} failed: ${error.message}`);
        
        if (attempt < MAX_RETRIES) {
          console.log(`  Retrying in ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }
    
    if (!response) {
      throw lastError || new Error('Publishing failed after all retries');
    }
    
    // Save to published folder with Ghost metadata
    const publishedPost = response.posts[0];
    const result = {
      ...digest,
      ghost_id: publishedPost.id,
      ghost_url: publishedPost.url,
      published_at: new Date().toISOString(),
      stage: 'published'
    };
    
    const publishedPath = path.join(PUBLISHED_DIR, filename);
    fs.writeFileSync(publishedPath, JSON.stringify(result, null, 2));
    
    // Remove from drafted folder
    fs.unlinkSync(filepath);
    
    return {
      success: true,
      filename,
      title: digest.digest.headline,
      ghostUrl: publishedPost.url
    };
  } catch (error) {
    // Move to rejected folder
    const rejectPath = path.join(REJECTED_DIR, filename);
    const errorFile = path.join(REJECTED_DIR, filename.replace('.json', '.error.json'));
    
    try {
      const fileContent = fs.readFileSync(filepath, 'utf8');
      fs.writeFileSync(rejectPath, fileContent);
      
      const errorLog = {
        filename,
        error: error.message,
        timestamp: new Date().toISOString(),
        stack: error.stack
      };
      fs.writeFileSync(errorFile, JSON.stringify(errorLog, null, 2));
      
      fs.unlinkSync(filepath);
    } catch (moveError) {
      console.error(`Failed to move file to rejected: ${moveError.message}`);
    }
    
    return {
      success: false,
      filename,
      error: error.message
    };
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting AI Digest Publisher...');
  console.log(`   Source: ${DRAFT_DIR}`);
  console.log(`   Ghost API: ${GHOST_API_URL}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);
  
  // Get all JSON files from draft folder
  const files = fs.readdirSync(DRAFT_DIR).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('✅ No files to publish.');
    return;
  }
  
  console.log(`📄 Found ${files.length} file(s) to publish\n`);
  
  // Process each file
  const results = [];
  for (const file of files) {
    const result = await processDigestFile(file);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.title}`);
      console.log(`   URL: ${result.ghostUrl}\n`);
    } else {
      console.log(`❌ ${file}: ${result.error}\n`);
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${results.length}`);
  console.log(`✅ Published: ${successful}`);
  console.log(`❌ Rejected: ${failed}`);
  
  if (successful > 0) {
    console.log('\n📰 Published Articles:');
    results
      .filter(r => r.success)
      .forEach(r => {
        console.log(`   • ${r.title}`);
        console.log(`     ${r.ghostUrl}`);
      });
  }
  
  if (failed > 0) {
    console.log('\n⚠️ Failed Articles:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   • ${r.filename}`);
        console.log(`     Error: ${r.error}`);
      });
  }
  
  console.log('\n' + '='.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
