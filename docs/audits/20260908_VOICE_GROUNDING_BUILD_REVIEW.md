# Voice-layer grounding — the build review (Phase 0, V1)

**Date:** September 8, 2026
**Branch:** `claude/voice-grounding-phase-0-rulings-hub8kv` (the task document names `claude/voice-layer-grounding-phase-0-i0hmxq`; the harness branch was fast-forwarded onto it — identical SHAs — and is the only branch this session may push)
**Range reviewed:** `0ea61f2d..2b557265` — the six build commits G1 → G6, on top of the two cherry-picks the rulings prescribed (`70ba90a1` the ATR fix, `0ea61f2d` the discovery document). The fixes this review produced are `3c8da20a`.
**Threshold:** BUILD_RULES §2 requires a review at ≥10 files or ≥1500 lines. The build diff is **51 files / 6,007 insertions**; the cumulative branch diff over the docs base is **53 files / 6,624 insertions**. Well over, on either measure.
**Companion:** `docs/audits/20260908_VOICE_GROUNDING_BUILD_HANDOVER.md` — written *after* this record, per the tasking.

---

## 1. Executive verdict

| # | Item | Verdict |
|---|---|---|
| 1 | G1 — the flag, the per-caller accessor, the canary env var, the direct pin, the off goldens | **Built.** The goldens were proved by RECONSTRUCTION, not by their header: reverse-applying the six commits and regenerating gives a byte-identical file. |
| 2 | G2 — the grounded prompt | **Built — and it carried the one code P2 that reaches a user under `'on'`:** YOUR RECORD and the pane disagreed about a guardrail-forced swap that failed to execute. Fixed by sharing the pane's selector. |
| 3 | G3 — the code-composed note | **Built.** Event-only text, the lint in code, dedupe by ET day, no model call — every ruling met by mechanism and killed by mutation. |
| 4 | G4 — the deterministic route | **Built.** Eight checks, one transaction, the budget server-derived. Two omissions found and fixed: the protected-store allowlist entry (caught by the full suite, before the review) and a legacy slot reported `filed` instead of `replaced-prior`. |
| 5 | G5 — chips minted by id, both clients | **Built — with the second code P2:** the grounded few-shot examples minted `File: …` STRING chips, the very claim-without-a-click-path Sol's F2 forbade, re-created by the prompt's own example. Fixed. |
| 6 | G6 — shadow mode | **Built.** One structural hazard fixed: the counterpart assembly was on the sent turn's critical path. |
| 7 | Flag-off | **Byte-identical for every prompt, every persisted shape and every response — proved by reconstruction and by 24 + 120 mutations.** One client-visible off-path change was found (`Holding note` on legacy exit notes) and gated. |
| 8 | Fence and ratchet | **Zero §1 contact.** The two new direct importers of the legacy table are in the §2.3 baseline; the ratchet is proved live. |
| 9 | Tests | **616 files · 10,948 pass · 64 skipped · 0 failing** — a FULL-suite figure, after the fixes. |
| 10 | `vite build` | Exit 0, before and after the fixes. |

**The honest headline:** of 43 findings, 33 were CONFIRMED by the refuter, 9 AMENDED, 1 REFUTED. No P1. After refutation, two code P2s stood, both reachable only under `'on'` — and both were about the same thing the arc exists to prevent: a sentence the player would read that the record does not back. The narrator's YOUR RECORD credited the agent with an argument the cron overwrote; the prompt's own example taught the model to mint a filing claim its tap would not honour. Five of my test rows could not fail under the defect they named, and two seams — the cache handler's flag wiring and the arena hook — had no row at all. Every instrument I built passed the whole time.

---

## 2. Method

**The survivor proof first.** Before any kill was trusted, the harness was proved able to report a survivor, in a `git archive HEAD` snapshot tree with `node_modules` symlinked:

| Probe | Result |
|---|---|
| The minted pill's `opacity: busy ? 0.5 : 1` → `0.7` (a style nothing should pin) | **SURVIVED** — 38 green. |
| The canonical-text rewrite lets the model's own chip text through (`item.text \|\| getCanonicalText(…)`) | **KILLED** — 2 red. |

