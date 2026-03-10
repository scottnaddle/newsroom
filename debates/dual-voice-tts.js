#!/usr/bin/env node
/**
 * 토론 대본을 발언자별로 다른 목소리로 변환
 * 
 * 사용법:
 *   node dual-voice-tts.js <debate-md> [output-mp3]
 */

const fs = require('fs');
const path = require('path');

// 목소리 설정
const VOICES = {
  '민수': 'echo',      // 기술낙관론자 - 남성
  '지현': 'shimmer',   // 회의론자 - 여성
  '진행자': 'alloy'    // 진행자 - 중성
};

// OpenAI API 키 로드
function loadAPIKey() {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  try {
    const bashrcPath = path.join(process.env.HOME || '/root', '.bashrc');
    const bashrc = fs.readFileSync(bashrcPath, 'utf-8');
    const lines = bashrc.split('\n');
    let lastKey = null;
    
    for (const line of lines) {
      const match = line.match(/^export OPENAI_API_KEY="([^"]+)"$/);
      if (match && match[1] && match[1].startsWith('sk-proj-')) {
        lastKey = match[1];
      }
    }
    
    if (lastKey) {
      process.env.OPENAI_API_KEY = lastKey;
      return lastKey;
    }
  } catch (error) {
    console.error('bashrc 읽기 실패:', error.message);
  }

  return null;
}

/**
 * 마크다운에서 발언자별 텍스트 추출
 */
function extractSpeakersFromMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const speakers = {};
  let currentSpeaker = null;
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    // 발언자 감지 (예: "**민수 (기술낙관론자)**:")
    const speakerMatch = line.match(/\*\*([^*(]+)\s*\([^)]+\)\*\*:?\s*"?(.+?)"?$/);
    
    if (speakerMatch) {
      const speakerName = speakerMatch[1].trim();
      const text = speakerMatch[2] || '';
      
      if (!speakers[speakerName]) {
        speakers[speakerName] = [];
      }
      
      currentSpeaker = speakerName;
      
      if (text) {
        speakers[speakerName].push(text);
      }
    } else if (currentSpeaker && line.trim() && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('*이 토론은')) {
      // 현재 발언자의 텍스트 계속 추가
      const cleanLine = line
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/"/g, '')
        .trim();
      
      if (cleanLine && !cleanLine.startsWith('*')) {
        speakers[currentSpeaker].push(cleanLine);
      }
    }
  }
  
  return speakers;
}

/**
 * 단일 텍스트를 TTS로 변환
 */
async function generateSingleTTS(text, voice, outputPath) {
  const apiKey = loadAPIKey();
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY를 찾을 수 없습니다');
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      input: text,
      voice: voice,
      response_format: 'mp3',
      speed: 1.0
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  
  return buffer.byteLength;
}

/**
 * 이중 목소리 토론 오디오 생성
 */
async function generateDualVoiceTTS(mdPath, outputPath) {
  console.log('🎙️ 이중 목소리 TTS 시작...\n');
  
  // 발언자별 텍스트 추출
  console.log('📖 발언자별 텍스트 추출 중...');
  const speakers = extractSpeakersFromMarkdown(mdPath);
  
  const speakerNames = Object.keys(speakers);
  console.log(`   감지된 발언자: ${speakerNames.join(', ')}\n`);
  
  if (speakerNames.length === 0) {
    throw new Error('발언자를 찾을 수 없습니다');
  }
  
  // 각 발언자별 오디오 생성
  const tempFiles = [];
  let partNumber = 0;
  
  for (const speakerName of speakerNames) {
    const texts = speakers[speakerName];
    const voice = VOICES[speakerName] || 'alloy';
    
    console.log(`\n🎙️ ${speakerName} 발언 변환 중...`);
    console.log(`   목소리: ${voice}`);
    console.log(`   문장 수: ${texts.length}`);
    
    // 각 문장을 개별 TTS로 변환
    for (let i = 0; i < texts.length; i++) {
      partNumber++;
      const tempFile = outputPath.replace('.mp3', `-part${partNumber}.mp3`);
      
      process.stdout.write(`   [${i + 1}/${texts.length}] 변환 중...`);
      
      try {
        const size = await generateSingleTTS(texts[i], voice, tempFile);
        console.log(` ✅ (${(size / 1024).toFixed(2)} KB)`);
        tempFiles.push(tempFile);
      } catch (error) {
        console.log(` ❌ 실패: ${error.message}`);
      }
      
      // Rate limiting 방지 (1초 대기)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 모든 오디오 파일 병합
  if (tempFiles.length > 1) {
    console.log('\n🔗 오디오 청크 병합 중...');
    
    const listFile = outputPath.replace('.mp3', '-list.txt');
    const listContent = tempFiles.map(f => `file '${path.basename(f)}'`).join('\n');
    fs.writeFileSync(listFile, listContent);
    
    const { execSync } = require('child_process');
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}" 2>/dev/null`,
      { cwd: path.dirname(outputPath) }
    );
    
    // 임시 파일 삭제
    tempFiles.forEach(f => fs.unlinkSync(f));
    fs.unlinkSync(listFile);
    
    console.log('   ✅ 병합 완료');
  } else if (tempFiles.length === 1) {
    fs.renameSync(tempFiles[0], outputPath);
  }
  
  const stats = fs.statSync(outputPath);
  console.log(`\n✅ 이중 목소리 TTS 성공!`);
  console.log(`   파일: ${outputPath}`);
  console.log(`   크기: ${(stats.size / 1024).toFixed(2)} KB`);
  
  return outputPath;
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('사용법: node dual-voice-tts.js <debate.md> [output.mp3]');
    console.log('예: node dual-voice-tts.js ai-copyright-debate.md debate-dual.mp3');
    console.log('\n목소리 설정:');
    console.log('  민수 (기술낙관론자) → echo (남성)');
    console.log('  지현 (회의론자) → shimmer (여성)');
    console.log('  진행자 → alloy (중성)');
    process.exit(1);
  }

  const mdPath = path.resolve(args[0]);
  const outputPath = args[1] || mdPath.replace('.md', '-dual.mp3');

  if (!fs.existsSync(mdPath)) {
    console.error(`❌ 파일을 찾을 수 없음: ${mdPath}`);
    process.exit(1);
  }

  try {
    await generateDualVoiceTTS(mdPath, outputPath);
    console.log('\n🎉 완료!');
  } catch (error) {
    console.error('❌ 실패:', error.message);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { generateDualVoiceTTS, extractSpeakersFromMarkdown };
