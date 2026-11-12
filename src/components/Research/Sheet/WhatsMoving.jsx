// src/components/Research/Sheet/WhatsMoving.jsx
//
// The two-view shell's first tab, WHAT'S MOVING (Amendment C §3 item 6, R-27;
// spec docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-7): the "Why is it
// moving?" popup's content, inline, from the same hook (WhyMovingPopup.jsx
// useWhyMoving) and the same body (WhyMovingBody: the catalyst, its type, the
// signals, the peers, what to watch, the sources and the time).
//
// LOADED ON THE PLAYER'S TAP, never on open: the explanation is a provider call
// (/api/why-moving), and this tab is the first one, mounted with the Analysis
// view — so the shell opens with no request the modal did not make before
// (the old Why? door asked on a tap too). Keyed by symbol in ShellTabs, so a
// stock reached by navigation asks again only on its own tap.
//
// The foot line says whose view it is not: *not {Agent}'s view* in battle (the
// player's agent by name, else the archetype); in browse no partner speaks.

import React, { useState } from 'react';
import { useWhyMoving, WhyMovingBody, whyMovingChangeText } from '../WhyMovingPopup.jsx';
import { SHELL_COPY } from './sheetCopy.js';
import { ST, MONO, tint } from './sheetTheme.js';

/**
 * @param {object} p  the popup's own props, as the modal passes them (symbol, name, change, price, open, high, low, close)
 * @param {string|null} [p.who]  whose view it is not (the agent's name, else the archetype); null in browse
 */
export default function WhatsMoving({ symbol, name, change, price, open, high, low, close, who = null }) {
  const [asked, setAsked] = useState(false);
  const { state, data, retry } = useWhyMoving({ symbol, name, change, price, open, high, low, close, active: asked });
  return (
    <div data-shell-moving={asked ? state : 'unasked'} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ST.ink, lineHeight: 1.35 }}>
        {SHELL_COPY.movingTitle(name || symbol, whyMovingChangeText(change))}
      </h3>
      {!asked && (
        <button
          type="button"
          data-shell-moving-ask
          onClick={() => setAsked(true)}
          style={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 48, padding: '0 14px', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10, background: tint(ST.teal, 8), border: `1px solid ${tint(ST.teal, 35)}`,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: ST.ink }}>{SHELL_COPY.movingLookUp}</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 10.5, color: ST.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SHELL_COPY.movingFrom}</span>
          <span aria-hidden="true" style={{ color: ST.teal, fontSize: 16 }}>›</span>
        </button>
      )}
      {asked && <WhyMovingBody state={state} data={data} onRetry={retry} />}
      <div data-shell-moving-foot style={{ fontFamily: MONO, fontSize: 10.5, color: ST.ink3, lineHeight: 1.45 }}>{SHELL_COPY.movingFoot(who)}</div>
    </div>
  );
}
