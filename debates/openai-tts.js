#!/usr/bin/env node
/**
 * OpenAI TTS로 한국어 오디오 생성
 * 
 * 사용법:
 *   node openai-tts.js <text> [output-path]
 */

const fs = require('fs');
const path = require('path');

// OpenAI API 키 확인
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경 변수가 필요합니다');
  console.error('\n설정 방법:');
  console.error('  export OPENAI_API_KEY="sk-proj-xxxxx"');
  console.error('\n또는 스크립트 실행 시:');
  console.error('  OPENAI_API_KEY="sk-proj-xxxxx" node openai-tts.js "텍스트"');
  process.exit(1);
}

async function generateTTS(text, outputPath) {
  console.log('🎙️ OpenAI TTS 시작...\n');
  console.log(`📝 텍스트 길이: ${text.length}자`);
  console.log(`🔊 모델: tts-1-hd (고품질)`);
  console.log(`🗣️ 음성: nova (자연스러운 여성)\n`);

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice: 'nova', // alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',
        speed: 1.0
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    // 오디오 저장
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));

    const stats = fs.statSync(outputPath);
    console.log(`✅ OpenAI TTS 성공!`);
    console.log(`   파일: ${outputPath}`);
    console.log(`   크기: ${(stats.size / 1024).toFixed(2)} KB`);

    return outputPath;
  } catch (error) {
    console.error('❌ OpenAI TTS 실패:', error.message);
    throw error;
  }
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('사용법: node openai-tts.js <text> [output-path]');
    console.log('예: node openai-tts.js "안녕하세요" output.mp3');
    process.exit(1);
  }

  const text = args[0];
  const outputPath = args[1] || path.join(__dirname, 'openai-tts-output.mp3');

  try {
    await generateTTS(text, outputPath);
    console.log('\n🎉 완료!');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { generateTTS };
