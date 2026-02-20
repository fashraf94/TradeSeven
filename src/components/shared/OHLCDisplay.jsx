import React from 'react';

const formatVol = (v) => {
  if (!v) return '';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
};

const labelStyle = { color: 'rgba(255,255,255,0.4)' };
const valueStyle = { color: '#e6edf3' };

const OHLCDisplay = ({ data }) => {
  if (!data) return null;
  const isGreen = data.close >= data.open;
  const changeColor = isGreen ? '#00ff88' : '#ff4757';

  return (
    <div style={{
      position: 'absolute',
      top: '8px',
      left: '8px',
      zIndex: 10,
      display: 'flex',
      gap: '12px',
      fontSize: '11px',
      fontFamily: 'monospace',
      pointerEvents: 'none',
    }}>
      <span><span style={labelStyle}>O</span> <span style={valueStyle}>{data.open?.toFixed(2)}</span></span>
      <span><span style={labelStyle}>H</span> <span style={valueStyle}>{data.high?.toFixed(2)}</span></span>
      <span><span style={labelStyle}>L</span> <span style={valueStyle}>{data.low?.toFixed(2)}</span></span>
      <span><span style={labelStyle}>C</span> <span style={{ color: changeColor }}>{data.close?.toFixed(2)}</span></span>
      {data.volume > 0 && (
        <span><span style={labelStyle}>Vol</span> <span style={valueStyle}>{formatVol(data.volume)}</span></span>
      )}
    </div>
  );
};

export default OHLCDisplay;