**Five lenses, one snapshot tree each** (`git archive 2b557265`, `node_modules` symlinked; read-only on git and on the shared working tree — BUILD_RULES §2's reviewer-isolation ruling), then a sixth agent whose only job was to **refute** every finding with a concrete repro:

| Lens | Dimension | Found |
|---|---|---|
| 1 | Domain correctness — the spec and the rulings against real inputs | 1 P2 · 8 P3 |
| 2 | Wiring and lifecycle — ordering, lifetimes, refs, transactions | 1 P2 · 7 P3 |
| 3 | The flag-off guarantee and guard integrity — goldens by reconstruction, 24 mutations | 1 P2 · 5 P3 |
| 4 | Test integrity — 120 mutations against the rows' own titles | 5 P2 (rows that could not fail) · 6 P3 gaps · 3 equivalent mutants |
| 5 | Cross-phase consistency and the rulings — a ruling-by-ruling table, every comment checked | 2 P2 · 10 P3 |
| Refuter | Every finding attacked: existing coverage, unreachable paths, shapes no writer produces, severity under `'off'` | 33 CONFIRMED · 9 AMENDED · 1 REFUTED |

**The rulings file.** The founder's rulings (the task document) were restated in a `RULINGS.md` beside the snapshots so every lens checked the build against the same text. The seed document and Sol's reviews were NOT attached to this session; G1 → G6 were reconstructed from the spec and the Phase 0 report, and that is recorded in the handover.

---

## 3. CONFIRMED — code defects, fixed in `3c8da20a`

### P2-1 · YOUR RECORD and the pane disagreed about a guardrail-forced swap that failed to execute
`api/_utils/voiceLayerGrounding.js` `recordStateLabel` · lens 1, confirmed by the refuter against the cron's own writer shape (`agent-evaluate.js`: the forced exit materialized into the result, `downgraded` + the thrown-swap prefix, the guardrail's provenance on the entry).

The pane has a ruled fifth state for this (D-70): *A guardrail called for a swap · it did not go through*. The narrator's block re-implemented the state selection instead of sharing it and rendered the fourth state's words — *Argued for a swap · it did not go through* — crediting the agent with an argument the cron overwrote, on the very block the narrator is told to speak from. Two surfaces, one check, two sentences (BUILD_RULES §9), and the wrong one was the narrator's evidence. Reachable only under `'on'`.

**Fix:** the fifth state's gate (`GUARDRAIL_SOURCE_PREFIX`, `GUARDRAIL_FORCED_EXIT`, `guardrailForcedExit`) and its sentence moved into the zero-import `src/data/decisionRecord.js`; the pane re-exports them under the shipped names; the narrator checks the gate FIRST inside the downgraded branch, exactly as the pane does. A PROPOSAL entry (unreachable under autopilot, but writable) is now `Held`, as the pane says, never `Swapped` (P3).

