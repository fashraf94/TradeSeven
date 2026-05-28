// src/components/FantasyTimes/DeepdiveMarkdown.jsx
// Library-based markdown renderer for Vera's long-form deepdives.
//
// This is intentionally separate from StoryDetail's renderMarkdownWithPullQuote, which
// stays as the lightweight renderer for the feed/card path and the other reporters. Vera's
// deepdives are full research articles (~26KB: headings, tables, source-citation links,
// blockquotes, lists), so they go through a real renderer: react-markdown + remark-gfm
// (tables, strikethrough, autolinks) + rehype-sanitize (default schema — permits the full
// table set and safe links while stripping scripts/iframes/event-handlers/javascript: URLs).
//
// Styling is inline-only (project convention). Background is transparent so the parent page
// controls the page background.

import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { BROADSHEET_TOKENS, REPORTER_COLORS } from '../../constants/reporterTheme';

const NAVY = REPORTER_COLORS.vera.primary;
// Navy is the brand/accent, but pure navy is unreadable on the dark page background, so
// links use the on-dark accent (lightened navy-family blue) for contrast while keeping
// Vera's identity. See REPORTER_COLORS.vera in reporterTheme.js.
const LINK = REPORTER_COLORS.vera.onDarkAccent;

export default function DeepdiveMarkdown({ markdown, reporterColor = NAVY }) {
  if (!markdown) return null;

  const heading = (size, margin) => ({
    fontFamily: BROADSHEET_TOKENS.fontHeadline,
    fontSize: size,
    fontWeight: 700,
    lineHeight: 1.25,
    color: '#f0f3f7',
    margin,
    textWrap: 'balance',
  });

  const components = {
    h1: ({ children }) => (
      <h1 style={{ ...heading(30, '34px 0 14px'), borderBottom: `2px solid ${reporterColor}`, paddingBottom: 10, fontWeight: 800 }}>{children}</h1>
    ),
    h2: ({ children }) => <h2 style={heading(24, '30px 0 12px')}>{children}</h2>,
    h3: ({ children }) => <h3 style={heading(20, '24px 0 10px')}>{children}</h3>,
    h4: ({ children }) => <h4 style={heading(17, '20px 0 8px')}>{children}</h4>,
    p: ({ children }) => (
      <p style={{ fontFamily: BROADSHEET_TOKENS.fontBody, fontSize: 17, lineHeight: 1.75, color: '#d8dee6', margin: '0 0 18px' }}>{children}</p>
    ),
    a: ({ href, title, children }) => (
      <a href={href} title={title} target="_blank" rel="noopener noreferrer"
        style={{ color: LINK, textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</a>
    ),
    strong: ({ children }) => <strong style={{ color: '#f0f3f7', fontWeight: 700 }}>{children}</strong>,
    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
    ul: ({ children }) => <ul style={{ margin: '0 0 18px', paddingLeft: 24, color: '#d8dee6', fontFamily: BROADSHEET_TOKENS.fontBody, fontSize: 16, lineHeight: 1.7 }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ margin: '0 0 18px', paddingLeft: 24, color: '#d8dee6', fontFamily: BROADSHEET_TOKENS.fontBody, fontSize: 16, lineHeight: 1.7 }}>{children}</ol>,
    li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
    blockquote: ({ children }) => (
      <blockquote style={{ borderLeft: `3px solid ${reporterColor}`, margin: '18px 0', padding: '4px 0 4px 18px', color: '#aeb6c2', fontStyle: 'italic' }}>{children}</blockquote>
    ),
    hr: () => <hr style={{ border: 0, borderTop: `1px solid ${BROADSHEET_TOKENS.sectionRule || 'rgba(60,73,77,0.4)'}`, margin: '28px 0' }} />,
    code: ({ className, children }) => (
      <code className={className} style={{ fontFamily: BROADSHEET_TOKENS.fontMono, fontSize: '0.9em', background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4 }}>{children}</code>
    ),
    pre: ({ children }) => (
      <pre style={{ background: '#11161d', padding: 14, borderRadius: 8, overflowX: 'auto', margin: '0 0 18px', fontFamily: BROADSHEET_TOKENS.fontMono, fontSize: 13, lineHeight: 1.5 }}>{children}</pre>
    ),
    // Tables: horizontal scroll on overflow (mobile), clean dark-theme borders.
    table: ({ children }) => (
      <div style={{ overflowX: 'auto', margin: '0 0 20px', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: BROADSHEET_TOKENS.fontBody, fontSize: 14, color: '#d8dee6' }}>{children}</table>
      </div>
    ),
    th: ({ children, style }) => (
      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${reporterColor}`, background: 'rgba(255,255,255,0.04)', fontWeight: 700, color: '#f0f3f7', whiteSpace: 'nowrap', ...style }}>{children}</th>
    ),
    td: ({ children, style }) => (
      <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(110,118,129,0.3)', verticalAlign: 'top', ...style }}>{children}</td>
    ),
  };

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={components}
    >
      {markdown}
    </Markdown>
  );
}
