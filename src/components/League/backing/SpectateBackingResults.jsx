// src/components/League/backing/SpectateBackingResults.jsx
//
// Backing Beta PR 5 — THE RESULTS CARD IN THE SPECTATE FINAL STATE (spec V1.3
// §5 "Results card (after settlement), in the Spectate final state"; design
// brief §E "the results surface lives in spectate's finished state"). Mounted
// BARE by LeagueSpectate; gated at CALL time on BACKING_BETA_ENABLED (the
// BackingLandingStrip shape: the outer component holds no hook) so the
// flag-off Spectate is byte-identical and opens no read. Renders only for a
// FINAL base-layer pod; the fetch is the viewer's own result for that pod
// (GET /api/backing/results?groupId=…), which also runs settle-on-read
// server-side. Emits `results_viewed` once per session per pod (§10).

import React, { useEffect } from 'react';
import { BACKING_BETA_ENABLED } from '../../../config/featureFlags';
import { LTOKENS, LX } from '../leagueTokens';
import { Eyebrow } from '../LeagueParts';
import useBackingResults from '../../../hooks/useBackingResults';
import { BACKING_EVENT, emitBackingEvent } from '../../../services/backingTelemetry';
import BackingResultsCard from './BackingResultsCard';
import { RESULTS } from './backingCopy';

function SpectateBackingResultsLive({ groupId, accent }) {
  const results = useBackingResults({ groupId, enabled: true });
  const pod = results.pod;
  useEffect(() => {
    if (!pod || pod.outcome === 'open') return;
    emitBackingEvent(BACKING_EVENT.RESULTS_VIEWED, { groupId, props: typeof pod.weekKey === 'string' ? { weekKey: pod.weekKey } : {} });
  }, [groupId, pod]);
  // Nothing while loading or when the pod has no pool: no reserved space, no
  // guess at a result.
  if (!pod || pod.outcome === 'open') return null;
  return (
    <div data-backing="spectate-results" style={{ marginTop: 18 }}>
      <Eyebrow color={LTOKENS.ink3} style={{ marginBottom: 8 }}>{RESULTS.podEyebrow}</Eyebrow>
      <BackingResultsCard pod={pod} accent={accent} />
    </div>
  );
}

/** The Spectate mount. Renders nothing — and runs nothing — while the flag is dark, and nothing for a live or bracket pod. */
export default function SpectateBackingResults({ pod, accent = LX.energy }) {
  if (!BACKING_BETA_ENABLED) return null;
  if (!pod || pod.base !== true || pod.status !== 'final' || typeof pod.id !== 'string' || pod.id.length === 0) return null;
  return <SpectateBackingResultsLive groupId={pod.id} accent={accent} />;
}
