'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import debounce from 'lodash.debounce'; // Add this import

// Define proper types for trace and log data
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

// Configuration constants
const MAX_DATA_POINTS = 100;
const LATENCY_THRESHOLD = 300; // 300ms

// Define chart data types
type DataPoint = [number, number]; // [timestamp, latency]

const TraceVisualization: React.FC<TraceVisualizationProps> = ({
  traceData,
  logData,
  onDataPointClick
}) => {
  const [option, setOption] = useState<any>({});
  const [timeSeriesData, setTimeSeriesData] = useState<DataPoint[]>([]);
  const [highLatencyData, setHighLatencyData] = useState<DataPoint[]>([]);
  const lastProcessedTimestampRef = useRef<number>(0);
  const echartsRef = useRef<InstanceType<typeof ReactECharts>>(null);

  // Process new trace data
  const processTraceData = useCallback((newTraces: TraceItem[]) => {
    if (!newTraces.length) return false;

    let newData: DataPoint[] = [];
    let newHighLatencyData: DataPoint[] = [];
    let hasNewData = false;

    // Process only new trace data since last update
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
      }
    });

    if (hasNewData) {
      // Only update state if we have new data
      setTimeSeriesData(prevData => {
        // Combine existing and new data, sort, and limit
        const combinedData = [...prevData, ...newData]
          .sort((a, b) => a[0] - b[0])
          .slice(-MAX_DATA_POINTS);
        
        // Update the last processed timestamp
        if (combinedData.length) {
          lastProcessedTimestampRef.current = Math.max(
            lastProcessedTimestampRef.current,
            combinedData[combinedData.length - 1][0]
          );
        }
        
        return combinedData;
      });

      setHighLatencyData(prevData => {
        return [...prevData, ...newHighLatencyData]
          .sort((a, b) => a[0] - b[0])
          .slice(-MAX_DATA_POINTS);
      });
    }

    return hasNewData;
  }, []);

  // Effect to process trace data when it changes
  useEffect(() => {
    processTraceData(traceData);
  }, [traceData, processTraceData]);

  // Create the empty chart configuration
  const createEmptyChartOption = useCallback(() => {
    const now = Date.now();
    return {
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
          formatter: (value: number) => new Date(value).toLocaleTimeString()
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
          data: [[now - 60000, 0], [now, 0]] // Empty chart dummy data
        }
      ]
    };
  }, []);

  // Create chart options with data
  const createChartOption = useCallback((timeData: DataPoint[], highLatencyData: DataPoint[]) => {
    // Calculate data statistics
    const latencies = timeData.map(item => item[1]);
    const maxLatency = Math.max(...latencies, 1); // Prevent division by zero
    const minLatency = Math.min(...latencies);
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / (latencies.length || 1);
    const minTime = timeData[0]?.[0] || Date.now() - 60000;
    const maxTime = timeData[timeData.length - 1]?.[0] || Date.now();

    return {
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
        max: maxLatency * 1.2, // Add space above max value
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
            return 5 + (latency / maxLatency) * 10;
          },
          itemStyle: {
            color: (params: any) => {
              const latency = params.value[1];
              
              if (latency < avgLatency * 0.5) {
                return '#52c41a'; // Very low latency
              } else if (latency < avgLatency) {
                return '#1890ff'; // Below average
              } else if (latency < avgLatency * 1.5) {
                return '#faad14'; // Above average
              } else if (latency < LATENCY_THRESHOLD) {
                return '#fa8c16'; // High latency
              } else {
                return '#ff4d4f'; // Very high latency (above threshold)
              }
            },
            opacity: 0.8,
            shadowBlur: 5,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          },
          data: timeData
        },
        {
          name: '고지연 요청',
          type: 'effectScatter',
          symbol: 'circle',
          symbolSize: (value: number[]) => {
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
        dimension: 1,
        min: minLatency,
        max: maxLatency,
        inRange: {
          color: ['#52c41a', '#1890ff', '#faad14', '#fa8c16', '#ff4d4f']
        }
      }
    };
  }, []);

  // Update chart options when data changes
  useEffect(() => {
    if (timeSeriesData.length === 0) {
      setOption(createEmptyChartOption());
      return;
    }

    setOption(createChartOption(timeSeriesData, highLatencyData));
  }, [timeSeriesData, highLatencyData, createEmptyChartOption, createChartOption]);

  // Find closest trace data point with binary search for better performance
  const findClosestTraceData = useCallback((timestamp: number, traces: TraceItem[]): TraceItem | null => {
    if (!traces.length) return null;
    
    // Sort traces by startTime if not already sorted
    const sortedTraces = [...traces].sort((a, b) => a.startTime - b.startTime);
    
    let left = 0;
    let right = sortedTraces.length - 1;
    let closest = 0;
    let minDiff = Infinity;
    
    // Binary search for closest timestamp
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const diff = Math.abs(sortedTraces[mid].startTime - timestamp);
      
      if (diff < minDiff) {
        minDiff = diff;
        closest = mid;
      }
      
      if (sortedTraces[mid].startTime < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return sortedTraces[closest];
  }, []);

  // Chart click event handler
  const onEvents = useMemo(() => ({
    click: (params: any) => {
      const timestamp = params.value[0];
      const clickedTrace = findClosestTraceData(timestamp, traceData);
      
      if (clickedTrace) {
        onDataPointClick(clickedTrace, 'trace');
      }
    }
  }), [traceData, onDataPointClick, findClosestTraceData]);

  // Chart ready callback
  const onChartReady = useCallback((instance: any) => {
    console.log('ECharts instance ready');
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = debounce(() => {
      if (echartsRef.current) {
        const echartsInstance = echartsRef.current.getEchartsInstance();
        echartsInstance.resize();
      }
    }, 300);

    window.addEventListener('resize', handleResize);
    
    // Initial resize
    if (echartsRef.current) {
      const echartsInstance = echartsRef.current.getEchartsInstance();
      echartsInstance.resize();
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-4">
      {traceData.length === 0 && timeSeriesData.length === 0 ? (
        <div className="h-96 flex items-center justify-center text-gray-500">
          <p>데이터가 로드되지 않았습니다. 데이터가 수신되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ReactECharts
          ref={echartsRef} 
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