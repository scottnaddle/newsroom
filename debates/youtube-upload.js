#!/usr/bin/env node
/**
 * YouTube 자동 업로드 스크립트
 *
 * 사용법:
 *   node youtube-upload.js <video-path> <title> [description]
 *
 * 예:
 *   node youtube-upload.js debate.mp4 "AI 교육 토론" "기술낙관론자 vs 회의론자"
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

/**
 * OAuth2 클라이언트 로드 또는 생성
 */
async function authorize() {
  // credentials.json 확인
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      'credentials.json이 없습니다!\n' +
      'YOUTUBE_SETUP.md의 Step 1을 완료하세요.'
    );
  }

  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // 기존 토큰 확인
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(token);

    // 토큰 갱신 필요 시 자동 갱신
    if (oauth2Client.isTokenExpiring()) {
      const newToken = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newToken.credentials);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken.credentials));
      console.log('🔄 토큰 갱신 완료');
    }

    return oauth2Client;
  }

  // 새 인증 필요
  throw new Error(
    'token.json이 없습니다!\n' +
    '먼저 인증을 완료하세요:\n' +
    '  node youtube-auth.js'
  );
}

/**
 * YouTube에 비디오 업로드
 */
async function uploadVideo(auth, videoPath, title, description = '') {
  const youtube = google.youtube({ version: 'v3', auth });

  const fileSize = fs.statSync(videoPath).size;

  console.log(`📤 YouTube 업로드 시작: ${title}`);
  console.log(`   파일: ${videoPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: title,
        description: description,
        tags: ['AI', '교육', '토론', 'AskedTech'],
        categoryId: '27' // Education
      },
      status: {
        privacyStatus: 'unlisted', // 비공개 (링크로만 접근 가능)
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fs.createReadStream(videoPath)
    }
  });

  const videoId = response.data.id;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  console.log(`✅ 업로드 완료!`);
  console.log(`   Video ID: ${videoId}`);
  console.log(`   URL: ${videoUrl}`);
  console.log(`   Embed: ${embedUrl}`);

  return {
    videoId,
    videoUrl,
    embedUrl
  };
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('사용법: node youtube-upload.js <video-path> <title> [description]');
    console.log('예: node youtube-upload.js debate.mp4 "AI 교육 토론" "기술낙관론자 vs 회의론자"');
    process.exit(1);
  }

  const videoPath = path.resolve(args[0]);
  const title = args[1];
  const description = args[2] || '';

  if (!fs.existsSync(videoPath)) {
    console.error(`❌ 파일을 찾을 수 없음: ${videoPath}`);
    process.exit(1);
  }

  try {
    const auth = await authorize();
    const result = await uploadVideo(auth, videoPath, title, description);

    // 결과를 JSON으로 출력 (다른 스크립트에서 파싱 가능)
    console.log('\n--- UPLOAD_RESULT ---');
    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('❌ 업로드 실패:', error.message);
    throw error;
  }
}

// 실행
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { authorize, uploadVideo };
