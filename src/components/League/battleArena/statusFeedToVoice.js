// src/components/League/battleArena/statusFeedToVoice.js
//
// League Battle View V2 — map a flat6 battle's WHAT-narration (battle.statusFeed)
// into the arena VoiceLane's line shape (Phase 3, pure + node-clean). The agent's
// reasoning (WHY) is concealed; the statusFeed is the public WHAT the owner's own
// battle already carries, so the voice lane reads it directly — no new endpoint.
//
// READ-ONLY this phase (founder ruling): the live "ask your agent" POST is a
// fast-follow; this module only renders the agent's existing narration.
//
// statusFeed entry shape (api/cron/agent-evaluate.js writers):
//   { timestamp, message, action, symbolIn?, symbolOut?, symbol?, regime?, score? }
// VoiceLane line shape: { kind, t, text, ticker?, _k }.

// The greeting/awaiting copy is design-authored (not in the feed); keep the
// Phase-2 fixture copy as the default so the awaiting/initial render is unchanged.
const DEFAULT_GREET = { kind: 'greeting', text: "We're live. I've got the six, you've got your three and the claim wire. Let's climb." };
const DEFAULT_WAIT = { kind: 'anticipation', text: "Lineup's locked and I'm itching. The second the bell rings, I'm hunting the swing." };

const MAX_LIVE_LINES = 6;
const TRADE_ACTIONS = /swap|trade|buy|sell|double|enter|exit|cut/i;

function toMillis(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') { const t = Date.parse(raw); return Number.isFinite(t) ? t : null; }
  if (typeof raw === 'object') {
    if (typeof raw.toMillis === 'function') { const m = raw.toMillis(); return Number.isFinite(m) ? m : null; }
    if (Number.isFinite(raw.seconds)) return raw.seconds * 1000;
    if (typeof raw.getTime === 'function') { const m = raw.getTime(); return Number.isFinite(m) ? m : null; }
  }
  return null;
}

/** A compact relative-time label ("now" / "32m" / "1h" / "2d") from a timestamp. */
export function relTime(rawTs, now) {
  const ts = toMillis(rawTs);
  const ref = Number.isFinite(now) ? now : null;
  if (ts == null || ref == null) return '';
  const s = Math.max(0, Math.floor((ref - ts) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function entryKind(action) {
  return action && TRADE_ACTIONS.test(action) ? 'trade' : 'read';
}

/**
 * Build the arena voice object from a battle. Returns the design's
 * { arch, greet, wait, live[] } shape; `live` is the mapped statusFeed,
 * newest-first, capped. Empty/absent feed → live: [] (the lane shows only greet).
 * @param {Object} battle a flat6 agentBattles doc (owner's own)
 * @param {number} now epoch ms (injected, for relTime)
 * @param {string} [archName] the agent's archetype label, for the lane header
 */
export function statusFeedToVoice(battle, now, archName) {
  const feed = Array.isArray(battle?.statusFeed) ? battle.statusFeed : [];
  const live = feed
    .slice(-MAX_LIVE_LINES)
    .reverse() // newest-first
    .map((e, i) => ({
      kind: entryKind(e?.action),
      t: relTime(e?.timestamp, now),
      text: e?.text || e?.message || '',
      ticker: e?.symbolIn || e?.symbol || undefined,
      _k: i + 1,
    }))
    .filter((l) => l.text);
  return {
    arch: archName || 'Your agent',
    greet: DEFAULT_GREET,
    wait: DEFAULT_WAIT,
    live,
  };
}
