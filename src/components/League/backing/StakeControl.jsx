/* eslint-disable react-refresh/only-export-components -- pure helpers co-located with the surface that consumes them, by design (the LeagueParts precedent) */
// src/components/League/backing/StakeControl.jsx
//
// Backing Beta PR 4 — SURFACE C, the stake control (spec V1.3 §5 "Stake
// control", §4 the Confirm step's three lines, §8 one transaction per stake,
// §9 honesty; design brief §2.C; Amendment A §A2/§A3 through the attestation
// step). The design's `backing-stake.jsx` was not in the attached bundle;
// this control is built from the briefs' contract with the bundle's parts
// (PointsMeter, Disclosures) and the League's button vocabulary.
//
//   · Presets 100 / 250 / 500 and a custom amount; the per-team cap and the
//     remaining allowance from the wallet state the endpoints return (the
//     owner-read wallet doc, and the stake reply's `allowanceRemaining`).
//   · THE THREE DISCLOSURE LINES sit directly above Confirm, from
//     src/constants/backing.js, never re-typed, never collapsed, never an icon.
//   · ATTESTATION FIRST: no valid attestation (useEligibility, or the stake
//     endpoint's `eligibility_required`) shows the AttestationStep before the
//     control; `account_required` shows the plain sign-in sentence.
//   · Each Confirm generates a FRESH requestId (newRequestId), and "Backed"
//     renders ONLY from the server's success reply — never optimistically,
//     never from the request. Every refusal reason maps to one plain sentence
//     in backingCopy.js.
//   · Nothing here shows a pot, a share or a payout: the reply's pool
//     projection carries only the capped signals and the close, and the
//     control does not render even those — the pod list does.
//   · THE TEAM IS NAMED BY THE SERVER (Amendment C §C1, D-af): the cap line and
//     the confirmation read the seat's `label` — the team card's, and on
//     "Backed" the stake reply's own `teamLabel` — never a name composed from
//     an id. The title keeps the card's human-and-agent unit.

import React, { useEffect, useMemo, useState } from 'react';
import { MIN_STAKE_BP, PER_TEAM_CAP_BP } from '../../../constants/backing';
import { LTOKENS, LX, alpha, MONO } from '../leagueTokens';
import { Eyebrow, Mono, Icon } from '../LeagueParts';
import { attestEligibility, newRequestId, placeStake } from '../../../services/backingService';
import { ELIGIBILITY } from '../../../hooks/useEligibility';
import AttestationStep from './AttestationStep';
import { Disclosures, MonoAttr, PointsMeter } from './BackingParts';
import { ATTEST, CARD, STAKE, STAKE_PRESETS, bp, refusalMessage } from './backingCopy';
import { stakedOnTeam } from './backingStakes';
import { teamLabelOf } from './backingStripState';

/** Client-side pre-check of an amount — the server decides; this only saves a round trip. */
export function validateAmount(amount, { capLeft, allowanceLeft }) {
  if (!Number.isInteger(amount)) return STAKE.notWhole;
  if (amount < MIN_STAKE_BP) return STAKE.belowMin;
  if (amount > capLeft) return STAKE.aboveCap;
  if (amount > allowanceLeft) return STAKE.aboveAllowance;
  return null;
}

const presetStyle = (on, accent, disabled) => ({
  all: 'unset', boxSizing: 'border-box', flex: 1, cursor: disabled ? 'default' : 'pointer', textAlign: 'center', padding: '11px 0', borderRadius: 11,
  fontFamily: MONO, fontSize: 14, fontWeight: 700, color: disabled ? LTOKENS.ink3 : on ? LTOKENS.bg : LTOKENS.ink,
  background: on ? accent : LTOKENS.surface, border: `1px solid ${on ? accent : LTOKENS.hair2}`, opacity: disabled ? 0.5 : 1,
});

/**
 * `services` (optional) replaces the calls this control makes — placeStake,
 * newRequestId, attestEligibility — so a host can answer them without the
 * network. Only the dev preview page passes it (fixture answers, nothing
 * saved); omitted, each call is the real service, exactly as before.
 */