### P2-2 · The grounded examples minted `File: …` string chips
`api/_utils/voiceLayerGrounding.js` `GROUNDED_REFINEMENT_EXAMPLE`, `GROUNDED_MASTERY_EXAMPLE` · lens 5, confirmed by the refuter (the parsed examples' chips were all strings; normalized, a `File: …` string becomes an `ask` chip whose tap goes to the CHAT route).

Two blocks after `GROUNDED_OUTPUT_FORMAT` demands a directive chip BY ID from the menu, the phase examples showed `"suggestedActions": ["File: Require stronger confirmation before entering", …]`. A model imitating the example yields a chip one letter from the ruled `Files: …` label that files nothing — Sol's F2 blocker, re-created inside the prompt. The 30-site guard cannot see `File:` and no row parsed the examples.

**Fix:** the examples' chips are QUESTIONS (`kind: 'ask'`), never a filing. The refuter's caution was decisive against the first proposed fix: the examples are phase-keyed and shown to every archetype, so a literal `TF-02` in one would teach id-guessing off another archetype's menu. The by-id shape is stated once, in the format, against the menu the prompt actually carries. A row now parses each example's JSON.

### P3 · The shadow assembly sat unguarded on the sent turn's path (AMENDED from P2)
`api/agent/chat.js` · lens 2. Under `'shadow'` the grounded history and the counterpart prompt were built unguarded before the shipped turn; an injected throw returned 500 with no model call and no write. The refuter's 15-shape hostile probe threw 0/15 (the grounded builders are defensive on every plausible doc shape), so a structural hazard against spec §9's letter — *"proves assembly … nothing else"* — not an observed defect. **Fix:** the counterpart (the prompt this turn does NOT send) is built under `try/catch`; a failure is recorded on the shadow record as `shadowAssemblyError` and the shipped turn continues. The SENT side is never guarded: a broken grounded prompt under `'on'` must not be silently swapped for the old one.

### P3 · `Holding note` was an off-path visible change (AMENDED from P2 — a founder decision, taken)
`src/screens/battleView/battleViewCopy.js` · lens 3. The word is founder-ruled (spec §5), but the eyebrow read no flag: every persisted `potential_exit` note — including legacy, model-written forecasts from the retired prompt — wore it under `VOICE_GROUNDING_MODE = 'off'`. The spec's `'off'` guarantee is written for prompts, so the refuter called this a gating question rather than a contradiction. **Decision taken:** gate the word on the grounded exchange (the marker `deriveChatMessages` already carries), so the flag-off page is byte-identical and the word never lands on a forecast the retired prompt wrote. One line reverses it if the founder wants the retroactive relabel; the ledger's D-86 amendment says which.

### P3 · The chip filing rendered an EMPTY speech bubble above its card
`src/components/Agent/AgentChat.jsx` · lenses 1, 2 and 5 independently. The audit exchange carries `agentResponse: ''` by design; the bubble body rendered unconditionally. The D-86 mechanism held (no eyebrow for the new type), but the box was what the player saw on every filing. **Fix:** the body is skipped for the persisted type `directive_filed` — keyed on the type, never on the text being empty — and the type's one name lives in `decisionRecord.js` beside the marker version, which the client had been comparing against a literal `1`.

### P3 · The rest, each with a row
- **The history block put a chip filing under "the ones you started"** — the USER tapped it. Filings are excluded; the CURRENT DIRECTIVE line already carries the text.
- **The guardrail path's system-authored hypothesis rendered unlabelled, with a doubled `Hypothesis:`** — withheld exactly where the rationale is engine-authored (the cron writes both together); the field's own leading label dropped for display.
- **The `_…_` emphasis wrapper ate underscores inside identifiers** — anchored at word boundaries, as Markdown reads it.
- **The fundamentals line rendered outside any CURRENT CONTEXT heading in the first-message prompt** — the battle assembly's heading and vintage sentence now apply to the opener too.
- **A typed question was silently dropped during a chip filing** (arena) — one `busy` guard for the composer, the fixed pills and the minted chips.
- **A battle change carried the prior battle's chips, belief and failure line** (arena) — reset with the counter.
- **Between a filing's 200 and the listener, the same chip was tappable with the stale belief** (Battle View) — the filed thread is held as the belief and the chips stay hidden until the subscribed slot catches up.
- **A legacy slot with text but no thread id was reported `filed`** — `replaced-prior`, with no thread to name.
- **The desktop answer-scroll ignored the receipt line** — a `directive` line is brought into view too.

---

## 4. CONFIRMED — test rows that could not fail

BUILD_RULES §2: *"A row that cannot fail under the defect it names is not a guard."* Five of mine were not, and two seams had no row at all.

| # | Row | Why it could not fail | Fix (verified green-on-pristine / red-under-mutant by lens 4, re-run by the refuter) |
|---|---|---|---|
| 1 | `'shadow': both prompts assembled … both on the record` | The builder mock returned one literal for BOTH builds, so swapping `systemPromptOld` / `systemPromptNew` survived. The windows were distinguishable; the prompts — what the harness replays — were not. | The mock returns `…:old` / `…:new`; the rows assert which was sent. |
| 2 | `'on': the chips are normalized by the SERVER-DERIVED archetype` | `VALID_BATTLE` carries no `agentContext`, so `getEffectiveArchetype` reduced to the agent doc; the property was proven at the route, not at the chat seam the title named. | A diversifier snapshot over a momentum_chaser agent doc: DV-02 kept, TF-02 dropped. |
| 3 | `passes the owner` (the dispatch source row) | `toContain('ownerId: battle.ownerId \|\| null,')` matched either of two identical dispatch lines; dropping either survived. | Count `.toBe(2)`. |
| 4 | `null-honest … never null or a default` | The portfolio fixture's ranking had no `fundamentals` key, so the portfolio builder's type guard was never reached (AMENDED: the conjunct guards a shape no shipped writer produces). | Both sides carry a non-object mirror. |
| 5 | `a directive chip reads Files: {canonical text}` (both clients) | Both rows looked the button up through `filesChip(DV02)` — when the prefix went, the lookup lost it too. The word the spec puts on the chip had no literal anywhere. | Literal `Files: …` lookups; a `decisionRecord.test.js` row pins every filing string, 422 included. |
| 6 | The cache handler's flag wiring | `briefOptions = { fundamentals: … !== 'off' }` had no row — every flag-off cache doc would have gained a field with the suite green. | A source row on the one line, both builders. |
| 7 | `useArenaEngine.js` | No test imported the hook: `fileLive` posting to the CHAT route and never adopting a 409's thread both survived. | A jsdom hook test through the real `fetchWithAuth` with the token mocked and global `fetch` stubbed (the runner did not honour a mock of the lazily-imported helper). |
| 8 | Writer 5 (`auto_debrief`) | Source rows only: stripping the marker before the write, literal kept, survived. | The exchange is built by an exported pure `buildDebriefExchange`, pinned behaviourally under each mode. |
| 9 | The fake transaction | Never enforced reads-before-writes: a `tx.get` after the writes survived 27/27. | The fake's `tx.get` throws once anything is buffered. |
| 10 | The accessor's env read | `fnBody()` sliced the commented source, so a read moved into a comment survived. | It slices the comment-stripped `CODE`. |
| 11 | The elicitation table | Fifteen strings sent every turn, byte-identical before and after the build, pinned by nothing — the goldens rendered the fixture's copy of one line. | A sixteenth golden key, `elicitation.table`; the JSON gained exactly that key. |
| 12 | Two titles over-claimed | "asks the accessor for the TOKEN's uid" / "for the BATTLE OWNER's uid" — both routes 403 unless the two are one, so the mutants were equivalent. | Reworded to what they prove. |

Six test files were de facto BUILD_RULES §4 dependency-surface guards with no guard comment; each now says so.

**Mutation totals:** lens 3 ran 24 (22 killed as designed; the two survivors are rows 6 and 11 above); lens 4 ran 120 (104 killed; 3 equivalent; 13 indicting, all above). The rows this review added were mutation-checked on the fixed tree: **22 run, 22 killed** — every fix has a row that reds without it.

---

## 5. REFUTED and AMENDED

- **REFUTED — R-28** (lens 3): "eight of nine `Woken by` sentences are pinned only by a prefix." `selectWhyState.test.js` › *ALL NINE persisted types have their ruled sentence (D-81)* pins every literal through the copy re-export; rewording one reds five rows in three files. Lens 3's suite list had not included that file. No change.
- **AMENDED — R-02** (`Holding note`): fact confirmed; severity a founder decision (§3 above). Taken: gated.
- **AMENDED — R-04** (the empty bubble): confirmed three ways; cosmetic and `'on'`-only (the route 404s under `'off'`, so no such exchange can exist there).
- **AMENDED — R-05** (the unguarded counterpart): mechanism confirmed; 0/15 hostile shapes throw; a hazard, fixed.
- **AMENDED — R-09** (the null-honest row): the gap is real, the untested conjunct guards a shape no writer produces; fixed anyway, one token.
- **AMENDED — R-19** (the legacy slot): no shipped writer of this tree or the previous one omits the thread id; needs a pre-Phase-7 slot on a still-active battle. Fixed, one line.
- **AMENDED — R-20** (no live-play gate on the route): the chat route's strip is a REVIEW-mode gate (closed market AND today's review), not a live-play gate; a directive filed after the close is in front of the process at the next check, which is what a directive is. **Recorded in the route header, not gated.**
- **AMENDED — R-17**: path only (`battleArena/LeagueBattleArenaLive.jsx`).

