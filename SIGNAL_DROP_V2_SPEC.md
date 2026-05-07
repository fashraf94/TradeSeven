# Signal Drop V2 — Watchlist Factory Spec

**Version:** 2.0
**Date:** May 7, 2026
**Status:** Locked architecture, ready for Sprint 6 audit
**Replaces:** `FORGE_SIGNAL_DROP_SPEC_V1_1.md` (April 28, 2026 — thesis-card-output model)

---

## Why V2 exists

V1.1 framed Signal Drop as a thesis-card factory: paste content, get an LLM-expanded thesis with related tickers, optionally take it into Workshop to build a strategy. The Phase 1 backend (Haiku parse, Gemma expansion, cache) shipped April 28 and quality-tested cleanly.

After Sprint 5 closed, Flash reframed the product:

> "Every component on the Discovery page is essentially a watchlist. The Theme cards all have stocks associated with each sub-theme, and the sectors also are watchlists of stocks within those specific sectors. Making the Signal Drop a custom way to make a watchlist by pushing users to bring a starting point object is the right move. Maybe in the future we can have that watchlist itself be the seed content for a strategy builder, but for now, let's just stick with building the watchlist so that the user and FantasyTrades can benefit together."

V2 reorients Signal Drop around watchlist creation as the primary output. The dialogue *is* the experience. The watchlist is a durable, returnable artifact. Strategy-building is downstream optional.

---

## Discovery taxonomy (the framing that unlocked V2)

Discovery is a watchlist surface. Every rail organizes stocks into meaningful groups, distinguished by who curated them:

| Rail | Curator | Origin |
|---|---|---|
| Featured Themes | Anthropic-authored | DKB (`dkb/thematic/*.json`) |
| All Themes | Anthropic-authored | DKB |
| Sectors | ETF-defined | SPDR sector funds + holdings |
| **Signal Drop** | **User-curated through dialogue** | **External content + agent dialogue** |

Signal Drop completes the taxonomy: it's the user-curated rail. Every saved watchlist is a stock group with documented reasoning, born from real curiosity rather than browsing pre-made lists.

---

## User journey

### 1. Trigger
User encounters interesting content externally (tweet, news article, earnings transcript, podcast clip). Wants to act on the curiosity.

### 2. Drop
User opens Signal Drop entry point on FantasyTrades. Pastes content (text). Submits.

### 3. Parse
Haiku-based parse step (existing V1.1 backend) extracts:
- Apparent topic / driver
- Mentioned tickers (validated against universe)
- Sentiment / direction signals
- Content quality flags (junk bailout, injection guard)

### 4. Phased dialogue

User enters a **watchlist building dialogue** with a Gemma-powered agent. Four explicit phases:

#### Phase A — `explore`
Agent helps user understand what the source is really about. What's the signal? What's the thesis? What's the time horizon? What sectors or themes could this touch?

Goal: shared mental model of the topic before tickers get proposed. Prevents "throw 20 random tickers at the user" failure mode.

#### Phase B — `propose`
Agent proposes tickers, batch by batch. For each ticker:
- Why this ticker fits
- What category it represents (direct play, beneficiary, hedged exposure, etc.)
- Risks / counter-arguments

User reacts: keeps, removes, asks for more in a category.

#### Phase C — `refine`
List takes shape. Agent and user discuss edge cases, debate marginal additions, prune speculative picks. User can volunteer their own tickers and ask the agent to evaluate.

#### Phase D — `finalize`
Agent presents the candidate watchlist with reasoning per ticker. User reviews. Optional advice on coverage gaps ("you have growth and large-cap, but no defensive plays — want me to suggest one?").

Phase transitions are agent-led but user-overridable. The agent uses suggestedActions chips ("propose more healthcare names", "let's refine", "I'm done") to make transitions visible.

### 5. Edit screen

After `finalize`, user lands on a watchlist editor:
- **Title** (editable, default = agent-suggested theme name)
- **Source** (auto-populated, link to original content if URL provided)
- **Tickers** with reasoning per ticker (each editable, removable)
- **Save** button

### 6. Saved watchlist

Saved watchlists appear:
- On Discover surface (a "My Watchlists" rail or section — placement TBD in audit)
- On a dedicated "My Watchlists" view (TBD)

Each saved watchlist shows: title, ticker count, creation date, source attribution.

### 7. Optional: Take to Workshop

On the saved watchlist detail view, an optional "Take to Workshop" CTA opens Workshop with the watchlist as `kind: 'watchlist'` seedContext. Sprint 5's bridge mechanism handles the rest.

---

## What's reused from V1.1

