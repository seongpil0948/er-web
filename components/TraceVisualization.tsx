'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import debounce from 'lodash.debounce';

interface TraceItem {
  startTime: number;
  duration: number;
  [key: string]: any;
}

interface LogItem {
  timestamp: number;
  [key: string]: any;
}

interface TraceVisualizationProps {
  traceData: TraceItem[];
  logData: LogItem[];
  onDataPointClick: (data: any, type: 'trace' | 'log') => void;
}

const MAX_DATA_POINTS = 100;
const LATENCY_THRESHOLD = 300; // 300ms

type DataPoint = [number, number]; // [timestamp, latency]

const TraceVisualization: React.FC<TraceVisualizationProps> = ({
  traceData,
  logData,
  onDataPointClick
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const lastProcessedTimestampRef = useRef<number>(0);
  const dataRef = useRef<{
    timeSeriesData: DataPoint[];
    highLatencyData: DataPoint[];
  }>({
    timeSeriesData: [],
    highLatencyData: []
  });
  
  // 초기 차트 옵션 생성
  const getInitialOption = useCallback(() => ({
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
        `;
      }
    },
    xAxis: {
      type: 'time',
      name: '시간',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: {
        formatter: (value: number) => new Date(value).toLocaleTimeString()
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
          const latency = value[1];
          return 5 + Math.min(latency / 50, 10); // 적절한 크기 계산
        },
        itemStyle: {
          color: (params: any) => {
            const latency = params.value[1];
            if (latency < 100) return '#52c41a'; // 매우 낮은 지연
            if (latency < 200) return '#1890ff'; // 낮은 지연
            if (latency < 300) return '#faad14'; // 보통 지연
            return '#ff4d4f'; // 높은 지연
          },
          opacity: 0.8,
          shadowBlur: 5,
          shadowColor: 'rgba(0, 0, 0, 0.2)'
        },
        data: []
      },
      {
        name: '고지연 요청',
        type: 'effectScatter',
        symbol: 'circle',
        symbolSize: (value: number[]) => {
          const latency = value[1];
          return 10 + Math.min(latency / 50, 15); // 적절한 크기 계산
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
        data: []
      }
    ]
  }), []);

  // 차트 초기화 함수
  const initChart = useCallback(() => {
    if (chartRef.current) {
      // 기존 차트 인스턴스가 있으면 제거
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }
      
      // 새 차트 인스턴스 생성
      const chartInstance = echarts.init(chartRef.current);
      chartInstanceRef.current = chartInstance;
      
      // 초기 옵션 설정
      chartInstance.setOption(getInitialOption());
      
      // 클릭 이벤트 핸들러 등록
      chartInstance.on('click', function(params) {
        // Type guard to ensure params.value exists and is an array
        if (params && params.value && Array.isArray(params.value) && params.value.length > 0) {
          const timestamp = params.value[0] as number;
          
          // 클릭된 지점과 가장 가까운 트레이스 찾기
          const closestTrace = traceData.reduce((closest, trace) => {
            const currentDiff = Math.abs(trace.startTime - timestamp);
            const closestDiff = Math.abs(closest?.startTime - timestamp) || Infinity;
            return currentDiff < closestDiff ? trace : closest;
          }, traceData[0]);
          
          if (closestTrace) {
            onDataPointClick(closestTrace, 'trace');
          }
        }
      });
      
      console.log('ECharts instance initialized');
    }
  }, [getInitialOption, traceData, onDataPointClick]);

  // 컴포넌트 마운트 시 차트 초기화
  useEffect(() => {
    initChart();
    
    return () => {
      // 컴포넌트 언마운트 시 차트 인스턴스 정리
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }
    };
  }, [initChart]);

  // 트레이스 데이터 처리 함수
  const processTraceData = useCallback((newTraces: TraceItem[]) => {
    if (!newTraces.length || !chartInstanceRef.current) return false;

    let newData: DataPoint[] = [];
    let newHighLatencyData: DataPoint[] = [];
    let hasNewData = false;

    // 마지막으로 처리된 타임스탬프 이후의 새 데이터만 처리
    newTraces.forEach(trace => {
      const timestamp = trace.startTime;
      
      if (timestamp <= lastProcessedTimestampRef.current) {
        return;
      }
      
      const latency = trace.duration;
      
      if (timestamp && latency) {
        const dataPoint: DataPoint = [timestamp, latency];
        newData.push(dataPoint);
        
        if (latency > LATENCY_THRESHOLD) {
          newHighLatencyData.push(dataPoint);
        }
        
        hasNewData = true;
        lastProcessedTimestampRef.current = Math.max(lastProcessedTimestampRef.current, timestamp);
      }
    });

    if (hasNewData && chartInstanceRef.current) {
      // 기존 데이터 참조
      const currentData = dataRef.current;
      
      // 새 데이터 추가 및 정렬
      const updatedTimeSeriesData = [...currentData.timeSeriesData, ...newData]
        .sort((a, b) => a[0] - b[0])
        .slice(-MAX_DATA_POINTS);

      const updatedHighLatencyData = [...currentData.highLatencyData, ...newHighLatencyData]
        .sort((a, b) => a[0] - b[0])
        .slice(-MAX_DATA_POINTS);
      
      // 데이터 참조 업데이트 (상태가 아닌 ref 사용)
      dataRef.current = {
        timeSeriesData: updatedTimeSeriesData,
        highLatencyData: updatedHighLatencyData
      };

      // ECharts 인스턴스에 직접 데이터 업데이트
      chartInstanceRef.current.setOption({
        series: [
          { data: updatedTimeSeriesData },
          { data: updatedHighLatencyData }
        ]
      });
      
      // X축 범위 동적 조정
      if (updatedTimeSeriesData.length > 0) {
        const minTime = updatedTimeSeriesData[0][0];
        const maxTime = updatedTimeSeriesData[updatedTimeSeriesData.length - 1][0];
        
        // Y축 최대값 조정
        const latencies = updatedTimeSeriesData.map(item => item[1]);
        const maxLatency = Math.max(...latencies, 1) * 1.2;
        
        chartInstanceRef.current.setOption({
          xAxis: {
            min: minTime,
            max: maxTime
          },
          yAxis: {
            max: maxLatency
          }
        });
      }
    }

    return hasNewData;
  }, []);

  // 트레이스 데이터 변경 효과
  useEffect(() => {
    processTraceData(traceData);
  }, [traceData, processTraceData]);

  // 리사이즈 핸들러
  useEffect(() => {
    const handleResize = debounce(() => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    }, 300);

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      handleResize.cancel();
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-4">
      {traceData.length === 0 ? (
        <div className="h-96 flex items-center justify-center text-gray-500">
          <p>데이터가 로드되지 않았습니다. 데이터가 수신되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div 
          ref={chartRef} 
          style={{ height: '600px', width: '100%' }}
        />
      )}
    </div>
  );
};

export default React.memo(TraceVisualization);