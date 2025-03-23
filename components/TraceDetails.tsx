// app/components/TraceDetails.tsx
'use client';
import React from 'react';

interface TraceDetailsProps {
  trace: any;
}

const TraceDetails: React.FC<TraceDetailsProps> = ({ trace }) => {
  if (!trace) return null;
  
  return (
    <div className="bg-blue-50 rounded-lg shadow-lg p-6 mt-6">
      <h3 className="text-xl font-bold mb-4">Trace Details</h3>
      <div className="mb-4">
        <p className="mb-1"><strong>Name:</strong> {trace.name}</p>
        <p className="mb-1"><strong>Trace ID:</strong> {trace.traceId}</p>
        <p className="mb-1"><strong>Span ID:</strong> {trace.spanId}</p>
        {trace.parentSpanId && (
          <p className="mb-1"><strong>Parent Span ID:</strong> {trace.parentSpanId}</p>
        )}
        <p className="mb-1"><strong>Kind:</strong> {getSpanKindName(trace.kind)}</p>
        <p className="mb-1"><strong>Duration:</strong> {trace.duration}ms</p>
        <p className="mb-1">
          <strong>Time Range:</strong> {new Date(Number(trace.startTime)).toLocaleTimeString()} - {new Date(Number(trace.endTime)).toLocaleTimeString()}
        </p>
      </div>
      
      <div>
        <h4 className="text-lg font-semibold mb-2">Attributes:</h4>
        <pre className="bg-blue-100 p-3 rounded overflow-x-auto">{JSON.stringify(trace.attributes, null, 2)}</pre>
      </div>
    </div>
  );
};

// SpanKind 숫자를 텍스트로 변환
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