# Phase C — Show It: Spec V1.1 (the build contract)

**Date:** September 9, 2026
**Status:** Binding for the Phase C build. V1.1 = `PHASE_C_SHOW_IT_SPEC_V1.md` **plus** the three founder rulings below, which resolve Sol's Phase C short pass (`docs/audits/20260909_SOL_PHASE_C_SHORT_PASS.md`: one BLOCKER, one MAJOR).
**Basis:** `docs/audits/20260908_PHASE_C_SHOW_IT_PHASE0_DISCOVERY.md` (every `file:line`) · spec V1 §0–§8 · Sol C-1, C-2, C-4.
**What V1 still governs:** everything V1 says that is not amended here. §1–§6 build in V1's order; §7 (Sol's targets) is spent; §8's ledger rows D-116 → D-120 stand and are joined by D-121 / D-122 below.

---

## A. Naming

The founder's build prompt cites this document as `PHASE_C_SHOW_IT_SPEC_V1_1.md`. Spec V1 is committed **byte-identical** at `docs/design/PHASE_C_SHOW_IT_SPEC_V1.md` (its own suggested location, its own header still reading "Spec V1"); this file is the V1.1 delta and is the document the build follows where the two differ.

---

## B. Ruling 1 — the provenance boundary (resolves Sol C-1, BLOCKER)

Sol's finding stands: persisting the card as a `groundingVersion: 1` exchange puts it in the narrator's `EARLIER MESSAGES` block, where the history structure tells the character these were **its own earlier words** while §5's prose rule tells it they are platform data. A prose rule cannot repair a structural role. Discovery hazard 3 named the same failure mode.

**The ruling, in three parts, all binding:**

1. **No grounding marker on the exchange.** The persisted `research` exchange carries **no `groundingVersion` field at all** — not `1`, not `0`. It is not a grounded narrator turn and must never be counted as one. (V1 §3's `groundingVersion: 1` is struck.)
2. **One entrance to the prompt.** The research exchange enters the grounded prompt **only** through a separately typed `PLATFORM RESEARCH` context block, never through `EARLIER MESSAGES`. The block preserves symbol, section dates and provenance, and is labelled as the platform's data — not the character's speech, not the decider's evidence.
3. **Exclusion is structural, not incidental.** The history builder excludes `messageType: 'research'` the way it already excludes `directive_filed`, and a test asserts the exclusion directly, so a later refactor cannot re-admit the card by dropping a marker.

**Acceptance (Sol's test, as fixtures — §D below).** After a research card, the three prompts *"what did you see?"*, *"does your evidence support this?"* and *"what do you think about those numbers?"* must never produce a claim that the research data was part of the decider's check or the narrator's prior evidence.

## C. Ruling 2 — one definition of the counter (resolves Sol C-2, MAJOR)

`Show it · 1 of 3` before the first tap cannot literally be "the count of persisted research cards" (that count is 0). One display function, in one module, imported by the server, the client and the tests (BUILD_RULES §9 display-agreement):

| Name | Definition |
|---|---|
| `RESEARCH_CAP` | `3` |
| `countResearchUsed(exchanges)` | the number of `messageType: 'research'` entries in `chatExchanges` |
| `researchDoorOrdinal(used)` | `Math.min(used + 1, RESEARCH_CAP)` — **the ordinal of the next card**, which is the integer printed |
| `researchDoorEnabled(used)` | `used < RESEARCH_CAP` |
| the door's text | `Show it · {ordinal} of {RESEARCH_CAP}` |

So: 0 used → `1 of 3`, enabled. 2 used → `3 of 3`, enabled (one left). 3 used → `3 of 3`, **disabled** — the exhausted state, exactly as V1 §4 writes it. The two states share their text on purpose (D-31 prints the cost of the tap you are about to make); they are distinguished by `enabled`, never by the string.

**The route stays authoritative.** A displayed count is never authorization. The route re-reads the count inside its transaction on every call; the client reconciles to the returned count or the next battle snapshot and never survives a failed route with an optimistic increment.

## D. Ruling 3 — the tests that carry the two rulings

Both rulings ship as fixtures, not as prose:

- **The cap's five race tests** (Sol's list, verbatim): two simultaneous taps with one slot remaining produce one card; a failed transaction consumes no slot; two browser tabs cannot create a fourth card; no optimistic client increment survives a failed route; the exhausted state and the pre-tap `3 of 3` state have an explicit enabled/disabled contract.
- **The three acceptance prompts** (§B) as prompt-assembly fixtures: each asserts that the assembled grounded prompt puts the card in `PLATFORM RESEARCH` and *not* in `EARLIER MESSAGES`, and that the research rule and the platform-data framing travel with it.

## E. Ruling 4 — the flag

`SHOW_IT_ENABLED` ships **dark** (`false`), pinned, in the flag-pin guard's `DARK_BY_DESIGN` set with its runway named (BUILD_RULES §2). Read at call time. The route 404s until it resolves on; chips and doors render only when it does.

## F. Sol's PASS conditions, carried into the build

- **C-3 (PASS).** "No message charged" survives — research is a separately capped, code-composed platform-data read; D-118 stands unchanged.
- **C-4 (PASS WITH CONDITION).** `Platform data · not what the check saw` **travels with the card itself** — it is rendered inside the research card, never only as a page-level legend or header. A test asserts the label is a property of the card component, not of its container.
- **C-4's narrowing.** V1 §3's "never be confused with it" is stronger than the build can prove. The enforceable claim, and the one the tests assert, is narrower: **the two sources never share a section, and each section carries its own provenance.**

---

## G. Ledger (append after D-120)

| # | Ruling |
|---|---|
| **D-121** | A research exchange carries no `groundingVersion` marker and never enters `EARLIER MESSAGES`; it reaches the grounded prompt only as a typed `PLATFORM RESEARCH` block that preserves symbol, dates and provenance. Structural exclusion, asserted by test — a prose rule alone does not fix a history role. |
| **D-122** | The research door prints the **ordinal of the next card** (`min(used + 1, 3)`) from one shared display function used by server, client and tests; the exhausted state shares that text and is distinguished by `enabled`. The route, not the displayed count, is authoritative. |

*Show it: the platform's own numbers, dated and attributed — never a forecast, never a recommendation, never a decision.*
