# DRB Redesign — "Huddle" — Concept V1.2

**Internal arc name:** DRB (Daily Regime Brief). **Player-facing name:** *Huddle* — "Huddle with Shadow". The artifact it produces is the **game plan**.
**Supersedes:** `20261029_DRB_HUDDLE_CONCEPT_V1_1.md`. V1.2 adjudicates Astra's Oct 29 review (AR-1–AR-12, verdict REWORK) under founder rulings R-6–R-10; the changes are listed in §10.
**Status:** concept V1.2, adopted. Next: S1 Phase 0 discovery, then the S1 build spec.
**Destination when committed:** `docs/design/20261029_DRB_HUDDLE_CONCEPT_V1_2.md`, carried in the first build PR (no docs-only PR)
**Grounded on:** `docs/audits/20261028_PHASE0_DRB_DISCOVERY.md` (branch `claude/drb-phase0`), the Astra review of V1.1 (Oct 29), and the founder rulings in §9

---

## 0. In plain terms

Every weekday at 8:30 AM ET, Shadow records a 60–90 second huddle for each player. It is about *that player's* names: what moved overnight and why, what is scheduled today, and what the equipped archetype makes of it. While Shadow talks, cards change on screen in step with the words. The huddle ends with a **game plan**: Shadow's proposed lines, leans and posture for the day. One tap confirms it, and it reaches the agent at its next check in every game the player is in that session. At the close the plan is graded two ways, *did the agent do it* and *did it work*, and the next huddle opens with that grade.

The habit: listen, tap once, done. Talking back comes later.

What it changes for the agent: nothing reads the huddle itself. The agent reads only what the player confirmed, through two slots it already reads at every check. No protected file is touched.

---

## 1. Goals and non-goals

**Goals**
1. A daily habit that shows what a partner agent can do: news explained against the player's positions.
2. The player's decision reaches the agent, honestly and visibly, in whichever games they play.
3. A record that can be graded, so the habit has a payoff and the archetypes get evidence.
4. Voice is the primary channel; cards and transcript make it work muted.

**Non-goals for V1**
- Two-way conversation with Shadow (V2; needs microphone and WebSocket header changes).
- The trading brain reading the huddle (ruled out).
- Hard guarantees from the plan's lines (they are instructions the agent reads, not gates).
- Changing deploy times or the 8:30 generation time.
- Any edit to a fenced file (R-6).

---

## 2. The average huddle, beat by beat

Target 70 seconds. Beats 0 and 3 are omitted when they have nothing to say; the huddle is never padded.

| # | Beat | ~s | What Shadow says | What the card shows | Source |
|---|------|----|------------------|---------------------|--------|
| 0 | **Yesterday's plan** (day 2 onward) | 8 | "Yesterday's plan: the fade in A, done and it paid. The hold on B, done, didn't work." | Yesterday's plan with two marks per stance: *did it* ✓/✗/?, *worked* ✓/✗/? | the huddle record's grade (§5) |
| 1 | **The tape** | 10 | One or two lines on the day: regime, breadth, what's scheduled | Tape card: regime and sector bars, plus a timeline strip of today's events | market context; EODHD economic events; earnings calendar (capped) |
| 2 | **Your names** | 30 | 1–3 names touched overnight, biggest exposure first: the fact, the source, Shadow's read | One card per name: a real prior-session chart with marks (the gap, the agent's entry, a line level); the overnight headline with its source and time | holdings across the player's active battles plus the watchlist; newsfilter.io query by ticker since prior close; EODHD news and sentiment; the agent's own trades |
| 3 | **The armor's take** | 10 | The equipped archetype, in its own voice | Stance chip on the names card; a dissent line if it disagrees | archetype method prompt (persona layer, not the trading brain) |
| 4 | **The game plan** | 10 | "Here's what I'd carry in today." Lines, leans and posture | The game plan card, with **Confirm** and **Edit** (full edit) | the beats above |
| 5 | **Status** (text, not audio) | — | — | A live line from receipts: *proposed → confirmed → written → heard → superseded → expired*, per battle | the huddle record and the tick capture |

**The audio ends at Beat 4.** Pre-recorded speech cannot know whether the player confirmed, edited, or skipped, so the close is a live text line, never a spoken promise (AR-5).

