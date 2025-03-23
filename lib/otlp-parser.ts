// lib/otlp-parser.ts
import { opentelemetry } from '../app/proto/proto';

// OTLP 트레이스와 로그 데이터 파싱 및 변환 함수
export function parseTraceData(traceData: any) {
  try {
    // resourceSpans 배열이 있는지 확인
    if (!traceData || !traceData.resourceSpans) {
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
          // traceId와 spanId 변환 - 이미 문자열로 변환된 경우 그대로 사용
          const traceId = typeof span.traceId === 'string' ? span.traceId : formatId(span.traceId);
          const spanId = typeof span.spanId === 'string' ? span.spanId : formatId(span.spanId);
          const parentSpanId = typeof span.parentSpanId === 'string' ? span.parentSpanId : formatId(span.parentSpanId);
          
          // 시간 정보 처리
          const startTimeNano = typeof span.startTimeUnixNano === 'string' ? 
            parseInt(span.startTimeUnixNano) : Number(span.startTimeUnixNano || 0);
          const endTimeNano = typeof span.endTimeUnixNano === 'string' ? 
            parseInt(span.endTimeUnixNano) : Number(span.endTimeUnixNano || 0);
          
          const startTimeMs = Math.floor(startTimeNano / 1000000);
          const endTimeMs = Math.floor(endTimeNano / 1000000);
          const durationMs = endTimeMs - startTimeMs;
          
          return {
            traceId,
            spanId,
            parentSpanId,
            name: span.name,
            kind: typeof span.kind === 'string' ? parseInt(span.kind) : span.kind,
            startTime: startTimeMs,
            endTime: endTimeMs,
            duration: durationMs > 0 ? durationMs : 0,
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
    if (!logData || !logData.resourceLogs) {
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
          // traceId와 spanId 변환
          const traceId = typeof logRecord.traceId === 'string' ? logRecord.traceId : formatId(logRecord.traceId);
          const spanId = typeof logRecord.spanId === 'string' ? logRecord.spanId : formatId(logRecord.spanId);
          
          // 시간 정보 처리
          const timeNano = typeof logRecord.timeUnixNano === 'string' ? 
            parseInt(logRecord.timeUnixNano) : Number(logRecord.timeUnixNano || 0);
          const observedTimeNano = typeof logRecord.observedTimeUnixNano === 'string' ? 
            parseInt(logRecord.observedTimeUnixNano) : Number(logRecord.observedTimeUnixNano || 0);
          
          return {
            timeUnixNano: Math.floor(timeNano / 1000000),
            observedTimeUnixNano: Math.floor(observedTimeNano / 1000000),
            severityNumber: typeof logRecord.severityNumber === 'string' ? 
              parseInt(logRecord.severityNumber) : logRecord.severityNumber,
            severityText: logRecord.severityText || '',
            body: parseBody(logRecord.body),
            traceId,
            spanId,
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

// ID 변환 (바이너리 또는 base64 형식에서 16진수 문자열로)
function formatId(id: any): string {
  if (!id) return '';
  
  // 이미 문자열인 경우
  if (typeof id === 'string') {
    // 이미 16진수 형식인지 확인
    if (/^[0-9A-Fa-f]+$/.test(id)) {
      return id;
    }
    // base64에서 변환 시도
    try {
      const binary = atob(id);
      let hex = '';
      for (let i = 0; i < binary.length; i++) {
        hex += ('00' + binary.charCodeAt(i).toString(16)).slice(-2);
      }
      return hex.toUpperCase();
    } catch (e) {
      return id; // 변환 실패 시 원본 반환
    }
  }
  
  // 바이너리 배열인 경우
  if (id && (id instanceof Uint8Array || id.buffer || Array.isArray(id))) {
    try {
      let hex = '';
      const array = id instanceof Uint8Array ? id : new Uint8Array(id);
      for (let i = 0; i < array.length; i++) {
        hex += ('00' + array[i].toString(16)).slice(-2);
      }
      return hex.toUpperCase();
    } catch (e) {
      console.error('Error formatting binary ID:', e);
      return '';
    }
  }
  
  return '';
}

// 속성(attribute) 배열을 객체로 변환
function parseAttributes(attributes: any[] = []) {
  const result: Record<string, any> = {};
  
  if (!Array.isArray(attributes)) {
    return result;
  }
  
  for (const attr of attributes) {
    if (attr && attr.key) {
      let value;
      
      if (attr.value) {
        if (attr.value.stringValue !== undefined) value = attr.value.stringValue;
        else if (attr.value.intValue !== undefined) value = typeof attr.value.intValue === 'string' ? 
          parseInt(attr.value.intValue) : attr.value.intValue;
        else if (attr.value.doubleValue !== undefined) value = typeof attr.value.doubleValue === 'string' ? 
          parseFloat(attr.value.doubleValue) : attr.value.doubleValue;
        else if (attr.value.boolValue !== undefined) value = Boolean(attr.value.boolValue);
      }
      
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
  } else if (body.kvlistValue && body.kvlistValue.values) {
    const keyValues: Record<string, any> = {};
    
    for (const item of body.kvlistValue.values) {
      if (item && item.key) {
        let value;
        
        if (item.value) {
          if (item.value.stringValue !== undefined) value = item.value.stringValue;
          else if (item.value.intValue !== undefined) value = typeof item.value.intValue === 'string' ? 
            parseInt(item.value.intValue) : item.value.intValue;
          else if (item.value.doubleValue !== undefined) value = typeof item.value.doubleValue === 'string' ? 
            parseFloat(item.value.doubleValue) : item.value.doubleValue;
          else if (item.value.boolValue !== undefined) value = Boolean(item.value.boolValue);
        }
        
        if (value !== undefined) {
          keyValues[item.key] = value;
        }
      }
    }
    return keyValues;
  }
  
  return JSON.stringify(body);
}

// 트레이스와 로그 데이터를 차트에서 사용할 형식으로 변환
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

// 문자열 해시 함수
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