// src/components/FantasyTimes/VeraDeepDive.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-page deepdive view for Vera — navigated via screen === 'deepDive'.
//
// Architectural difference from StoryDetail: the other reporters' detail views receive
// the full story object and render it directly. Vera's long-form markdown does NOT live
// on the story object — the story only carries a summary plus visualConfig.fullDeepdiveId.
// The full markdown lives in the separate `fantasyTimesDeepdives` collection (written by
// api/fantasytimes/ingest-deepdive.js). So this page fetches the deepdive doc by ID on
// mount and shows a loading state until the markdown is ready.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { REPORTER_COLORS, FEED_TOKENS, BROADSHEET_TOKENS } from '../../constants/reporterTheme';
import { fetchDeepdive } from '../../services/fantasyTimesClient';
import DeepdiveMarkdown from './DeepdiveMarkdown';

const NAVY = REPORTER_COLORS.vera?.primary || '#1e3a5f';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VeraDeepDive({ story, onClose, isDesktop }) {
  const [deepdive, setDeepdive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fullDeepdiveId = story?.visualConfig?.fullDeepdiveId;

  useEffect(() => {
    if (!fullDeepdiveId) {
      setError('unavailable');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDeepdive(fullDeepdiveId)
      .then((d) => { if (!cancelled) setDeepdive(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load deepdive'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fullDeepdiveId, reloadKey]);

  if (!story) return null;

  const readTime = deepdive?.wordCount ? Math.max(1, Math.round(deepdive.wordCount / 220)) : null;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0e14',
      color: '#e6edf3',
    }}>
      {/* ── Top bar with back arrow (mirrors StoryDetail) ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${FEED_TOKENS.bgCardBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        backgroundColor: '#0a0e14',
        zIndex: 10,
      }}>
        <button
          onClick={onClose}
          aria-label="Back to feed"
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <span style={{ color: '#00d9ff', fontSize: '14px', fontWeight: 600 }}>
          FantasyTimes
        </span>
      </div>

      {/* ── Content column ── */}
      <div style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: isDesktop ? '40px 24px 80px' : '24px 16px 64px',
      }}>
        {/* Reporter header */}
        <div style={{ marginBottom: 28 }}>
          <span style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: NAVY === '#1e3a5f' ? '#7fb0e6' : NAVY,
            display: 'block',
            marginBottom: 14,
          }}>
            DEEP RESEARCH
          </span>

          <h1 style={{
            fontFamily: BROADSHEET_TOKENS.fontHeadline,
            fontSize: isDesktop ? 44 : 30,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: '#f0f3f7',
            margin: '0 0 14px',
            textWrap: 'balance',
          }}>
            {story.headline}
          </h1>

          {story.subheadline && (
            <p style={{
              fontFamily: BROADSHEET_TOKENS.fontBody,
              fontSize: isDesktop ? 19 : 16,
              lineHeight: 1.5,
              color: '#bbc9ce',
              margin: '0 0 18px',
              textWrap: 'pretty',
            }}>
              {story.subheadline.replace(/\*\*/g, '')}
            </p>
          )}

          <div style={{
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 12,
            color: '#859398',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight: 700, color: '#e3e2e7', textTransform: 'uppercase' }}>BY VERA</span>
            {readTime && (<><span>•</span><span>{readTime} min read</span></>)}
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: FEED_TOKENS.bgCardBorder, margin: '0 0 28px' }} />

        {/* Loading state */}
        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#8b949e', fontFamily: BROADSHEET_TOKENS.fontMono, fontSize: 13 }}>
            <div style={{
              width: 28, height: 28, margin: '0 auto 16px',
              border: '2px solid rgba(127,176,230,0.25)',
              borderTopColor: '#7fb0e6',
              borderRadius: '50%',
              animation: 'veraSpin 0.8s linear infinite',
            }} />
            Loading deepdive…
            <style>{`@keyframes veraSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error states */}
        {!loading && error === 'unavailable' && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#8b949e', fontSize: 14 }}>
            This deepdive is unavailable.
          </div>
        )}
        {!loading && error && error !== 'unavailable' && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#8b949e', fontSize: 14 }}>
            <div style={{ marginBottom: 14 }}>Couldn’t load this deepdive.</div>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              style={{
                background: 'none',
                border: `1px solid ${FEED_TOKENS.bgCardBorder}`,
                color: '#7fb0e6',
                borderRadius: 6,
                padding: '8px 18px',
                cursor: 'pointer',
                fontFamily: BROADSHEET_TOKENS.fontMono,
                fontSize: 12,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Body */}
        {!loading && !error && deepdive && (
          <DeepdiveMarkdown markdown={deepdive.fullMarkdown} reporterColor={NAVY} />
        )}

        {/* Source attribution footer */}
        {!loading && !error && deepdive && (deepdive.sourceFile || deepdive.topicSlug || deepdive.generatedAt) && (
          <div style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: `1px solid ${FEED_TOKENS.bgCardBorder}`,
            fontFamily: BROADSHEET_TOKENS.fontMono,
            fontSize: 11,
            color: '#6e7681',
            lineHeight: 1.6,
          }}>
            {[
              deepdive.topicSlug ? `Topic: ${deepdive.topicSlug}` : null,
              deepdive.sourceFile ? `Source: ${deepdive.sourceFile}` : null,
              deepdive.generatedAt ? `Generated ${formatDate(deepdive.generatedAt)}` : null,
            ].filter(Boolean).join('  ·  ')}
          </div>
        )}
      </div>
    </div>
  );
}
