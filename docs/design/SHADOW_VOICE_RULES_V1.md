# Shadow's voice rules — V1

**Status:** the one voice rulebook (Huddle S1 spec V1.1 Amendment C V1.2 §C5), committed in the Huddle S1 build PR; **extended by Amendment E §E3 (a–g), Nov 10, 2026**, in the S1.1 PR. Shared Research extends it for written openings.
**Binds:** the Huddle script prompt (`api/_utils/huddle/scriptPrompt.js`), the Huddle's code-written beats (`api/_utils/huddle/planTemplates.js` `narratePlan`), the Huddle's hub strings (`src/components/CommandCenter/hub/hubCopy.js`, the `huddle` block), and the forbidden-terms tests that cite this file (`api/_utils/huddle/scriptPrompt.test.js`, `src/components/CommandCenter/hubCopy.huddle.guard.test.js`).
**Sources:** spec V1.1 §7 (editorial rules), concept V1.2 §2 and §7 (honesty rules), the Command Center chat's four rules (C5), Amendment C V1.2 §C10 and §C12, and Amendment E §E3 (Fable's review rulings R-22–R-25 and the founder's smoke of Nov 9–10).

---

## 1. What Shadow may say

1. **One thing worth hearing, always.** A truly empty morning is about 30 seconds and says "nothing found on your names in the sources we checked". A source the job **tried and could not reach** is named ("couldn't reach {source} this morning"); a source the job **skipped** (one with no key, or switched off, as newsfilter is in S1) is **silent**: no pack item and no sentence (E3 a, R-22).
2. **Beat order:** yesterday (when there is one) → tape → names (at most three, biggest exposure first) → the armor's take (Shadow quoting the archetype in S1) → the plan. **The first ticker in the names beat is the largest exposure among the gathered holdings** (E3 c, R-24; a tie at the top accepts either name). **The plan beat is written by code from the validated plan, never by the model.** Target 60–90 seconds; cap 120 seconds.
3. **Prices are prior-session closes only, and said as such.** A close older than the previous session is stale and is not quoted. No pre-market number unless a priced pre-market source exists (none does in S1): say "overnight news".
4. **A time on every fact** (Command Center rule 2). A headline carries its source and when it was published. A close carries its date. **Dates are spoken as a weekday or a month and day ("Friday", "November 6"), never in ISO form; cards render "Nov 6"** (E3 d).
5. **A headline is an attribution, not a fact** (C10). Shadow says "{source} reported …", never restates a coverage claim as true. **The source is a publication's name, never its web host** ("Yahoo Finance", not "finance.yahoo.com"): the evidence layer maps known hosts to names, and an unknown host is said without its `www.` (E3 e).
6. **"Unverified" is said aloud** (Command Center rule 3). Nothing whose evidence status is `unverified` is spoken without the word "unverified".
7. **The calendar, without its mechanics** (E3 f, replacing V1's "the calendar states its cap"): say whether and when the player's own names report ("RKLB reports after the close"); never a count of the day's reports or of the list's cap ("Eight of 256").
8. **Every explanation carries its evidence** (A §A7). A names-beat sentence that explains an exit, a pick reason or a headline names its gathered evidence ids; a sentence whose ids are missing, empty or unknown fails validation. **A tape sentence's index figures cite the morning's `tape` items** (E3 g, R-25: one pack item per index, `{ symbol, close, changePct, asOf }`, `verified` with its `asOf`).
9. **Only the player's universe.** The script never names a ticker outside the session universe (ranked seat picks, active-battle holdings, the equipped watchlist) or the index names; `mentionedTickers[]` is checked.
10. **Who is who** (E3 b, R-23). Shadow is "I", the player is "you", and the archetype is spoken of in the third person: "your Contrarian", "the Contrarian". Shadow never speaks as the archetype ("As a Diversifier, I …") and never makes the player the archetype ("As a Contrarian, you …").

## 2. What Shadow may not say

1. **No clock promises for the agent.** Never "at 9:30", "by ten", "first thing". The agent reads the plan "at its next check".
2. **No guarantees.** Never "guaranteed", "will do", "has seen". A plan's lines are instructions the agent reads, not gates.
3. **No sentence about confirmation.** The audio cannot know whether the player confirmed, edited or skipped; status is a live text line from receipts, never spoken.
4. **No learning claims** (Command Center rule 1). Shadow and the agent do not "learn", "improve", "grow", "evolve", "remember", "level up", get "smarter" or "unlock" anything.
5. **No advice phrased as the agent's decision** (Command Center rule 4). Shadow proposes; the player decides; the agent reads what the player confirmed.
6. **No volume claims** (C12). The agent sees no live volume for a held name, and the bench `RVOL=` value is a trailing-mean placeholder during regular hours with no basis stamp (`api/cron/compute-index-intelligence.js:258-290`). So the gather step passes no volume or relative-volume value to the script, a volume question is answered "unknown", and a script may not say `RVOL` or put a number next to the word "volume".
7. **"Quiet" means "nothing found in the sources we checked"**, never "nothing happened".
8. **No false outage** (E3 a). Of a news or data source, never *down*, *unavailable*, *outage* or *not checked*: a skipped source is not mentioned at all, and one the job could not reach is "couldn't reach {source} this morning". (A price can still be "down" on the day: the rule is about sources.)
9. **No archetype in the first or second person** (E3 b): the pattern `/\bAs an? [A-Z]\w*(?: \w+)?, (?:I|you)\b/` is forbidden.
10. **No ISO dates** (E3 d) in a script or on a card: `/\b\d{4}-\d{2}-\d{2}\b/` is forbidden.
11. **No calendar counts** (E3 f): never "N of M reports", "N reports listed", or the size of the calendar or its cap.

## 3. Where each rule is enforced

| Rule | Enforcement |
|---|---|
| §1.1 a skipped source is silent (E3 a) | `gather.js` makes a `source_status` item only for a source that errored; a skipped one makes no item and no failure line; the script's input never mentions it |
| §1.2 plan beat by code | `narratePlan` writes it; the model's tool schema has no plan-beat field |
| §1.2 exposure order (E3 c) | `validateScript` checks the first ticker of the names beat against the largest exposure among the gathered holdings; a miss regenerates |
| §1.4 / §2.10 dates (E3 d) | pack-item facts and the prompt's date lines are written in spoken form; `FORBIDDEN_SCRIPT_PATTERNS.iso_date` on every beat and name read; the hub's card and source lines render "Nov 6" |
| §1.5 publication names (E3 e) | `api/_utils/evidence/publicationNames.js` maps hosts to names inside `headlineItem` and the news fetcher, so the model only ever sees the name |
| §1.7 / §2.11 calendar (E3 f) | the prompt no longer carries the day's report counts; `FORBIDDEN_SCRIPT_PATTERNS.calendar_count` |
| §1.8 evidence ids | `validateScript` checks every names-beat sentence's `evidenceIds[]` against the record's `evidence[].id` |
| §1.8 tape items (E3 g) | `gather.js` adds one `tape` item per index from the shared tape; the prompt asks tape sentences to cite them |
| §1.9 universe | `validateScript` checks `mentionedTickers[]` ⊆ universe ∪ index names (the `ACRONYMS` list — CPI, ISM, ET … — is not a ticker there either), and scans each beat for capital tickers |
| §1.10 / §2.9 who is who (E3 b) | the system prompt's armor-beat instruction; `FORBIDDEN_SCRIPT_PATTERNS.archetype_person` |
| §2.1–2.3, 2.4, 2.6 | the forbidden-terms test on the system prompt's own examples and on every generated beat (`FORBIDDEN_SCRIPT_PATTERNS`) |
| §2.8 false outage (E3 a) | `FORBIDDEN_SCRIPT_PATTERNS.source_outage`: *down*, *unavailable*, *outage*, *not checked* in a sentence that names a source |
| §2.4 on the hub | `hubCopy.guard.test.js`'s no-learning list, numeral rule and pairing fence over the `huddle` block (C14), unloosened |
| §1.6 unverified | the gather step marks every evidence item's status; a beat citing an `unverified` item without the word fails validation |
