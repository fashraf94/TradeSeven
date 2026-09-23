// src/components/League/backing/BackingResults.jsx
//
// Backing Beta PR 5 — THE RESULTS SECTION of the Backing screen: the last
// completed week's cards first, earlier weeks on demand (spec V1.3 §5; the
// strip's between-state — "Last week's result" — opens the screen onto this).
// Owns the one read (useBackingResults, weeks newest first, one week per
// page) and the `results_viewed` emit per pool card (§10); the cards are the
// pure BackingResultsCard. Rendered only inside the lit screen, so it never
// runs while dark.

import React, { useEffect } from 'react';
import { LTOKENS, LX } from '../leagueTokens';
import { Eyebrow, Mono } from '../LeagueParts';
import useBackingResults from '../../../hooks/useBackingResults';
import { BACKING_EVENT, emitBackingEvent } from '../../../services/backingTelemetry';
import BackingResultsCard from './BackingResultsCard';
import { RESULTS } from './backingCopy';

/** The outcomes that ARE a result. */
const RESULT_OUTCOMES = new Set(['settled', 'refunded', 'insufficient']);

export default function BackingResults({ uid, accent = LX.energy, onOpenTape = null }) {
  const results = useBackingResults({ limit: 1, enabled: Boolean(uid) });
  const { weeks } = results;
  // `results_viewed` is §10's last funnel stage: recorded for a pool that
  // SHOWS a result, never for one still waiting on it (HON-R-2).
  useEffect(() => {
    for (const week of weeks) {
      for (const pod of Array.isArray(week?.pools) ? week.pools : []) {
        if (!RESULT_OUTCOMES.has(pod?.outcome)) continue;
        emitBackingEvent(BACKING_EVENT.RESULTS_VIEWED, { groupId: pod.groupId, props: typeof week.weekKey === 'string' ? { weekKey: week.weekKey } : {} });
      }
    }
  }, [weeks]);
  if (!uid) return null;
  if (results.loading && weeks.length === 0) return <Mono style={{ display: 'block', fontSize: 11, color: LTOKENS.ink3, marginBottom: 14 }}>{RESULTS.loading}</Mono>;
  if (weeks.length === 0) return null;
  return (
    <div data-backing="results-section" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
      <Eyebrow color={LTOKENS.gold}>{RESULTS.eyebrow}</Eyebrow>
      {weeks.map((week) => (
        <div key={week.weekKey} data-backing="results-week" data-week={week.weekKey} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{RESULTS.weekTitle(week.weekKey)}</Mono>
          {(Array.isArray(week.pools) ? week.pools : []).map((pod) => (
            <BackingResultsCard key={pod.groupId} pod={pod} accent={accent} onOpenTape={onOpenTape} />
          ))}
        </div>
      ))}
      {results.nextBefore && (
        <button type="button" className="lg-tap" data-backing="results-more" onClick={results.loadMore} disabled={results.loadingMore} style={{ all: 'unset', cursor: 'pointer', alignSelf: 'flex-start', padding: '7px 11px', borderRadius: 10, border: `1px solid ${LTOKENS.hair2}`, color: LTOKENS.ink2, fontSize: 12, fontWeight: 600 }}>
          {results.loadingMore ? RESULTS.loadingMore : RESULTS.loadMore}
        </button>
      )}
    </div>
  );
}
