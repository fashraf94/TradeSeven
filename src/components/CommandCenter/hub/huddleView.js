// src/components/CommandCenter/hub/huddleView.js
//
// Huddle S1 — what the hub shows of the Huddle, PURE (Huddle spec Amendment C V1.2 §C4,
// §C6, §C8, §C15; Command Center spec V1.2 Amendment D). It reads only its arguments: the
// two readers' answers (src/hooks/useHuddleToday.js, useHuddleHistory.js, called in
// ConnectedHub), the agent read the hub already holds, and a clock. No read, effect, timer
// or listener. Every word is hubCopy.js's `huddle` block; status words come from receipts.

import { HUB_COPY as COPY } from './hubCopy';
import { formatHubTime, hubMs, formatHubDay } from './hubDate';

export const HUDDLE_KIND = 'huddle';
/** C6: the Huddle rule's own Later key. */
export const huddleLaterKeyOf = (etDate) => `huddle:${etDate}`;

const huddleOf = (read) => (read?.status === 'ready' || read?.stale === true ? read.huddle ?? null : null);
const timeOf = (iso) => {
  const t = formatHubTime(hubMs(iso));
  return t ? COPY.time.et(t) : '';
};

/** "1:10" from milliseconds (a duration rendered from data, the numeral rule). */
export function durationText(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The chip (C4): a state label and a door, or null when there is no record to open. */
export function huddleChipOf(read) {
  const h = huddleOf(read);
  if (!h) return null;
  if (h.status === 'ready') {
    const heard = h.plan && h.plan.status !== 'proposed';
    const label = heard ? COPY.huddle.chipDone : COPY.huddle.chip(durationText(h.audio?.durationMs));
    return { state: 'ready', label };
  }
  if (h.status === 'queued' || h.status === 'generating') return { state: 'preparing', label: COPY.huddle.chipPreparing };
  return { state: 'failed', label: COPY.huddle.chipUnavailable };
}

/**
 * The next action's Huddle candidate (C6): today's huddle is ready, its plan still proposed and not empty, the session not
 * closed. After a confirm or a skip it is none, and the card falls through. An empty plan has nothing to confirm or skip
 * (the sheet shows neither), so it is no candidate either (review L3-8): the chip still opens the huddle to hear.
 */
export function huddleCandidateOf(read, nowMs) {
  const h = huddleOf(read);
  if (!h || h.status !== 'ready' || h.plan?.status !== 'proposed') return null;
  const current = h.plan.current || {};
  if ((current.stances?.length ?? 0) + (current.lines?.length ?? 0) === 0) return null;
  const closeMs = h.session?.closeMs;
  if (typeof closeMs !== 'number' || !(nowMs < closeMs)) return null;
  return {
    key: HUDDLE_KIND,
    id: h.etDate,
    title: COPY.huddle.readyTitle,
    why: COPY.huddle.readyWhy,
    cta: COPY.huddle.open,
    laterKey: huddleLaterKeyOf(h.etDate),
  };
}

/** One game's status line, from its newest receipt (§6.4, A §A4, C §C3, §C7, §C15). */
export function battleStatusText(b) {
  const game = COPY.huddle.games[b?.battleKind] ?? COPY.huddle.games.other;
  const W = COPY.huddle.battle;
  let words;
  switch (b?.disposition) {
    case 'written':
      if (b.retiredAt) words = W.retired;
      else if (b.replacedAt) words = b.replacedSince ? W.noLongerCurrentSince(timeOf(b.replacedSince)) : W.noLongerCurrent;
      else if (b.heardAt) words = W.heard(timeOf(b.heardAt));
      else words = W.filed;
      break;
    case 'retry_live_call': words = b.expiredAt ? W.expired : W.liveCall; break;
    case 'retry_inactive': words = b.expiredAt ? W.expired : W.inactive; break;
    case 'retry_error': words = b.expiredAt ? W.expired : W.retry; break;
    case 'stale_approach': words = b.expiredAt ? W.expired : W.staleApproach; break;
    case 'skipped_session': words = W.otherSession; break;
    case 'skipped_newer_instruction': words = W.newerInstruction; break;
    case 'archetype_unsupported': words = W.unsupported; break;
    default: words = W.firstRead;
  }
  return `${game}${COPY.sep}${words}`;
}

/** The plan's own line and one line per game, for the sheet (receipts only). CPU seats are never shown. */
export function huddleStatusOf(huddle) {
  const plan = huddle?.plan;
  if (!plan) return { plan: '', battles: [] };
  const S = COPY.huddle.planState;
  const battles = (plan.battles || []).filter((b) => b.disposition !== 'skipped_cpu');
  const line = plan.status === 'confirmed'
    ? (battles.length ? S.confirmed(timeOf(plan.confirmed?.confirmedAt)) : S.waitingForGame)
    : plan.status === 'skipped' ? S.skipped
      : plan.status === 'expired' ? S.expired
        : S.proposed;
  return { plan: line, battles: battles.map((b) => ({ battleId: b.battleId, text: battleStatusText(b) })) };
}

/**
 * C15: does the plan need reconfirming? The archetype the hub's own agent read shows differs from the newest
 * confirmation's. Pure derivation from readers the hub already has; the Deploy card makes no call of its own.
 */
export function needsReconfirmOf(read, agentArchetype) {
  const plan = huddleOf(read)?.plan;
  if (!plan || plan.status !== 'confirmed' || typeof agentArchetype !== 'string' || !agentArchetype) return false;
  const newest = plan.confirmations?.[plan.confirmations.length - 1] ?? plan.confirmed ?? null;
  return typeof newest?.archetype === 'string' && newest.archetype !== agentArchetype;
}

const historyStateOf = (p) => (p.planStatus === 'confirmed' ? 'confirmed'
  : p.planStatus === 'skipped' ? 'skipped'
    : p.planStatus === 'expired' ? 'expired'
      : p.planStatus === 'proposed' ? 'proposed' : 'none');

/** The Partnership panel (C8; Amendment D §D5): loading, none, error, and an as-of note on a kept answer. */
export function huddlePartnershipOf(todayRead, historyRead) {
  const today = huddleOf(todayRead);
  const history = Array.isArray(historyRead?.plans) ? historyRead.plans : null;
  // The Research panel's states (C8; D5): a read that failed with nothing kept is an error (with Retry), whatever the other
  // read holds; a read still out is loading. Only when both have answered is an empty answer "none" (review L3-3: an empty
  // history must not stand in for today's answer).
  const todayAnswered = today !== null || todayRead?.status === 'ready';
  const historyAnswered = history !== null;
  if ((!todayAnswered && todayRead?.status === 'error') || (!historyAnswered && historyRead?.status === 'error')) return { status: 'error' };
  if (!todayAnswered || !historyAnswered) return { status: 'loading' };
  const rows = (history || []).map((p) => ({
    etDate: p.etDate,
    text: COPY.huddle.historyRow(formatHubDay(hubMs(`${p.etDate}T16:00:00Z`)) || p.etDate, COPY.huddle.historyState[historyStateOf(p)]),
  }));
  const status = huddleStatusOf(today);
  const kept = todayRead?.stale === true || historyRead?.stale === true;
  return {
    status: today || rows.length ? 'ready' : 'none',
    today: today ? { etDate: today.etDate, line: status.plan, battles: status.battles, items: (today.plan?.current?.stances || []).concat(today.plan?.current?.lines || []).map((i) => COPY.huddle.itemText(i, Object.fromEntries(Object.entries(today.plan?.eventLabels || {})))) } : null,
    history: rows,
    asOf: kept ? COPY.huddle.partnershipAsOf(timeOf(todayRead?.asOf || historyRead?.asOf)) : null,
  };
}

/**
 * The Partnership area's one-line summary beside Shadow (C8; Amendment D §D5: the Huddle replaces the reserved "Not in this
 * release" text, the summary included): the panel's state in one line — loading, error, none, or today's plan line. Null
 * without a Huddle section (the flag off): the caller keeps the reserved summary.
 */
export function huddlePartnershipSummaryOf(partnership) {
  if (!partnership || typeof partnership !== 'object') return null;
  if (partnership.status === 'loading') return COPY.huddle.partnershipLoading;
  if (partnership.status === 'error') return COPY.huddle.partnershipError;
  if (partnership.status === 'ready' && partnership.today?.line) return partnership.today.line;
  return COPY.huddle.partnershipNone;
}

/**
 * Recent activity's two Huddle rows (C8; Amendment D §D7): "Plan confirmed" / "Plan skipped", from the plan history,
 * with kind-specific ids `huddle-plan:{uid}:{etDate}`. The list's own cutoff applies to them like every other row.
 */
export function huddleActivityOf(historyRead, uid) {
  if (!uid || !Array.isArray(historyRead?.plans)) return [];
  const out = [];
  for (const p of historyRead.plans) {
    const at = p.planStatus === 'confirmed' ? p.confirmedAt : p.planStatus === 'skipped' ? p.skippedAt : null;
    const ms = hubMs(at);
    if (ms === null) continue;
    out.push({ id: `huddle-plan:${uid}:${p.etDate}`, kind: p.planStatus, ms, etDate: p.etDate });
  }
  return out;
}
