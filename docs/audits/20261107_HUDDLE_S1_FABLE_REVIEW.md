# Huddle S1 — Fable's review of the build report (Nov 7, 2026)

**Reviewed:** `docs/audits/20261107_BUILD_HUDDLE_S1.md` on `claude/huddle-s1` (code 563e0550, draft PR #1032); smoke branch `claude/huddle-s1-smoke` @ 3f13111f.
**Verdict:** **MERGE** after the founder smoke and the Command Center chat's hub-side check. Nothing in the report blocks merging a dark build. **The flag flip waits** on R-17 and the flip-PR items below.
**Destination when committed:** `docs/audits/20261107_HUDDLE_S1_FABLE_REVIEW.md`, in the flip PR (no docs-only PR).

---

## 1. What landed

- Every dark guarantee held (review lens L1 traced each path); no fenced file edited; the sweep call in `agent-evaluate.js` sits where the spec placed it, pinned.
- Filing and receipt in one transaction, with emulator rows (B §B1). The dropped post-deploy hook stayed dropped (C §C7).
- The entry chunk is byte-identical to base across three builds; the hub chunk grew 9.4 kB. Every hub rule in C4, C6, C7, C8, C14, C15 held; one moved under a ruling (the sheet body is a static permitted terminal, not a lazy module — RF-4, the mount guard allows one lazy edge).
- The `/news` capture (C §C13) settled the arc's top unknown: seven keys, `link` on every item, vendor `date` in UTC, no item id, no `source` key, and items tagged with a symbol are often about another company — the fetcher now filters on title or ≤ 2 US names.
- Full Linux suite 1313 files / 28,912 tests, lint, build, 37 rules files on the emulator: all pass.
- The review: 38 findings, 36 held under a refuter, 26 fixed with failing-on-old-code rows, mutation lens 37/37 killed after fixes.
- Two real scripts from the founder's own data, read-only, honest about every gap they met. The plan beat is code-narrated and correct in both.

## 2. What did not land

- **Speech is unverified.** The local `ELEVENLABS_API_KEY` is the key's ID. No audio, no alignment, no stored mp3, no GCS, no audio route against a real object. The text fallback worked as designed.
- **The third script (Trend Follower) was not generated** — the four-call budget went to two regenerations (2 of 2 regenerated; RF-15).
- **The marker.** §14 says the preview's worker waits for the marker production's brief writes. Production has no marker until this PR merges; previews run no crons. See §5.
- **Rules.** The hub's client read of `huddles/{uid}/days/{etDate}` needs the owner rule published; §14 does not say so. See §5.

## 3. Rulings on the five founder questions (plus one accepted addition)

| # | Ruling |
|---|---|
| **R-16** Dissent table | **Ratified as proposed.** Every row moves a stance toward WATCH; the six ids are pinned equal to `VALID_ARCHETYPES`. |
| **R-17** Voice and key — **the flip gate** | A real key and `HUDDLE_SHADOW_VOICE_ID` on the preview (the academy voice `pNInz6obpgDQGcFmaJgB` is acceptable for the smoke if Shadow's voice is not chosen yet). **Check the production value of `ELEVENLABS_API_KEY` too**: the academy route reads the same name, so if production holds the ID, academy audio is broken today. One with-timestamps response captured during the smoke, key-stripped, committed as `api/_utils/__fixtures__/elevenLabsTimestampsCapture.js` in the flip PR, and the alignment reader's test written against it (L1-1, the C13 precedent). |
| **R-18** Battles under another archetype (L1-10, L2-2) | **Keep C15 as built.** The "Reconfirm" door shows only when the equipped archetype differs from the newest confirmation (reconfirming would help); a battle whose frozen archetype matches no confirmation and cannot be reached by reconfirming — a game deployed before a switch, a training clone with an override — reads **"not this game's approach"**, no door, status from the receipt. Confirm-per-archetype-in-play is **an S2 item**, not the flip PR's: it multiplies the plan card by archetype and is not worth it until the smoke shows the case is common. |
| **R-19** Transient voice failure (L2-1) | **In-job retry, not post-publish re-voicing.** One retry on 429 / 5xx / timeout after a short wait, inside the job's 120 s budget, no new model call. A second failure publishes text-only for the day, as now. The record's immutability (A §A2) stands; nothing re-opens a published huddle. |
| **R-20** The Wire's N1.1 boundary (RF-11) | **Yes.** Register `api/_utils/evidence/fantasyTimesStories.js` in the voice-layer consumer set as a reader that speaks headlines only as attributions ("FantasyTimes reported: …"), with a boundary test row. The trading brain never sees the text; the player hears it with its source. |
| **R-21** `HUDDLE_PLAYER_UIDS` (the builder's addition) | **Accepted as the Huddle's own cohort.** Unset = every active player, as the spec says. The flip PR sets it to Flash and the FT_QA uid first (the cockpit pattern) and widens by hand; it stays separate from `COCKPIT_ALLOWLIST_UIDS` so the Huddle never couples to the cockpit, calls or Film Room cards. `.env.example` and the flag's doc block name it. |

## 4. The script review (RF-16, RF-17, RF-18, Run A's armor beat) — four rules for the flip PR

The structure works: short beats, every name read cited, honest gaps, a correct code-narrated plan. Four things the model did that the rulebook and validator must now forbid:

| # | Rule | Where it lives |
|---|---|---|
| **R-22** A skipped source is silent | A source the job *skipped* (newsfilter every morning in S1; anything behind a missing key) produces **no pack item and no sentence**. Only a source the job *tried and could not reach* produces a `source_status` item, with the fact "couldn't reach {source} this morning." Run B's "both unavailable" and "news sources down" described sources nobody tried; that is a false claim and will recur daily for newsfilter. Forbidden terms gain **down**, **unavailable** and **outage** for sources. | `gather.js`, `packItem.js`, `SHADOW_VOICE_RULES_V1.md`, the forbidden-terms tests |
| **R-23** The armor beat speaks of the archetype in the third person | Shadow is "I", the player is "you", the archetype is "your Diversifier" / "the Diversifier". "As a Diversifier, I …" (Run A) makes Shadow the archetype; "As a Diversifier, you …" (Run B) makes the player the archetype. Both forbidden: pattern `As an? \w+, (I|you)\b`. | rulebook, forbidden-terms tests, the system prompt's armor-beat instruction |
| **R-24** Names in exposure order, checked | The validator checks that the first ticker mentioned in the names beat is the largest exposure in the gathered holdings; a miss regenerates (RF-18: Run B led with the 10 % support name because it had the only headline). | `scriptPrompt.js validateScript` |
| **R-25** A `tape` pack kind | C §C10 gains kind `tape`: one item per index from `marketContext` (`{ symbol, close, changePct, asOf }`), `verified` with its `asOf`. A tape sentence's SPY/QQQ figures then cite an item (RF-16: today they cite only an unrelated source-status item and pass A7). Checking that a spoken figure appears in a cited item is S2. | `gather.js`, `packItem.js`, C10's kind list (a one-line amendment in the flip PR's commit message, not a new amendment file) |

Also for the flip PR, no ruling needed: if the smoke's regeneration rate stays at 2 of 2, try Sonnet at **medium** effort before touching the prompt (the build ran `effort: low`); the tape beat's 380-character cap should be stated as a number in the beat's own instruction.

## 5. Before the smoke — three things the report's §14 leaves out

1. **Publish `firestore.rules` from `claude/huddle-s1`** (Firebase console, as for ID-1). The hub reads the huddle record from the client; without the owner rule the chip reads "Huddle unavailable" and the smoke proves nothing. The three server-only collections deny clients either way; publishing before merge is harmless.
2. **The marker.** Production's brief handler cannot write `huddleRuns/{etDate}` until this PR merges, and previews run no crons, so the worker alone will find nothing to do. Two ways, pick one:
   - **(a) Keep smoke-before-merge:** on the smoke morning, call the preview's **brief handler** (`/api/cron/compute-daily-regime-brief`) with the cron secret, then the worker. Cost: the day's brief is regenerated once (one Sonnet call, one rewrite of the same document). Recommended.
   - **(b) Merge first** (the build is dark; the only production effect is the marker write and a worker that exits at once), let the next morning's production brief write the marker, rebase the smoke branch, then smoke. Cleaner, but it moves the smoke after the merge.
3. **The C15 smoke, on the preview** (production's sweep is off, so a game deployed *after* confirming gets nothing until the flip): start with an active game under archetype A; switch the ranked agent to B; open the preview and confirm → the game's line reads "not this game's approach" and the Deploy card shows the reconfirm line; switch back to A and reconfirm → the game's line moves to "read by your agent at …" after its next check.

Everything else in §14 stands: `HUDDLE_PLAYER_UIDS` = your uid on the preview **before** any worker call; iPhone Safari and desktop at 360 px and wide; confirm, edit (422 preview), skip; audio stops on close and tab switch; open the preview once after 4 PM.

## 6. For the Command Center chat (with the report, per C §C9)

- **L3-11, their ruling.** Before the open, a multi-day game already scored reads as "in session" and outranks "Huddle ready" every morning. With 3–5-day battles this hides the Huddle on most mornings. Recommendation to carry: *in session* means a live game whose market session is open; a multi-day game between sessions ranks with "deployed, starts 9:30", below "Huddle ready" before the open. The fix is one predicate in `hub/huddleView.js huddleCandidateOf` or `nextAction.js`, in the flip PR, with its rows re-pinned.
- **RF-4** (sheet body static, not lazy — moved under C8), **RF-5** ("research awaiting your direction" has no rule yet; S1 added only the Huddle rule), the entry-chunk attribution table, and the Partnership summary fix (RF-23) are theirs to confirm.

## 7. Out of scope, confirmed as reported (fix nothing in the flip PR)

`api/news/stock.js:65` reads a `source` key the payload never has; `fetchRecentNews`'s missing composite (RF-1); the newsroom's phantom-key readers (C §C11); the bench RVOL stamp (C §C12); the brief's own trading-day skip and DST pin (A §A10 — flip PR); the CRLF comment stripper in `agentEvalRunsDenials.rules.mjs` (Windows only).

## 8. Housekeeping

Three WSL worktrees left on disk: `~/pd-ci-huddle`, `~/pd-ci-huddle-h`, `~/pd-ci-huddle-s`; their `node_modules` are symlinks into `~/pd-af0` — unlink before deleting.

## 9. Sequence from here

1. Send the build report and this review to the Command Center chat; bring back its hub-side check and the L3-11 ruling.
2. Pre-smoke steps (§5), then the founder smoke on the preview.
3. Merge #1032.
4. Fable writes the flip-PR prompt (Opus): R-17's capture and test, R-19, R-20, R-22–R-25, R-18's wording, L3-11's predicate, the A §A10 trading-day skip and DST pin, `HUDDLE_PLAYER_UIDS` set to the cohort, then the flag.
5. Still pending from the founder: Shadow's own voice id; newsfilter stays off (needs its own capture first).
