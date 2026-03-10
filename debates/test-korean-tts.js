#!/usr/bin/env node
/**
 * 한국어 TTS 테스트
 * Edge TTS 한국어 음성 모델 사용
 */

const { EdgeTTS } = require('node-edge-tts');
const fs = require('fs');
const path = require('path');

async function testKoreanTTS() {
  const text = '안녕하세요. 이것은 한국어 테스트입니다. AI 교육은 학생들에게 도움이 될까요?';
  const outputPath = path.join(__dirname, 'test-korean-tts.mp3');

  console.log('🎙️ 한국어 TTS 테스트 시작...\n');
  console.log('📝 텍스트:', text);
  console.log('🔊 음성: ko-KR-SunHiNeural (한국어 여성)\n');

  try {
    const tts = new EdgeTTS();

    // 한국어 음성으로 설정
    await tts.setMetadata('ko-KR-SunHiNeural', 'audio-24khz-48kbitrate-mono-mp3');

    // 오디오 생성
    const audioStream = await tts.toStream(text);

    // 파일로 저장
    const writeStream = fs.createWriteStream(outputPath);
    audioStream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const stats = fs.statSync(outputPath);
    console.log(`✅ 한국어 TTS 성공!`);
    console.log(`   파일: ${outputPath}`);
    console.log(`   크기: ${(stats.size / 1024).toFixed(2)} KB`);

    return outputPath;
  } catch (error) {
    console.error('❌ 한국어 TTS 실패:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// 실행
testKoreanTTS()
  .then(() => console.log('\n🎉 테스트 완료!'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
