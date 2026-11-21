// src/components/Explore/useExploreResearch.js
//
// Explore Build 1 — THE ONE RESEARCH READ (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md
// §5.3, N-4, N-8, N-9; build prompt K-3, K-4). This file is the research service's one
// reader outside the sheet (src/components/SharedResearch/sharedResearch.boundary.test.js
// EXPLORE_READER): it imports exactly `{ readExploreInvestigations }` and nothing else of it.
//
// WHEN IT READS, and never otherwise:
//   - once when it mounts (the Search page with the switch not 'off', ExploreRuntime.jsx), and
//     again only if the player changes under it;
//   - once after each close of the sheet (`reread`, quiet: the page keeps what it shows until
//     the answer lands, so the panel's button never leaves while the read runs);
//   - once per tap of Try again (`retry`: the view goes back to loading, so a second tap has
//     no button to press).
// No timer, no listener, no retry of its own. It never opens, steps, edits or closes anything.
//
// THE VIEW (exploreView.js researchViewOf): loading · ready (quota, items by story) · gated (the
// service's `gated`, a 404 disabled) · failed (a 401, a 429, no answer, anything else).
// An answer is applied only if it is the newest read's and was sent for the player still here:
// an answer for a player who has since signed out or changed is dropped (K-4).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readExploreInvestigations } from '../../services/sharedResearchService';
import { RESEARCH, researchViewOf } from './exploreView';

const LOADING = Object.freeze({ status: RESEARCH.LOADING });

export default function useExploreResearch({ ownerKey = null } = {}) {
  const [view, setView] = useState(LOADING);
  const owner = useRef(ownerKey);
  const seq = useRef(0);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const read = useCallback(({ quiet = false } = {}) => {
    const sentFor = owner.current;
    seq.current += 1;
    const n = seq.current;
    // A quiet read keeps the view and marks it `refreshing` until the answer replaces it: the panel keeps its button
    // (and the focus on it) but the button does not act meanwhile (review B-10).
    if (!quiet) setView(LOADING);
    else setView((v) => (v.status === RESEARCH.LOADING || v.refreshing ? v : { ...v, refreshing: true }));
    return Promise.resolve()
      .then(() => readExploreInvestigations())
      .then(researchViewOf, () => researchViewOf(null))
      .then((next) => {
        if (!live.current || n !== seq.current || owner.current !== sentFor) return; // stale: dropped
        setView(next);
      });
  }, []);

  // At mount, and for a different player: one read. The owner is set before the read is sent. Development
  // StrictMode re-runs this effect on the same mount: the second run finds the read already sent for this owner.
  const readFor = useRef(undefined);
  useEffect(() => {
    owner.current = ownerKey;
    if (readFor.current === ownerKey) return;
    readFor.current = ownerKey;
    read();
  }, [ownerKey, read]);

  const reread = useCallback(() => read({ quiet: true }), [read]);
  const retry = useCallback(() => read(), [read]);
  // One object per view (the runtime hands it up the tree; a fresh object per render would loop)
  return useMemo(() => ({ ...view, reread, retry }), [view, reread, retry]);
}
