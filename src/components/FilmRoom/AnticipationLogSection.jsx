import React from 'react';
import { renderMessageWithEntities } from '../../utils/renderMessageWithEntities';
import { dayOf } from '../../utils/dayOfTimestamp';

const formatTimestamp = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export default function AnticipationLogSection({ battle, chatExchanges, dayNum, onSymbolClick, knownTickers, tokens }) {
  const list = (Array.isArray(chatExchanges) ? chatExchanges : []).filter(
    (ex) => ex && ex.messageType === 'anticipation' && dayOf(ex.timestamp, battle) === dayNum
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          padding: '6px 16px 4px',
          fontSize: 11,
          fontWeight: 700,
          color: tokens.textPrimary || '#e2e8f0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Anticipation Log ({list.length})
      </div>

      {list.length === 0 ? (
        <div
          style={{
            margin: '0 12px',
            padding: '14px 16px',
            borderRadius: 12,
            border: `1px dashed ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
            color: tokens.textFaint || '#64748b',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          No anticipation entries logged on this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px' }}>
          {list.map((ex, i) => (
            <div
              key={ex.timestamp || i}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: tokens.bgCard || '#15171E',
                border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: tokens.textPrimary || '#e2e8f0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {renderMessageWithEntities(ex.agentResponse, onSymbolClick, knownTickers)}
              </div>
              {ex.timestamp && (
                <div style={{ fontSize: 10, color: tokens.textFaint || '#64748b' }}>
                  {formatTimestamp(ex.timestamp)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
