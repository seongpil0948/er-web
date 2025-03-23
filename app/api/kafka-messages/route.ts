// app/api/kafka-messages/route.ts
import { NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';
import * as SnappyJS from 'snappyjs';
// 생성된 protobuf 타입 임포트
import { opentelemetry } from '../../../app/proto/proto';

// 필요한 메시지 타입들
const { TracesData } = opentelemetry.proto.trace.v1;
const { LogsData } = opentelemetry.proto.logs.v1;

// 싱글톤 패턴으로 Kafka 인스턴스 관리
let kafkaInstance: Kafka | null = null;
let consumerInstance: any = null;
let isConsumerRunning = false;

// 메시지 캐시
let messageCache = {
  traces: [] as any[],
  logs: [] as any[]
};

// Kafka 인스턴스 가져오기
function getKafkaInstance() {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka({
      clientId: 'nextjs-otlp-client',
      brokers: ['10.101.91.181:9092', '10.101.91.181:9093'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
  }
  return kafkaInstance;
}

// 메시지 압축 해제하기
function decompressMessage(buffer: Buffer): Buffer {
  try {
    // Snappy로 압축된 메시지인지 확인하는 간단한 방법
    // Snappy 헤더 검사 (대략적인 방법)
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0x06 && buffer[2] === 0x00 && buffer[3] === 0x00) {
      return Buffer.from(SnappyJS.uncompress(buffer));
    }
    
    // 압축되지 않은 메시지로 판단
    return buffer;
  } catch (error) {
    console.warn('Failed to decompress message, using raw buffer:', error);
    return buffer;
  }
}

// Kafka 소비자 시작
async function startKafkaConsumer() {
  if (isConsumerRunning) return;
  
  try {
    const kafka = getKafkaInstance();
    
    if (!consumerInstance) {
      consumerInstance = kafka.consumer({ 
        groupId: 'nextjs-otlp-consumer',
        sessionTimeout: 30000,
        heartbeatInterval: 5000
      });
    }
    
    await consumerInstance.connect();
    
    // 토픽 구독
    await consumerInstance.subscribe({ 
      topics: ['onpremise.theshop.oltp.dev.trace', 'onpremise.theshop.oltp.dev.log'],
      fromBeginning: false 
    });
    
    // 메시지 소비 시작
    await consumerInstance.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        try {
          if (!message.value) return;
          
          // 메시지 압축 해제
          const decompressedValue = decompressMessage(message.value);
          
          // 토픽에 따라 적절한 protobuf 타입으로 디코딩
          if (topic === 'onpremise.theshop.oltp.dev.trace') {
            // 생성된 proto.d.ts의 메시지 타입 사용
            const decoded = TracesData.decode(new Uint8Array(decompressedValue));
            const data = TracesData.toObject(decoded, {
              longs: String,
              enums: String,
              defaults: true
            });
            
            // 메시지 캐시에 저장 (최대 100개 유지)
            messageCache.traces.unshift({ 
              offset: message.offset, 
              timestamp: message.timestamp,
              data 
            });
            
            if (messageCache.traces.length > 100) {
              messageCache.traces = messageCache.traces.slice(0, 100);
            }
          } 
          else if (topic === 'onpremise.theshop.oltp.dev.log') {
            const decoded = LogsData.decode(new Uint8Array(decompressedValue));
            const data = LogsData.toObject(decoded, {
              longs: String,
              enums: String,
              defaults: true
            });
            
            // 메시지 캐시에 저장 (최대 100개 유지)
            messageCache.logs.unshift({ 
              offset: message.offset, 
              timestamp: message.timestamp,
              data 
            });
            
            if (messageCache.logs.length > 100) {
              messageCache.logs = messageCache.logs.slice(0, 100);
            }
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      },
    });
    
    isConsumerRunning = true;
    console.log('Kafka consumer started successfully');
  } catch (error) {
    console.error('Error starting Kafka consumer:', error);
    isConsumerRunning = false;
    
    // 연결 실패 시 인스턴스 재설정
    if (consumerInstance) {
      try {
        await consumerInstance.disconnect();
      } catch (e) {
        console.error('Error disconnecting consumer:', e);
      }
      consumerInstance = null;
    }
    
    throw error;
  }
}

// GET 메서드 핸들러
export async function GET() {
  try {

      await startKafkaConsumer().catch(error => {
        console.error('Failed to start Kafka consumer:', error);
      });
    
    // 캐시된 메시지 반환
    return NextResponse.json({
      traces: messageCache.traces,
      logs: messageCache.logs,
      consumerRunning: isConsumerRunning,
    });
  } catch (error) {
    console.error('API handler error:', error);
    
    // 오류 발생 시 시뮬레이션 데이터 사용
    
    return NextResponse.json({ 
      error: 'Failed to retrieve telemetry data',
      details: (error as Error).message,
      traces: messageCache.traces.length > 0 ? messageCache.traces : [],
      logs: messageCache.logs.length > 0 ? messageCache.logs : [],
      consumerRunning: false,
    }, { status: 200 });
  }
}