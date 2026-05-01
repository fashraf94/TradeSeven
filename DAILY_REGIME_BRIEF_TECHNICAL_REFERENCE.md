# Daily Regime Brief (DRB) — Technical Reference

**Status:** Live in production. Cron firing daily 12:30 UTC Mon-Fri.
**Purpose:** Forward-looking daily market synthesis. Two consumers: (1) injected into Gemma's Voice Layer Block 3.5 via `anchorContext` for chat sessions, (2) read by Discover tab's Current Events rail to surface scheduled events as strategy-building cards.
**Replaces:** Hand-written DKB content production (formally paused April 21, 2026).

---

## Architecture overview

```
 ┌──────────────────────────────────────────────┐
 │ 12:30 UTC Mon-Fri — cron fires               │
 │ /api/cron/compute-daily-regime-brief         │
 └──────────────┬───────────────────────────────┘
                │
                ├─ idempotency guard (forDate === today → skip with 200)
                │
                ├─ parallel gather:
                │   ├─ Firestore: indexIntelligence/marketContext
                │   ├─ fetchEconomicEvents() — direct helper import
                │   └─ fetchEarningsCalendar() — direct helper import
                │
                ├─ buildDailyRegimeBriefPrompt(...) → { systemPrompt, userPrompt }
                │
                ├─ Sonnet call (claude-sonnet-4-20250514)
                │   ├─ Forced Tool Use: submit_daily_regime_brief
                │   ├─ 45s Promise.race timeout
                │   └─ Output: { brief, keyEvents (structured objects), themes }
                │
                ├─ Firestore.set(indexIntelligence/dailyRegimeBrief, {...})
                │
                └─ logDailyRegimeBrief(...) — fire-and-forget to GCS
                
                      ↓ (consumed hours later by two read paths)
                      
 ┌──────────────────────────────────────────────┐    ┌──────────────────────────────────────────────┐
 │ Path 1 — Gemma chat request                  │    │ Path 2 — Discover tab Current Events rail   │
 │ api/agent/chat.js:213-222                    │    │ /api/discover/current-events (Phase 4)      │
 └──────────────┬───────────────────────────────┘    └──────────────┬───────────────────────────────┘
                │                                                    │
                ├─ Promise.all:                                      ├─ Read indexIntelligence/dailyRegimeBrief
                │   ├─ indexIntelligence/marketContext               ├─ Filter past events (end-of-day ET)
                │   ├─ indexIntelligence/dailyRegimeBrief            ├─ Render keyEvents as cards
                │   └─ voiceLayerCache/{battleId}                    └─ Each card: label, eventDate, eventTime,
                │                                                       whyItMatters, tickers, "Build a strategy" CTA
                ├─ anchorContext = `Regime: X. Detail.`
                │   + (DRB brief if forDate matches)
                │
                └─ buildVoiceLayerPrompt({ anchorContext, ... })
                    → Block 3.5
```

---

## Files

### Implementation

| Path | Purpose |
|---|---|
| `api/cron/compute-daily-regime-brief.js` | Cron handler |
| `api/_utils/dailyRegimeBriefPrompt.js` | Sonnet tool schema + prompt builder |
| `api/_utils/fetchEconomicEvents.js` | Pure Sonar fetcher (shared with `economic-events-sonar.js`) |
| `api/_utils/fetchEarningsCalendar.js` | Pure Sonar fetcher (shared with `earnings-calendar-sonar.js`) |
| `api/_utils/shadowLogger.js` | `logDailyRegimeBrief` exported via `appendToStream` |

### Read paths (consumers)

| Path | What it consumes |
|---|---|
| `api/agent/chat.js` (lines ~213-228) | `forDate`, `dailyBrief` only. Appends to anchorContext when `forDate === today`. |
| `api/forge/expand-signal.js` (lines ~144-168) | `forDate`, `dailyBrief` only. |
| `api/forge/workshop-chat.js` (lines ~251-254) | `forDate`, `dailyBrief` only. |
| `api/discover/current-events.js` (Phase 4) | `keyEvents` array (structured objects). Renders as Current Events cards. |

Note: as of the Path C schema change (Phase 1 of Sprint 4), `keyEvents` is a structured array of objects rather than strings. Only the Discover Current Events consumer reads `keyEvents`. The other three consumers read only `dailyBrief` and `forDate`, so the schema change is backward-compatible for them.

---

## Firestore schema

### `indexIntelligence/dailyRegimeBrief`

Single doc, overwritten daily (idempotent via `forDate` check).

