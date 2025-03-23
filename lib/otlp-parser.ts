// OTLP 트레이스와 로그 데이터 파싱 및 변환 함수
export function parseTraceData(traceData: any) {
  try {
    // resourceSpans 배열이 있는지 확인
    if (!traceData.resourceSpans) {
      return null;
    }
    
    // 모든 리소스 스팬에서 데이터 추출
    const parsedData = traceData.resourceSpans.flatMap((resourceSpan: any) => {
      const resource = resourceSpan.resource || {};
      const resourceAttrs = parseAttributes(resource.attributes);
      
      // scopeSpans 처리
      return (resourceSpan.scopeSpans || []).flatMap((scopeSpan: any) => {
        const scope = scopeSpan.scope || {};
        
        // spans 처리
        return (scopeSpan.spans || []).map((span: any) => {
          return {
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId,
            name: span.name,
            kind: span.kind,
            startTime: BigInt(span.startTimeUnixNano || 0) / BigInt(1000000), // 밀리초로 변환
            endTime: BigInt(span.endTimeUnixNano || 0) / BigInt(1000000),
            duration: (BigInt(span.endTimeUnixNano || 0) - BigInt(span.startTimeUnixNano || 0)) / BigInt(1000000),
            attributes: {
              ...parseAttributes(span.attributes),
              resourceAttributes: resourceAttrs,
              scopeName: scope.name,
              scopeVersion: scope.version
            }
          };
        });
      });
    });
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing trace data:', error);
    return [];
  }
}

export function parseLogData(logData: any) {
  try {
    // resourceLogs 배열이 있는지 확인
    if (!logData.resourceLogs) {
      return null;
    }
    
    // 모든 리소스 로그에서 데이터 추출
    const parsedData = logData.resourceLogs.flatMap((resourceLog: any) => {
      const resource = resourceLog.resource || {};
      const resourceAttrs = parseAttributes(resource.attributes);
      
      // scopeLogs 처리
      return (resourceLog.scopeLogs || []).flatMap((scopeLog: any) => {
        const scope = scopeLog.scope || {};
        
        // logRecords 처리
        return (scopeLog.logRecords || []).map((logRecord: any) => {
          return {
            timeUnixNano: BigInt(logRecord.timeUnixNano || 0) / BigInt(1000000), // 밀리초로 변환
            observedTimeUnixNano: BigInt(logRecord.observedTimeUnixNano || 0) / BigInt(1000000),
            severityNumber: logRecord.severityNumber,
            severityText: logRecord.severityText,
            body: parseBody(logRecord.body),
            traceId: logRecord.traceId,
            spanId: logRecord.spanId,
            attributes: {
              ...parseAttributes(logRecord.attributes),
              resourceAttributes: resourceAttrs,
              scopeName: scope.name,
              scopeVersion: scope.version
            }
          };
        });
      });
    });
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing log data:', error);
    return [];
  }
}

// 속성(attribute) 배열을 객체로 변환
function parseAttributes(attributes: any[] = []) {
  const result: Record<string, any> = {};
  
  for (const attr of attributes) {
    if (attr.key) {
      const value = attr.value?.stringValue || 
                   attr.value?.intValue || 
                   attr.value?.doubleValue || 
                   attr.value?.boolValue;
      
      if (value !== undefined) {
        result[attr.key] = value;
      }
    }
  }
  
  return result;
}

// 로그 본문 파싱
function parseBody(body: any) {
  if (!body) return '';
  
  if (body.stringValue) {
    return body.stringValue;
  } else if (body.kvlistValue) {
    const keyValues: Record<string, any> = {};
    for (const item of body.kvlistValue) {
      const key = item.key;
      const value = item.value?.stringValue || 
                    item.value?.intValue || 
                    item.value?.doubleValue || 
                    item.value?.boolValue;
      
      if (key && value !== undefined) {
        keyValues[key] = value;
      }
    }
    return keyValues;
  }
  
  return JSON.stringify(body);
}

// 트레이스와 로그 데이터를 ECharts에서 사용할 포맷으로 변환
export function convertToChartData(traces: any[], logs: any[]) {
  // 트레이스 데이터를 점으로 변환
  const tracePoints = traces.map(trace => {
    // 랜덤성을 줄이고 비슷한 트레이스를 그룹화하기 위한 해시 함수
    const xCoord = hashString(trace.traceId || '') % 100;
    const yCoord = trace.duration / 10; // 지속 시간을 Y 좌표로 사용
    
    return {
      value: [xCoord, yCoord],
      itemStyle: {
        color: 'rgba(81, 162, 252, 0.8)'
      },
      originalData: trace,
      dataType: 'trace'
    };
  });
  
  // 로그 데이터를 점으로 변환
  const logPoints = logs.map(log => {
    // 로그에 연관된 트레이스가 있으면 사용, 없으면 해시 생성
    const xCoord = log.traceId ? 
      hashString(log.traceId) % 100 : 
      hashString(log.attributes.resourceAttributes?.service_name || '') % 100;
    
    const severityToY: Record<number, number> = {
      1: 10, // TRACE
      5: 20, // DEBUG
      9: 30, // INFO
      13: 60, // WARN
      17: 90, // ERROR
      21: 100 // FATAL
    };
    
    const yCoord = severityToY[log.severityNumber] || 50;
    
    return {
      value: [xCoord, yCoord],
      itemStyle: {
        color: getSeverityColor(log.severityNumber)
      },
      originalData: log,
      dataType: 'log'
    };
  });
  
  return {
    trace: tracePoints,
    log: logPoints
  };
}

// 간단한 문자열 해시 함수
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  return Math.abs(hash);
}

// 심각도에 따른 색상 반환
function getSeverityColor(severity: number): string {
  switch (true) {
    case severity <= 4: // TRACE
      return 'rgba(150, 150, 150, 0.8)';
    case severity <= 8: // DEBUG
      return 'rgba(100, 200, 200, 0.8)';
    case severity <= 12: // INFO
      return 'rgba(100, 200, 100, 0.8)';
    case severity <= 16: // WARN
      return 'rgba(240, 200, 100, 0.8)';
    case severity <= 20: // ERROR
      return 'rgba(240, 100, 100, 0.8)';
    default: // FATAL
      return 'rgba(180, 40, 40, 0.8)';
  }
}