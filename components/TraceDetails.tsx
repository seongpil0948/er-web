import React from 'react';

interface TraceDetailsProps {
  trace: any;
}

const TraceDetails: React.FC<TraceDetailsProps> = ({ trace }) => {
  if (!trace) return null;
  
  return (
    <div className="trace-details">
      <h3>Trace Details</h3>
      <div className="trace-header">
        <p><strong>Name:</strong> {trace.name}</p>
        <p><strong>Trace ID:</strong> {trace.traceId}</p>
        <p><strong>Span ID:</strong> {trace.spanId}</p>
        {trace.parentSpanId && (
          <p><strong>Parent Span ID:</strong> {trace.parentSpanId}</p>
        )}
        <p><strong>Kind:</strong> {getSpanKindName(trace.kind)}</p>
        <p><strong>Duration:</strong> {trace.duration}ms</p>
        <p>
          <strong>Time Range:</strong> {new Date(Number(trace.startTime)).toLocaleTimeString()} - {new Date(Number(trace.endTime)).toLocaleTimeString()}
        </p>
      </div>
      
      <div className="trace-attributes">
        <h4>Attributes:</h4>
        <pre>{JSON.stringify(trace.attributes, null, 2)}</pre>
      </div>
      
      <style jsx>{`
        .trace-details {
          background-color: #f0f5ff;
          border-radius: 4px;
          padding: 16px;
          margin-top: 20px;
        }
        .trace-header {
          margin-bottom: 16px;
        }
        .trace-attributes {
          margin-top: 16px;
        }
        pre {
          background-color: #e6eeff;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};

// Span Kind 숫자를 텍스트로 변환
function getSpanKindName(kind: number): string {
  switch (kind) {
    case 0: return 'UNSPECIFIED';
    case 1: return 'INTERNAL';
    case 2: return 'SERVER';
    case 3: return 'CLIENT';
    case 4: return 'PRODUCER';
    case 5: return 'CONSUMER';
    default: return 'UNKNOWN';
  }
}

export default TraceDetails;