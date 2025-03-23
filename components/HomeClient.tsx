// app/components/HomeClient.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import dynamic from 'next/dynamic';
import { parseLogData, parseTraceData } from '@/lib/otlp-parser';

// 서버 컴포넌트와 클라이언트 컴포넌트 구분을 위해 dynamic import 사용
const TraceVisualization = dynamic(() => import('./TraceVisualization'), { ssr: false });
const LogViewer = dynamic(() => import('./LogViewer'), { ssr: false });
const TraceDetails = dynamic(() => import('./TraceDetails'), { ssr: false });

export function HomeClient() {
  // 선택된 데이터 상태
  const [selectedItem, setSelectedItem] = useState<{
    data: any;
    type: 'trace' | 'log' | null;
  }>({
    data: null,
    type: null
  });
  
  // 파싱된 데이터 상태
  const [parsedData, setParsedData] = useState({
    traces: [] as any[],
    logs: [] as any[]
  });
  
  // Kafka 메시지 가져오기
  const { data, error, refetch } = useQuery('kafkaMessages', async () => {
    const response = await fetch('/api/kafka-messages');
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return response.json();
  }, {
    refetchInterval: 5000, // 5초마다 데이터 갱신
  });
  
  // 데이터 파싱
  useEffect(() => {
    if (data) {
      const parsedTraces = data.traces
        .map((msg: any) => parseTraceData(msg.data))
        .filter(Boolean)
        .flat();
      
      const parsedLogs = data.logs
        .map((msg: any) => parseLogData(msg.data))
        .filter(Boolean)
        .flat();
      
      setParsedData({
        traces: parsedTraces,
        logs: parsedLogs
      });
    }
  }, [data]);
  
  // 데이터 포인트 클릭 핸들러
  const handleDataPointClick = (data: any, type: 'trace' | 'log') => {
    setSelectedItem({ data, type });
    console.log(`Selected ${type}:`, data);
  };
  
  return (
    <div>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">OTLP Data Visualization</h1>
        
        {error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>Error loading data: {(error as Error).message}</p>
            <button 
              onClick={() => refetch()}
              className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <p>Loaded {parsedData.traces.length} traces and {parsedData.logs.length} logs</p>
              <button 
                onClick={() => refetch()}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Refresh Data
              </button>
            </div>
            
            <div className="mb-8">
              <TraceVisualization
                traceData={parsedData.traces}
                logData={parsedData.logs}
                onDataPointClick={handleDataPointClick}
              />
            </div>
            
            {selectedItem.data && selectedItem.type === 'trace' && (
              <TraceDetails trace={selectedItem.data} />
            )}
            
            {selectedItem.data && selectedItem.type === 'log' && (
              <LogViewer log={selectedItem.data} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default HomeClient;