**Words the huddle may not say.** No clock times for the agent ("9:30") — it says "at its next check." No pre-market prices unless a priced pre-market source exists (S1 Phase 0 decides; otherwise Shadow says "overnight news," and the chart is the prior session). "Quiet" means "nothing found in the sources we checked." (AR-4, AR-6)

**Quiet day.** ~30 seconds: tape, "nothing found on your names," and a stand-pat plan with nothing to confirm.

**Where it lives.** A chip under Shadow on the hub ("Huddle · 1:10"), and tapping Shadow (hook requested from the Shadow redesign lane later). The game plan's home is the hub's **Partnership** area, as its own record (§3). The hub's brief card goes away. Never autoplays; transcript always shown; captions on the cards.

---

## 3. The game plan

**Fields**
- `tape`: one line.
- `names[]`: ticker, fact (source, time), Shadow's read, stance (`hold | trim | chase | fade | watch`).
- `lines[]` (≤2): hard-worded instructions ("no adds before 10:00 data", "fade A above 48", "no swaps today").
- `leans[]`: soft preferences ("favor the industrials pop").
- `posture`: one of the agent's **three real presets** — `aggressive | balanced | defensive` — with each one's actual effect printed on the card (read from the preset config in S1; "defensive" still trades). "Stand pat" is not a posture; it is a line. (AR-2)
- `dissent[]`: where the archetype disagrees and what it will do instead.
- `session`: the trading session the plan belongs to (ET date, holiday- and early-close-aware).
- `revision`: hash of the exact text confirmed, so a later edit is a new revision (AR-5).
- `status` with timestamps: `proposed | confirmed | skipped | expired`.
- `applications[]`: one receipt per battle — `battleId`, `writtenAt`, `heardAt` (first check whose capture shows the plan in the prompt), `supersededAt` (a chat or cockpit directive replaced it), `expiredAt`.
- `grade`: filled at the close (§5).

**How it reaches the agent (R-6, AR-1)**
| Plan part | Slot the agent already reads every check | Note |
|---|---|---|
| `lines[]` + `leans[]` + the stance list | the in-game instruction slot (`battle.directive`), as **one composed instruction** | the "confirmed-lean list" is not used: it only switches off standing leans, it cannot carry new ones |
| `posture` | the day's preset (`battle.strategyPreset`) | owner-writable today; mapped to the three real values |

Both writes go through **one new server route** that validates the owner and the session, is idempotent per `(plan, revision, battle)`, writes atomically, and records the receipt. The shared directive writer has no authorization of its own, so the route supplies it (AR-3).

**Application rule (R-3, R-7, AR-3, AR-4).** A confirmed plan applies to **every battle the player owns in that session**, each with its own receipt:
1. at Confirm, for every battle that already exists (ranked, deployed from 7:00);
2. right after a deploy from the hub, the app asks the route to apply the pending plan to the new battle;
3. a small **sweep at the start of the agent's check**, outside the fence, applies a still-pending plan to any battle that lacks a receipt (covers late ranked seats and any deploy path the app missed). S1 Phase 0 confirms the sweep's home is not a fenced file; if it is, the sweep is dropped and late seats show *pending* until the player next opens the hub.

No hook in battle creation. A plan never attaches to a battle from another session (a deploy after 3:15 PM is tomorrow's battle and gets tomorrow's plan). A plan **expires at the stock-session close** (R-9, also for battles holding crypto); the next morning's generation clears any slot the expired plan wrote, so yesterday's instruction never rides into today. A chat or cockpit directive filed later replaces the plan's instruction, and the receipt says *superseded*.

**Guardrails.** Leans are soft: the archetype may decline one that conflicts with its method and says so in `dissent[]`. Lines are read every check but not guaranteed, stated on the card. The trading brain never reads the plan's prose beyond these two slots.

**Partnership home (AR-10).** The plan lives in the Partnership area as a **trading-control record for one session**. It is not partnership memory, not a research preference, and not proof of learning; it never becomes a standing preference on its own.

---

## 4. Cards