---

## 6. Recorded, not fixed — for the founder

1. **The deploy-time opener is still the OLD prompt under `'on'`.** Fenced `api/agent/decide.js` calls `buildFirstMessagePrompt` with no `grounded`; `ensure-opener` returns `already_present` whenever that opener exists, so the fenced opener is the common case and carries guard sites 1, 2, 3, 13–17, 29, 30 ("watching", "you go first…"). Ruling 4 covers only the history window (met by mechanism). Spec §4 / §7's "no 'watching' in the opener" holds for the LAZY opener only until a §7-gated one-key fence change. Not fixable in this build.
2. **D-80 vs spec §3.2.** YOUR RECORD quotes rationale BYTES verbatim (the spec's rule), including the cron's provenance code (`Guardrail override (guardrail_stopLoss): …`); D-80 says a machinery-provenance code never reaches the screen, and the pane maps it through `renderMotive`. The prompt is not the screen, but the narrator can now voice `guardrail_stopLoss`. Bytes or the pane's mapping — a ruling.
3. **Spec §3.2's "one-entry fallback if the R5 read is thin"** is not implemented; `RECORD_WINDOW` is fixed at three until the paired harness has measured.
4. **The hypothesis label** has two ruled spellings — the prompt's (§3.2, built) and the pane's (§11, A3.7 unbuilt). No drift today; when A3.7 lands the label moves to `decisionRecord.js`.
5. **`FILING_STATUS`'s body words have no client consumer** — both clients render by HTTP status; recorded in the route header as the client contract.

---

## 7. Process notes

- **The protected-store scan had been red since G4** (two write sites in the route's transaction, unlisted). The full suite after G6 caught it; the targeted runs after G3 and G4 had not included the scan. The allowlist entry was added by amending G4 before anything was pushed — the entry belongs with the writer — and every test figure in this record and the handover is a FULL-suite figure.
- **Lens 4's mutation parser** mislabelled every kill as a survivor on my first pass of the fix rows; the red row names in the same output proved the kills, and the two mutations with no red row were re-run with real defects (a read after the writes; a strip inside the builder) and killed.
- **The hook test** could not mock the lazily-imported `fetchWithAuth` (the runner evaluated the real module for the second dynamic import); it mocks the token read under it and stubs global `fetch` instead, which observes every request as the network sees it.

---

## 8. Post-build rulings — the five founder items (handover §6)

Appended September 8, 2026, in the same PR that commits Sol's two passes to
`docs/audits/` (below). These are the five items the handover's §6 carried out
of the build; this section records **where each one now stands**, and — for the
two the build had to settle in order to ship — **what the build took**, with the
one-line reversal named where one exists. Two remain open: they are founder
rulings, and nothing in this build made them. The fifth is deferred, not
settled: nothing renders both spellings today, so nothing disagrees yet.

The authority wording follows Sol's own governance note (PASS2, §"There is also
one governance wording issue"): an advisory pass does not create founder
rulings. **Taken in the build** below means a build decision recorded and
reversible; **open** means awaiting the founder.

| # | Item | Status | Disposition of record |
|---|---|---|---|
| 1 | **The deploy-time opener stays the OLD prompt under `'on'`** | **OPEN — founder ruling** | Fenced `api/agent/decide.js` calls `buildFirstMessagePrompt` with no `grounded`, and `ensure-opener` returns `already_present` whenever that opener exists, so the fenced opener is the common case and carries guard sites **1, 13–17, 29, 30 in every phase, plus the phase block's own — 2, 3 in discovery, 4–6 in refinement, 7, 8 in mastery** ("watching", "you go first…"). *(This corrects §6 item 1 above and the handover §6, which both give the discovery list unqualified: sites 2 and 3 live only in `DISCOVERY_RULES`, and which sites ride along depends on `getAgentPhase(gamesPlayed)`. Measured by running the shipped `findGuardedVocabulary` over the real `buildFirstMessagePrompt` output per phase; the GROUNDED first-message prompt returns zero hits.)* Spec §4/§7's "no 'watching' in the opener" therefore holds for the LAZY opener only — which IS the live path, `OPENER_LAZY_FALLBACK_ENABLED = true`. The two paths open to the founder are a **§7-gated two-line fence change** (pass `grounded` into the `buildFirstMessagePrompt` call in `decide.js` — the key AND a `getVoiceGroundingMode` import that file does not yet have, unlike `ensure-opener.js`) or an **accepted gap** recorded as such. Not fixable inside a non-fenced build; ruling 4 (the history window) is met by mechanism either way. |
| 2 | **D-80 vs spec §3.2 — rationale bytes on the narrator's path** | **OPEN — founder ruling** | YOUR RECORD quotes the rationale BYTES verbatim (spec §3.2's own rule: "verbatim means bytes"), provenance code included — `Guardrail override (guardrail_stopLoss): …`. D-80 says a machinery-provenance code never reaches the screen, and the pane maps it through `renderMotive`. The prompt is not the screen, but under `'on'` the narrator can now voice `guardrail_stopLoss`. **Bytes, or the pane's `renderMotive` mapping** — one or the other, and the harness's per-pair rationale column (`api/scripts/voice-grounding-harness.js`) is where the founder can see what the model does with them before deciding. |
| 3 | **`Holding note` gating** | **TAKEN IN THE BUILD** | Gated on the grounded exchange: the eyebrow renders only for an exchange carrying the grounding marker, so the flag-off page is byte-identical and legacy model forecasts are never retroactively relabelled. Review row: §5's `AMENDED — R-02` (fact confirmed; severity a founder decision). **Reverses in one line** in `src/screens/battleView/battleViewCopy.js` if the retroactive relabel is what the founder wants. |
| 4 | **No review-mode gate on the deterministic route** | **TAKEN IN THE BUILD** | `POST /api/agent/file-directive` adds no LIVENESS gate beyond an ACTIVE battle (check 2) — its other seven in-transaction checks all stand. A directive filed after the close is in front of the trading process at the NEXT check, which is what a directive is; the chat route's strip is a REVIEW-mode gate, not a live-play gate, and review mode is entered either by auto-detection (a closed market AND today's review) or by the client's bounded `mode: 'review'` override — the Film Room path, which needs neither. Review row: §5's `AMENDED — R-20`. **Recorded in the route header, not gated** — the decision is in `api/agent/file-directive.js`'s "TWO DECISIONS RECORDED (a)". |
| 5 | **The hypothesis label's two spellings** | **DEFERRED — no drift today** | The prompt's spelling (spec §3.2, built: `HYPOTHESIS_LABEL` in `api/_utils/voiceLayerGrounding.js`) and the pane's (spec §11, A3.7 unbuilt) differ. Nothing renders both today, so nothing disagrees. **Reconcile when A3.7 lands**, by moving the label into the zero-import `src/data/decisionRecord.js` — the same one-home move every other shared string in this arc took. |

