// src/components/Dashboard/deployCeremony/CeremonyError.jsx
//
// Deploy Ceremony · error / fallback surface (spec §8). Net-new UI: today a
// failed deploy silently re-enables the button. The copy is precise — "no battle
// was created", never "nothing was committed" (false on the post-persistence
// path, where the stored decision DID change). data.details is shown when
// present; retry respects the server's 120s deploy lock.

import React from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { CMD, alpha, Mono, Eyebrow } from '../commandUI';

const HEADLINE = {
  deploy: () => 'Deployment failed — no battle was created.',
  server: () => 'Deployment failed — no battle was created.',
  // errorPhase 'post_decision' softening (spec §8, nice-to-have).
  server_post: (name) => `${name} made its picks, but the battle couldn’t be created.`,
  timeout: () => 'Deployment timed out — no battle was created.',
};

export default function CeremonyError({
  accent = CMD.copper, agentName = 'Your agent', errorKind = 'deploy',
  details, cooldownRemainingMs = 0, onRetry, onDismiss,
}) {
  const headline = (HEADLINE[errorKind] || HEADLINE.deploy)(agentName);
  const retrySecs = cooldownRemainingMs > 0 ? Math.ceil(cooldownRemainingMs / 1000) : 0;
  const canRetry = Boolean(onRetry) && retrySecs === 0;

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '0 22px', textAlign: 'center' }}>
      <div style={{
        width: 54, height: 54, borderRadius: '50%', margin: '0 auto 18px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: alpha(CMD.copper, 0.12),
        border: `1px solid ${alpha(CMD.copper, 0.34)}`,
      }}>
        <AlertTriangle size={26} color={CMD.copper} />
      </div>

      <Eyebrow color={CMD.copper} style={{ marginBottom: 8 }}>Deployment failed</Eyebrow>
      <div style={{ fontSize: 18, fontWeight: 600, color: CMD.ink, lineHeight: 1.4, marginBottom: 12 }}>{headline}</div>

      {details && (
        <div style={{
          fontSize: 12.5, lineHeight: 1.5, color: CMD.ink2, background: CMD.surface,
          border: `1px solid ${CMD.hair}`, borderRadius: 12, padding: '10px 12px', marginBottom: 14,
          textAlign: 'left', wordBreak: 'break-word',
        }}>
          {typeof details === 'string' ? details : JSON.stringify(details)}
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

      <Mono style={{ display: 'block', fontSize: 10.5, letterSpacing: '0.06em', color: CMD.ink3, marginTop: 14, lineHeight: 1.5 }}>
        Your agent is safe. Nothing is stuck — you can try again shortly.
      </Mono>
    </div>
  );
}
