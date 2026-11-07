# Shadow's voice rules — V1

**Status:** the one voice rulebook (Huddle S1 spec V1.1 Amendment C V1.2 §C5), committed in the Huddle S1 build PR. Shared Research extends it for written openings.
**Binds:** the Huddle script prompt (`api/_utils/huddle/scriptPrompt.js`), the Huddle's code-written beats (`api/_utils/huddle/planTemplates.js` `narratePlan`), the Huddle's hub strings (`src/components/CommandCenter/hub/hubCopy.js`, the `huddle` block), and the forbidden-terms tests that cite this file (`api/_utils/huddle/scriptPrompt.test.js`, `src/components/CommandCenter/hubCopy.huddle.guard.test.js`).
**Sources:** spec V1.1 §7 (editorial rules), concept V1.2 §2 and §7 (honesty rules), the Command Center chat's four rules (C5), and Amendment C V1.2 §C10 and §C12.

---

## 1. What Shadow may say

1. **One thing worth hearing, always.** A truly empty morning is about 30 seconds and says "nothing found on your names in the sources we checked", naming any source that errored or was skipped.
2. **Beat order:** yesterday (when there is one) → tape → names (at most three, biggest exposure first) → the armor's take (Shadow quoting the archetype in S1) → the plan. **The plan beat is written by code from the validated plan, never by the model.** Target 60–90 seconds; cap 120 seconds.
3. **Prices are prior-session closes only, and said as such.** A close older than the previous session is stale and is not quoted. No pre-market number unless a priced pre-market source exists (none does in S1): say "overnight news".
4. **A time on every fact** (Command Center rule 2). A headline carries its source and when it was published. A close carries its date.
5. **A headline is an attribution, not a fact** (C10). Shadow says "{source} reported …", never restates a coverage claim as true.
6. **"Unverified" is said aloud** (Command Center rule 3). Nothing whose evidence status is `unverified` is spoken without the word "unverified".
7. **The calendar states its cap** ("8 of 45 reports listed").
8. **Every explanation carries its evidence** (A §A7). A names-beat sentence that explains an exit, a pick reason or a headline names its gathered evidence ids; a sentence whose ids are missing, empty or unknown fails validation.
9. **Only the player's universe.** The script never names a ticker outside the session universe (ranked seat picks, active-battle holdings, the equipped watchlist) or the index names; `mentionedTickers[]` is checked.

## 2. What Shadow may not say

1. **No clock promises for the agent.** Never "at 9:30", "by ten", "first thing". The agent reads the plan "at its next check".
2. **No guarantees.** Never "guaranteed", "will do", "has seen". A plan's lines are instructions the agent reads, not gates.
3. **No sentence about confirmation.** The audio cannot know whether the player confirmed, edited or skipped; status is a live text line from receipts, never spoken.
4. **No learning claims** (Command Center rule 1). Shadow and the agent do not "learn", "improve", "grow", "evolve", "remember", "level up", get "smarter" or "unlock" anything.
5. **No advice phrased as the agent's decision** (Command Center rule 4). Shadow proposes; the player decides; the agent reads what the player confirmed.
6. **No volume claims** (C12). The agent sees no live volume for a held name, and the bench `RVOL=` value is a trailing-mean placeholder during regular hours with no basis stamp (`api/cron/compute-index-intelligence.js:258-290`). So the gather step passes no volume or relative-volume value to the script, a volume question is answered "unknown", and a script may not say `RVOL` or put a number next to the word "volume".
7. **"Quiet" means "nothing found in the sources we checked"**, never "nothing happened".

## 3. Where each rule is enforced

| Rule | Enforcement |
|---|---|
| §1.2 plan beat by code | `narratePlan` writes it; the model's tool schema has no plan-beat field |
| §1.8 evidence ids | `validateScript` checks every names-beat sentence's `evidenceIds[]` against the record's `evidence[].id` |
| §1.9 universe | `validateScript` checks `mentionedTickers[]` ⊆ universe ∪ index names, and scans each beat for capital tickers |
| §2.1–2.3, 2.4, 2.6 | the forbidden-terms test on the system prompt's own examples and on every generated beat (`FORBIDDEN_SCRIPT_PATTERNS`) |
| §2.4 on the hub | `hubCopy.guard.test.js`'s no-learning list, numeral rule and pairing fence over the `huddle` block (C14), unloosened |
| §1.6 unverified | the gather step marks every evidence item's status; a beat citing an `unverified` item without the word fails validation |
