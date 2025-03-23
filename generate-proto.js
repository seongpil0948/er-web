// scripts/generate-proto.js
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 출력 디렉토리 생성
console.info("__dirname:", __dirname);
const outDir = path.join(__dirname, 'app/proto');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// proto 경로 설정
const protoDir = '/Users/2309-n0015/Code/Temp/opentelemetry-proto'

// 디렉토리 구조 확인
console.log('Proto directory exists:', fs.existsSync(protoDir));
console.log('Proto files:');
if (fs.existsSync(protoDir)) {
  fs.readdirSync(protoDir).forEach(file => {
    console.log(`- ${file}`);
  });
}

// protobufjs에 proto 경로를 지정하는 방법 수정
try {
  console.log('Generating TypeScript files from Proto...');
  
  // -p 플래그를 사용하여 import 경로 지정
  execSync(`npx pbjs -t static-module -w es6 -p ${protoDir} -o ${outDir}/proto.js ${protoDir}/opentelemetry/proto/common/v1/common.proto ${protoDir}/opentelemetry/proto/resource/v1/resource.proto ${protoDir}/opentelemetry/proto/trace/v1/trace.proto ${protoDir}/opentelemetry/proto/logs/v1/logs.proto`);
  
  // JS 파일을 TypeScript로 변환
  execSync(`npx pbts -o ${outDir}/proto.d.ts ${outDir}/proto.js`);
  
  console.log('Proto files successfully converted to TypeScript!');
} catch (error) {
  console.error('Error generating TypeScript from Proto:', error.message);
  process.exit(1);
}