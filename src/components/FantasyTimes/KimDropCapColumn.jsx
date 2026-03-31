// src/components/FantasyTimes/KimDropCapColumn.jsx
// Kim's weekly column with CSS ::first-letter drop cap effect + purple ambient glow.

import React from 'react';
import { REPORTER_COLORS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';

function getReadTime(body) {
  if (!body) return 1;
  return Math.max(1, Math.ceil(body.length / 1200));
}

export default function KimDropCapColumn({ story, isDesktop, onStorySelect }) {
  if (!story) return null;

  const dropCapId = `kim-drop-cap-${(story.id || 'default').replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const kimColor = REPORTER_COLORS.kim;
  const bodyText = (story.body || story.subheadline || '').replace(/\*\*(.*?)\*\*/g, '$1');

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: BROADSHEET_TOKENS.bgPage,
      padding: isDesktop ? 32 : 24,
      borderLeft: `4px solid ${kimColor.hex}`,
      borderTop: '1px solid rgba(60, 73, 77, 0.2)',
      borderBottom: '1px solid rgba(60, 73, 77, 0.2)',
    }}>
      {/* Purple ambient glow */}
      <div style={{
        position: 'absolute',
        bottom: -80,
        left: -80,
        width: 256,
        height: 256,
        background: 'rgba(139, 92, 246, 0.1)',
        filter: 'blur(80px)',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Section label */}
        <div style={{
          fontFamily: BROADSHEET_TOKENS.fontMono,
          fontSize: 10,
          fontWeight: 700,
          color: kimColor.hex,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          KIM'S WEEKLY
        </div>

        {/* Headline */}
        <h3 style={{
          fontFamily: BROADSHEET_TOKENS.fontHeadline,
          fontSize: isDesktop ? 24 : 20,
          fontWeight: 700,
          lineHeight: 1.25,
          color: '#e3e2e7',
          margin: '0 0 20px',
          textWrap: 'balance',
        }}>
          {story.headline}
        </h3>

        {/* Drop cap body */}
        <style>{`
          #${dropCapId}::first-letter {
            float: left;
            font-family: 'Newsreader', serif;
            font-size: 4.5rem;
            line-height: 1;
            padding-right: 0.5rem;
            color: #A78BFA;
            font-weight: 700;
          }
        `}</style>
        <div
          id={dropCapId}
          style={{
            fontFamily: BROADSHEET_TOKENS.fontBody,
            fontSize: 14,
            lineHeight: 1.8,
            color: '#b3b9c5',
          }}
        >
          {bodyText}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid rgba(60, 73, 77, 0.1)',
          marginTop: 32,
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 10,
            color: '#bbc9ce',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            READ TIME: {getReadTime(story.body)} MIN
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onStorySelect) onStorySelect(story);
            }}
            style={{
              fontFamily: BROADSHEET_TOKENS.fontMono,
              fontSize: 10,
              fontWeight: 700,
              color: kimColor.hex,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${kimColor.hex}`,
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            READ FULL COLUMN
          </button>
        </div>
      </div>
    </div>
  );
}
