#!/usr/bin/env node
/**
 * 토론 대본을 OpenAI TTS로 한국어 오디오 생성
 * 
 * 사용법:
 *   node generate-debate-tts.js <debate-md-file> [output-mp3]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// OpenAI API 키 로드
function loadAPIKey() {
  // 1. 환경 변수에서 확인
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // 2. .bashrc에서 로드 (마지막 키 사용)
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
 * 마크다운에서 텍스트 추출 (TTS용)
 */
function extractTextFromMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf-8');
  
  let text = '';
  const lines = content.split('\n');
  
  for (const line of lines) {
    // 헤더, 메타데이터 제외
    if (line.startsWith('#') || 
        line.startsWith('---') || 
        line.startsWith('*') ||
        line.trim() === '') {
      continue;
    }
    
    // 마크다운 문법 제거
    let cleanLine = line
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold**
      .replace(/\*([^*]+)\*/g, '$1')      // *italic*
      .replace(/`([^`]+)`/g, '$1')        // `code`
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [link](url)
      .trim();
    
    if (cleanLine) {
      text += cleanLine + '\n';
    }
  }
  
  return text.trim();
}

/**
 * OpenAI TTS로 오디오 생성
 */
async function generateTTS(text, outputPath) {
  const apiKey = loadAPIKey();
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY를 찾을 수 없습니다');
  }

  console.log('🎙️ OpenAI TTS 시작...\n');
  console.log(`📝 텍스트 길이: ${text.length}자`);
  console.log(`🔊 모델: tts-1-hd (고품질)`);
  console.log(`🗣️ 음성: nova (자연스러운 여성)\n`);

  // 텍스트가 너무 길면 분할 (OpenAI 제한: 4096자)
  const chunks = [];
  if (text.length > 4000) {
    const sentences = text.split(/[.!?]\n/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > 4000) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '.\n';
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    console.log(`📦 텍스트 분할: ${chunks.length}개 청크`);
  } else {
    chunks.push(text);
  }

  // 각 청크를 TTS로 변환
  const tempFiles = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkFile = outputPath.replace('.mp3', `-part${i + 1}.mp3`);
    
    console.log(`\n🎙️ 청크 ${i + 1}/${chunks.length} 변환 중...`);
    
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: chunks[i],
        voice: 'nova',
        response_format: 'mp3',
        speed: 1.0
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(chunkFile, Buffer.from(buffer));
    tempFiles.push(chunkFile);
    
    console.log(`   ✅ 완료 (${(buffer.byteLength / 1024).toFixed(2)} KB)`);
  }

  // 청크가 여러 개면 병합
  if (tempFiles.length > 1) {
    console.log('\n🔗 오디오 청크 병합 중...');
    
    const listFile = outputPath.replace('.mp3', '-list.txt');
    const listContent = tempFiles.map(f => `file '${path.basename(f)}'`).join('\n');
    fs.writeFileSync(listFile, listContent);
    
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}" 2>/dev/null`,
      { cwd: path.dirname(outputPath) }
    );
    
    // 임시 파일 삭제
    tempFiles.forEach(f => fs.unlinkSync(f));
    fs.unlinkSync(listFile);
    
    console.log('   ✅ 병합 완료');
  } else {
    // 단일 청크면 그냥 이동
    fs.renameSync(tempFiles[0], outputPath);
  }

  const stats = fs.statSync(outputPath);
  console.log(`\n✅ OpenAI TTS 성공!`);
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
    console.log('사용법: node generate-debate-tts.js <debate.md> [output.mp3]');
    console.log('예: node generate-debate-tts.js ai-copyright-debate.md debate.mp3');
    process.exit(1);
  }

  const mdPath = path.resolve(args[0]);
  const outputPath = args[1] || mdPath.replace('.md', '.mp3');

  if (!fs.existsSync(mdPath)) {
    console.error(`❌ 파일을 찾을 수 없음: ${mdPath}`);
    process.exit(1);
  }

  try {
    console.log('📖 마크다운 파일 읽는 중...');
    const text = extractTextFromMarkdown(mdPath);
    
    console.log(`📝 추출된 텍스트: ${text.length}자\n`);
    
    await generateTTS(text, outputPath);
    
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

module.exports = { generateTTS, extractTextFromMarkdown };
