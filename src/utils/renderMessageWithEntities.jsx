import React from 'react';
import { scanEntities, ENTITY_KIND } from './findKnownTickers';

// Entity detection in chat messages (Phase 2.5 Voice Layer Rework).
//
// Each [A-Z]{1,5} match is resolved against, in order:
//   1. knownTickers (battle roster) → teal ticker span → opens AssetResearchModal
//   2. TERM_TOKENS_SET (Phase 2.5)  → amber term span  → opens TermResearchModal
//   3. fallthrough                  → plain text (no highlight, no broken modal)
//
// The fallthrough branch prevents arbitrary uppercase acronyms (VWAP, PCE, RSI)
// from routing to a broken AssetResearchModal.

export const TICKER_ACCENT = '#5EEAD4';
export const TERM_ACCENT = '#f59e0b';

export function renderMessageWithEntities(text, onSymbolClick, knownTickers) {
  // Defensive: a malformed agentResponse (e.g., object rather than string from
  // a server contract violation or legacy doc shape) would otherwise return
  // through the lastIndex===0 fallthrough and React would throw
  // "Objects are not valid as a React child" at the call site.
  if (typeof text !== 'string') return '';
  if (!text || !onSymbolClick) return text;

  const parts = [];
  let lastIndex = 0;

  // A2.3 (ruling 8): the scan is `findKnownTickers.js`'s, so the underline the
  // player sees and the `In the chat · {n}` count are the same rule by
  // construction. The loop below is otherwise the shipped one — the golden
  // proves the output is byte-identical.
  for (const { word, index, kind } of scanEntities(text, knownTickers)) {
    const isTicker = kind === ENTITY_KIND.TICKER;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    if (isTicker) {
      parts.push(
        <span
          key={index}
          role="button"
          tabIndex={0}
          aria-label={`Open research for ${word}`}
          onClick={() => onSymbolClick({ symbol: word })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSymbolClick({ symbol: word });
            }
          }}
          style={{
            color: TICKER_ACCENT,
            cursor: 'pointer',
            borderBottom: '1px dotted rgba(94, 234, 212, 0.4)',
          }}
        >
          {word}
        </span>
      );
    } else {
      parts.push(
        <span
          key={index}
          role="button"
          tabIndex={0}
          aria-label={`Open glossary for ${word}`}
          onClick={() => onSymbolClick({ type: 'term', token: word })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSymbolClick({ type: 'term', token: word });
            }
          }}
          style={{
            color: TERM_ACCENT,
            cursor: 'pointer',
            borderBottom: '1px dotted rgba(245, 158, 11, 0.4)',
          }}
        >
          {word}
        </span>
      );
    }

    lastIndex = index + word.length;
  }

  if (lastIndex === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// Type-driven rendering config (Phase 1 Voice Layer Rework, spec §4.6). Adding
// a new agent-initiated messageType (trade_narration, anticipation, etc.) only
// requires extending this map — no MessageBubble branches.
export const RENDER_CONFIG = {
  user_initiated:    { accent: '#5EEAD4', label: null },
  auto_debrief:      { accent: '#f59e0b', label: { emoji: '📋', text: 'Post-Market Debrief' } },
  first_message:     { accent: '#5EEAD4', label: null },
  trade_narration:   { accent: '#5EEAD4', label: null },
  anticipation:      { accent: '#5EEAD4', label: null },
};

export function resolveMessageType(message) {
  if (message?.messageType && RENDER_CONFIG[message.messageType]) return message.messageType;
  if (message?.isAutoDebrief) return 'auto_debrief';
  return 'user_initiated';
}