export default function StakeControl({ card, pod, wallet, eligibility, accent = LX.energy, onBacked, onClose, services = null }) {
  const place = services?.placeStake ?? placeStake;
  const nextRequestId = services?.newRequestId ?? newRequestId;
  const attest = services?.attestEligibility ?? attestEligibility;
  const name = card.team.displayName;
  const agentName = card.team.agent?.name ?? CARD.agentFallbackName(name);
  // The seat's single-label name (D-af): the server's, off the team card.
  const label = teamLabelOf(card.team.label);
  const already = stakedOnTeam(pod, card.odUserId);
  const capLeft = Math.max(0, PER_TEAM_CAP_BP - already);
  // The wallet is the server's record; until its first snapshot has landed
  // (or if the read failed) the allowance is UNKNOWN — never shown as the full
  // 1,000 (FAB-10, the PR 4 review record).
  const walletKnown = wallet?.known === true && Number.isFinite(wallet?.left);
  const allowanceLeft = walletKnown ? wallet.left : 0;
  const maxAmount = Math.min(capLeft, allowanceLeft);

  // The largest preset the allowance and the cap admit; below the smallest
  // preset the minimum stake, when it fits; otherwise nothing is pre-chosen
  // and Confirm waits for an amount (never "Confirm 0 BP").
  const defaultPreset = useMemo(() => [...STAKE_PRESETS].reverse().find((p) => p <= maxAmount) ?? (maxAmount >= MIN_STAKE_BP ? MIN_STAKE_BP : null), [maxAmount]);
  const [preset, setPreset] = useState(defaultPreset);
  const [touched, setTouched] = useState(false);
  // Until the viewer chooses, the pre-chosen preset follows the allowance and
  // the cap as they become known (the wallet can land after the control; R-A-8).
  useEffect(() => { if (!touched) setPreset(defaultPreset); }, [defaultPreset, touched]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [needsAttest, setNeedsAttest] = useState(false);

  const amount = custom.length > 0 ? Number(custom) : preset;

  const confirm = async () => {
    const problem = validateAmount(amount, { capLeft, allowanceLeft });
    if (problem) { setError(problem); return; }
    const requestId = nextRequestId();
    setBusy(true);
    setError(null);
    try {
      const body = await place({ groupId: card.groupId, teamOdUserId: card.odUserId, amount, requestId });
      // "Backed" only from the server's success reply — and only with the
      // amount THAT reply carries: a reply without its stake is not a stake
      // (FAB-11, the PR 4 review record). The pod list re-reads the ledger
      // (`onBacked` → refresh) so the §B6 line and the strip follow the record.
      if (!Number.isFinite(body?.stake?.amount)) throw Object.assign(new Error('stake reply without a stake'), { code: 'server_error' });
      setResult(body);
      onBacked?.(body);
    } catch (err) {
      if (err?.code === 'eligibility_required') setNeedsAttest(true);
      setError(refusalMessage(err?.code));
    } finally {
      setBusy(false);
    }
  };

  const status = eligibility?.status ?? ELIGIBILITY.REQUIRED;
  if (status === ELIGIBILITY.LOADING) {
    return <MonoAttr data-backing="stake-checking" style={{ fontSize: 11, color: LTOKENS.ink3 }}>{ATTEST.checking}</MonoAttr>;
  }
  if (status !== ELIGIBILITY.ATTESTED || needsAttest) {
    return (
      <AttestationStep
        accent={accent}
        attest={attest}
        onAttested={() => { setNeedsAttest(false); setError(null); eligibility?.refresh?.(); }}
      />
    );
  }

  if (!walletKnown && !result) {
    return <MonoAttr data-backing="wallet-checking" style={{ fontSize: 11, color: LTOKENS.ink3 }}>{STAKE.walletPending}</MonoAttr>;
  }

  if (result) {
    const backedAmount = result.stake.amount;
    // The reply's own name for the team — the server confirmed THIS stake.
    const backedLabel = teamLabelOf(result.teamLabel ?? card.team.label);
    return (
      <div data-backing="backed" style={{ borderRadius: 16, padding: '16px 15px', background: `linear-gradient(160deg, ${alpha(accent, 0.12)}, ${LTOKENS.surface} 64%)`, border: `1px solid ${alpha(accent, 0.3)}`, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: LTOKENS.ink }}>
          <Icon name="check" size={16} color={accent} stroke={2.4} />{STAKE.backed(backedAmount, backedLabel)}
        </div>
        <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginTop: 6 }}>{STAKE.backedSub}</div>
        {result?.replay === true && <Mono style={{ display: 'block', marginTop: 6, fontSize: 10, color: LTOKENS.ink3 }}>{STAKE.replayed}</Mono>}
        <button type="button" className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', marginTop: 14, padding: '10px 16px', borderRadius: 11, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, fontSize: 13, fontWeight: 600, color: LTOKENS.ink }}>{STAKE.another}</button>
      </div>
    );
  }

  const atCap = maxAmount < MIN_STAKE_BP;
  return (
    <div data-backing="stake-control" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow color={accent} style={{ marginBottom: 5 }}>{STAKE.eyebrow}</Eyebrow>
        <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{STAKE.title(name, agentName)}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <PointsMeter left={allowanceLeft} total={wallet?.total ?? 0} compact />
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, textAlign: 'right' }}>{STAKE.cap(already, label)}</Mono>
      </div>

      {atCap ? (
        <div data-backing="cap-reached" style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, padding: '11px 12px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
          {capLeft < MIN_STAKE_BP ? STAKE.capReached(label) : STAKE.aboveAllowance}
        </div>
      ) : (
        <>
          <div>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{STAKE.presets}</Mono>
            <div style={{ display: 'flex', gap: 8 }}>
              {STAKE_PRESETS.map((p) => {
                const disabled = p > maxAmount;
                const on = custom.length === 0 && preset === p;
                return (
                  <button key={p} type="button" className="lg-tap" disabled={disabled} onClick={() => { setTouched(true); setPreset(p); setCustom(''); setError(null); }} style={presetStyle(on, accent, disabled)} data-preset={p}>
                    {bp(p)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{STAKE.custom}</Mono>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_STAKE_BP}
              max={maxAmount}
              step={1}
              value={custom}
              onChange={(e) => { setTouched(true); setCustom(e.target.value.replace(/[^0-9]/g, '')); setError(null); }}
              placeholder={STAKE.customPlaceholder(maxAmount)}
              aria-label={STAKE.custom}
              data-backing="custom-amount"
              style={{ all: 'unset', boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 11, fontFamily: MONO, fontSize: 14, color: LTOKENS.ink, background: LTOKENS.surface, border: `1px solid ${custom ? alpha(accent, 0.5) : LTOKENS.hair2}` }}
            />
          </div>
        </>
      )}

      <div>
        <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{STAKE.disclosuresTitle}</Mono>
        <Disclosures />
      </div>

      {error && <div role="alert" data-backing="stake-error" style={{ fontSize: 12, color: LX.neg, lineHeight: 1.4 }}>{error}</div>}

      <button
        type="button"
        className="lg-tap"
        data-backing="confirm"
        onClick={confirm}
        disabled={busy || atCap || amount == null}
        style={{ all: 'unset', boxSizing: 'border-box', cursor: busy || atCap || amount == null ? 'default' : 'pointer', width: '100%', padding: 14, borderRadius: 13, textAlign: 'center', fontWeight: 700, fontSize: 14.5, background: atCap ? LTOKENS.surface : accent, color: atCap ? LTOKENS.ink3 : LTOKENS.bg, opacity: busy ? 0.7 : 1, border: `1px solid ${atCap ? LTOKENS.hair2 : 'transparent'}`, boxShadow: atCap ? 'none' : `0 8px 24px ${alpha(accent, 0.3)}` }}
      >
        {busy ? STAKE.confirming : amount == null ? STAKE.confirmNone : STAKE.confirm(Number.isInteger(amount) ? amount : 0)}
      </button>
    </div>
  );
}
