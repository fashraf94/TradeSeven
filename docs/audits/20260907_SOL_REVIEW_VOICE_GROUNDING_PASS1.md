# SOL ADVERSARIAL REVIEW — Voice-Layer Grounding Spec V1

**Date:** September 7, 2026  
**Target:** `VOICE_LAYER_GROUNDING_SPEC_V1.md`  
**Evidence record:** `20260907_VOICE_GROUNDING_PHASE0_DISCOVERY.md`  
**Role:** blind adversarial review of contracts and claims, not aesthetics  
**Lock discipline:** no LOCKED framework decision is reopened. The phrase “you can honor or argue directives” is treated as the founder’s earlier paraphrase, not as a repo string.

---

## 1. Executive verdict

**SPEC VERDICT: STOP**

This is a narrow design stop, not a rejection of the grounding direction.

The central architecture is right: give the voice layer real records, separate narrator context from decider evidence, remove invented forward intent, code-render receipts, and measure before rollout.

V1 is not yet safe to build because two core contracts do not survive their own source evidence:

1. **R1 and R4 conflict.** R1 forbids a specific future trade. R4/§5 quotes a `threshold` whose source contract explicitly asks the decider for “the specific condition that would make you act” and even models “I would rotate it into Core.” Attribution as “its note” does not turn an action conditional into a non-promise.
2. **`Files:` is not backed by the current click path.** The discovery proves a chip tap sends text into a new Gemma turn. Only after Gemma speaks does the gate map the model-selected id to canonical text. The proposed chip object carries an id, but §6.2 says the tap keeps the unchanged text-only mechanism. Therefore the UI cannot truthfully promise that the tap “Files” that directive.

Both are contract failures in the exact areas this spec exists to make honest.

After those two are corrected, the remaining findings are bounded. I do not see a reason to abandon the arc or reopen the authority model.

### Severity count

| Severity | Count |
|---|---:|
| **BLOCKER** | **2** |
| **MAJOR** | **8** |
| **MINOR** | **0** |

---

## 2. Findings

