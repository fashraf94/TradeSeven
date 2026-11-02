# Research Modal Concept V1.1 — Amendment A

**Date:** October 17, 2026 · **Amends:** `RESEARCH_MODAL_REDESIGN_CONCEPT_V1_1_OCT17_2026.md` (R-4, R-11) · **Trigger:** the founder's read of the first Claude Design batch (Bomb mode, screens 5–6)
**Status:** founder rulings approve-by-default; the batch-2 Claude Design prompt in §3 runs once they stand. Direction V2 consolidates everything after batch 2.

## 1. Founder read of batch 1 (recorded)

- Adopted: the Fuse (5a), the red zone's three states (6a–6c), the derived heat accent, the record-derived sheet content, the `LIVE · SCORED` chip, the next-check clock, the closed-market state.
- Founder: the design and colors are better than the shipped modal; "some of the directions" liked; the **Ask / Direct / Draw the Line row is confusing**.
- Fable's diagnosis: the row is R-4's fault, not the mockup's — three verbs without objects, one of them wrong for the moment (Direct on a held name near a rung) and one dead (Draw the Line before the dials exist). R-4 also conflicted with the cockpit direction (chat drives, cockpit acts, the research sheet never trades) and with the command budgets (cockpit 7, chat 10).

## 2. Rulings (approve-by-default)

| # | Ruling | What changes for the player |
|---|---|---|
| R-4′ | **One action per mode, with its object in the label, plus a door to where the verbs live.** Bomb mode: *Ask Shadow: hold through the {time} check?* · *→ Cockpit*. In-battle Analysis: *Ask* (the three playbook questions, R-10) · *→ Cockpit*. Browse: *Watchlist* · *My read*. **Direct** lives in the cockpit only. **Draw the Line** does not appear in the modal until the exit dials ship; when they do, it is a drag gesture on the chart with a handle, not a button. Every Ask shows what it costs (*· 1 message*); Phase 0 decides whether a modal Ask draws from the chat budget or the cockpit's. | Two buttons that say what they do, instead of three verbs that don't. |
| R-11′(a) | **The Fuse is the 💣 chart.** Bricks become the ladder's unit: the sheet's ladder rail carries brick ticks between rungs (brick = the per-stock size that puts each rung on a whole brick), and the to-go label reads *1.0% · 2 bricks to +30*. The Bricks chart is retired from V1 (kept as a drawn option in the record). | A chart that reads on a flat stock as well as a moving one, and a distance you can count. |
| R-11′(c) | **One sheet for both Bomb views.** The horizontal ladder rail (entry → rungs, banked lit, to-go above the next rung, brick ticks) plus *What has to happen*, in both the 💣 view and the red zone. The three ENTRY / BANKED / NEXT tiles from 5a/5b are retired; their numbers live on the rail and in the header. | The sheet doesn't change shape when the mode changes. |
| R-11′(d) | **Label collision rule.** When the live price is within the red-zone band of a rung, the live label on the Fuse yields to the rung label; the to-go pill carries the live number. (The mockup's 5a collides exactly there.) | Readable at phone width in the moment that matters. |
| R-11′(e) | **Red zone entry is the modal's, not the chart's.** The mode is entered from any Bomb-view state when the band condition holds, and the `RED ZONE` chip is a state indicator, not a tab. Leaving the band releases the mode after a short hold (no flicker). | Already how batch 1 drew it; written down. |

Open founder call carried from batch 1: none blocking. Fuse vs Bricks is ruled above as a default; override by saying "Bricks."

## 3. Paste-ready Claude Design prompt — batch 2 (screens 1–4 and 7)

**Attach:** the batch-1 Bomb-mode HTML (settled, as the shell and vocabulary reference), the three MPC screenshots (Analysis, Technical, Bomb tab with the daily chart), concept V1.1, this amendment, and `The Cockpit - V4.html`.

---

This is batch 2 of the FantasyTrades research-modal round. Batch 1 (attached, screens 5–6, Bomb mode) is settled: reuse its shell, sheet geometry, type, spacing and color exactly. Read concept V1.1 and Amendment A before drawing; Amendment A changes the action row on every screen and must be applied as written.

**Action row (Amendment A, R-4′) — on every screen:** two buttons, each naming its object. In battle: an *Ask* button carrying its question (Bomb mode: "Ask Shadow: hold through the 1:15 check?"; Analysis: one of the three playbook questions as the default with the other two one tap away) with a small cost chip ("· 1 message"), and a *→ Cockpit* door. In browse: *Watchlist* and *My read*. No "Direct" button anywhere in the modal. No "Draw the Line" button anywhere; the Technical screen shows it only as a disabled drag handle on the chart's right edge labeled "Dials coming".

**Everything else from the concept stands:** mobile first; honesty (never show the agent claiming what the record can't prove; a stock it hasn't examined says so); less text, more structure; the skin is fixed, no new hexes.

**Deliver five screens, phone width, plus desktop variants for 1, 3 and 4:**
1. In-battle Analysis — a held name: stance header, the read from records (the latest Why? line and the last two tape beats, with timestamps), watching-for (only signals the check receipt shows), wire, the `Wall St: Buy · 24 analysts` chip, the collapsed "About", the Ask presets, the action row.
2. In-battle Analysis — a name the agent has not examined: the honest empty state ("Shadow hasn't looked at this one") and the Ask.
3. Browse Analysis — the six-lens card (six archetype rows: verdict chip Fits / Passes / Watching, one line in voice, a "why" disclosure; the equipped archetype pinned first), one row expanded, rank snapshot, wire, "my read" entry, the action row.
4. Technical — the three-row read stack (Weekly trend · Daily setup · Intraday trigger) with one row tapped and its level highlighted on the chart, the named setup, the facts, the levels, the narration, the disabled "Dials coming" handle.
5. One free exploration: the chart and the agent's read as a single surface — the version of this modal where the sheet and the chart are not two things. Skin and honesty rules only.

One-line caption per screen naming its state. Placeholder text for the agent's voice; the system writes the voice.

---

## 4. What happens after batch 2

Founder read → **direction V2** (one document: structure, behavior and vocabulary from both batches; skin from existing tokens; every ruling R-1–R-11 as amended) → read-only Phase 0 (concept §6 step 4, including the scoring cadence, the check schedule and which price the check reads — the next-check clock and the `LIVE · SCORED` chip depend on it) → spec V1 → Build A (Bomb mode).
