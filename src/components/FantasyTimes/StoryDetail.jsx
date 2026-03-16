// src/components/FantasyTimes/StoryDetail.jsx
// Expanded story view — bottom sheet on mobile, modal on desktop.

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, TrendingUp, Globe, BarChart3, Compass } from 'lucide-react';
import { REPORTER_PROFILES } from '../../prompts/fantasyTimesPrompts';
import StoryVisualSafe from './StoryVisualSafe';

const ICON_MAP = { Zap, TrendingUp, Globe, BarChart3, Compass };

/**
 * Simple markdown-to-HTML renderer for story bodies.
 * Handles: bold, em-dashes, blockquotes, ## headers, paragraphs, bullets.
 */
function renderMarkdown(text) {
  if (!text) return '';
  return text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Blockquotes (restore after escaping)
    .replace(/^&gt;\s?(.+)$/gm, '<blockquote style="border-left:3px solid #30363d;padding-left:12px;color:#8b949e;margin:8px 0;font-style:italic">$1</blockquote>')
    // Headers
    .replace(/^## (.+)$/gm, '<h3 style="color:#e6edf3;font-size:15px;margin:16px 0 8px;font-weight:700">$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e6edf3">$1</strong>')
    // Bullets
    .replace(/^- (.+)$/gm, '<li style="color:#8b949e;margin:2px 0;margin-left:16px">$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.6">')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>');
}

export default function StoryDetail({ story, isOpen, onClose, isMobile }) {
  if (!isOpen || !story) return null;

  const profile = REPORTER_PROFILES[story.reporter] || REPORTER_PROFILES.kai;
  const IconComponent = ICON_MAP[profile.icon] || Zap;

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  const bodyHtml = renderMarkdown(story.body);

  const modalVariants = isMobile
    ? {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { type: 'spring', damping: 25, stiffness: 300 },
      }
    : {
        initial: { opacity: 0, scale: 0.95, x: '-50%', y: '-50%' },
        animate: { opacity: 1, scale: 1, x: '-50%', y: '-50%' },
        exit: { opacity: 0, scale: 0.95, x: '-50%', y: '-50%' },
        transition: { duration: 0.2 },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
            }}
          />

          {/* Modal/Sheet */}
          <motion.div
            {...modalVariants}
            style={{
              position: 'fixed',
              zIndex: 101,
              backgroundColor: '#0d1117',
              overflowY: 'auto',
              ...(isMobile
                ? {
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '90vh',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                  }
                : {
                    top: '50%',
                    left: '50%',
                    maxWidth: '640px',
                    width: '90vw',
                    maxHeight: '85vh',
                    borderRadius: '12px',
                    border: '1px solid #21262d',
                  }),
            }}
          >
            {/* Drag handle (mobile) */}
            {isMobile && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '10px 0 4px',
              }}>
                <div style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#30363d',
                }} />
              </div>
            )}

            {/* Header */}
            <div style={{
              padding: '16px 20px 12px',
              borderBottom: '1px solid #21262d',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: `${profile.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IconComponent size={16} color={profile.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: profile.color, fontSize: '13px', fontWeight: 600 }}>
                  {profile.name} · {profile.beat}
                </div>
                <div style={{ color: '#6e7681', fontSize: '11px' }}>
                  {story.publishedAt
                    ? new Date(
                        story.publishedAt._seconds
                          ? story.publishedAt._seconds * 1000
                          : story.publishedAt
                      ).toLocaleString()
                    : ''}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '16px 20px' }}>
              {/* Visual */}
              {story.visualType && story.visualType !== 'none' && (
                <div style={{ marginBottom: 16 }}>
                  <StoryVisualSafe
                    visualType={story.visualType}
                    visualConfig={story.visualConfig}
                    size="expanded"
                  />
                </div>
              )}

              {/* Headline */}
              <h2 style={{
                color: '#e6edf3',
                fontSize: '18px',
                fontWeight: 700,
                lineHeight: 1.3,
                margin: '0 0 8px',
              }}>
                {story.headline}
              </h2>

              {/* Subheadline */}
              <p style={{
                color: '#8b949e',
                fontSize: '14px',
                margin: '0 0 16px',
                lineHeight: 1.4,
              }}>
                {story.subheadline}
              </p>

              {/* Body */}
              <div
                style={{
                  color: '#c9d1d9',
                  fontSize: '14px',
                  lineHeight: 1.7,
                }}
                dangerouslySetInnerHTML={{ __html: `<p style="margin:8px 0;line-height:1.6">${bodyHtml}</p>` }}
              />

              {/* Related tickers */}
              {story.tickers && story.tickers.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #21262d',
                }}>
                  {story.tickers.map((ticker) => (
                    <span
                      key={ticker}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#21262d',
                        color: '#e6edf3',
                      }}
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
              )}

              {/* Disclaimer */}
              <p style={{
                color: '#6e7681',
                fontSize: '11px',
                marginTop: '20px',
                paddingTop: '12px',
                borderTop: '1px solid #21262d',
                lineHeight: 1.4,
              }}>
                FantasyTimes — AI-generated for educational and entertainment purposes. Not financial advice.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
