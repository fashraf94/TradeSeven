// src/data/archetypeIdentity.js
//
// Per-archetype identity copy, transcribed verbatim from
// ARCHETYPE_IDENTITY_CONTRACT_V1.md §2. This is the "teaching" layer for the
// onboarding reveal and the agent dashboard: since the archetype is DERIVED
// (not chosen), the reveal explains in plain language what the agent is and how
// it will behave. Every reveal names the tradeoff, not just the upside.
//
//   - disposition: the one-line essence.
//   - reveal:      "what you are / how it trades" — shown on the reveal screen.
//   - voice:       the agent's first-person line (also the fallback greeting
//                  when the Haiku-derived greeting is unavailable).
//
// Keyed by the stable archetype code-ids. Display NAMES live in
// archetypeDisplay.js; keep this file to behavior copy only so the two layers
// stay independently editable.

export const ARCHETYPE_IDENTITY = {
  momentum_chaser: {
    disposition: 'Goes where the momentum is — and leaves the moment it fades.',
    reveal:
      "You buy strength, not bargains. When a name or sector is clearly trending up on real volume, you pile in; when the trend breaks, you cut it without sentiment. You'll concentrate in whatever's hot rather than spread thin — and you'd rather miss the exact bottom than sit in a loser.",
    voice:
      "I trade what's working. Show me a clean uptrend and I'm in — but the second momentum rolls over, I'm out.",
  },
  contrarian: {
    disposition: 'Buys what everyone else is giving up on.',
    reveal:
      "You move against the crowd. A name that's beaten down and out of favor is exactly what interests you, and when everyone's piling into the obvious winner you stay away. It takes patience — you're betting the market overreacted and will come back, which doesn't always happen on your schedule.",
    voice:
      "I go where the crowd isn't. If everyone's selling it, that's usually when I start looking.",
  },
  diversifier: {
    disposition: 'Spreads the bets so no single one can sink you.',
    reveal:
      "You don't bet the house on any one idea. Your edge is staying spread across many sectors, so when one blows up the rest carry you. You trade breadth over depth — smaller positions across a wider field — which smooths the ride but means you rarely land a single huge winner.",
    voice:
      "I don't put it all in one basket. I'd rather own a bit of everything and let the spread do the work.",
  },
  degen: {
    disposition: 'Chases the biggest swings and wears the risk.',
    reveal:
      "You're here for the big moves. Volatility is the point, not the problem — you chase the names with the widest swings and mostly ignore what the fundamentals say. The upside is explosive; the cost is that you'll take some hard hits, and you're fine with that.",
    voice:
      "I'm not here to play it safe. Give me the names that actually move — I'll take the swings, good and bad.",
  },
  analyst: {
    disposition: 'Buys quality companies and lets the fundamentals do the work.',
    reveal:
      "You buy good businesses, not lottery tickets. Strong balance sheets, real earnings, blue-chip quality — that's what gets your money, and you're slow and deliberate about it. You won't catch every hot run, but you're rarely left holding something that was never worth owning.",
    voice:
      "I buy companies I'd be comfortable holding. Show me the fundamentals and I'll tell you if it's worth it.",
  },
  guardian: {
    disposition: 'Protects the downside before chasing any upside.',
    reveal:
      "Your first job is not losing money. You move slowly, trade rarely, and lean defensive — built to come through a bad stretch intact rather than to top the leaderboard in a good one. You'll give up some upside for that safety, and that's a trade you're happy to make.",
    voice:
      "Rule one is don't lose it. I'd rather protect what we've got than reach for a risky win.",
  },
};

// Resolve identity copy for an archetype. Falls back to the analyst
// (Fundamental Investor) profile for an unknown/missing code-id, mirroring the
// server-side derivation fallback.
export const getArchetypeIdentity = (archetype) =>
  ARCHETYPE_IDENTITY[archetype] || ARCHETYPE_IDENTITY.analyst;

export default ARCHETYPE_IDENTITY;