```js
{
  dailyBrief: string,              // 150-300 token desk-briefing paragraph
  keyEvents: Array<{               // 3-6 structured event objects (Path C schema)
    label: string,                 // e.g. "Fed rate decision", "NVDA earnings"
    eventDate: string,             // YYYY-MM-DD
    eventTime: string,             // e.g. "2:00 PM ET", "AMC", "BMO", or empty
    kind: 'macro' | 'earnings' | 'fed' | 'speech' | 'auction',
    whyItMatters: string,          // 1-2 sentence card body, ~140 chars max
    tickers: string[],             // 2-3 affected tickers (US-listed)
  }>,
  themes: string[],                // 2-5 items: "AI capex rotation cooling"
  forDate: string,                 // YYYY-MM-DD
  generatedAt: Timestamp,          // Firestore serverTimestamp
  model: 'claude-sonnet-4-20250514',
  tokenUsage: {
    input: number | null,
    output: number | null
  },
  sourceFailures: string[]         // e.g., ['earnings-calendar-sonar'] if fetcher failed
}
```

### Firestore security rules (existing, no changes needed)

```
match /indexIntelligence/{docId} {
  allow read: if true;
  allow write: if false;
}
```

Wildcard `{docId}` pattern covers `dailyRegimeBrief` automatically. Public read; Admin SDK write only.

---

## Cron specification

```json
{
  "path": "/api/cron/compute-daily-regime-brief",
  "schedule": "30 12 * * 1-5"
}
```

**Timing:** 12:30 UTC Mon-Fri
- EST: 7:30 AM ET
- EDT: 8:30 AM ET