| # | Severity | Finding | Why it matters | Minimum correction |
|---|---|---|---|---|
| **F1** | **BLOCKER** | **R1 and R4 contradict each other on `threshold`.** | R1 says the character never states a specific future trade. §5 renders the decider’s `threshold` verbatim. Discovery C6 proves that field is requested as “the specific condition that would make you act,” with the schema example “If it holds above the 20-day on the next test, I would rotate it into Core.” The quoted sentence remains a conditional commitment about future trading behavior. | **Do not render `threshold` in anticipation V1.** A code-composed note may report the historical flag, symbol, direction, slot, and a source field independently proven to be descriptive. Restore threshold text only after the fenced output contract is changed so the field no longer encodes a future action. |
| **F2** | **BLOCKER** | **`Files:` promises deterministic filing, but §6.2 retains a model-mediated click path.** | Discovery D9/D10 proves the current chip tap sends the chip text as the next user message. Gemma then emits a proposal id. Only afterward does `directiveGate` map that id to canonical text. The chip’s own id is not what files the directive. The model may choose another id, emit no change, hit a conflict, or fail schema. | Make a directive chip submit its **structured allowlist id** to a deterministic server route that validates and files that exact id without asking Gemma to re-decide the mapping. If the current text-only route remains, the prefix must be weaker than `Files:` and R3 is not satisfied. |
| **F3** | **MAJOR** | **The identity frame collapses two provenance classes into “your record.”** | §3.1 says “What follows is your record.” What follows later includes cache briefs and market context. Discovery A2/B4/H20 proves those are narrator-side context, often from a different cadence and sometimes a different corpus than what the decider saw. R2 itself says these sources must stay labelled. | Scope “YOUR RECORD” only to persisted decision-path output. Add a separate heading such as **CURRENT NARRATOR CONTEXT — not evidence from the trading check** for cache material. Replace “what you were told” with “what was filed to the trading process” for directives. |
| **F4** | **MAJOR** | **“Your standing rules act on their own” reintroduces continuous or autonomous agency the framework forbids.** | The locked cadence rule says the system is discrete. Discovery and framework evidence show checks happen on cadence and the decider receives current rules/directives at checks. “Act on their own” suggests behavior between checks and is not proven for the general rule set. | Replace with a cadence-honest sentence: **“Between scheduled checks, no new trading decision is made. At a check, the trading process evaluates current evidence under its standing rules and any current directive.”** |
| **F5** | **MAJOR** | **Expanding history fixes memory but creates self-contamination.** | §3.3 adds agent-initiated opener, trade narration, and anticipation exchanges to the last-10 history. Discovery Hazard 4 proves they are absent today, but V1 adds no rule saying prior voice text is conversation history rather than decision evidence. Legacy “I’m rotating” or “I’m watching” lines could be fed back as if they were facts. | Tag history by source/message type and state explicitly that **prior voice messages are not decision evidence**. Exclude legacy pre-grounding proactive messages or include only grounded/code-composed proactive exchanges with a grounding version/source marker. |
| **F6** | **MAJOR** | **The DECIDER RECORD contract says both “verbatim” and “emphasis markers stripped,” while the test demands byte equality. It also leaves the hypothesis duplicate unresolved.** | These claims cannot all be true. Discovery F15 and Hazard 12 prove the current rationale may contain an inline hypothesis while the separate `hypothesis` field also exists. §3.2 would render both, while §10 demands verbatim rationale equality. | Pick one contract. For V1, preserve the exact rationale bytes if it is called verbatim. If display sanitation is required, label it sanitized and test semantic/source equality instead of byte equality. Do not render the standalone hypothesis beside an inline duplicate until deterministic de-duplication is specified. |
| **F7** | **MAJOR** | **Code-composed anticipation still embeds model-authored free text whose safety is not proven.** | §5 removes Gemma’s paraphrase but inserts `signalSummary` and `threshold` written by the decider model. Discovery proves `threshold` is unsafe. It does not prove `signalSummary` is restricted to descriptive present/past evidence. Code composition removes one hallucination layer, not the semantics already inside the source field. | In V1, render only fields whose source contract is proven non-promissory. Symbol, direction, slot, and evaluation id are safe. Treat `signalSummary` as untrusted for forward-intent purposes until its schema/instruction is verified. |
| **F8** | **MAJOR** | **Trade narration conflicts with the spec’s own “quote, never compose the decider’s reasoning” lock.** | §4 keeps a Gemma instruction to “translate faithfully.” Discovery C7 proves this remains a model-authored paraphrase of the decider’s rationale. The rationale may also carry an inline future hypothesis because of F15. A past-tense instruction does not resolve the source conflict. | Make the V1 trade notice code-composed from structured trade facts. If rationale is surfaced, quote a deterministically safe decision-only field. Do not ask the narrator model to rewrite causal reasoning while the spec says it only quotes the decider’s reasoning. |
| **F9** | **MAJOR** | **Shadow mode does not measure the latency of the prompt that will be sent when the flag turns on.** | §9 shadow assembles the new prompt but sends the old prompt. The discovery says live `gemmaLatencyMs` is currently unaggregated and the +980-token latency impact is not measured. Reading old-prompt p50/p95 plus a token estimate does not satisfy R5’s “measure before on.” | Require the paired harness to record **new-prompt latency**, schema adherence, and timeout rate. Then use a limited live canary before broad `on`. Shadow assembly alone is necessary but insufficient. |
| **F10** | **MAJOR** | **The dedupe implementation proves text equality, while the claim says condition equality.** | §5 hashes raw `threshold` and says “no re-narration of an unchanged condition.” Discovery H22 shows there is no structured prior-condition memory. A model can restate the same condition with different words and defeat the hash. Conversely, exact text equality is the only thing the implementation can prove. | Either narrow the claim to **no repeat for the same normalized threshold text**, or use a stable structured condition identifier. Until a structured source exists, do not claim semantic condition dedupe. |

---

## 3. Claims audit

### C-1 — “The character speaks only from its record”

**The spec shows:** §3.1 calls what follows “your record.”  
**The discovery proves:** cache technicals, fundamentals, market context, and Wire material are narrator-side context and are not necessarily what the decider saw at its tick.  
**The gap is:** the frame converts labelled context back into an undifferentiated autobiographical record.

**Disposition:** correct F3 before build.

### C-2 — “Quoting the threshold is reporting, not forecasting”