| Component | Status |
|---|---|
| `api/forge/parse-signal.js` | Reused as-is. Step 1 is still "parse the input." |
| `signalDropCache` | Reused for parse-step caching across users seeing the same content. |
| `injectionGuard.js` | Reused. Same defense surface. |
| `contentHash.js` | Reused. Same dedup logic. |
| `tickerValidation.js` | Reused. Same universe filter. |
| `shadowLogger.js` (logSignalDrops) | Reused. Sprint 5 fixed the `waitUntil` patterns. |
| Phase 1 quality testing harness | Adapted with new success criteria. |

## What's repurposed

| Component | V1.1 role | V2 role |
|---|---|---|
| `api/forge/expand-signal.js` | Final output: thesis card with tickers | First step of dialogue: agent's opening turn references parsed content |
| `signalDropPrompt.js` | Builds parse + expand prompts | Builds parse + dialogue-phase prompts |

## What's new

| Component | Purpose |
|---|---|
| Watchlist dialogue endpoint | Multi-turn agent conversation, phased prompt, tracks phase state per session |
| `watchlists` Firestore collection | Per-user watchlists with origin, tickers + reasoning, metadata |
| `watchlistSessions` Firestore collection | In-progress dialogue sessions (analogous to `workshopSessions`) |
| Signal Drop entry point UI | Where user pastes content |
| Dialogue UI | Chat-style interface with phase indicator and suggestedActions chips |
| Edit screen UI | Post-dialogue review/edit before save |
| Watchlist detail UI | Saved watchlist view with Take to Workshop CTA |
| Discover surface integration | Where saved watchlists render on Discover |
| Workshop seedContext branch | `kind: 'watchlist'` extension to Sprint 5 mechanism |

---

## Data model

### `watchlists` collection (new)

```
watchlists/{watchlistId}
{
  userId: string,
  title: string,                    // user-editable
  createdAt: timestamp,
  updatedAt: timestamp,
  origin: {
    type: 'signal_drop',
    contentSnippet: string,         // first 500 chars of source for attribution
    sourceUrl: string | null,       // optional, if user pasted a URL
    parseId: string,                // pointer to signalDropCache entry
    sessionId: string,              // pointer to watchlistSessions doc
  },
  tickers: [
    {
      symbol: string,
      reasoning: string,            // agent's reasoning, user-editable
      category: string,             // 'direct play' | 'beneficiary' | 'hedged' | etc.
      addedAt: timestamp,           // tracks dialogue order
    }
  ],
  themeTags: string[],              // empty for V2; future-compat for theme inference
}
```

### `watchlistSessions` collection (new)

Mirrors `workshopSessions` pattern. Persists in-progress dialogues so users can return.

```
watchlistSessions/{sessionId}
{
  userId: string,
  startedAt: timestamp,
  updatedAt: timestamp,
  phase: 'explore' | 'propose' | 'refine' | 'finalize' | 'completed',
  exchanges: [
    { role: 'user' | 'agent', content: string, timestamp, suggestedActions?: [] }
  ],
  parseId: string,                  // signalDropCache pointer
  candidateTickers: [               // tickers proposed/discussed during dialogue
    { symbol, reasoning, status: 'proposed' | 'kept' | 'removed' }
  ],
  watchlistId: string | null,       // set after finalize → save
  messagesUsed: number,
  messageBudget: number,            // analogous to Workshop's 25
}
```

### Workshop seedContext extension (Sprint 5 mechanism)

```ts
type SeedContext = ... |
  {
    kind: 'watchlist';
    watchlistId: string;
    title: string;
    tickers: { symbol: string, reasoning: string }[];  // capped at ~10 for prompt size
    sourceContent: string | null;                       // brief origin context
  };
```

---

## Agent dialogue model

### Voice
Research partner, not assistant. The agent has opinions about which tickers fit and why — and is willing to push back on user proposals that don't make sense. The agent is also curious — it asks questions about the user's interest.

### Phase rules

**Phase A (`explore`)**
- Goal: shared mental model of the topic before any tickers get named
- Don't propose tickers in this phase, even if asked — redirect: "Before we name names, let's understand what you're seeing here"
- Ask 1-2 questions, listen to user's frame
- Transition trigger: user signals they want to start naming tickers, OR agent has enough understanding to propose responsibly

**Phase B (`propose`)**
- Goal: introduce candidate tickers in batches of 3-5 with reasoning per ticker
- For each ticker: symbol, reasoning, category, risk / counter-argument
- Don't dump 20 tickers at once — batch and check in
- Transition trigger: user has reacted to ~10 candidates, list is taking shape

**Phase C (`refine`)**
- Goal: prune, debate edge cases, accept user-volunteered tickers
- Be willing to push back if a user-volunteered ticker doesn't fit the thesis
- Suggest coverage gaps
- Transition trigger: user signals satisfaction OR list reaches reasonable size (10-20)

**Phase D (`finalize`)**
- Goal: present full candidate list for review
- Recap: title suggestion, list of N tickers with reasoning, optional gap warnings
- Transition: hand off to edit screen

