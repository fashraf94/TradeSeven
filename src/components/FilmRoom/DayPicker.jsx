import React from 'react';

export default function DayPicker({ tradingDays, selectedDay, onSelectDay, dailyReviews, tokens }) {
  if (!Array.isArray(tradingDays) || tradingDays.length <= 1) return null;

  const reviewedDays = new Set(
    (Array.isArray(dailyReviews) ? dailyReviews : [])
      .map((r) => r?.tradingDay)
      .filter((n) => typeof n === 'number')
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 2,
      }}
    >
      {tradingDays.map((dateStr, idx) => {
        const dayNum = idx + 1;
        const isActive = dayNum === selectedDay;
        const hasReview = reviewedDays.has(dayNum);
        const label =
          typeof dateStr === 'string'
            ? new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : `Day ${dayNum}`;

        return (
          <button
            key={dayNum}
            onClick={() => onSelectDay(dayNum)}
            style={{
              flex: '0 0 auto',
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${
                isActive
                  ? tokens.teal || '#5eead4'
                  : tokens.borderDefault || 'rgba(255,255,255,0.08)'
              }`,
              background: isActive ? 'rgba(94,234,212,0.10)' : 'rgba(255,255,255,0.02)',
              color: isActive ? tokens.teal || '#5eead4' : tokens.textSecondary || '#cbd5e1',
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              letterSpacing: '0.02em',
            }}
          >
            <span>Day {dayNum}</span>
            <span style={{ fontSize: 10, color: tokens.textFaint || '#64748b' }}>· {label}</span>
            {hasReview && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: tokens.amber || '#f59e0b',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
