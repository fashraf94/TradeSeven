# Stock Research Modal — Design Direction V2

**Date:** October 17, 2026 · **Status:** direction of record for the research-modal redesign; supersedes concept V1.1 and its Amendment A as the governing document (both remain the record of how we got here). Rulings R-12–R-15 (§1) are presented approve-by-default. One more Claude Design round (§6, three screens, same session) closes the design phase; then Phase 0.
**Inputs:** concept V1.1 (Oct 17), Amendment A (Oct 17), Claude Design batch 1 (Bomb mode, screens 5–6) and batch 2 (Analysis & Technical, screens 1–4 and 7), and the founder's reads of both.
**The rule that governs everything below (from the cockpit arc):** the mockups contribute structure, behavior and vocabulary; the skin comes from the shipped tokens; no imported hexes.

## 0. What the two design rounds established (plain terms)

**Batch 1 — Bomb mode.** Adopted: the Fuse as the 💣 chart (rail, rungs, banked check at its time, live bead, ghost sparkline with the 15-minute checks as dots); the red zone as a mode (rung as goal line, pulse trace, distance as the biggest number, next-check clock, `LIVE · SCORED` chip, banked moment, closed-market state); the derived heat accent. Amended by Amendment A: Bricks demoted to the ladder's unit; one sheet for both Bomb views; the label-collision rule.

**Batch 2 — Analysis & Technical.** Adopted: every in-battle card is a record with a timestamp; "watching for" scoped to the receipt; the three-verdict read stack; the six-lens row shape; the action row as two labeled buttons; **screen 7's pinned-record chart as the shape of the in-battle Analysis tab.** Founder's read: the shape — curiosity first, research driven by the player and assisted by the agent — is right; but too much is shown at once with no path through it, and the voice must be the equipped archetype, not Shadow.

## 1. New rulings (approve-by-default)

| # | Ruling | What it changes for the player |
|---|---|---|
| R-12 | **The archetype is the voice in battle; Shadow is not in the modal in V1.** Every in-battle line, the empty state, the narration and the Ask button name the equipped archetype ("Trend Follower's read", "Trend Follower hasn't looked at this one", "Ask Trend Follower: …"), with the agent's given name as a chip. The six-lens card's rows are the real six archetypes — Trend Follower · Contrarian · Speculator · Capital Preserver · Diversifier · Fundamental Investor — with the equipped one pinned first and marked *Equipped · {agent name}*. Mockup names (Vanguard, Ledger, Tempest, Compass, Anchor, "Shadow" as a row) are placeholders and do not ship. | The partner you chose is the one talking. |
| R-13 | **Open on a question; unfold in three layers.** *Layer 0 (on open)*: stance line · the archetype's latest sentence from the record · the chart with record pins collapsed to dots · the three playbook questions as the main surface · a tucked row (News ·n· / About / Wall St) · the action row. Everything above the action row fits one phone viewport (the designer's 844 px fold) — a hard constraint, measured. *Layer 1 (tap a question)*: an **evidence pack** of three to five items that bear on that question, built from the record and the computed facts, **ordered by the equipped archetype's weights and constraints** (read from existing config, never edited); each item lights its pin on the chart; the Ask button now carries the question. *Layer 2 (tap Ask)*: the archetype's voiced answer, in the modal, with the pack as its receipt; the exchange is filed to chat so chat and cockpit know it happened (one exchange, two renderings). The Technical tab unfolds the same way (§2.3). | One line and a question on open, instead of three screens of cards. |
| R-14 | **Plain words on the player's side of the glass.** Record kinds and states render with plain labels (§3); ledger vocabulary (WHY?, TAPE, CALL, OPEN, HELD) stays in the data, not on the screen. Rule reasons in the six-lens "why" render through plain templates ("Volume isn't there yet — 1.1× vs the 1.5× it wants"), one template per verdict input; the raw rule stays one tap away for the player who wants it. Honesty is unchanged: plain words describe the same record. | A casual player can read it; a trader can still see the rule. |
| R-15 | **The evidence pack is deterministic and archetype-ordered; only Ask spends a message.** Tapping a question costs nothing and calls no model: the pack is assembled from records and facts, and the archetype's priorities decide what leads. Ask is one message (budget per Phase 0), answered from the pack and the charter. Each pack is labeled *what {archetype} weighs* so the emphasis is honest about its source. | Different archetypes show different evidence first — guaranteed mechanically — before any voice speaks. |

