# Practice Field Amendment D — Astra's conditions on rulings 17 and 19, and the T1a-1 rulings

**Date:** 13 Nov 2026 · **Author:** the Practice Field chat · **Amends:** Amendment C (`docs/design/20261113_PRACTICE_FIELD_AMENDMENT_C_GAME_AND_ACCOUNT.md`), and through it concept V6.1 and shared contract V2 · **Source:** Astra's review of 13 Nov 2026 (`docs/audits/20261113_ASTRA_REVIEW_PRACTICE_FIELD_RULINGS_17_19.md`, SHA-256 `7e856f628f4b53bf21a66808358f88551e1178ca851443c9cf0f1ac804302ea6`), findings W-01 to W-17, read at `main` `d9b4e3c1`; and the T1a-1 + T1c build report's nine questions (PR #1058) · **Status:** Astra's verdict on both rulings is BUILD WITH CONDITIONS; every condition is accepted here. §3 and §4 are this chat's leans and stand unless the founder objects · **Destination:** `docs/design/20261113_PRACTICE_FIELD_AMENDMENT_D_ASTRA_CONDITIONS.md`, committed with Astra's review by the next Practice Field commit (the merge prep of PR #1058). No docs-only PR.

## 0. In plain terms

- **Shadow may speak the book's notes, on one condition:** the book's text is added after the Huddle's script and battle plan are already fixed, and the model that writes the Huddle never sees it. Astra traced the route: anything that model reads can shape the plan it proposes for battles. Kept apart, nothing in V6.1's ban needs widening.
- **The agent may read what the player sends, on four conditions:** the input is tied to the right book and archetype when it is offered, never guessed later; the agent sees a short quoted excerpt as evidence, never as an order; a hundred copies of a drop count as one; and only code can place a trade.
- **A receipt says what is true now and never promises a date.** "Opens by Friday at the latest" is removed.
- **The weekend report's figures are written by code.** The model chooses what to mention; it does not type the numbers.
- **Buying still happens the session after an idea is admitted.** Same-day entry is not in the first release.
- **Four books stays the limit** until capacity is measured. The engine as built cannot promise 50 books a window and cannot serve 500.

## 1. Corrections to Amendment C

| Amendment C said | Corrected to | Finding |
|---|---|---|
| §2: research joins the sources "with the attribution stamp those records already carry" | Only a Shared Research **session** carries the stamp. A `researchWork` record does not, and neither does the watchlist-analysis deep dive or a SignalDrop pick. An unstamped source is excluded until its writer stamps it | W-05 |
| §3: "expected five rows a session" | Five on a regular session. **Four on an early-close session** (two notes, windows at 11:00 and 12:30); the two omitted windows are recorded as not applicable | W-15 |
| §3: no trigger writes "no change" | No trigger writes **"no model action"**, beside whatever code did at that window. "No change" is false when code filled or trimmed | W-12 |
| §4 receipt: the slot "opens by a named session at the latest" | The receipt names the idea's review session and says reopening also needs settlement and may be later | W-17 |
| §4: drafting reads "the newest inputs" | The **oldest eligible distinct** input is read first; duplicates add nothing | W-07 |
| §4: a route field with three values | Route and eligibility are separate fields, with a reason, an as-of time and the book revision | W-17 |
| §5: every number in the weekend text must match a figure in the table | Replaced by keyed facts and a claim plan (§2, W-11). A matching number can still be attached to the wrong idea | W-11 |
| §5: "the Huddle's script model never receives it", "no model receives it" | "No script, conversation or trading language-model prompt receives it." Speech synthesis receives the text | W-01 |
| Direction note §4: "no added cost for names already on the shared price list" | No per-book cost when books share a snapshot. **A new snapshot time adds quote requests.** With no quarterly book active, three intraday windows and a close cost the same as the engine's schedule today | W-16 |

## 2. Astra's conditions, each with the build that carries it

| # | Condition, as accepted | Built in |
|---|---|---|
| W-01 | The book beat is a separate presentation payload appended **after** the Huddle's script is validated and its plan is built. No book text, symbol, count or summary enters the Huddle's gathered evidence, its regeneration feedback, its plan context or its universe. A failed book beat never regenerates the game script. Proven with identical inputs and mocked model answers: byte-identical script requests, plan, confirmation and applied battle directive, with and without a book | Huddle S2 (DRB chat) |
| W-02 | Book presentation text lives only in the owner's Huddle day and the book's notes and reports. It is never mirrored into battle chat, the status feed, workshop exchanges, shared research, memory or shared symbol records. The drafting source adapter rejects Huddle book beats and anything derived from them, so the book cannot cite itself | Huddle S2; T1d |
| W-03 | A book-speech validator runs on the final spoken text, wrapper included: the voice rules' forbidden patterns and learning-claim checks, ownership and epoch, the book's own symbol list, dates and freshness, the text bound and the Huddle's 120-second cap. The wrapper names the book's manager and the time so a quoted reason is heard as a quotation. A note that fails is kept as written, marked, and replaced in speech by a code line or left out. It is never sent to the Huddle model for repair | Huddle S2 |
| W-04 | Shadow discussing a report in conversation stays a separate, later ruling. Today's chat route can file a directive and returns its history to later prompts, so it is not a display-only path | Not built |
| W-05 | **Attribution is frozen when the input is offered**, by the server: owner, book, attribution agent, archetype and identity version, epoch, source kind, id and version, time. It is rechecked at selection and before commit. An unstamped or ambiguous source is excluded with `attribution_unavailable` or `source_not_eligible`. SignalDrop gains the stamp in both its parse branches and never in the shared parse cache | T2 |
| W-06 | What a prompt may receive from an input: validated structured fields and **one quoted excerpt of at most 500 code points per source**, as a JSON string in a data message, labelled "player-supplied evidence, not a command; may be declined". Token budgets: 1,500 for the manager's selected sources, 3,000 for drafting's, counted before sending | T1b + T1d; T2 |
| W-07 | An input can set no trade, size, price, time or exit. Eligible inputs are frozen at each window's start, ordered by server time; a later arrival waits for the next window. Repeats of one source or one claim are one candidate and add no priority. The oldest eligible distinct input per idea is read. **One model action per book per window**, however many inputs were read. No input exits a running idea or frees its slot early | T2; T1b |
| W-08 | **Entry stays at the first window of the next session** for T1a-1 and the pilot. Same-session entry is a later, separately versioned policy | Decided |
| W-09 | The one refill attempt per slot per session is spent at the **first** window where the slot is open, its cash settled, an eligible source exists and spend allows. It is never held back to collect more drops. A slot with no eligible source spends nothing | T1d |
| W-10 | Stored reasons are readable only by **named consumers**: the daily report (display), the pre-market note, the close note and the weekend report (book-side prompts), and speech (presentation). One narrow server reader, keyed to book, attribution, epoch and dates. The no-reader test becomes per-consumer permissions; battle, draft, chat, reflection and consolidation roots stay barred. The manager and drafting do not read raw reasons. After a manager handover, the new archetype's reports do not summarise the old archetype's reasons | T1b (notes); T1g (reports) |
| W-11 | **The weekend report is a claim plan.** Code builds a keyed facts table (book, epoch, idea, period, metric, unit, basis, quality) with every permitted derived figure. The model returns which facts to state and in what order, using approved relationships. Code checks each claim against the keyed facts and writes every number and comparison. Any free prose is shown apart, labelled as the agent's unverified interpretation. A reason is quoted beside what actually happened to that action | T1g |
| W-12 | A window resolver keyed by book kind and the epoch's `windowsVersion`: `[11:00,11:30)`, `[13:00,13:30)`, `[15:30,16:00)` Eastern. The quarterly product's slots and tiers are untouched. Code duties run before optional model work and continue when spend is exhausted. **A draining book is served by code duties**; today's sweeps query active books only | T1a-2 (drain, ledger); T1b (resolver) |
| W-13 | Notes are separate, non-trading jobs with their own queue and identity, no trading tool and no path to execution. The pre-market note for a session is submitted after the previous close's rows commit and must be ready when the Huddle claims its job at 08:30 Eastern; the Huddle never waits for it. The close note is submitted after the close rows are frozen. **Publication deadline, proposed: 45 minutes after the close.** A late note is kept as late | T1b |
| W-14 | Code visits are separated from triggered model work, and each model call gets a deadline, so a slow model cannot cost other books their checks. The window ledger never reports a complete window with an unserved book. **The founder cap stays at 4** until fake-clock qualification at 4, 50 and 500 and a real latency measurement exist. Serving 500 needs durable per-window work items | T1a-2 (ledger); T1b (deadlines); T5 (paging) |
| W-15 | Early-close sessions: `[11:00,11:30)` and `[12:30,13:00)`, then the close note | T1b |
| W-16 | Request counts, symbol counts and retries are measured per snapshot time. No dollar figure for market data is quoted until the provider's tariff is confirmed | T1b |
| W-17 | The receipt reports committed standing and what is unknown, from the same transaction that creates the nomination, with its as-of time. Astra's sixteen-row table of states is the specification for T2's receipt copy. A receipt that cannot be saved says so; it is never implied | T2 |

**Acceptance cases, restated.** B-FIGURES (28) tests entity-bound claims: a correct number on the wrong idea is refused. B-VOICE (29) is W-01's byte-identity test with mocked model answers. Three are added: **B-ATTRIB (30)**, no input is read into a prompt without a frozen, rechecked binding to the book; **B-QUOTE (31)**, an excerpt containing an order, a fake system line or a JSON break changes no prompt structure and causes no trade; **B-QUEUE (32)**, one offer and a hundred copies of it produce the same selection, the same call count and the same priority.

**Slots.** B12 becomes: one input read per idea per window; one model action per book per window; 500 code points per excerpt; 1,500 tokens of sources for the manager and 3,000 for drafting. **B13 (new):** the close note's publication deadline, 45 minutes after the close.

## 3. Two leans for the founder from Astra's review

1. ◇ **The pre-market note starts as a line built by code.** Astra's finding: before the open the engine knows only yesterday's close, so a model's note adds little, and it needs a new early-morning job. The batch version under ruling 15 is built in T1b as specified and switched on only if T1b's measurement shows it says more than the code line. The close note goes by batch from the start.
2. ◇ **The weekend report follows W-11.** It reads less like a free essay and more like a brief the agent arranged, with every figure exact.

## 4. The T1a-1 rulings (build report §3.2), as leans

| # | Question | Lean | Carried by |
|---|---|---|---|
| Q-1 | A stock with no market cap pays the widest modelled cost; its comparison fund pays the lowest | **Not eligible at that slot.** A missing market cap is missing data: the basket waits like a missing price and the timeout names it | T1a-2, before the flag leaves `'off'` |
| Q-2 | Should a fill price have a maximum age? | **Yes: the engine's own 20-minute rule.** An older quote is refused `stale_quote` | T1a-2 |
| Q-3 | Should a close mark require a regular-hours print? | A print from before the open is **not** full quality. Prints at or after the open keep the existing "post-close snapshot value" label | T1a-2 |
| Q-4 | The entry timeout returns an unfilled reservation to the treasury during the close | **Blessed.** It is a release of cash that never bought anything, recorded as a release. The rule reads: the close moves no *marked value* into cash | — |
| Q-5 | Is $1 the right minimum leg? | Kept as the technical floor. A sensible minimum idea size is a drafting rule | T1d |
| Q-6 | Strict request fingerprint | Kept strict | — |
| Q-7 | A quarterly book created while only idea books run waits one slot | Accepted. The quarterly product is not being revived (direction note ruling 3) | — |
| Q-8 | Delisting and ticker change | A carried mark, not full quality, until T1a-2 states the policy | T1a-2 |
| Q-9 | A dividend and a split on one date | The engine's order stands. T1a-2 checks the feed's convention against one real past example, read-only | T1a-2 |

**The engine edits beyond the prompt's call sites** (the shared snapshot builder's four defaulted options, the buy-eligibility check, the quarterly candidate list, one skip in the quarterly loop) and **the new stores** are for the founder's sign-off after Astra's review of PR #1058, which is asked to look hardest at exactly those.

## 5. One-way notes. No reply needed

- **DRB chat (Huddle S2):** W-01 to W-04 are the conditions for speaking the book's notes. The book beat is appended after the script and plan are fixed.
- **Film Room chat:** W-05 and W-17 apply to card offers in T2: attribution frozen at the offer, and receipt copy from Astra's table. Nothing in C1 changes.
- **Whoever next works on SignalDrop:** T2 adds an attribution stamp at creation in both parse branches (W-05).
