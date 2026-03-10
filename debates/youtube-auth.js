#!/usr/bin/env node
/**
 * YouTube OAuth 인증 (1회만 실행)
 *
 * 사용법:
 *   node youtube-auth.js
 *
 * 이 스크립트는 브라우저를 열어 Google 로그인을 요청합니다.
 * 인증이 완료되면 token.json이 생성되며, 이후 자동으로 갱신됩니다.
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

async function authenticate() {
  // credentials.json 확인
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ credentials.json이 없습니다!');
    console.error('\n📋 설정 방법:');
    console.error('   1. Google Cloud Console 접속: https://console.cloud.google.com/');
    console.error('   2. YouTube Data API v3 활성화');
    console.error('   3. OAuth 2.0 클라이언트 ID 생성 (Desktop app)');
    console.error('   4. credentials.json 다운로드');
    console.error(`   5. ${CREDENTIALS_PATH}에 저장`);
    console.error('\n📖 자세한 내용: YOUTUBE_SETUP.md');
    process.exit(1);
  }

  console.log('🔐 YouTube OAuth 인증 시작...\n');

  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  // 수동 인증을 위한 redirect URI
  const manualRedirectUri = 'urn:ietf:wg:oauth:2.0:oob';
  
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    manualRedirectUri
  );

  // 인증 URL 생성
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // 항상 refresh token 받기
  });

  console.log('🌐 브라우저에서 다음 URL을 열고 인증하세요:\n');
  console.log(authUrl);
  console.log('\n');

  // 인증 코드 입력 대기
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('🔑 인증 코드를 붙여넣으세요: ', async (code) => {
    rl.close();

    try {
      // 토큰 교환
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // 토큰 저장
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('\n✅ 인증 완료!');
      console.log(`   토큰 저장 위치: ${TOKEN_PATH}`);
      console.log('\n🚀 이제 YouTube 업로드가 가능합니다!');
      console.log('   node youtube-upload.js <video> <title>');

    } catch (error) {
      console.error('\n❌ 인증 실패:', error.message);
      process.exit(1);
    }
  });
}

// 실행
authenticate();
