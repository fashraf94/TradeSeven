// src/components/Dashboard/deployCeremony/DueIdeaInterstitial.jsx
//
// Pilot P1c — founder ruling E1 (16 Oct 2026; pilot spec Amendment E): the ONE
// screen a deploy shows, BEFORE any deploy call, when the agent's equipped
// idea is due for review with no ready successor (src/services/dueIdeaCheck.js).
// A due idea never blocks the deploy: every button deploys. Table C V1.2:
//
//   title   "Your [SYM|LIST] idea reached its time-frame." — founder ruling B3's
//           rule (the idea's one symbol, else the FROZEN list name); neither
//           known → no title, never an invented one.
//   1 Reaffirm and deploy — the existing reaffirm route, then the deploy: the
//                           fresh version v{n+1} is `ready`, so it rides.
//   2 Retire and deploy   — the existing transition route (retire), then the
//                           deploy: nothing rides.
//   3 Deploy without it   — the deploy alone: nothing rides, the idea stays due.
//
// No fourth option and no "Try again". When the reaffirm or the retire fails
// (a typed refusal, a lost response), the deploy does NOT go ahead — that
// would put "deploy without it" in place of the action the player chose: the
// screen says what the server said (its typed message, else the Forge panel's
// own failure line) and the same three buttons stay. The next press re-reads
// the idea first, so a reaffirm whose response was lost is seen as done and
// never repeated, and an idea resolved elsewhere simply deploys.
//
// Portaled to <body> at the ceremony's layer (z:1010); the ceremony itself
// opens only once a button is chosen. Colors are the dashboard's CMD tokens.

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CMD, alpha } from '../commandUI';
import useModalFocus from '../../../hooks/useModalFocus';
import { DUE_DEPLOY_ACTIONS, PANEL_COPY } from '../../Forge/Watchlist/ideaCopy';
import { reaffirmHypothesis, transitionHypothesis, newOpId } from '../../../services/hypothesisVersionService';
import { readDueIdea } from '../../../services/dueIdeaCheck';

const Z_INDEX = 1010; // the Deploy Ceremony's layer (DeployCeremony.jsx)

/** A refusal's words: the server's typed message, else the Idea panel's failure line (IdeaPanel.jsx messageOf). */
function messageOf(err) {
  return typeof err?.status === 'number' && err?.body && typeof err.body.message === 'string' ? err.body.message : PANEL_COPY.moveFailed;
}

/**
 * @param {{ due: { watchlistId: string, version: number, currentVersion: number, title: string|null },
 *           accent?: string, onProceed: () => void }} props
 *   `onProceed` runs the deploy (the shell skips its own idea check for it).
 */
export default function DueIdeaInterstitial({ due: initialDue, accent = CMD.teal, onProceed }) {
  const containerRef = useRef(null);
  useModalFocus({ isOpen: true, autoFocusRef: containerRef, containerRef });
  const [due, setDue] = useState(initialDue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const staleRef = useRef(false); // a failed step: the next press re-reads the idea first

  const choose = async (id) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (id !== 'without') {
      try {
        let target = due;
        if (staleRef.current) {
          target = await readDueIdea(due.watchlistId);
          staleRef.current = false;
          // Nothing is due any more (the earlier step landed after all, or the idea moved elsewhere): just deploy.
          if (target) setDue(target);
        }
        if (target && id === 'reaffirm') {
          await reaffirmHypothesis(target.watchlistId, { version: target.version, opId: newOpId(), expectedVersion: target.currentVersion });
        } else if (target && id === 'retire') {
          await transitionHypothesis(target.watchlistId, { version: target.version, action: 'retire', expectedStatus: 'review_due' });
        }
      } catch (err) {
        staleRef.current = true;
        setError(messageOf(err));
        setBusy(false);
        return;
      }
    }
    onProceed();
  };

  return createPortal(
    <div
      ref={containerRef}
      className="due-idea-interstitial"
      data-testid="due-idea-interstitial"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={due.title ? 'due-idea-title' : undefined}
      aria-label={due.title ? undefined : DUE_DEPLOY_ACTIONS.map((a) => a.label).join(', ')}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: Z_INDEX, outline: 'none',
        boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto',
        background: 'rgba(8,9,12,0.94)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 0 calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}
    >
      <style>{'.due-idea-interstitial, .due-idea-interstitial * { box-sizing: border-box; }'}</style>
      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '0 22px', textAlign: 'center' }}>
        {due.title && (
          <div id="due-idea-title" data-testid="due-idea-title" style={{ fontSize: 18, fontWeight: 600, color: CMD.ink, lineHeight: 1.4, marginBottom: 18 }}>
            {due.title}
          </div>
        )}
        {error && (
          <div
            role="alert"
            data-testid="due-idea-error"
            style={{
              fontSize: 12.5, lineHeight: 1.5, color: CMD.ink2, background: CMD.surface,
              border: `1px solid ${CMD.hair}`, borderRadius: 12, padding: '10px 12px', marginBottom: 14,
              textAlign: 'left', wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="due-idea-actions">
          {DUE_DEPLOY_ACTIONS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              data-action={a.id}
              disabled={busy}
              onClick={() => choose(a.id)}
              style={{
                width: '100%', padding: '14px', borderRadius: 13, fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.55 : 1,
                border: `1px solid ${i === 0 ? alpha(accent, 0.5) : CMD.hair}`,
                background: i === 0 ? alpha(accent, 0.14) : 'transparent',
                color: i === 0 ? accent : CMD.ink2,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
