// src/components/League/backing/AttestationStep.jsx
//
// Backing Beta PR 4 — THE ELIGIBILITY ATTESTATION STEP at the backing entry
// (spec V1.3 §5 "a one-time step — 18+ confirmation and beta-terms
// acceptance"; PR 0's placeholder copy, marked for counsel; Amendment A §A2
// re-attestation on a terms revision, §A3 anonymous accounts refused).
//
// Shown BEFORE the stake control whenever the viewer holds no valid
// attestation (useEligibility, or the stake endpoint's `eligibility_required`
// refusal). The two statements render VERBATIM from src/constants/
// eligibility.js — placeholders counsel replaces before the flip (the
// eligibilityFlags tripwire keeps the flag dark while they carry the marker)
// — and while TERMS_VERSION is still a `-draft` tag the step says so on
// screen, so the placeholder can never read as ratified terms.
//
// The server records the attestation (POST /api/eligibility/attest) and the
// step reports back only on the server's success response; `account_required`
// (an anonymous account) becomes the plain sign-in sentence.

import React, { useState } from 'react';
import { ATTESTATION_COPY, TERMS_VERSION } from '../../../constants/eligibility';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono } from '../LeagueParts';
import { attestEligibility } from '../../../services/backingService';
import { MonoAttr } from './BackingParts';
import { ATTEST, refusalMessage } from './backingCopy';

function Statement({ id, label, text, checked, onChange, accent }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 12px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${checked ? alpha(accent, 0.4) : LTOKENS.hair}`, cursor: 'pointer' }}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, accentColor: accent }} />
      <div style={{ minWidth: 0 }}>
        <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{label}</Mono>
        <div style={{ fontSize: 13, color: LTOKENS.ink, lineHeight: 1.45 }}>{text}</div>
      </div>
    </label>
  );
}

// `attest` (optional) replaces the attestation call — the stake control passes
// its own (the real service unless a host injected one; the dev preview page
// does, answering from fixtures). Omitted, it is the real service.
export default function AttestationStep({ onAttested, accent = LX.energy, attest = attestEligibility }) {
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const draft = typeof TERMS_VERSION === 'string' && /-draft$/.test(TERMS_VERSION);

  const submit = async () => {
    if (!adult || !terms) { setError(ATTEST.incomplete); return; }
    setBusy(true);
    setError(null);
    try {
      await attest(TERMS_VERSION);
      onAttested?.();
    } catch (err) {
      setError(err?.code === 'network' || err?.code === 'account_required' ? refusalMessage(err.code) : ATTEST.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-backing="attestation" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <Eyebrow color={accent} style={{ marginBottom: 5 }}>{ATTEST.eyebrow}</Eyebrow>
        <div style={{ fontSize: 17, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{ATTEST.title}</div>
        <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginTop: 5 }}>{ATTEST.sub}</div>
        {draft && <MonoAttr data-backing="terms-draft" style={{ display: 'block', marginTop: 6, fontSize: 9.5, color: LTOKENS.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{ATTEST.draftNote}</MonoAttr>}
      </div>
      <Statement id="bk-attest-adult" label={ATTEST.adultLabel} text={ATTESTATION_COPY.adult} checked={adult} onChange={setAdult} accent={accent} />
      <Statement id="bk-attest-terms" label={ATTEST.termsLabel} text={ATTESTATION_COPY.terms} checked={terms} onChange={setTerms} accent={accent} />
      {error && <div role="alert" style={{ fontSize: 12, color: LX.neg, lineHeight: 1.4 }}>{error}</div>}
      <button
        type="button"
        className="lg-tap"
        onClick={submit}
        disabled={busy}
        style={{ all: 'unset', boxSizing: 'border-box', cursor: busy ? 'wait' : 'pointer', width: '100%', padding: 13, borderRadius: 13, textAlign: 'center', fontWeight: 700, fontSize: 14, background: accent, color: LTOKENS.bg, opacity: busy ? 0.7 : 1, boxShadow: `0 8px 24px ${alpha(accent, 0.3)}` }}
      >
        {busy ? ATTEST.saving : ATTEST.continue}
      </button>
    </div>
  );
}