Two items from §6 of THIS record are not in the table above because they are not
founder items: spec §3.2's one-entry record fallback (`RECORD_WINDOW` stays 3
until the paired harness has measured — the harness this PR adds is what
measures it) and `FILING_STATUS`'s body words having no client consumer (both
clients render by HTTP status; recorded in the route header as the client
contract).

### The reviews this record answers

Sol's two passes are committed alongside this section, byte-exact as received:

| File | Pass | Verdict |
|---|---|---|
| `docs/audits/20260907_SOL_REVIEW_VOICE_GROUNDING_PASS1.md` | Blind adversarial review of Spec V1 | **STOP** — 2 BLOCKER · 8 MAJOR (F1 the action-bearing `threshold`; F2 `Files:` unbacked by the click path) |
| `docs/audits/20260907_SOL_REVIEW_VOICE_GROUNDING_PASS2.md` | Confirm pass on V1.1 | **PROCEED WITH CORRECTIONS** — 0 BLOCKER · 5 MAJOR · 3 minor/governance |

Their dispositions are the spec's own Appendix B and Appendix C
(`docs/design/VOICE_LAYER_GROUNDING_SPEC_V1_2.md`); the build against those
dispositions is §§1–7 above. PASS2's M1 (raw rationale still carries forward
language) is the one that closes in two halves: the code half shipped in the
build — `RATIONALE_RULE` is printed beside the block
(`api/_utils/voiceLayerGrounding.js`), byte-identical to the wording Sol asked
for — and the measurement half is what PROVES it, the hostile fixture and the
scored forward-language dimension that live in
`api/scripts/voice-grounding-harness.js` and run at spec §9 gate 1.
