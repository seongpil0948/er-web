// scripts/generate-proto.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

// 필요한 proto 파일 경로 목록
const protoFiles = [
  'opentelemetry/proto/common/v1/common.proto',
  'opentelemetry/proto/resource/v1/resource.proto',
  'opentelemetry/proto/trace/v1/trace.proto',
  'opentelemetry/proto/logs/v1/logs.proto'
];

// GitHub raw 콘텐츠 URL의 베이스
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/main/';

// 출력 디렉토리 생성
console.info("__dirname:", __dirname);
const outDir = path.join(__dirname, 'app/proto');
const tempProtoDir = path.join(__dirname, 'temp_proto');

// 출력 디렉토리와 임시 proto 디렉토리 생성
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

if (!fs.existsSync(tempProtoDir)) {
  fs.mkdirSync(tempProtoDir, { recursive: true });
}

// 각 프로토 파일에 대한 디렉토리 구조 생성 및 다운로드
async function downloadProtoFiles() {
  const downloadPromises = protoFiles.map(filePath => {
    return new Promise((resolve, reject) => {
      const fullPath = path.join(tempProtoDir, filePath);
      const dirPath = path.dirname(fullPath);
      
      // 디렉토리 구조 생성
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // GitHub에서 파일 다운로드
      const fileUrl = GITHUB_RAW_BASE + filePath;
      console.log(`Downloading: ${fileUrl}`);
      
      https.get(fileUrl, response => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${filePath}: ${response.statusCode}`));
          return;
        }
        
        const fileStream = fs.createWriteStream(fullPath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          console.log(`Downloaded: ${filePath}`);
          resolve();
        });
        
        fileStream.on('error', err => {
          reject(err);
        });
      }).on('error', err => {
        reject(err);
      });
    });
  });
  
  return Promise.all(downloadPromises);
}

// proto 파일 다운로드 및 TypeScript 생성
async function generateProtoFiles() {
  try {
    // proto 파일 다운로드
    await downloadProtoFiles();
    
    console.log('Generating TypeScript files from Proto...');
    
    // 다운로드한 proto 파일 경로 생성
    const protoFilePaths = protoFiles.map(file => path.join(tempProtoDir, file));
    
    // pbjs 실행
    execSync(`npx pbjs -t static-module -w es6 -p ${tempProtoDir} -o ${outDir}/proto.js ${protoFilePaths.join(' ')}`);
    
    // JS 파일을 TypeScript로 변환
    execSync(`npx pbts -o ${outDir}/proto.d.ts ${outDir}/proto.js`);
    
    console.log('Proto files successfully converted to TypeScript!');
    
    // 임시 디렉토리 정리 (선택 사항)
    console.log('Cleaning up temporary files...');
    fs.rmSync(tempProtoDir, { recursive: true, force: true });
    console.log('Cleanup complete!');
    
  } catch (error) {
    console.error('Error generating TypeScript from Proto:', error.message);
    process.exit(1);
  }
}

// 실행
generateProtoFiles();