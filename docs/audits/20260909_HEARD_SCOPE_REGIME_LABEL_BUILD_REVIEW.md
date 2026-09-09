# Heard-scope + regime-label build — §2 cumulative review

**Branch:** `claude/nifty-thompson-38vgbc` · **Base:** `origin/main` @ `d1690a3` (fetched at session open; branch cut clean)
**Reviewed at:** `0378924a` (three build commits) · **Fixes at:** `1014bc4f`
**Diff at review:** 12 files, 374 insertions / 66 deletions — over the §2 threshold (**≥10 files**), so this review is mandatory, not optional.
**Date:** September 9, 2026

---

## 1. Executive verdict

| # | What was asked | Shipped | Review verdict |
|---|---|---|---|
| 1 | `Heard at the {slot} check` on any directive card with a null-suppression stamp — Replaced and Expired included; `Not heard at this check` stays on the current card | Yes | **Holds**, with one scope correction: the widening had also reached the *This turn* strip, which is not a directive card. Fixed. |
| 2 | One `REGIME_LABELS` source in `decisionRecord.js`; `Regime · Expanding` with the raw token as `title`; both Agent feeds re-pointed, byte-identical | Yes | **Holds.** Byte-identity proved over 200,632 inputs. One real gate defect found and fixed (prototype keys). |
| 3 | BUILD_RULES §2 gains the reviewer-isolation sentence | Yes | Holds. |

**Twelve findings raised, three refuted, nine confirmed.** Every confirmed finding is either fixed in `1014bc4f` or recorded below for a founder ruling. No fenced file was read or edited. Full suite green (650 files, 12,238 tests); `vite build` clean.

