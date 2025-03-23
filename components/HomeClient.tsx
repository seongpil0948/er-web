// app/components/HomeClient.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import dynamic from 'next/dynamic';
import { parseLogData, parseTraceData, calculateLatencyStatistics } from '@/lib/otlp-parser';

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
  
  // 지연 시간 통계
  const [latencyStats, setLatencyStats] = useState({
    avg: 0,
    max: 0,
    min: 0,
    p95: 0,
    p99: 0
  });
  
  // 자동 새로고침 간격 (밀리초)
  const [refreshInterval, setRefreshInterval] = useState(5000);
  
  // Kafka 메시지 가져오기
  const { data, error, refetch, isLoading } = useQuery('kafkaMessages', async () => {
    const response = await fetch('/api/kafka-messages');
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return response.json();
  }, {
    refetchInterval: refreshInterval, // 설정된 간격으로 데이터 갱신
    refetchIntervalInBackground: true,
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
      
      // 지연 시간 통계 계산
      setLatencyStats(calculateLatencyStatistics(parsedTraces));
    }
  }, [data]);
  
  // 데이터 포인트 클릭 핸들러
  const handleDataPointClick = (data: any, type: 'trace' | 'log') => {
    setSelectedItem({ data, type });
    console.log(`Selected ${type}:`, data);
  };
  
  // 새로고침 간격 변경 핸들러
  const handleRefreshIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRefreshInterval(Number(e.target.value));
  };
  
  return (
    <div>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">OTLP 실시간 지연 시간 모니터링</h1>
        
        {error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>Error loading data: {(error as Error).message}</p>
            <button 
              onClick={() => refetch()}
              className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              재시도
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex-1">
                <p className="text-gray-700">로드된 데이터: {parsedData.traces.length} 트레이스, {parsedData.logs.length} 로그</p>
                {isLoading && <p className="text-blue-500">데이터 로딩 중...</p>}
              </div>
              
              <div className="flex items-center">
                <span className="mr-2">갱신 간격:</span>
                <select
                  value={refreshInterval}
                  onChange={handleRefreshIntervalChange}
                  className="bg-white border border-gray-300 rounded py-1 px-3 text-gray-700"
                >
                  <option value={1000}>1초</option>
                  <option value={2000}>2초</option>
                  <option value={5000}>5초</option>
                  <option value={10000}>10초</option>
                  <option value={30000}>30초</option>
                </select>
                <button 
                  onClick={() => refetch()}
                  className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  새로고침
                </button>
              </div>
            </div>
            
            {/* 지연 시간 통계 */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <h3 className="text-lg font-semibold text-gray-700">평균 지연 시간</h3>
                <p className="text-3xl font-bold text-blue-600">{latencyStats.avg.toFixed(2)}ms</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <h3 className="text-lg font-semibold text-gray-700">최대 지연 시간</h3>
                <p className="text-3xl font-bold text-red-600">{latencyStats.max.toFixed(2)}ms</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <h3 className="text-lg font-semibold text-gray-700">최소 지연 시간</h3>
                <p className="text-3xl font-bold text-green-600">{latencyStats.min.toFixed(2)}ms</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <h3 className="text-lg font-semibold text-gray-700">95 백분위수</h3>
                <p className="text-3xl font-bold text-yellow-600">{latencyStats.p95.toFixed(2)}ms</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <h3 className="text-lg font-semibold text-gray-700">99 백분위수</h3>
                <p className="text-3xl font-bold text-orange-600">{latencyStats.p99.toFixed(2)}ms</p>
              </div>
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