### Negative constraints
- No financial advice ("you should buy")
- No price targets
- No timing predictions (specific dates)
- No promise that any ticker will perform well
- Doesn't pre-fill activeThesis (this isn't Workshop — different schema entirely)

### Suggested actions chips
At each phase, agent surfaces 1-3 suggested user actions as chips:
- Phase A: ["explore further", "propose tickers"]
- Phase B: ["more in this category", "different angle", "I have my own"]
- Phase C: ["I'm satisfied", "coverage check", "more options"]
- Phase D: ["save & edit", "back to refining"]

---

## Edit screen

User lands here after `finalize`. UI elements:

**Header**
- Title input (default: agent-suggested, e.g., "AI Infrastructure Plays — May 7")
- Source attribution (read-only, with link if URL was source)

**Tickers list**
- Each ticker: symbol (read-only), reasoning (editable textarea, ~200 char max), category (read-only label), remove button
- Reorder via drag-handle (nice-to-have, not blocking for MVP)

**Footer**
- Cancel (returns to dialogue)
- Save (creates `watchlists/{id}` doc, redirects to detail view)

---

## Constraints

### What V2 does NOT do (deferred)
- Theme tag inference (no `themeTags` population at save time; field exists for future use)
- Watchlist promotion to platform-level theme (massive future work)
- Watchlist sharing / social features
- Watchlist comparison against other users' watchlists
- Multi-source watchlists (each watchlist has one origin)
- Edit-after-save deep modifications (V2 lets user edit reasoning, but not add new tickers post-save — would require re-running dialogue)

### Backend gaps from V1.1
The V1.1 spec called for several endpoints that may not have shipped:
- `GET /api/forge/recent-drops` — fetch user's recent watchlists for rail
- `GET /api/forge/drop-history` — paginated history
- `POST /api/forge/delete-drop-history` — purge
- `GET /api/forge/export-drop-history` — JSON export

Audit will determine which of these exist. Anything missing becomes Sprint 6 scope (renamed for V2 — e.g., `recent-watchlists`, etc.).

### Cost profile
Roughly comparable to V1.1 with the dialogue stage replacing the expansion stage:

- Haiku parse: ~$0.003-0.005 per drop (unchanged)
- Gemma dialogue: ~$0.020-0.080 per drop (varies with turn count; longer dialogues cost more)
- Cache hit on parse: ~$0.0001

Beta scale (100 users, 5 drops/week): ~$50-150/month
Launch scale (10K users, 3 drops/week): ~$2K-6K/month for Signal Drop infra

---

## Implementation phasing (proposed for audit)

The audit will refine this, but the rough Sprint 6 shape:

**Phase 1: Backend gaps + Workshop handoff branch (small)**
- Any missing V1.1 endpoints (recent, history, etc.)
- `kind: 'watchlist'` validator + prompt builder branch (Sprint 5 extension)
- ~2-3 file changes, single session

**Phase 2: Dialogue endpoint + persistence (medium)**
- New `api/forge/watchlist-dialogue.js` endpoint
- `watchlistSessions` Firestore schema + rules
- Phased prompt construction in `signalDropPrompt.js` extension
- ~5-6 file changes, 1-2 sessions

**Phase 3: Entry point + dialogue UI (medium-large)**
- Signal Drop entry point component
- Dialogue chat UI (likely WatchlistChat component, mirrors WorkshopChat)
- Phase indicator + suggested actions integration
- ~6-8 file changes, 2 sessions

**Phase 4: Edit screen + save flow (medium)**
- Edit screen component
- `watchlists` Firestore schema + save logic + rules
- ~4-5 file changes, 1 session

**Phase 5: Watchlist detail view + Discover integration (medium)**
- Detail view component with Take to Workshop CTA
- Discover surface integration
- ~5-6 file changes, 1-2 sessions

**Phase 6: Polish (small)**
- Empty states, loading states, error handling
- Mobile verification
- 1 session

**Total: 6-8 sessions, multi-day work.**

---

## Success criteria

**MVP**
- User can paste content, complete a phased dialogue, save a curated watchlist
- Saved watchlists render on Discover
- Take to Workshop CTA opens Workshop with watchlist as seed context
- Theme tag inference deferred but field reserved

**Smoke test (post-MVP)**
- Run 5-10 real signal drops with diverse content (tweet, article, earnings clip, etc.)
- Verify dialogue feels productive (not robotic, not aimless)
- Verify saved watchlists are useful artifacts (would the user return to them?)
- Verify Take to Workshop produces a viable strategy starting point

---

## End of V2 spec

This spec is the canonical reference for Sprint 6. The Phase 0 audit prompt audits *against* this spec, identifying what's reusable from V1.1 backend, what gaps exist, and what new infrastructure must be built.
