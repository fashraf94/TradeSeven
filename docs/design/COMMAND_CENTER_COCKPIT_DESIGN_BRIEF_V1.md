# The Cockpit — Command Center design brief for BaggerBomb (V1)

**Date:** September 1, 2026
**Status:** Design brief V1, for Claude Design, Sol (second pass), and CC Phase 0. Not a build spec.
**Prepared by:** Fable, with Flash (founder). Design authority for this arc lives in the framework chat.
**Suggested commit location:** `docs/design/COMMAND_CENTER_COCKPIT_DESIGN_BRIEF_V1.md`
**Companions:** `COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md` (the Battle View — read it first) · `SCOUTING_ASSIGNMENTS_CONCEPT_V1_1.md` · `PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V1.md` · framework V1.2 (§5.5 Agent Desk, Pass 1)

This brief is self-contained for a designer. Appendix A maps it to framework rulings and to Sol's split rule.

---

## 1. What we are designing, in one paragraph

The Command Center is the **cockpit**: the page a player lands on to deploy, to see the one urgent thing about a live battle, and to feed their curiosity between battles. It is not a dashboard, and it is not the game — the game is the Battle View (the controller). The cockpit's live card is the Battle View seen from the cockpit seat: a **filtered, freshness-bound, own-side projection** of the battle, stamped with the check it comes from, that expands into the Battle View on tap. Three blocks, hard cap. A fourth block is how the old "fancy deployment page" happened.

**The rule that governs every field on the page (Sol, sustained):** the cockpit is not a copy of the Battle View. Every projected fact carries the timestamp of the check it came from, shows only the player's own side, and — until the chat-side precedence fix lands — quotes the engine, never the character.

---

## 2. The three blocks

| # | Block | Live battle | No live battle |
|---|---|---|---|
| 1 | **The card** | The live card (§3) — the hero | The Deploy hero (§4) — the hero |
| 2 | **Curiosity** | What's new: the morning read (one line + chips), the latest Signal Drop result (one line), and one door: *Show it something* | Same |
| 3 | **Games** | Battle chips: live battles only, plus `+ Start a battle`. A league battle appears here when live (later); its deploy stays in League. | Same, with no live chips |

Nothing else. Identity and career record live in the Agent Hub (a header chip links there). Read and Equip in full open from the Equip chip. Game Tape is reached from the Battle View.

---

## 3. The live card

A single card. Fields, in order, with their source and their honesty condition:

| Field | Renders | Source | Condition |
|---|---|---|---|
| **Header** | `1Agent +0 · CPU +1 · Live` and the tug-of-war bar | the match score | Match totals are the scoreboard and ship on the Manage card today (founder to confirm the narrowing of the own-only rule to this). No opponent pieces, ever. |
| **As-of stamp** | `As of the 12:47 PM check` | the check completion marker | **Every field below is from this check.** If the cockpit's data is older than the Battle View's, the stamp says so; the card never says "now." If no marker is readable, the card shows the last known check and `updating…` |
| **Turn line** | `Next check ~1:02 PM` / `Last check 12:47 PM · next was due ~1:02 PM` | cadence + marker | Tilde always; late-check copy as on the Battle View |
| **Urgent line** *(when one exists)* | `1Agent asked for a call before the ~2:00 check: PLTR or CRWD` | open scouting assignment | Only while both assignment predicates hold and the answer is open (companion concept; leave room, do not design further) |
| **Closest to a tier** | two rows: `SLB · 2.3% to Bagger` · `MU · 5.7% to Bust` | own pieces' distance-to-tier | Own side only; scoreboard language; same numbers and same check as the Battle View rows |
| **This turn** | `Filed 12:31 · for the ~1:02 check` → `Acted` / `Replaced` / `Expired` | current directive + floor receipts | Floor states only; never a ceiling state (Heard / Holding / Declined) unless the Battle View can prove it too |
| **Latest** | one line of engine text: `12:47 · 2 checks · no change` or the check-level evaluation summary | statusFeed, engine-authored entries only | **Never the character's chat.** Opponent-tagged entries (`opponent_trade`, `opponent_threshold`) filtered out. After P-7 lands, the framework chat may allow the last character line; not before. |
| **Tap** | the whole card | — | Expands into the Battle View. The header is the shared element: it grows into the Battle View header; the rows resolve into the board. One motion, ≤ 400 ms, reduced-motion respected. |

No composer. No verbs. The cockpit is a place to see and to go, not to act — acting happens on the pieces, on the Battle View.

**Stale rule.** The Manage card polls every 120 s today; the Battle View subscribes; proximity refreshes about every 15 minutes. Two truthful values from different moments must never sit side by side without an as-of. The stamp is the design's answer: the card is *from a check*, and it says which.

---

## 4. The Deploy hero (no live battle)

