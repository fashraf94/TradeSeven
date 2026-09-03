// src/components/Dashboard/deployCeremony/CeremonyError.jsx
//
// Deploy Ceremony · error / fallback surface (spec §8). Net-new UI: today a
// failed deploy silently re-enables the button. data.details is shown when
// present; retry respects the server's 120s deploy lock.
//
// TERMINAL-STATE HONESTY (PR 2). The headline is selected by the VERIFICATION
// OUTCOME, not by the error's shape:
//
//   'confirmed'    — a server terminal-error signal AND an empty `agentBattles`
//                    query. Both are required before the client may assert that
//                    no battle was created. These strings may say so.
//   'lost_contact' — the check threw, timed out, could not run, or came back
//                    empty with no server error signal. We do not know what
//                    happened, and the copy must not pretend otherwise: a check
//                    that could not complete has learned nothing and must not
//                    author a stronger claim than the one it replaced.
//
// `errorKind` is retained as DIAGNOSTIC context — it still selects among the
// confirmed headlines and rides alongside `details` — but it is no longer the
// sole headline selector. Defaulting `errorTone` to 'lost_contact' is deliberate:
// an unstated outcome must fail toward the weaker claim, never the stronger one.

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { CMD, alpha, Mono, Eyebrow } from '../commandUI';

function safeDetails(details) {
  if (typeof details === 'string') return details;
  try { return JSON.stringify(details); } catch { return String(details); }
}

// CONFIRMED failures only. Every one of these asserts non-creation, which the
// verification has actually established.
const HEADLINE = {
  deploy: () => 'Deployment failed — no battle was created.',
  server: () => 'Deployment failed — no battle was created.',
  // errorPhase 'post_decision' softening (spec §8, nice-to-have).
  server_post: (name) => `${name} made its picks, but the battle couldn’t be created.`,
  timeout: () => 'Deployment timed out — no battle was created.',
};

// LOST CONTACT. Says what is true — we stopped being able to tell — and points
// at the one place the answer will show up. It claims nothing about creation.
const LOST_CONTACT_HEADLINE = 'Couldn’t confirm the deploy.';
const LOST_CONTACT_EYEBROW = 'Deployment unconfirmed';
const LOST_CONTACT_SUBTEXT = 'Your agent is safe. If the battle was created it will appear on your hub — check there before deploying again.';
const CONFIRMED_SUBTEXT = 'Your agent is safe. Nothing is stuck — you can try again shortly.';

export default function CeremonyError({
  accent = CMD.copper, agentName = 'Your agent', errorKind = 'deploy',
  errorTone = 'lost_contact',
  details, cooldownUntil = 0, onRetry, onDismiss,
}) {
  const confirmed = errorTone === 'confirmed';
  const headline = confirmed
    ? (HEADLINE[errorKind] || HEADLINE.deploy)(agentName)
    : LOST_CONTACT_HEADLINE;
  // Tick a local clock so the retry countdown actually decrements and re-enables
  // when the server's 120s lock expires (the stage machine stops re-rendering
  // once in 'error').
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [cooldownUntil]);
  const remaining = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0;
  const retrySecs = Math.ceil(remaining / 1000);
  const canRetry = Boolean(onRetry) && remaining === 0;

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '0 22px', textAlign: 'center' }}>
      <div style={{
        width: 54, height: 54, borderRadius: '50%', margin: '0 auto 18px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: alpha(CMD.copper, 0.12),
        border: `1px solid ${alpha(CMD.copper, 0.34)}`,
      }}>
        <AlertTriangle size={26} color={CMD.copper} />
      </div>

      <Eyebrow color={CMD.copper} style={{ marginBottom: 8 }}>{confirmed ? 'Deployment failed' : LOST_CONTACT_EYEBROW}</Eyebrow>
      <div style={{ fontSize: 18, fontWeight: 600, color: CMD.ink, lineHeight: 1.4, marginBottom: 12 }}>{headline}</div>

      {details && (
        <div style={{
          fontSize: 12.5, lineHeight: 1.5, color: CMD.ink2, background: CMD.surface,
          border: `1px solid ${CMD.hair}`, borderRadius: 12, padding: '10px 12px', marginBottom: 14,
          textAlign: 'left', wordBreak: 'break-word',
        }}>
          {safeDetails(details)}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        {onRetry && (
          <button
            type="button"
            onClick={canRetry ? onRetry : undefined}
            disabled={!canRetry}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%',
              padding: '14px', borderRadius: 13, border: `1px solid ${alpha(accent, 0.5)}`,
              background: canRetry ? alpha(accent, 0.14) : 'transparent', color: canRetry ? accent : CMD.ink3,
              fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: canRetry ? 'pointer' : 'default',
            }}
          >
            <RotateCcw size={16} />
            {canRetry ? 'Try again' : `Retry available in ${retrySecs}s`}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
            padding: '13px', borderRadius: 13, border: 'none', background: 'transparent', color: CMD.ink2,
            fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={15} /> Back to hub
        </button>
      </div>

      {/* The existing subtext was already more honest than the headline it sat
          under; on the lost-contact path it now also says where the answer is. */}
      <Mono style={{ display: 'block', fontSize: 10.5, letterSpacing: '0.06em', color: CMD.ink3, marginTop: 14, lineHeight: 1.5 }}>
        {confirmed ? CONFIRMED_SUBTEXT : LOST_CONTACT_SUBTEXT}
      </Mono>
    </div>
  );
}