Standing rulings R-1–R-11 as amended (Amendment A: R-4′, R-11′) remain in force; the consolidated ledger is §5.

## 2. The modal, mode by mode (structure · behavior · vocabulary)

### 2.1 In-battle Analysis (our lens) — the pinned chart

- **Chart:** the 1D/1W chart with the record pinned to it — entry, the stop and target from the latest receipt on the price axis, each check and beat as a dot at its time, the player's call as a dot, banked rungs lit. Pins are dots by default; one opens at a time (the latest, or the one a pack item points to). Batch 2's screen 7 is the reference.
- **Layer 0:** `Holding since Tue 10/13 · entry $154.76 · +4.3% · +15 banked` · the archetype's latest line (one sentence, verbatim, timestamped: *"Trend Follower · Fri 1:15"*) · the three questions as large buttons — *Does this help us catch up?* · *Does this protect the lead?* · *Is this better than what's stalled?* · tucked row: `News · 2` · `About` · `Wall St: Buy · 24` · action row: *Ask Trend Follower* (disabled until a question is chosen, label says so) · *→ Cockpit*.
- **Layer 1 — the packs** (each item is a fact with its source and a pin):
  - *Catch up:* distance to the next rung and its points; what moved the name since entry (the computed facts that apply); the archetype's conditions for staying in or adding (from its constraints); the stalled holding it is being compared with.
  - *Protect the lead:* the stop from the receipt and the distance to it; drawdown from the high since entry; points banked and what the next check can change; the archetype's risk register (from its constraints).
  - *Better than what's stalled:* the holdings with no rung progress in the last N checks; side-by-side distance-to-rung; the archetype's rank view of each.
  - Order within a pack = the archetype's weights. A Capital Preserver's *protect the lead* leads with the stop and drawdown; a Speculator's leads with volume and distance to the rung.
- **Layer 2 — the answer:** the archetype's reply card (voice placeholder in design), headed by the question, footed by *from: the items above*, with a `filed to chat` chip. The next question stays one tap away.
- **Unexamined name:** Layer 0 reads *"Trend Follower hasn't looked at this one"* with the stance *In our universe · not examined* (or *Not in our universe*), the three questions still offered, and the pack built from facts only (no record items) — labeled as such.

### 2.2 Browse Analysis (six lenses)

