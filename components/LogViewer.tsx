// components/LogViewer.tsx
import React from 'react';

interface LogViewerProps {
  log: any;
}

const LogViewer: React.FC<LogViewerProps> = ({ log }) => {
  if (!log) return null;
  
  const bodyContent = typeof log.body === 'object' 
    ? JSON.stringify(log.body, null, 2) 
    : log.body;
  
  return (
    <div className="log-viewer">
      <h3>Log Details</h3>
      <div className="log-header">
        <p><strong>Time:</strong> {new Date(Number(log.timeUnixNano)).toLocaleString()}</p>
        <p><strong>Severity:</strong> {log.severityText} ({log.severityNumber})</p>
        {log.traceId && (
          <p><strong>Trace ID:</strong> {log.traceId}</p>
        )}
        {log.spanId && (
          <p><strong>Span ID:</strong> {log.spanId}</p>
        )}
      </div>
      
      <div className="log-body">
        <h4>Log Body:</h4>
        <pre>{bodyContent}</pre>
      </div>
      
      <div className="log-attributes">
        <h4>Attributes:</h4>
        <pre>{JSON.stringify(log.attributes, null, 2)}</pre>
      </div>
      
      <style jsx>{`
        .log-viewer {
          background-color: #f8f9fa;
          border-radius: 4px;
          padding: 16px;
          margin-top: 20px;
        }
        .log-header {
          margin-bottom: 16px;
        }
        .log-body, .log-attributes {
          margin-top: 16px;
        }
        pre {
          background-color: #eee;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};

export default LogViewer;