**Buffer analysis:**
- `compute-index-intelligence` finishes its later DST slot at ~11:35 UTC
- DRB fires at 12:30 UTC → 55-minute upstream buffer
- `agent-evaluate` and `voice-layer-cache` first fire at 13:00 UTC → 30-minute downstream runway
- Single slot, no DST duplication needed (DRB doesn't depend on exact ET timing)

**Config:** `export const config = { maxDuration: 60 };`

**Idempotency guard:** Handler checks for existing `dailyRegimeBrief` doc with `forDate === today`. If found, skips Sonnet call and returns 200 immediately. To force a fresh run during testing, delete the existing doc via Firebase Console first.

**Auth:** Standard Vercel cron pattern.

```js
const isVercelCron = req.headers['x-vercel-cron'] === '1';
const authHeader = req.headers.authorization;
if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

---

## Sonnet prompt contract

### Tool schema (Path C — structured keyEvents)

```js
{
  name: 'submit_daily_regime_brief',
  input_schema: {
    required: ['brief', 'keyEvents', 'themes'],
    properties: {
      brief: {
        type: 'string',           // desk-briefing paragraph
      },
      keyEvents: {
        type: 'array',
        description: '3-6 most consequential scheduled events this week. Pick from the calendars provided in user prompt; do not invent events.',
        items: {
          type: 'object',
          required: ['label', 'eventDate', 'kind', 'whyItMatters', 'tickers'],
          properties: {
            label: {
              type: 'string',
              description: 'Short event name. Examples: "Fed rate decision", "NVDA earnings", "CPI release", "Q1 GDP advance". 3-6 words.',
            },
            eventDate: {
              type: 'string',
              description: 'YYYY-MM-DD date of the event, copied directly from the calendar input.',
            },
            eventTime: {
              type: 'string',
              description: 'Time of day. Examples: "2:00 PM ET", "AMC", "BMO", "8:30 AM ET". Empty string if not applicable.',
            },
            kind: {
              type: 'string',
              enum: ['macro', 'earnings', 'fed', 'speech', 'auction'],
              description: 'Event category. macro = CPI/GDP/PMI/etc. earnings = company earnings. fed = FOMC decisions. speech = Fed/policymaker speeches. auction = Treasury auctions.',
            },
            whyItMatters: {
              type: 'string',
              description: '1-2 sentences explaining what to watch and why it matters for positioning. Desk-briefing voice. ~140 characters max.',
            },
            tickers: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 affected tickers. For earnings, the company itself. For macro/fed events, broad-market tickers most reactive (SPY, TLT, GLD, DXY, XLE, etc.). Pick from US-listed names.',
            },
          },
        },
      },
      themes: {
        type: 'array',
        items: { type: 'string' },  // 2-5 compact noun phrases
      },
    },
  },
}
```

### Mandatory constraints in system prompt

- **No VIX citations** — codebase doesn't track VIX (`voice-layer-cache.js:269` explicit comment). Only volatility tiers permitted (elevated / normal / compressed).
- **No restating of current regime data** — regime name, breadth tiers, sector movers are already rendered by Block 4C. DRB is forward-looking only.
- **Desk-briefing voice** — direct, specific. Not marketing copy. Not news summary.
- **150-300 tokens** for the brief itself.
- **Forced Tool Use** — no prose responses.
- **Copy eventDate verbatim from calendar input** — do not infer or guess dates.
- **Tickers must be US-listed and trade-able** — for macro/fed events, pick the 2-3 most reactive broad-market or sector ETFs.

### Input data (rendered in user prompt)

| Field | Source |
|---|---|
| Regime, regimeDetail, volatilityRegime, breadthTier | `indexIntelligence/marketContext` |
| topSectorToday, topSectorChange, worstSectorToday, worstSectorChange | `indexIntelligence/marketContext` |
| technicalLeaders (top 5 symbols), technicalLaggards (bottom 5 symbols) | `indexIntelligence/marketContext` (bare string arrays) |
| thisWeekEvents, nextWeekEvents (with date, time, event, impact, category) | `fetchEconomicEvents()` |
| thisWeekEarnings, nextWeekEarnings (filtered to significance === 'high', with date, timing, ticker, name) | `fetchEarningsCalendar()` |
| forDate | `new Date().toISOString().split('T')[0]` |

---

## Failure modes and recovery

| Failure | Behavior | User impact |
|---|---|---|
| Cron doesn't fire | Prior day's brief stays in Firestore; chat reads it anyway but `forDate !== today` so silent fall-through to regime-only anchorContext | None for chat — matches pre-DRB behavior. Discover Current Events rail enters empty state. |
| `fetchEconomicEvents` throws | Empty arrays passed to Sonnet; `sourceFailures: ['economic-events-sonar']` logged in doc | Brief synthesized from earnings + market context only |
| `fetchEarningsCalendar` throws | Same treatment | Brief synthesized from econ + market context only |
| Both fetchers throw | Both logged; Sonnet writes from market context alone | Brief is thinner but still renders |
| Sonnet returns no tool_use block | Throws, 500 returned, existing doc NOT overwritten | Prior day's brief remains; next day retries fresh |
| Sonnet times out (>45s) | Same as above | Prior day's brief remains |
| Firestore write fails | Cron returns 500; no shadow log | Prior day's brief remains |
| `chat.js` DRB read fails | Existing try/catch logs `[VoiceLayer] Failed to fetch market context` and falls through | Block 3.5 uses canned fallback string |
| Discover Current Events read fails | Endpoint returns degraded state | Empty rail with "Updated soon" footer |

---

## Shadow logger integration

**Stream:** `daily_regime_brief`
**Call site:** `api/cron/compute-daily-regime-brief.js` after successful Firestore write
**Pattern:** fire-and-forget with `.catch(() => {})` (belt and suspenders; logger silent-fails internally)

```js
logDailyRegimeBrief({
  forDate,
  inputContext: { regime, breadthTier, volatilityRegime, econEventsCount, earningsCount, sourceFailures },
  output: { brief, keyEvents, themes },   // keyEvents now contains structured objects
  tokenUsage,
  duration
}).catch(() => {});
```

**Purpose:**
1. Training signal for future Gemma fine-tuning (input context → synthesis output → user reactions downstream)
2. Heartbeat for monitoring (absence of today's record = DRB failed)

**GCS target:** `gs://fantasytrades/shadow/daily_regime_brief/{YYYY-MM-DD}/{eventId}.jsonl`

**Known issue (May 2026):** Shadow logger has been silently failing for `daily_regime_brief` stream since approximately April 30. Firestore writes succeed (verified live); GCS writes are silently dropped by the swallowed `.catch()`. Other streams (`signal_drops`, `evaluations`, `conversations`, etc.) continue writing normally. Out of scope for Phase 1; tracked separately as a maintenance task.

---

## Cost profile

Per day:
- 1 Sonnet call, ~3K input tokens, ~600 output tokens (slightly higher than pre-Path-C due to structured event details)
- ~$0.025 / day = ~$0.75 / month

At scale (100K users, same 1 call/day):
- Cost unchanged — DRB is global, not per-user
- ~$0.75 / month regardless of user count

Sonar fetcher calls bypass the HTTP cache when called directly (cron uses helpers, not endpoints), but Sonar costs ~$0.01 / day for both.