- Six rows, real names, verdict chip (*Would take it* / *Would pass* / *Watching*) + one line in voice; equipped archetype pinned first and marked. One row expanded at a time; its "why" is three to five plain-template reasons with the raw rule behind a disclosure. Header: *Archetype reads · as of {date} · not your agent*. The `Our lens · live battle ›` chip switches to §2.1 when a battle is live.
- Below: rank snapshot (one line → Ranks tab), `News · n`, `About`, `Wall St` chip, **My read** (one line + direction/horizon chips; stored on the agent's record with user provenance), action row *Watchlist* · *My read*.

### 2.3 Technical — unfolded

- **Layer 0:** the three verdict words with their row names (*Weekly trend · UP* / *Daily setup · BREAKOUT* / *Intraday trigger · HOLDING*; the intraday row reads *No intraday data for this name* when there is none) · the named setup (*2-week base breakout*) · the narration: two sentences in the archetype's voice in battle (neutral in browse), written from the facts · `Show the numbers`.
- **Layer 1:** tap a verdict → its two or three facts as plain lines and its level or bar highlighted on the chart.
- **Layer 2:** `Show the numbers` → the facts grid (RSI, MACD, 20/50/200-day, volume vs 30-day, 52-week range), the levels (tap → drawn), as shipped after the honesty fixes.
- **Draw the Line:** a disabled drag handle on the chart's right edge labeled *Dials coming* until the exit dials ship; never a button.

### 2.4 Bomb mode

As batch 1 and Amendment A: the Fuse as the 💣 chart with the ladder as its spine and brick ticks between rungs; the red zone's three states; one sheet (ladder rail + *what has to happen*); action row *Ask {Archetype}: hold through the {time} check?* · *→ Cockpit*. The Bomb Ask uses the same three-layer pattern: the question is preset, its pack is the ladder, the next check, the stop and the scored price.

### 2.5 The action row (Amendment A, R-4′)

Two buttons on every sheet, each naming its object. In battle: the Ask with its question and a cost chip (*· 1 message*) · *→ Cockpit*. Browse: *Watchlist* · *My read*. No Direct in the modal (it lives in the cockpit); no Draw the Line button.

## 3. Vocabulary — what the player sees (R-14)

| Data | On screen |
|---|---|
| Why? line from a check | **What it decided** · Fri 1:15 |
| Tape beat | **What happened** · Thu 1:15 |
| Player's call / answer | **What you told it** · Thu 1:38 |
| `OPEN` (call still in effect) | *still in effect* |
| `HELD` / `HOLDING` | *Holding* |
| `+15 BANKED` | *+15 banked* |
| Watching-for (receipt-scoped) | **What it's watching** · from the 1:15 check |
| Wire | **News it read** |
| Verdicts (six lenses) | *Would take it* / *Would pass* / *Watching* |
| Rule reason | plain template, raw rule one tap away |
| Archetype voice attribution | *{Archetype} · {time}*, agent name as a chip |
| Red zone | *Red zone* · *to +15* · *next check 3:48* · *live $160.27 · scored $160.19 at 1:00* |

The honesty registry's forbidden-terms test applies to every template; nothing above claims an input the record does not carry (on a held name today the receipt may show the stop and target but not RSI/RVOL — the design renders what the receipt has, not the mockup's example).

## 4. Skin and motion

Skin: shipped tokens only; the heat accent is a derived token. Motion: the Fuse bead's halo; the red-zone trace and clock; the banked moment is the one loud animation; pins open with the same `smooth` token the cockpit uses; reduced motion → instant. Mobile first; desktop variants for the in-battle Analysis, Browse and Technical screens follow the shipped board | pane split.

## 5. Rulings ledger (consolidated)

R-1 two modes by entry point · R-2 the read from records, Ask the only new text · R-3 six lenses: verdicts first, one cached voice call · R-4′ two labeled actions per mode, Direct in the cockpit, Draw the Line a gesture · R-5 the chart is the agent's record · R-6 the three-row read stack from computed facts · R-7 folded into R-11 · R-8 mobile first · R-9 Wall St as a chip · R-10 three playbook questions · R-11′ Bomb mode: the Fuse, the red zone, one sheet, bricks as the ladder's unit, no synthesized candle, label-collision rule, red zone as the modal's mode · **R-12 archetype voice, real six names, no Shadow in V1 · R-13 open on a question, three layers, Layer 0 above the fold · R-14 plain words, raw rule one tap away · R-15 deterministic archetype-ordered packs, only Ask spends a message.**

## 6. Claude Design round 3 — the last round (same session)

**Paste into the existing Claude Design session** (it holds batches 1 and 2). Attach this direction.

---

Round 3, same project. Read Design Direction V2 (attached). Two corrections from the founder's read of batch 2, both structural: (1) too much is shown at once — the modal must open on one line and a question and unfold in three layers (V2 §1 R-13, §2.1, §2.3); (2) the voice in battle is the equipped archetype, never "Shadow" (R-12); the six archetypes are Trend Follower · Contrarian · Speculator · Capital Preserver · Diversifier · Fundamental Investor. Apply the plain-word vocabulary in V2 §3 everywhere. Keep the shell, skin, sheet geometry and action row from batches 1–2. Phone width only.

