import { NextResponse } from 'next/server';
import { Kafka, EachMessagePayload } from 'kafkajs';

// 메시지를 저장할 인메모리 캐시
let traceMessages: any[] = [];
let logMessages: any[] = [];
let consumer: any = null;

export async function GET() {
  // 캐시된 메시지 반환
  return NextResponse.json({
    traces: traceMessages.slice(-100),
    logs: logMessages.slice(-100)
  });
}

// 서버 시작 시 소비자 설정
async function initConsumer() {
  console.log('Initializing Kafka consumer...');
  // Kafka 클라이언트 설정
  const kafka = new Kafka({
    clientId: 'nextjs-otlp-client',
    brokers: ['10.101.91.181:9092', '10.101.91.181:9093']
  });
  console.log("Kafka client created" , kafka);

  if (!consumer) {
    console.log("Creating consumer");
    consumer = kafka.consumer({ 
      groupId: 'nextjs-otlp-group' 
    });
    
    await consumer.connect();
    
    await consumer.subscribe({ 
      topic: 'onpremise.theshop.oltp.dev.trace', 
      fromBeginning: false 
    });
    
    await consumer.subscribe({ 
      topic: 'onpremise.theshop.oltp.dev.log', 
      fromBeginning: false 
    });
    
    // 메시지 처리
    await consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        console.log('Received message:', {
          topic,
          partition,
          offset: message.offset,
          value: message.value?.toString()
        });
        const value = message.value?.toString();
        if (!value) return;
        
        try {
          const data = JSON.parse(value);
          
          if (topic === 'onpremise.theshop.oltp.dev.trace') {
            traceMessages.push({
              timestamp: Date.now(),
              data
            });
            // 캐시 크기 제한
            if (traceMessages.length > 1000) {
              traceMessages = traceMessages.slice(-1000);
            }
          } else if (topic === 'onpremise.theshop.oltp.dev.log') {
            logMessages.push({
              timestamp: Date.now(),
              data
            });
            // 캐시 크기 제한
            if (logMessages.length > 1000) {
              logMessages = logMessages.slice(-1000);
            }
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      },
    });
  }
}

initConsumer().catch(console.error);

