import React from 'react';

const GRADE_COLORS = {
  A: '#34d399', B: '#34d399',
  C: '#f59e0b',
  D: '#ef4444', F: '#ef4444',
};

const hexToRgba = (hex, alpha) => {
  if (!hex || hex.charAt(0) !== '#') return `rgba(150,150,150,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatTimestamp = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

// Read-only daily review card. Adapted from GameTapeView's DaySummaryCard
// (Phase 4: extracted for the Film Room). The proposedRules[] list is rendered
// as read-only text; accept/reject UX is deferred (see follow-up backlog #2).
export default function DaySummaryCard({ review, tokens }) {
  if (!review) {
    return (
      <div
        style={{
          margin: '0 12px',
          padding: '20px 16px',
          borderRadius: 12,
          background: tokens.bgCard || '#15171E',
          border: `1px dashed ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
          color: tokens.textFaint || '#64748b',
          fontSize: 12,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        No review yet for this day. The tape will be filed after the close.
      </div>
    );
  }

  const gradeColor = GRADE_COLORS[String(review.selfGrade || '').toUpperCase()] || tokens.textMuted;
  const dateStr = review.date || formatTimestamp(review.createdAt);

  return (
    <div
      style={{
        margin: '0 12px',
        padding: '14px 16px',
        borderRadius: 12,
        background: tokens.bgCard || '#15171E',
        border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: tokens.textFaint || '#64748b',
            }}
          >
            Day Summary
            {review.tradingDay != null && ` · Day ${review.tradingDay}`}
          </span>
          {dateStr && (
            <span style={{ fontSize: 11, color: tokens.textMuted || '#94a3b8' }}>{dateStr}</span>
          )}
        </div>
        {review.selfGrade && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 36,
              height: 36,
              borderRadius: 10,
              background: hexToRgba(gradeColor, 0.12),
              border: `1px solid ${hexToRgba(gradeColor, 0.3)}`,
              color: gradeColor,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '0.02em',
            }}
          >
            {review.selfGrade}
          </div>
        )}
      </div>

      {review.daySummary && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: tokens.textSecondary || '#cbd5e1',
          }}
        >
          {review.daySummary}
        </p>
      )}

      {review.selfGradeRationale && (
        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            fontStyle: 'italic',
            lineHeight: 1.5,
            color: tokens.textMuted || '#94a3b8',
          }}
        >
          "{review.selfGradeRationale}"
        </p>
      )}

      {review.lessonLearned && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: hexToRgba(tokens.teal || '#5eead4', 0.06),
            border: `1px solid ${hexToRgba(tokens.teal || '#5eead4', 0.2)}`,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: tokens.teal || '#5eead4',
              marginBottom: 4,
            }}
          >
            Lesson Learned
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: tokens.textSecondary || '#cbd5e1',
            }}
          >
            {review.lessonLearned}
          </p>
        </div>
      )}

      {Array.isArray(review.proposedRules) && review.proposedRules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: tokens.purpleText || '#a78bfa',
            }}
          >
            Proposed Rules
          </div>
          {review.proposedRules.map((rule, i) => (
            <div
              key={i}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: tokens.bgElevated || 'rgba(255,255,255,0.02)',
                border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
                fontSize: 11.5,
                lineHeight: 1.45,
                color: tokens.textSecondary || '#cbd5e1',
              }}
            >
              <div>{rule?.text || '—'}</div>
              {rule?.rationale && (
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 10.5,
                    fontStyle: 'italic',
                    color: tokens.textFaint || '#64748b',
                  }}
                >
                  {rule.rationale}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