**The spec shows:** R1/R4 and §5 treat `threshold` as a quoted historical note.  
**The discovery proves:** the fenced prompt defines `threshold` as “the specific condition that would make you act,” and the schema example contains a specific future rotation.  
**The gap is:** the proposition being quoted is itself a future action conditional. Attribution proves authorship. It does not erase the commitment contained in the proposition.

**Disposition:** claim fails. F1.

### C-3 — “Code-composed anticipation removes the promise problem”

**The spec shows:** §5 removes model-composed anticipation prose.  
**The discovery proves:** the inputs remain model-authored `signalSummary` and `threshold`; `threshold` is action-bearing by contract.  
**The gap is:** the compositor prevents Gemma from adding new intent, but it still republishes intent already present in the decider output.

**Disposition:** partially true only after unsafe source fields are removed or re-contracted.

### C-4 — “A directive chip that says `Files:` will file that directive”

**The spec shows:** §6.1 creates `{kind:'directive', id, text}` and §6.2 says tapping sends canonical text through the unchanged mechanism.  
**The discovery proves:** the current click path sends text, then Gemma chooses the proposal id, then the gate resolves it. There is no pre-send deterministic mapping.  
**The gap is:** the chip id is presentation metadata, not the filing authority.

**Disposition:** claim fails. F2.

### C-5 — “`Filed:` is structurally honest”

**The spec shows:** §6.3 renders `Filed: {directive.text}` from the exchange/server result, not model prose.  
**The discovery proves:** the resolved directive text exists after the gate and is persisted/returned; both clients currently fail to consume the server-owned status fields.  
**The gap is:** the design is sound only if the UI line is bound to the actual successful write, not merely the model proposal or pre-write resolution.

**Disposition:** sustain with an implementation rule: render only after the authoritative write succeeds, from the persisted directive object.

### C-6 — “The last-10 history gives the character honest memory”

**The spec shows:** §3.3 includes agent-initiated exchanges.  
**The discovery proves:** those exchanges currently include proactive text generated under the old unsafe “watching / rotating” instructions.  
**The gap is:** visibility is not provenance. Replaying old narrator claims can turn old fabrication into new apparent memory.

**Disposition:** claim incomplete. F5.

### C-7 — “Rationale is verbatim”

**The spec shows:** “verbatim, emphasis markers stripped,” plus a byte-equality test.  
**The discovery proves:** emphasis markers may be part of the stored rationale, and the inline hypothesis contradiction exists.  
**The gap is:** a transformed string is not byte-verbatim, and duplicate prediction content remains undecided.

**Disposition:** claim fails as written. F6.

### C-8 — “Trade narration obeys C1”

**The spec shows:** C1 is restated as “the narrator quotes, never composes the decider’s reasoning,” while §4 retains “translate faithfully.”  
**The discovery proves:** `generateTradeNarration` asks the model to compose a translation of `closedTrade.rationale`.  
**The gap is:** faithful paraphrase is still composed reasoning text.

**Disposition:** claim fails as written. F8.

### C-9 — “Measure before `on`”

**The spec shows:** shadow mode plus old-prompt p50/p95 and a measured token delta are gates.  
**The discovery proves:** the new prompt is not sent in shadow and its latency effect is not measured.  
**The gap is:** assembly cost and token delta are proxies, not the production latency distribution of the new request.

**Disposition:** incomplete. F9.

### C-10 — “No re-narration unless the candidate’s condition changed”

**The spec shows:** hash `(symbol, direction, threshold)` and skip identical hashes.  
**The discovery proves:** condition is free text with no structured identity or prior semantic memory.  
**The gap is:** the system can prove string stability, not semantic-condition stability.

**Disposition:** narrow the claim or add a structured condition identity. F10.

### C-11 — “Fundamentals mirror is zero-read and honestly vintage-marked”

**The spec shows:** copy the existing `rankingsMap` fundamentals into the cache brief and render its `computedAt` vintage.  
**The discovery proves:** `voice-layer-cache.js` already holds the same rankings entry; the fundamentals mirror carries a weekly `computedAt`; marginal read cost is zero.  
**The gap is:** none, provided F3’s provenance boundary prevents these values from being presented as decider evidence.

**Disposition:** sustained.

---

## 4. §12 attack answers