**Hard constraint for every Layer 0:** everything above the action row — the chart included — fits inside your 844 px fold line. Draw the fold.

**Deliver three screens, each in its layers:**
A. **In-battle Analysis — EOG held, Trend Follower equipped.** A0 on open: stance line, Trend Follower's latest sentence (placeholder, timestamped), the pinned chart with pins as dots, the three questions as the main surface, the tucked row (`News · 2` · `About` · `Wall St: Buy · 24`), the action row with the Ask disabled until a question is chosen. A1 after tapping *Does this protect the lead?*: the evidence pack (four items: the stop from the receipt and its distance; drawdown from the high; +15 banked and what the 1:30 check can change; Trend Follower's risk rule in plain words), each item lighting its pin on the chart; the Ask button now reading *Ask Trend Follower: does this protect the lead? · 1 message*. A2 after Ask: the reply card (voice placeholder), *from: the items above*, `filed to chat` chip, the other two questions one tap away. Also A0 for the same stock with **Capital Preserver** equipped — same screen, different first sentence placeholder — and A1 for it, where the pack's order changes (stop and drawdown lead; show the difference).
B. **Technical — EOG, 1W.** B0: three verdict words with row names, the named setup, the two-sentence narration placeholder attributed *Trend Follower · 2:47 PM*, `Show the numbers`, the disabled *Dials coming* handle. B1: *Daily setup · BREAKOUT* tapped — its facts as plain lines and the base top highlighted on the chart. B2: `Show the numbers` open — the facts grid and the levels as in batch 2.
C. **Browse — CEG from search, Trend Follower equipped on the live battle.** The six real archetypes, the equipped row pinned and marked *Equipped · {agent name}*, one row expanded with four plain-template reasons and a `rule ›` disclosure, the `Our lens · live battle ›` chip, rank snapshot, `News · 2`, My read, the action row.

Caption each state with one line. Voice stays in placeholders.

---

## 7. After round 3

Founder read → freeze V2 (a one-line amendment if the round changes anything) → **read-only Phase 0**, which must answer: the modal's entry points and their game context; what the battle record, receipts, tape and call records expose per symbol (and what a held name's receipt actually carries today); **the scoring cadence — whether a rung banks only at the scoring check, the check schedule, and which price the check reads** (the next-check clock and the `LIVE · SCORED` chip depend on it); the 💣 and 1-minute data sources, their lag, and the live-candle synthesizer; the typical 15-minute move per stock (the red-zone band); **how a modal Ask enters the chat path with an evidence pack attached, and which budget it spends**; whether the archetype weights and constraints can order a pack and compute a per-stock verdict without fence contact, and the universe agreement rate across the six (concept §4 — decides whether six lenses ship in V1); what the Feb 2026 pattern/confluence services still compute. Then spec V1 and the builds: **A** Bomb mode · **B** Technical unfolded + the chart layer · **C** in-battle Analysis (pinned chart, packs, Ask) · **D** six lenses + My read (gated on the agreement rate).

## 8. Open founder questions (defaults stand unless amended)

- Q-1 New user, no archetype, browse → all six lenses, *equip one* as the row action.
- Q-2 My read in battle → browse-only in V1.
- Q-3 Named setups → authored from the founder's multi-timeframe method (five to eight), the Feb detector as implementation.
- Q-4 Red-zone band → 1% for design, measured band after Phase 0.
- Q-5 (new) The Ask button names the archetype; the agent's given name is a chip. *Default: yes.*
- Q-6 (new) Shadow appears nowhere in the modal in V1; a later "Shadow noticed you looked at this" belongs to the Shadow/learning arc. *Default: yes.*
