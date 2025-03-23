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
          
          // 속성에서 latency 관련 정보 추출 (있는 경우)
          const attributes = parseAttributes(span.attributes);
          let latency = durationMs;
          
          // http.latency 또는 db.latency 등의 속성이 있으면 해당 값 사용
          if (attributes['http.latency']) {
            latency = parseFloat(attributes['http.latency']);
          } else if (attributes['db.latency']) {
            latency = parseFloat(attributes['db.latency']);
          }
          
          return {
            traceId,
            spanId,
            parentSpanId,
            name: span.name,
            kind: typeof span.kind === 'string' ? parseInt(span.kind) : span.kind,
            startTime: startTimeMs,
            endTime: endTimeMs,
            duration: durationMs > 0 ? durationMs : 0,
            latency: latency > 0 ? latency : durationMs,
            attributes: {
              ...attributes,
              resourceAttributes: resourceAttrs,
              scopeName: scope.name,
              scopeVersion: scope.version
            },
            // 원본 데이터 참조 (필요 시)
            rawSpan: span
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
          
          // 밀리초 단위로 변환
          const timeMs = Math.floor(timeNano / 1000000);
          const observedTimeMs = Math.floor(observedTimeNano / 1000000);
          
          return {
            timeUnixNano: timeMs,
            observedTimeUnixNano: observedTimeMs,
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
            },
            // 타임스탬프 (차트용)
            timestamp: timeMs,
            // 원본 데이터 참조 (필요 시)
            rawLogRecord: logRecord
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

// 실시간 차트를 위한 시계열 데이터 변환 함수
export function convertToTimeSeriesData(traces: any[]) {
  if (!traces || !traces.length) return [];
  
  // 시간 순으로 정렬
  const sortedTraces = [...traces].sort((a, b) => a.startTime - b.startTime);
  
  // [시간, 지연시간] 형식의 배열 생성
  return sortedTraces.map(trace => [trace.startTime, trace.latency || trace.duration]);
}

// 차트 데이터 통계 계산 함수
export function calculateLatencyStatistics(traces: any[]) {
  if (!traces || !traces.length) return { avg: 0, max: 0, min: 0, p95: 0, p99: 0 };
  
  const latencies = traces.map(t => t.latency || t.duration).filter(l => l > 0);
  
  if (!latencies.length) return { avg: 0, max: 0, min: 0, p95: 0, p99: 0 };
  
  // 정렬
  latencies.sort((a, b) => a - b);
  
  // 통계 계산
  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const avg = sum / latencies.length;
  const max = latencies[latencies.length - 1];
  const min = latencies[0];
  
  // 백분위수 계산
  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);
  
  const p95 = latencies[p95Index];
  const p99 = latencies[p99Index];
  
  return { avg, max, min, p95, p99 };
}