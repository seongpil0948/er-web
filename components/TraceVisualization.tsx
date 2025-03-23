// components/TraceVisualization.tsx
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { parseTraceData } from '@/lib/otlp-parser';

// 서버 사이드 렌더링 없이 클라이언트에서만 로드하기 위해 dynamic import 사용
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface TraceVisualizationProps {
  traceData: any[];
  logData: any[];
  onDataPointClick: (data: any, type: 'trace' | 'log') => void;
}

// 실시간 데이터를 위한 윈도우 사이즈 (데이터 포인트 수)
const MAX_DATA_POINTS = 100;

// 지연 시간의 임계값 설정 (이 값 이상이면 효과를 줌)
const LATENCY_THRESHOLD = 300; // 300ms

const TraceVisualization: React.FC<TraceVisualizationProps> = ({
  traceData,
  logData,
  onDataPointClick
}) => {
  const [option, setOption] = useState<any>({});
  
  // 차트에 표시할 시계열 데이터
  const [timeSeriesData, setTimeSeriesData] = useState<Array<[number, number]>>([]);
  
  // 고지연 데이터를 따로 저장 (effectScatter로 표시할 데이터)
  const [highLatencyData, setHighLatencyData] = useState<Array<[number, number]>>([]);
  
  // 마지막으로 처리된 데이터의 타임스탬프를 추적
  const lastProcessedTimestampRef = useRef<number>(0);
  
  // ECharts 인스턴스 참조
  const chartInstanceRef = useRef<any>(null);

  // 트레이스 데이터가 변경될 때 시계열 데이터 업데이트
  useEffect(() => {
    if (!traceData.length) return;

    // 새로운 데이터 처리
    const newTimeSeriesData = [...timeSeriesData];
    const newHighLatencyData: Array<[number, number]> = [...highLatencyData];
    let hasNewData = false;

    // 새로운 트레이스 데이터에서 시간과 지연 시간 추출
    traceData.forEach(trace => {
      const timestamp = trace.startTime; // 밀리초 단위 타임스탬프
      
      // 이미 처리된 데이터는 스킵
      if (timestamp <= lastProcessedTimestampRef.current) {
        return;
      }
      
      const latency = trace.duration; // 밀리초 단위 지연 시간
      
      if (timestamp && latency) {
        // 데이터 포인트 추가
        const dataPoint: [number, number] = [timestamp, latency];
        newTimeSeriesData.push(dataPoint);
        
        // 지연 시간이 임계값을 넘으면 고지연 데이터에도 추가
        if (latency > LATENCY_THRESHOLD) {
          newHighLatencyData.push(dataPoint);
        }
        
        hasNewData = true;
      }
    });

    // 데이터가 추가되었을 경우에만 상태 업데이트
    if (hasNewData) {
      // 시간순으로 정렬
      newTimeSeriesData.sort((a, b) => a[0] - b[0]);
      newHighLatencyData.sort((a, b) => a[0] - b[0]);
      
      // 데이터 포인트 수 제한 (최신 데이터 유지)
      const limitedData = newTimeSeriesData.slice(-MAX_DATA_POINTS);
      const limitedHighLatencyData = newHighLatencyData.slice(-MAX_DATA_POINTS);
      
      // 마지막 처리 타임스탬프 업데이트
      if (limitedData.length > 0) {
        lastProcessedTimestampRef.current = limitedData[limitedData.length - 1][0];
      }
      
      setTimeSeriesData(limitedData);
      setHighLatencyData(limitedHighLatencyData);
    }
  }, [traceData]);

  // 시계열 데이터가 변경될 때 차트 옵션 업데이트
  useEffect(() => {
    // 데이터가 없으면 기본 차트 표시
    if (timeSeriesData.length === 0) {
      const now = Date.now();
      // 빈 차트 설정
      setOption({
        title: {
          text: '실시간 지연 시간 모니터링',
          left: 'center'
        },
        tooltip: {
          trigger: 'item',
          formatter: function(params: any) {
            const timestamp = params.value[0];
            const latency = params.value[1];
            return `${new Date(timestamp).toLocaleTimeString()}<br/>지연 시간: ${latency}ms`;
          }
        },
        xAxis: {
          type: 'time',
          name: '시간',
          nameLocation: 'middle',
          nameGap: 30,
          axisLabel: {
            formatter: (value: number) => {
              return new Date(value).toLocaleTimeString();
            }
          }
        },
        yAxis: {
          type: 'value',
          name: '지연 시간 (ms)',
          nameLocation: 'middle',
          nameGap: 40
        },
        grid: {
          left: '5%',
          right: '5%',
          bottom: '10%',
          top: '15%',
          containLabel: true
        },
        series: [
          {
            name: '지연 시간',
            type: 'scatter',
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: {
              color: 'rgba(84, 112, 198, 0.7)'
            },
            data: [[now - 60000, 0], [now, 0]] // 빈 차트 표시용 더미 데이터
          }
        ]
      });
      return;
    }

    // 데이터 범위 계산
    const latencies = timeSeriesData.map(item => item[1]);
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const minTime = timeSeriesData[0][0];
    const maxTime = timeSeriesData[timeSeriesData.length - 1][0];

    // 차트 옵션 업데이트
    const newOption = {
      title: {
        text: '실시간 지연 시간 모니터링',
        left: 'center'
      },
      legend: {
        data: ['일반 요청', '고지연 요청'],
        right: 10,
        top: 10
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params: any) {
          const timestamp = params.value[0];
          const latency = params.value[1];
          const date = new Date(timestamp);
          return `
            <div style="font-weight: bold; margin-bottom: 5px;">
              ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>지연 시간:</span>
              <span style="font-weight: bold; color: ${latency > LATENCY_THRESHOLD ? '#ff5252' : '#1890ff'}">
                ${latency.toFixed(2)}ms
              </span>
            </div>
            <div>
              <span style="color: ${latency > avgLatency ? '#ff9800' : '#4caf50'}">
                ${latency > avgLatency ? '▲ 평균 이상' : '▼ 평균 이하'}
              </span>
            </div>
          `;
        }
      },
      xAxis: {
        type: 'time',
        name: '시간',
        nameLocation: 'middle',
        nameGap: 30,
        min: minTime,
        max: maxTime,
        axisLabel: {
          formatter: (value: number) => {
            return new Date(value).toLocaleTimeString();
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            opacity: 0.3
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '지연 시간 (ms)',
        nameLocation: 'middle',
        nameGap: 40,
        min: 0,
        max: maxLatency * 1.2, // 최대값에 여유 공간 추가
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            opacity: 0.3
          }
        }
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '10%',
        top: '15%',
        containLabel: true
      },
      series: [
        {
          name: '일반 요청',
          type: 'scatter',
          symbol: 'circle',
          symbolSize: (value: number[]) => {
            // 지연 시간에 따라 동적 크기 설정
            const latency = value[1];
            return 5 + (latency / maxLatency) * 10;
          },
          itemStyle: {
            color: (params: any) => {
              // 지연 시간에 따라 색상 변경
              const latency = params.value[1];
              
              // 지연 시간 수준에 따른 색상 그라디언트
              if (latency < avgLatency * 0.5) {
                return '#52c41a'; // 매우 낮은 지연
              } else if (latency < avgLatency) {
                return '#1890ff'; // 평균 이하 지연
              } else if (latency < avgLatency * 1.5) {
                return '#faad14'; // 평균 이상 지연
              } else if (latency < LATENCY_THRESHOLD) {
                return '#fa8c16'; // 높은 지연
              } else {
                return '#ff4d4f'; // 매우 높은 지연 (임계값 이상)
              }
            },
            opacity: 0.8,
            shadowBlur: 5,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          },
          data: timeSeriesData
        },
        {
          name: '고지연 요청',
          type: 'effectScatter',
          symbol: 'circle',
          symbolSize: (value: number[]) => {
            // 지연 시간에 따라 동적 크기 설정
            const latency = value[1];
            return 10 + (latency / maxLatency) * 15;
          },
          showEffectOn: 'render',
          rippleEffect: {
            brushType: 'stroke',
            scale: 3,
            period: 3
          },
          itemStyle: {
            color: '#ff4d4f',
            shadowBlur: 10,
            shadowColor: 'rgba(255, 77, 79, 0.5)'
          },
          data: highLatencyData
        }
      ],
      visualMap: {
        show: false,
        dimension: 1, // y 축 값(지연 시간)에 따라 색상 매핑
        min: minLatency,
        max: maxLatency,
        inRange: {
          color: ['#52c41a', '#1890ff', '#faad14', '#fa8c16', '#ff4d4f']
        }
      }
    };

    setOption(newOption);
  }, [timeSeriesData, highLatencyData]);

  // 차트 이벤트 처리
  const onEvents = {
    click: (params: any) => {
      // 클릭된 데이터 포인트의 타임스탬프
      const timestamp = params.value[0];
      
      // 해당 타임스탬프에 가장 가까운 트레이스 데이터 찾기
      const clickedTrace = traceData.reduce((closest, trace) => {
        const traceDiff = Math.abs(trace.startTime - timestamp);
        const closestDiff = Math.abs(closest?.startTime - timestamp) || Infinity;
        return traceDiff < closestDiff ? trace : closest;
      }, null);
      
      if (clickedTrace) {
        onDataPointClick(clickedTrace, 'trace');
      }
    }
  };

  // ECharts 인스턴스 참조 저장
  const onChartReady = useCallback((instance: any) => {
    chartInstanceRef.current = instance;
  }, []);

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-4">
      {traceData.length === 0 && timeSeriesData.length === 0 ? (
        <div className="h-96 flex items-center justify-center text-gray-500">
          <p>데이터가 로드되지 않았습니다. 데이터가 수신되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: '600px', width: '100%' }}
          onEvents={onEvents}
          onChartReady={onChartReady}
          notMerge={false}
          lazyUpdate={true}
        />
      )}
    </div>
  );
};

export default TraceVisualization;