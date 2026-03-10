#!/usr/bin/env node
/**
 * MP3 오디오를 MP4 비디오로 변환 (YouTube 업로드용)
 *
 * 사용법:
 *   node audio-to-video.js <audio-path> [output-path] [thumbnail-path]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * 오디오를 비디오로 변환
 */
function audioToVideo(audioPath, outputPath, thumbnailPath = null) {
  // 입력 파일 확인
  if (!fs.existsSync(audioPath)) {
    throw new Error(`파일을 찾을 수 없음: ${audioPath}`);
  }

  // 출력 경로 기본값
  if (!outputPath) {
    outputPath = audioPath.replace(/\.(mp3|wav|m4a)$/i, '.mp4');
  }

  // 썸네일이 없으면 기본 배경색으로 생성
  if (!thumbnailPath || !fs.existsSync(thumbnailPath)) {
    console.log('🎨 기본 썸네일 생성 중...');

    // 기본 썸네일 경로
    const defaultThumbnail = path.join(__dirname, 'thumbnails', 'default.jpg');
    if (fs.existsSync(defaultThumbnail)) {
      thumbnailPath = defaultThumbnail;
    } else {
      // 썸네일 폴더 생성
      fs.mkdirSync(path.dirname(defaultThumbnail), { recursive: true });

      // FFmpeg로 단색 배경 이미지 생성 (1280x720, 블루 그라데이션)
      const tempBg = path.join(__dirname, 'temp-bg.png');
      execSync(
        `ffmpeg -f lavfi -i "color=c=#667eea:s=1280x720:d=0.1" ` +
        `-frames:v 1 -y "${tempBg}" 2>/dev/null`,
        { stdio: 'pipe' }
      );

      thumbnailPath = tempBg;
    }
  }

  console.log(`🎬 비디오 변환 시작...`);
  console.log(`   오디오: ${audioPath}`);
  console.log(`   출력: ${outputPath}`);

  // FFmpeg 명령어 (오디오 + 이미지 → 비디오)
  const cmd =
    `ffmpeg -y -loop 1 -i "${thumbnailPath}" -i "${audioPath}" ` +
    `-c:v libx264 -tune stillimage -c:a aac -b:a 192k ` +
    `-pix_fmt yuv420p -shortest -movflags +faststart ` +
    `"${outputPath}"`;

  try {
    execSync(cmd, { stdio: 'inherit' });

    const stats = fs.statSync(outputPath);
    console.log(`✅ 변환 완료! (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return outputPath;
  } catch (error) {
    console.error('❌ 변환 실패:', error.message);
    throw error;
  } finally {
    // 임시 파일 정리
    const tempBg = path.join(__dirname, 'temp-bg.png');
    if (fs.existsSync(tempBg)) {
      fs.unlinkSync(tempBg);
    }
  }
}

/**
 * 메인 함수
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('사용법: node audio-to-video.js <audio-path> [output-path] [thumbnail-path]');
    console.log('예: node audio-to-video.js debate.mp3 debate.mp4 thumbnail.jpg');
    process.exit(1);
  }

  const audioPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : null;
  const thumbnailPath = args[2] ? path.resolve(args[2]) : null;

  try {
    const result = audioToVideo(audioPath, outputPath, thumbnailPath);
    console.log(`\n📹 출력 파일: ${result}`);
    return result;
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { audioToVideo };