### Attack 1 — “What will you do if NVDA breaks $145?”

The honest answer shape is:

> I do not know what the next check will decide. At the next scheduled check, the trading process will evaluate the live evidence under its standing rules and current directive. The last recorded check showed [historical fact].

If `$145` appears only inside an action-bearing anticipation `threshold`, the character should not convert it into “I will buy/rotate if $145 breaks.” Under R1, a recorded action conditional is not a permitted way to state a specific future trade.

The prompt needs one additional anti-extrapolation sentence:

> Historical decision records are evidence of what was decided then. Do not infer a current plan or future action from them.

### Attack 2 — Is quoting the decider’s recorded condition still a promise?

**Yes, when the recorded condition is authored as a condition “that would make you act.”**

The line is not “quoted versus paraphrased.” The line is the proposition’s semantics.

These are different:

- **Historical fact:** “At 12:45 the process flagged NVDA as a potential-entry candidate.”
- **Recorded forecast:** “At 12:45 the model predicted NVDA would break $145.”
- **Action conditional:** “If NVDA breaks $145, I would rotate it into Core.”

The first is safe. The second can be safe when explicitly labelled as a past prediction. The third communicates a future trading commitment even when quoted.

R1 and R4 therefore need reconciliation. My ruling is to preserve R1 and remove the action-bearing threshold from V1 anticipation.

### Attack 3 — Can `YOUR RECORD` become extrapolatable memory?

**Yes.**

A model will naturally treat autobiographical material as evidence of current intent unless told not to. The stronger frame should say:

- this is historical decision-path output;
- the narrator did not author it;
- it does not represent continuous thought;
- it does not establish a current plan;
- it may be quoted for what happened, not extended into what will happen.

Also separate narrator-side cache context from the record. F3 is required.

### Attack 4 — Is code-composed anticipation better than none?

**Yes, but only after removing fields whose source contracts remain promissory.**

I would not cut the entire feature. I would cut its unsafe payload.

V1-safe form:

> At the 12:45 check, the trading process flagged NVDA as a potential-entry candidate.

Optionally add a signal only after its source contract is shown to be descriptive and non-action-bearing.

Do **not** publish `threshold` until §7 changes the fenced source contract. Code composition is worthwhile because it eliminates a second model’s embellishment. It does not sanitize the first model’s semantics.

### Attack 5 — Do canonical chips kill usefulness? Is `Files:` right?

Canonical text does **not** kill usefulness. It makes the action legible and testable.

`Files:` is the right prefix only after the click is deterministic.

If tapping a chip submits its id directly to deterministic allowlist validation and the exact id is filed, `Files:` is truthful.

If tapping still starts a Gemma turn that may choose a different proposal, use weaker language. Under R3, I would fix the mechanism rather than weaken the copy.

The League receipt is legitimate if it renders from the actual persisted directive write. It should never infer success from the prose response.

### Attack 6 — Is shadow mode enough?

**No.**

Shadow mode proves:

- the new prompt assembles;
- token size is known on real battles;
- off-state behavior stays unchanged.

It does **not** prove:

- new-prompt p95 latency;
- timeout rate under the larger prompt;
- schema adherence under live load;
- real-user helpfulness after grounding.

Before broad `on`, require:

1. paired old/new harness with new-prompt latency and schema metrics;
2. founder review of at least 20 real paired turns;
3. a limited live canary for one trading day;
4. only then the broad flip.

### Attack 7 — What claims cannot the system prove?

The claims audit above identifies the failures. The highest-risk unprovable claims are:

1. a quoted action-bearing threshold is “not a promise”;
2. `Files:` deterministically files through the unchanged click path;
3. the whole prompt following §3.1 is “your record”;
4. unchanged free-text hash means unchanged semantic condition;
5. shadow old-prompt latency proves new-prompt latency;
6. model-translated rationale satisfies “quote, never compose.”

---

## 5. Founder rulings R1–R6

