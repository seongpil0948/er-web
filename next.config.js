/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['protobufjs', 'long'],
  // webpack: (config) => {
  //   // 바이너리 파일을 사용할 수 있도록 구성
  //   config.module.rules.push({
  //     test: /\.(proto)$/,
  //     type: 'asset/source',
  //   });
    
  //   return config;
  // },  
};

module.exports = nextConfig;
