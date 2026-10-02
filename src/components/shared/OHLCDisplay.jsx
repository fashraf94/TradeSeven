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
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// `showUnavailable` (opt-in; StockChart passes it only for controlled held
// research — SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md E-1 item 31): a field
// that is not a finite number reads "—", and the close is coloured neutrally
// unless both open and close are known. Absent, the output is unchanged.
const OHLCDisplay = ({ data, showUnavailable = false }) => {
  if (!data) return null;
  const isGreen = data.close >= data.open;
  const changeColor = showUnavailable && !(isNum(data.open) && isNum(data.close))
    ? valueStyle.color
    : (isGreen ? '#00ff88' : '#ff4757');
  const fmt = (v) => (showUnavailable && !isNum(v) ? '\u2014' : v?.toFixed(2));

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
      <span><span style={labelStyle}>O</span> <span style={valueStyle}>{fmt(data.open)}</span></span>
      <span><span style={labelStyle}>H</span> <span style={valueStyle}>{fmt(data.high)}</span></span>
      <span><span style={labelStyle}>L</span> <span style={valueStyle}>{fmt(data.low)}</span></span>
      <span><span style={labelStyle}>C</span> <span style={{ color: changeColor }}>{fmt(data.close)}</span></span>
      {data.volume > 0 && (
        <span><span style={labelStyle}>Vol</span> <span style={valueStyle}>{formatVol(data.volume)}</span></span>
      )}
    </div>
  );
};

export default OHLCDisplay;