| Ruling | Verdict | Reason |
|---|---|---|
| **R1 — one voice, one tense rule** | **SUSTAIN** | This is the correct governing honesty rule. It is the rule R4 must conform to, not the reverse. |
| **R2 — both evidence sources, labelled** | **SUSTAIN WITH A RULE** | Cache fundamentals are valid narrator context, but §3.1 must stop calling all subsequent context “your record.” |
| **R3 — action chips minted from allowlist** | **SUSTAIN WITH A MECHANISM CHANGE** | Canonical ids/text are right. The click must submit the id deterministically. Current unchanged text-only behavior does not fulfill the ruling. |
| **R4 — anticipation reports, does not perform** | **REQUIRES CORRECTION** | The candidate event can be reported. The current `threshold` cannot be published under R1 because its fenced source contract is action-promissory. |
| **R5 — measure before on** | **SUSTAIN WITH A STRONGER GATE** | Shadow is good, but it does not measure new-prompt execution latency. Add paired latency plus a live canary. |
| **R6 — ATR bug separately now** | **SUSTAIN** | Discovery §5.1 supports the bug and the separation. |

---

## 6. Side questions

### D-76 — The plan at deploy

**VERDICT: SUSTAINED WITH A RULE**

Yes. If the Sonnet deploy brief and tier rationales are persisted, frozen at deploy, and actually placed in front of the decider every tick as D-76/A2 records, they are decision-path output under C1.

Rule:

- render only the exact persisted deploy artifact the decider receives;
- code-render it, do not Gemma-paraphrase it;
- label `The plan at deploy · {date}`;
- gate out tournament battles and template fallback exactly as proposed;
- do not convert the deploy rationale into a statement of current intent.

A frozen deploy plan is historical strategy context. It is not a promise about the next check.

### The hypothesis field

**VERDICT: SUSTAINED WITH A RULE**

Labelling makes the provenance honest. It does not make the prediction true.

The safe object is:

> `Hypothesis recorded at the 12:45 check · graded after the battle`

Render the exact persisted field as a historical prediction. Do not voice it as the narrator’s current forecast.

Rule: the pane must resolve the inline duplicate first. If the same hypothesis still appears inside `rationale`, render one copy only. Until exact de-duplication is defined, prefer the dedicated field and suppress the duplicate presentation path rather than show it twice.

### Assignments V2 — conversational scouting trigger

**VERDICT: SUSTAINED WITH A RULE**

A scouting ask is not a trade promise.

This is R1-compliant:

> My last check named NOW and TSLA on the bench. Scout them and equip the one you’d trust.

It reports a past record and requests research/equip work. It does not say either name will be traded.

Rules:

- symbols must come from the actual cited decider record, not UI proximity or narrator inference;
- the ask must remain research/equip, never “pick which one I should rotate into” unless the separate directive path is explicitly invoked;
- the result must not auto-enter prompt assembly except through the already ruled user/equip path.

---

## 7. Minimum V1.1 correction packet

The smallest correction set I would send back to Fable is:

1. **R4:** anticipation V1 reports the candidate event only. Remove `threshold`. Hold `signalSummary` until its source semantics are verified.
2. **R3:** directive chip click submits the allowlist id deterministically. `Files:` becomes true by mechanism, not by copy.
3. **§3.1:** split historical DECIDER RECORD from CURRENT NARRATOR CONTEXT and remove “standing rules act on their own.”
4. **§3.3:** provenance-tag proactive history and exclude unsafe legacy proactive messages.
5. **§3.2/§10:** resolve “verbatim vs stripped,” and resolve rationale/hypothesis duplication.
6. **§4:** remove model paraphrase from trade narration or narrow it to structured past-tense facts plus a safe direct quote.
7. **§5:** narrow dedupe to what the implementation proves, or add structured condition identity.
8. **§9:** paired new-prompt latency measurement plus one limited live canary before broad `on`.

No new Phase 0 is needed for items 1–5, 7, or 8.

One targeted read is needed before retaining `signalSummary`: prove its exact schema/prompt contract and whether it permits action or forward language.

---

## 8. Final verdict

**STOP V1 AS A BUILD BASIS.**

The stop is caused by two central honesty failures, not by architecture sprawl:

- the spec republishes an action conditional while claiming it never predicts a specific future trade;
- the UI promises deterministic filing while retaining a model-mediated text-only click path.

Correct those, then close the provenance/history, verbatim/hypothesis, trade-narration, dedupe, and rollout gaps above.

With that correction packet, the design direction is viable and materially stronger than the current voice layer. No locked authority decision needs reopening.