BaggerBomb can start at any time; the cockpit's first job is to make that easy. The hero is the shipped full-width Deploy: `Deploy · Speculator · Watchlist` with the equipped archetype and watchlist visible as gear, one tap to the deploy flow. Beneath it, one line about the last battle (engine text, e.g. `Yesterday · +94 · won vs CPU`) or `Debrief on the way.` while the debrief is pending — and that pending state must resolve (the debrief liveness prerequisite, P-6). No archetype iconography (separate arc).

---

## 5. Curiosity block

Three lines, one door. The morning read as one line with its chips (`More` opens the full read). The latest Signal Drop result as one line (`AI capex read · 8 related names · saved as watchlist`). The door: **Show it something** — opens Signal Drop. Nothing here is a research hub; the hub is its own surface and this block links to it. If the ticker join for portfolio news proves empty most days, that line does not exist here at all.

---

## 6. Shells

**Desktop:** one column, max ~780 px (the current desktop dashboard's canvas width), the three blocks stacked; the card first. The page is narrow by design — a cockpit, not a control room.
**Mobile:** the same stack. Optional deliverable: **the strip** — a one-line accessory above the tab bar on every other screen (`1Agent · +0 · next check ~1:02`), tapping into the Battle View. The strip carries the same as-of rule.

---

## 7. Honesty rules (in addition to the Controller's eight)

1. Every projected field is stamped with its check. The card never claims "now."
2. Own side only, for every field including prose. Match totals are the one exception, pending confirmation.
3. Engine text only in *Latest* until the framework chat lifts the rule. No character quotes on the front door.
4. Floor receipts only. The cockpit can never know more than the Battle View proves.
5. No verbs on the cockpit. If a control would act on the battle, it belongs on a piece, on the Battle View.
6. Three blocks. If a fourth appears, remove it.

---

## 8. Deliverables (in this order)

| # | Screen / state | Shell | Notes |
|---|---|---|---|
| 1 | Live card, nothing queued, fresh (as-of = latest check) | Desktop + mobile | The resting state. Calm; one glance answers "how are we doing and when is the next check." |
| 2 | Live card with a filed directive in *This turn* (floor) | Desktop | And the same card after `Acted`. |
| 3 | Live card, stale: as-of older than the expected check, and `updating…` | Desktop | The honesty state. |
| 4 | Expand transition: card → Battle View | Either | The header as the shared element. ≤ 400 ms. |
| 5 | No-battle state: Deploy hero + last battle line + curiosity + games | Desktop + mobile | The other hero. |
| 6 | The strip on another screen (optional) | Mobile | Same as-of rule. |
| 7 | Live card with the urgent line (assignment) | Desktop | Placeholder only; leave room. |

Do not design: the Battle View itself, Read and Equip in full, the Agent Hub, league surfaces, notifications beyond the strip.

---

## 9. Quality bar, tokens, fixtures
Same tokens, type, and voice as the Controller brief V1.2 §10. The card uses the Battle View header's exact anatomy at a smaller scale so the expand transition is a true shared element.
**Fixture (live battle, Sep 1):** `1Agent +0 · CPU +1`; as of the `12:47 PM` check; next `~1:02 PM`; closest to a tier: `SLB · 2.3% to Bagger`, `MU · 5.7% to Bust`; This turn: `Filed 11:20 · for the ~1:02 check`; Latest: `12:47 · 2 checks · no change`. No-battle fixture: `Deploy · Speculator · Watchlist (10 names)`; `Yesterday · +94 · won vs CPU`.

## 10. Questions the design should answer
1. Does the card carry the tug-of-war bar, or only the two totals? (Both are the scoreboard; the bar may be too much at card size.)
2. When there are two live battles (ranked + BaggerBomb), does the card stack or page?
3. What does the card look like at the instant of the expand — where do the two "closest" rows go?

---

## Appendix A — Traceability for the framework chat

| This brief | Framework / ruling | Status |
|---|---|---|
| The live card is the Agent Desk | §5.5 items 1–6 (posture, proximity, swap lock, latest statusFeed, alerts, clock) | Pass 1 as scoped; alerts folded into *Latest* pending P-5 |
| Filtered, freshness-bound projection; engine text only | Sol #9, #10; §12 front-door gate; P-7 | Sustained — the split rule |
| Own side; match totals allowed | Sol #11; Aug 31 own-portfolio ruling; P-4 | Narrowed — **founder to confirm** |
| No composer on the cockpit | D-2 dual surface (conversation stays on the Battle View); §12 | Gate does not bite for the cockpit |
| Three-block cap | founder, Sep 1 | Sol: "no contradiction yet" — this brief decides |
| Deploy hero; no iconography | D-35; deferred visual-identity arc | Honored |
| Debrief pending must resolve | P-6 liveness | Prerequisite |
| Curiosity block limited to what's new + links | D-36 (ticker join hit rate); D-27 | Honored |
| Battle chips: live only + start | founder, Sep 1 | Honored |
| Prerequisites | P-4 (voiceLayerCache owner-scoped), P-5 (dead alert types), P-6, D-16 | Unchanged from V1.2 Pass 1 |

*Prepared September 1, 2026. Nothing here is a build instruction.*
