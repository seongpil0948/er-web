// app/components/TraceVisualization.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { convertToChartData } from '@/lib/otlp-parser';

// 서버 사이드 렌더링 없이 클라이언트에서만 로드하기 위해 dynamic import 사용
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface TraceVisualizationProps {
  traceData: any[];
  logData: any[];
  onDataPointClick: (data: any, type: 'trace' | 'log') => void;
}

const TraceVisualization: React.FC<TraceVisualizationProps> = ({
  traceData,
  logData,
  onDataPointClick
}) => {
  const [option, setOption] = useState<any>({});
  
  // 데이터 변경 시 차트 옵션 업데이트
  useEffect(() => {
    const chartData = convertToChartData(traceData, logData);
    
    const newOption = {
      tooltip: {
        trigger: 'item',
        formatter: function(params: any) {
          const data = params.data;
          if (!data.originalData) return '';
          
          if (data.dataType === 'trace') {
            return `
              <div>
                <strong>Trace:</strong> ${data.originalData.name || 'unnamed'}<br/>
                <strong>TraceID:</strong> ${data.originalData.traceId?.substring(0, 8) || 'N/A'}...<br/>
                <strong>Duration:</strong> ${data.originalData.duration}ms<br/>
                <strong>Service:</strong> ${data.originalData.attributes.resourceAttributes?.service_name || 'unknown'}<br/>
              </div>
            `;
          } else {
            return `
              <div>
                <strong>Log:</strong> ${data.originalData.severityText || ''}<br/>
                <strong>Service:</strong> ${data.originalData.attributes.resourceAttributes?.service_name || 'unknown'}<br/>
                <strong>Time:</strong> ${new Date(Number(data.originalData.timeUnixNano)).toLocaleTimeString()}<br/>
                <strong>TraceID:</strong> ${data.originalData.traceId?.substring(0, 8) || 'N/A'}...<br/>
              </div>
            `;
          }
        }
      },
      xAxis: {
        name: 'Trace Group',
        nameLocation: 'middle',
        nameGap: 25,
        scale: true
      },
      yAxis: {
        name: 'Duration / Severity Level',
        nameLocation: 'middle',
        nameGap: 50,
        scale: true
      },
      series: [
        {
          name: 'Traces',
          type: 'effectScatter',
          symbolSize: 15,
          data: chartData.trace,
          rippleEffect: {
            period: 4,
            scale: 2.5,
            brushType: 'stroke'
          }
        },
        {
          name: 'Logs', 
          type: 'scatter',
          data: chartData.log
        }
      ],
      legend: {
        data: ['Traces', 'Logs'],
        right: 10,
        top: 10
      }
    };
    
    setOption(newOption);
  }, [traceData, logData]);
  
  // 차트 클릭 이벤트 핸들러
  const onChartClick = useCallback((params: any) => {
    const data = params.data;
    if (data && data.originalData) {
      onDataPointClick(data.originalData, data.dataType);
    }
  }, [onDataPointClick]);
  
  // 차트 이벤트 설정
  const onEvents = {
    'click': onChartClick
  };
  
  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-4">
      {traceData.length === 0 && logData.length === 0 ? (
        <div className="h-96 flex items-center justify-center text-gray-500">
          <p>데이터가 로드되지 않았습니다. 데이터가 수신되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: '600px', width: '100%' }}
          onEvents={onEvents}
        />
      )}
    </div>
  );
};

export default TraceVisualization;