**Two items need a founder ruling** — neither is a defect, both are consequences of the change as specified: §5.1 (the negative's scrollback asymmetry) and §5.2 (the raw token is unreachable on touch/AT).

---

## 2. How the review was run

Five lenses, each on its **own `git archive` extraction** under the session scratchpad with `node_modules` symlinked, **path-distinct**, reviewers read-only on git and on the shared working tree — the §2 reviewer-isolation rule, including the sentence this branch adds. The two mutating lenses (which edit their own tree to run repro mutations) ran **last**.

| Lens | Dimension | Tree | Mutating |
|---|---|---|---|
| A | Domain correctness & claims honesty | `revA` | no |
| B | Wiring, lifecycle, blast radius | `revB` | no |
| C | Cross-surface consistency & byte-identity | `revC` | no |
| R1 | Refutation of A's findings | `revD` | yes — ran last |
| R2 | Refutation of B's and C's findings | `revE` | yes — ran last |

Per §2 every finding was handed to a refuter instructed to **refute it with a concrete repro**. Both refuters restored their trees and re-ran the touched suites green before reporting. The shared working tree was untouched throughout (`git status --porcelain` empty at each hand-off).

---

## 3. REFUTED (3)

| ID | Claim | Why it fell |
|---|---|---|
| A-1 | The panel shows a word the check never saw and the `title` defence is void, because Battle View is phone-first | **The premise is wrong.** Every cited design doc specs desktop and mobile as co-equal shells (`PHASE_A_SEED_BATTLE_VIEW_CONTROLLER_V1.md:14,70`; `BATTLE_VIEW_CHARACTER_PANE_DESIGN_BRIEF_V1.md:15,33`; `COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md:62-63`), and the desktop shell is implemented — `AgentBattleScreen.jsx:171` `useIsDesktop()` drives real layout branches. On desktop `title` is a native hover tooltip, so the token IS one hover away on a primary surface. A narrower residue survives as §5.2. |
| A-3 | The honesty guard cannot see `label`, so a `label` of `Moved +2.57% today` would ship green | **The mutation does not ship green.** Applied verbatim to `decisionRecord.js:866`: 3 test files fail, 3 tests. `selectEvidence.test.js:158` (`expect(fact.label).toBe(fact.text)`) catches it directly; `WhyPanel.render.test.jsx:578` and `AgentBattleScreen.tickStamps.jsdom.test.jsx:250` catch it through the rendered DOM. The sub-premise is true — `deskHonesty.test.js` alone would miss it — but the conclusion does not follow. |
| A-5 | Labels centralised while colours stayed local, so the two can drift | **CI blocks it.** Adding `risk_on: 'Risk-On'` to the shared map reddens `regimeLabels.render.test.jsx:57-60` and `:64-69` immediately. Both pills gate on the LABEL, so a colour-only miss can never render an unlabelled pill, and `tokens.textMuted` is a hex in every provider (`holoTheme.js:61`). |

---

## 4. CONFIRMED and fixed in `1014bc4f` (7)

| ID | Finding | Fix |
|---|---|---|
| C-1 | The widened positive also reached `ThisTurnStrip`, whose contract is "only what is unresolved and check-bound". Unreachable via `deriveReceipts` (the slot's thread is always `currentId`; the strip returns null on `completed`) — but unpinned, and true only incidentally. | `battleViewCopy.js:620-644` adds `thisTurnHeardLine`; `ThisTurnStrip.jsx:33` calls it. The card rule and the strip rule now each have exactly one decision point (§9). Row + mutation in `ThisTurnStrip.render.test.jsx`. |
| C-5 | `REGIME_LABELS[entry.regime]` is truthy for every `Object.prototype` key, so `regime: 'constructor'` resolved the label to a **function** and threw in `hexToRgba` — in both feeds, before any colour fallback. The new test's "an unruled token renders no regime pill (the shipped guard)" was an overclaim: `'risk_on'` is unruled *and* absent from the prototype, so it never exercised a guard. | Both feeds gate on the `regimeLabel` accessor (closed list) instead of a raw lookup. Feeds and panel now agree on which tokens are ruled. Rows extended to `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__proto__`. |
| C-2 | No screen-level row proved the widened positive: the two new rows inject the stamp by hand into the receipts map, and no test ran a real document through `deriveHeard` + `deriveReceipts` onto a card the walk itself marked `replaced`. | `AgentBattleScreen.tickStamps.jsdom.test.jsx:235-270`. |
| B-4 | `AgentBattleScreen.tickStamps.jsdom.test.jsx:228` still claimed "t-1's replaced card carries no Heard line at all" — true only because that fixture's stamp is negative. Refuter flipped it to `suppressed: null`: the card gained `Heard at the 12:15 PM check` **and the test still passed**. | Comment corrected; the row above now points at the positive row that follows it. |
| C-3 | `AgentChat.jsx:224` kept the inherited "beneath Filed" wording — the third instance of a phrase the branch corrected in two other places. | Reworded to name the receipt row, whichever of the three words it carries. |
| B-1 | `StatusFeedTimeline.jsx` is **not on a live path** — its only importer is `AgentStrategyTab.ARCHIVED.jsx`, which nothing imports. So "three surfaces" / "the two Agent feeds read it" overcounted, and its test block pins dead code. | Prose corrected in `decisionRecord.js:709-720`, `AgentActivityFeed.jsx:9-15`, `StatusFeedTimeline.jsx:4-11` and the test header — the file is still re-pointed (as asked), now said plainly to be dead. |
| B-3 | `COPY.regimeLabel` shipped with zero consumers — a second derivation path to a string `evidenceFacts` already builds, which is the drift item 2 set out to close. | Removed. |
| B-5 | The `title="` count was panel-wide, so the Show-it door's own `title` (emitted at the read cap) would have reddened it later for an unrelated reason. Refuter measured 2 with `onShowIt` + `researchUsed=3`. | Scoped to the evidence block. |

---

## 5. CONFIRMED, recorded for a founder ruling (2)

### 5.1 The scrollback's Heard record is one-sided (A-4, MEDIUM)

Verified against the real pipeline:

```
WITHHELD before: {"state":"filed",    "line":"Not heard at this check"}
WITHHELD after : {"state":"replaced", "line":null}
HEARD    before: {"state":"filed",    "line":"Heard at the 11:30 AM check"}
HEARD    after : {"state":"replaced", "line":"Heard at the 11:30 AM check"}
```

Filing a new directive **erases the record of a withheld one and never erases the record of a heard one**. On base both vanished together, which was at least symmetric.

The deictic argument is sound *for the current string* but not for the fact: `Not heard at the {slot} check` would be true wherever read — the stamp carries `at`, and `heardLabel` already builds exactly that shape. The Phase B handover named that alternative (`…HANDOVER.md:99`). **Not changed here** because the negative's wording and scope were specified. If the one-sidedness is unwanted, the fix is the self-naming negative, and it is one line.

### 5.2 The raw token is unreachable on touch and to assistive tech (A-1 residue, LOW)

On desktop `title` is a hover tooltip and the claim holds. On a phone `title` has no hover and iOS Safari never surfaces it; the element is a bare `<span>` with no `tabIndex`, `role` or `aria-label`, so it is not keyboard-reachable and not reliably announced. There is no tooltip primitive in the Battle View or Agent trees, and no other client surface prints the token any more. So on mobile/AT the honest render is in the DOM and out of reach. **Not changed here** because `title` was specified; the remedies (a tooltip primitive, or `aria-label`) are their own task.

---

## 6. Recorded for separate tasking (§3 — found, not fixed)

- `api/_utils/voiceLayerGrounding.js:319` hard-codes a fourth copy of the Heard sentence instead of importing `heardLabel` from `decisionRecord.js:586` — the same duplication this branch removed for the regime words. Pre-existing.
- `REGIME_COLORS` remains declared in both feeds. With the C-5 gate fix an unruled token can no longer reach the colour lookup, so nothing breaks; a fifth ruled pair would render a grey pill and redden CI first. Pre-existing, out of item 2's scope (labels only).

---

## 7. What was proved, not asserted

- **The narrator's prompt is byte-identical.** A differential harness reconstructed the pre-branch `evidenceFactLines` from the diff's `-` lines and diffed it against the new projection over **200,632 inputs: 0 mismatches** — including `chg: -0`, `NaN`/`±Infinity`, `regime: '__proto__'`, `nr7` in six shapes, `risk: {action:'HOLD'}`, and a getter-instrumented field-read order probe. The `×` (U+00D7) survives on `text`; the `·` (U+00B7) exists only on `label`. The 18 prompt goldens and `voiceLayerGrounding.tickStamps.test.js:61` still pin the raw token.
- **An unstamped card is byte-identical to Phase A.** `heardLine` is the only input to the Phase-B markup delta; a 7-state × 14-stamp matrix differs in exactly 6 cells, all of them the intended widening. Pre-flip, `budget_skipped`, unrecognised-shape and mid-tick documents all render `null` before and after. `AgentBattleScreen.paneOff.golden.test.jsx` passes as a live first-paint proof.
- **The positive can never name a check at which the thread was withheld.** `heardStamps` writes `at` and `heard` as an atomic pair from one evaluation (`decisionRecord.js:638`), so the slot named and the verdict rendered always come from the same check. All four orderings traced.
- **The return-type change has no missed consumer.** Repo-wide, six files touch `evidenceFacts`/`evidenceFactLines`; only `WhyPanel.jsx` consumes objects. An object as a React child was probe-confirmed to throw, so a missed consumer would have been loud.
- **`key={fact.text}` is collision-free** over 200,000 randomized stamps.

---

## 8. Record corrections owed (A-2, CONFIRMED at MEDIUM)

This build reverses decisions recorded in `20260909_PHASE_B_B1_CLIENT_STAMPS_HANDOVER.md:98,99,102` and dispositions in `…_REVIEW.md:39,59,115`. Those files are point-in-time reports pinned to an older HEAD and are frozen by repo convention, so they are **not** rewritten. This document is the superseding record, and `PHASE_B_TICK_STAMPS_SPEC_V1.md` §9 carries the spec-level amendment.