**Total DRB marginal cost: ~$0.035 / day at any scale.**

---

## Testing and verification

### Pre-deploy smoke test

Can be run on a preview deploy:

```bash
# First delete the existing doc via Firebase Console (idempotency guard)
curl -X POST https://{preview-url}/api/cron/compute-daily-regime-brief \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "forDate": "2026-05-01",
  "briefLength": 1200,
  "keyEventsCount": 4,
  "tokenUsage": { "input": 2800, "output": 580 },
  "sourceFailures": [],
  "duration": 14400
}
```

### Post-deploy verification

1. **First cron fire:** Check Vercel function logs at ~12:30 UTC the next weekday. Look for `[DailyRegimeBrief] Brief generated` with expected token counts.
2. **Firestore:** Verify `indexIntelligence/dailyRegimeBrief` doc exists with all fields populated, including structured `keyEvents` objects (not strings).
3. **Shadow log (when fixed):** Check GCS bucket `fantasytrades/shadow/daily_regime_brief/{YYYY-MM-DD}/` for the day's JSONL record.
4. **Chat integration:** Open a Gemma battle chat. Pull function logs for `chat.js` and confirm `anchorContext` includes the brief text concatenated after the regime line.
5. **Discover integration (Phase 4):** Open Discover tab. Confirm Current Events rail renders with cards matching the `keyEvents` array.

### Ongoing monitoring

- **Shadow log absence:** If no record for a weekday and shadow logger is fixed, DRB failed silently. Check Vercel logs.
- **Brief length drift:** Sonnet should produce 150-300 token briefs. If `briefLength` consistently exceeds 400 tokens, tighten the tool schema description.
- **`sourceFailures` frequency:** If Sonar fetchers fail >5% of days, investigate Perplexity rate limits or endpoint auth drift.
- **`keyEvents` structure quality:** Spot-check that each event object has all 5 required fields populated. If `whyItMatters` truncates or `tickers` arrays are empty, tighten system prompt.

---

## Design decisions and rationale

### Why a separate doc, not a field on `marketContext`

`compute-index-intelligence` overwrites `marketContext` via `batch.set()` (not merge). If DRB wrote to a field on that doc, the next morning's `compute-index-intelligence` run would clobber it. Separate doc avoids the race entirely.

### Why single cron slot (no DST duplication)

Unlike `compute-index-intelligence` (which matters for before-market-open timing), DRB doesn't depend on exact ET time. It only depends on being after `compute-index-intelligence` and before downstream consumers. A single 12:30 UTC slot satisfies both constraints in EST and EDT.

### Why Forced Tool Use instead of raw JSON

Standard for structured output across the codebase (`agent/decide.js`, `agent/reflect.js`, `forge/compile-dimensions.js`). Eliminates JSON parsing fragility.

### Why structured keyEvents (Path C) over string array

Original schema had `keyEvents: string[]` like `"Wed FOMC decision"`. Discover Current Events rail (Phase 4) needs structured fields per event — date, time, kind, narrative, tickers. Three paths were considered:

- **Path A:** Parse strings + fuzzy-match against sonar caches at request time. Rejected: brittle parsing, dependent on Sonnet adherence to undocumented format conventions, fuzzy joins fail on paraphrasing.
- **Path B:** Keep string schema, generate per-event narrative/tickers via Haiku call inside DRB cron. Viable but adds 6 Haiku calls per cron run (~$0.005/day) without solving the underlying date-parsing problem.
- **Path C (selected):** Modify the Sonnet tool schema to return structured objects. Sonnet already receives the full structured calendar input — discarding that structure on output was wasteful. Marginal cost ~150-300 extra output tokens (~$0.001/day). Eliminates fuzzy join entirely. Single source of truth for event details.

Path C was selected on April-May 2026 based on Phase 0 audit findings and live DRB output quality verification.

### Why event-time and end-of-day filtering happens in the consumer, not the writer

DRB writes events for the entire week. The Discover endpoint filters past events at request time using the user's local clock vs. `eventDate + eventTime`. This keeps the writer simple (single daily run, no re-writes through the day) while letting the consumer freshly evaluate "past vs upcoming" at every Discover tab open.

---

## Related documentation

- `FORGE_DISCOVER_TAB_SPEC_V1_1.md` — Phase 4 specifies the Current Events rail consumer
- `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` — Block 3.5 anchorContext injection mechanism
- `FORGE_LANDING_IMPLEMENTATION_REFERENCE.md` — Existing Forge landing patterns