1. **One card per beat**, flipped on the audio's timestamps (character-level alignment from ElevenLabs; the script carries beat markers).
2. **Code draws, the model chooses.** The model writes a small chart spec; a deterministic renderer plots real price data. A **spec validator** rejects: unsupported symbols or ranges, future or stale series, marks at prices the series doesn't contain, invented entries, axis choices that hide the move, and any raw SVG or URL from the model. Pre-market bars are excluded unless S1 Phase 0 finds a priced source (the Film Tape bars exclude them). (AR-9)
3. **Diagrams from templates first**; freehand later.
4. **Every card carries its receipt:** data source and as-of time; marks labelled as Shadow's read.
5. **Cards live on** with the huddle record; shown in the Film Room next to what happened; each name card opens the research modal ("dig in" to Shared Research later).
6. **Phone first.** SVG rendered server-side, design tokens, no horizontal scroll.

**Card types in V1:** tape card, event strip, name card, stance chip, game plan card, grade card.

---

## 5. Grading at the close (R-8, AR-7)

Two marks per stance and per line, shown side by side, never merged:
- **Did it** (compliance): from the tick capture and the trade list — did the agent's actions match the stance in its window? `✓ / ✗ / ?`
- **Worked** (outcome): from the Film Tape price series — did the price path favor the stance in its window? `✓ / ✗ / ?`

Each stance has a defined observation window and criterion (written in the S1 spec, e.g. *fade A above 48*: compliance = no buy of A at or above 48 after the plan was heard; outcome = A closed below its level). `watch` has outcome only. Free-text or edited lines that match no defined pattern are graded `?` on compliance. Anything unsupported by records is `?`, never guessed. A plan that expired unapplied is graded *not applied*. Grading runs for **every battle that completed that session**, not only the evening's expiries, and the trade list's 50-entry cap is checked before trusting compliance.

The grade card goes into the Film Room beside the battle, into the Partnership plan history, and becomes Beat 0 of the next huddle. A running tally per player and per archetype is the evidence the Practice Field will later turn into plays. V1 records; it does not promote anything to a play.

---

## 6. Inputs, generation, voices and cost

**Shared layer, computed once at 8:30:** market context (prior close), EODHD economic events for today and the week (replaces the hand-entered calendar), earnings calendar capped as in the stale fix (note: the feed carries no market caps, so size claims are not made).

**Per-player layer:** equipped archetype; equipped watchlist and thesis; holdings and yesterday's trades across the player's active battles; yesterday's plan and grade; the agent's latest lesson; overnight news for the player's tickers (newsfilter.io query by `symbols`, since prior close, paginated; EODHD news and daily sentiment per ticker).

**Pipeline (AR-8).** The 8:30 cron does not generate; it **enqueues one job per active player**. A worker drains the queue within its time budget (the existing persisted-cursor queue pattern is the model; one worker cron entry is acceptable under the cron budget, with the §6 count line updated). Each job is idempotent per `(player, session)` and retried on failure. **Each ticker is fetched once per morning** into a shared cache, so EODHD and newsfilter calls scale with distinct tickers, not players. One Sonnet call per player returns the structured script (beats, card specs, plan) → renderer draws SVG cards → ElevenLabs renders audio **with timestamps**, dialogue mode for the archetype line (the existing single-voice endpoint is a code reference only) → stored: audio in storage, cards/plan/transcript in one huddle record → served through the app's own routes (no CSP change) → client player.

**8:30 through DST (AR-4).** The generation time is pinned to ET with a timezone guard; the current brief cron drifts to 7:30 ET when clocks change.

**Voices (R-2).** Shadow plus the six archetypes. Voices do not drive cost; generated audio does.

**Cost.** ~25 minutes of speech per player per month; tier decided with cohort size, after checking the chosen model's credit multiplier on the account. Levers: short huddles, the shared tape beat rendered once, no archetype line on quiet days.

**Measurement from day one (AR-11):** listens, completions, confirmations, per player per session.

**Flag:** `DRB_HUDDLE_ENABLED`, dark by default, separate flip PR. The flag is added to the pinned flag registry like any other; it authorizes nothing else.

---

## 7. Honesty rules
1. Never autoplay; transcript always visible.
2. Status comes from receipts, per battle, and the audio never states it.
3. No clock-time promises for the agent; "at its next check."
4. No card claims the agent saw something it didn't; chart data is real and validated; marks are labelled as Shadow's read.
5. Pre-market numbers only with a priced source; otherwise "overnight news."
6. "Nothing found in the sources we checked," never "nothing happened."
7. Lines are instructions, not guarantees, on the card itself.
8. The trading brain never reads the huddle. The post-game chat's lesson path still feeds the next deploy without confirmation; closing it is its own task.

