// src/hooks/useEligibility.js
//
// Backing Beta PR 4 — does the viewer hold a VALID attestation? (spec V1.3 §5:
// "The pod list is viewable without it; Confirm requires it"; Amendment A §A2
// D-aa: an attestation under a superseded TERMS_VERSION counts as absent.)
//
// One owner-read of eligibility/{uid}; `refresh` re-reads after the
// attestation endpoint answers. The status is the client's routing hint for
// WHICH step to show first — the stake endpoint re-checks eligibility inside
// its own transaction and its `eligibility_required` refusal re-presents the
// step regardless of what this hook believed (§9: the client never asserts
// an attestation). `unknown` covers a failed read: the step is shown and the
// server decides.

import { useCallback, useEffect, useState } from 'react';
import { TERMS_VERSION } from '../constants/eligibility';
import { readEligibility } from '../services/backingService';

export const ELIGIBILITY = Object.freeze({
  LOADING: 'loading',
  ATTESTED: 'attested',
  REQUIRED: 'required',
  UNKNOWN: 'unknown',
});

export function eligibilityStatusOf(docData) {
  if (!docData) return ELIGIBILITY.REQUIRED;
  return docData.termsVersion === TERMS_VERSION ? ELIGIBILITY.ATTESTED : ELIGIBILITY.REQUIRED;
}

export default function useEligibility(uid, enabled = true) {
  const [status, setStatus] = useState(enabled && uid ? ELIGIBILITY.LOADING : ELIGIBILITY.REQUIRED);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !uid) { setStatus(ELIGIBILITY.REQUIRED); return undefined; }
    let active = true;
    setStatus(ELIGIBILITY.LOADING);
    readEligibility(uid)
      .then((data) => { if (active) setStatus(eligibilityStatusOf(data)); })
      .catch((err) => {
        console.warn('[useEligibility] read failed:', err?.message);
        if (active) setStatus(ELIGIBILITY.UNKNOWN);
      });
    return () => { active = false; };
  }, [enabled, uid, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { status, refresh };
}
