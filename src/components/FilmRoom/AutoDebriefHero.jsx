import React from 'react';
import { renderMessageWithEntities } from '../../utils/renderMessageWithEntities';
import { dayOf } from '../../utils/dayOfTimestamp';

function hexToRgba(hex, alpha) {
  if (!hex || hex.charAt(0) !== '#') return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function findDebriefForDay(chatExchanges, dayNum, battle) {
  if (!Array.isArray(chatExchanges) || !dayNum) return null;
  const debriefs = chatExchanges.filter(
    (ex) => ex && (ex.messageType === 'auto_debrief' || ex.isAutoDebrief === true)
  );
  return debriefs.find((ex) => dayOf(ex.timestamp, battle) === dayNum) || null;
}

function formatPostedAt(ts) {
  if (ts == null) return '';
  let ms = null;
  if (typeof ts === 'number') ms = ts;
  else if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    if (!Number.isNaN(parsed)) ms = parsed;
  } else if (typeof ts === 'object') {
    if (typeof ts.toMillis === 'function') ms = ts.toMillis();
    else if (typeof ts.seconds === 'number') ms = ts.seconds * 1000;
    else if (typeof ts._seconds === 'number') ms = ts._seconds * 1000;
  }
  if (ms == null) return '';
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

export default function AutoDebriefHero({ battle, chatExchanges, dayNum, agentName, onSymbolClick, knownTickers, tokens }) {
  const exchange = findDebriefForDay(chatExchanges, dayNum, battle);
  if (!exchange) {
    return (
      <div
        style={{
          margin: '0 12px',
          padding: '14px 16px',
          borderRadius: 12,
          border: `1px dashed ${tokens.borderDefault || 'rgba(255,255,255,0.08)'}`,
          color: tokens.textFaint || '#64748b',
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        Today's debrief will be filed after the close.
      </div>
    );
  }

  const amber = tokens.amber || '#f59e0b';

  return (
    <div
      style={{
        margin: '0 12px',
        padding: '16px 18px',
        borderRadius: 12,
        background: hexToRgba(amber, 0.06),
        border: `1px solid ${hexToRgba(amber, 0.28)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          color: amber,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ fontSize: 14 }}>📋</span>
        <span>Post-Market Debrief</span>
        {(() => {
          const posted = formatPostedAt(exchange.timestamp);
          if (!posted && !agentName) return null;
          return (
            <span
              style={{
                marginLeft: 'auto',
                color: tokens.textFaint || '#64748b',
                textTransform: 'none',
                fontWeight: 500,
                letterSpacing: 0,
              }}
            >
              {posted && `Posted at ${posted} ET`}
              {posted && agentName && ' · '}
              {agentName}
            </span>
          );
        })()}
      </div>

      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.6,
          color: tokens.textPrimary || '#e2e8f0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {renderMessageWithEntities(exchange.agentResponse, onSymbolClick, knownTickers)}
      </div>
    </div>
  );
}