---

## 8. Lane boundaries and fence manifest
- **This arc owns:** the huddle, the game plan, the cards, the grade, the Partnership area's content, removal of the hub's brief card, the apply route, the check-start sweep, the queue worker.
- **Fence contact: none intended.** Not touched: battle creation, the decision and prompt-assembly files, the control renderer, the swap executor. S1 Phase 0 produces the file-level manifest (every file S1 touches, fenced or pinned yes/no). If any item needs a fenced file, it is dropped or redesigned, not authorized (R-6).
- **Shadow redesign lane:** one hook requested after its build lands: tap on Shadow plus a *speaking* state.
- **Shared Research (hub chat):** "dig in" lands there once its feasibility review is done.

---

## 9. Founder rulings
**Oct 29, 2026 — concept V1 → V1.1:** R-1 name (Huddle / game plan; DRB internal); R-2 all seven voices; R-3 apply at the next check, pending until a battle exists, both games; R-4 matchup preview deferred; R-5 full edit before confirm.

**Oct 29, 2026 — Astra review → V1.2:**
- **R-6** No fence work. Route around: composed instruction + preset only; apply at confirm, after hub deploy, and by a check-start sweep outside the fence; no battle-creation hook.
- **R-7** One plan applies to every battle the player owns that session, with a receipt per battle.
- **R-8** Two grades per stance, *did it* and *worked*, shown separately; unsupported cases `?`.
- **R-9** Plans expire at the stock-session close, including battles holding crypto.
- **R-10** The flag flip waits for: the grade visible the next morning, all seven voices, the transcript fallback, and receipt-based status.

**Standing (discovery FQ-1–5):** stale brief fixed separately (PR #1009); honest age on the old card; the trading brain never reads the brief; live slots are the only path; EODHD economic events replace the hand-entered calendar.

**Approved by default unless the founder objects:** the huddle record (one per player per session); the apply route with owner/session validation, idempotency and receipts; the check-start sweep; the queue worker; the chart-spec validator; the ET timezone guard; grading in an evening job covering all completed battles.

---

## 10. Changes from V1.1 (Astra adjudication)
| AR | Change in V1.2 |
|---|---|
| AR-1 | `leanOverrides` dropped; leans ride inside the composed instruction |
| AR-2 | posture = `aggressive / balanced / defensive` with real effects; "stand pat" is a line |
| AR-3 | no battle-creation hook; apply route with owner/session checks, idempotency, receipts; sweep at check start; both games with separate receipts (R-7) |
| AR-4 | ET guard on 8:30; plans bound to a session; no cross-session attachment; explicit expiry at the stock close (R-9); no "9:30" wording |
| AR-5 | status states and per-battle receipts; audio ends at the proposal; revision hash on confirm |
| AR-6 | provenance rules for prices, caps and coverage; "nothing found in checked sources" |
| AR-7 | two grades (R-8), defined windows, `?` for unsupported, all completed battles graded |
| AR-8 | queue + worker, idempotent per player-session, shared ticker cache |
| AR-9 | chart-spec validator; pre-market excluded unless sourced |
| AR-10 | plan is a session trading-control record, not partnership memory |
| AR-11 | release criteria (R-10) and day-one measurement; timestamps + dialogue endpoints |
| AR-12 | fence manifest produced by S1 Phase 0; flag authorizes nothing else |

---

## 11. Slices and release criteria
- **S1 — The huddle:** queue + worker, per-player script, game plan, audio with transcript and timestamps (Shadow voice), hub chip, Partnership home, apply route, sweep, receipts, measurement counters. Text-only cards.
- **S2 — The grade:** close-of-day scoring (two marks), Film Room card, Partnership history, Beat 0.
- **S3 — Cards:** chart renderer + validator, event strip, sync to timestamps, cards stored on the record.
- **S4 — Voices:** the six archetype voices in dialogue mode; diagram templates.
- **S5 — "Dig in" to Shared Research; matchup preview (after roster visibility is decided).**

**The flip waits for S1–S4** (R-10). Each slice: Phase 0 where new ground is touched, Opus builds from a prescribed prompt, Fable reviews, the founder smoke-tests and merges, flag flip separate.
