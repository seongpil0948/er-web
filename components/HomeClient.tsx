'use client';
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useQuery } from 'react-query';
import TraceVisualization from '../components/TraceVisualization';
import LogViewer from '../components/LogViewer';
import TraceDetails from '../components/TraceDetails';
import { parseTraceData, parseLogData } from '../lib/otlp-parser';

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
      <Head>
        <title>OTLP Data Visualization</title>
        <meta name="description" content="Visualization of OTLP traces and logs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="container">
        <h1>OTLP Data Visualization</h1>
        
        {error ? (
          <div className="error-message">
            <p>Error loading data: {(error as Error).message}</p>
            <button onClick={() => refetch()}>Retry</button>
          </div>
        ) : (
          <>
            <div className="stats">
              <p>Loaded {parsedData.traces.length} traces and {parsedData.logs.length} logs</p>
              <button onClick={() => refetch()}>Refresh Data</button>
            </div>
            
            <div className="visualization-container">
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
      
      <style jsx>{`
        .container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        h1 {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .error-message {
          color: red;
          padding: 1rem;
          background-color: #ffeeee;
          border-radius: 4px;
          text-align: center;
        }
        
        .stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .visualization-container {
          margin-bottom: 2rem;
        }
        
        button {
          background-color: #4a89dc;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button:hover {
          background-color: #3b7dd8;
        }
      `}</style>
    </div>
  );
}
export default HomeClient;