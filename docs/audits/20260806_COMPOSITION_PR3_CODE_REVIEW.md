# Composition PR 3 — BUILD_RULES §2 Adversarial Review Record

**Date:** Aug 6, 2026 · **Branch:** `claude/composition-pr3-assembly` (base `0b400974`) · **Scope:** the PR 3 cumulative diff — the A11 binding table, the five PR-3 ledger items (M12/M11/B3/B8/B5), the CompiledBuild legality boundary (A7/A15/C2 closure), **the §7-signed fenced splice in both assemblers** (D3/A13/A14 + dual goldens), and the M7 budget fixture.

**Method (§2 at threshold; the fenced PR — founder-ordered high effort):** two independent adversarial lenses (design/correctness; test-integrity), every finding refute-attempted by its own lens before reporting, all CONFIRMED findings fixed in-branch before push (this PR's posture: fix, don't just record — the founder merges the finished artifact), mutation-checked (N-series + review-driven re-verification), `vite build` explicit, this record written and committed.

---

## Fence sweep (§1)

**CLEAN.** The only fenced files in the diff are the two §7-signed assemblers (`agentPromptAssembly.js`, `agentEvalPromptAssembly.js`); splices are the sanctioned DR-13 flag-split shape (one import + one index build + append-wraps), `compositionAdvisoryRender.js` registered in `PROMPT_CONTRIBUTING_MODULES` in the same commit. `decide.js` and every other §1 file untouched.

**FC-1 (named process concern, design lens):** `resolvedAgentManifest.js`'s new `compositionCompat` slice is concept-level contact with the fenced `createAgentBattle` doc shape — the manifest the fenced `agentBattleService.js:220` writes into battle docs gains a field **when a candidate-mode build exists** (never today; `MANIFEST_WRITE_ENABLED` is live but legacy builds carry no advisory keys, so the field is absent and manifestHash unchanged — golden-verified). It shipped inside the §7-signed commit and is named here explicitly per §1's concept-fence rule: **at the PR-4 flip, the battle-doc shape changes via this non-fenced module** — the founder should treat the flip as touching that concept.

## Lens 1 — Test integrity ("would the row fail under its named defect?")

| # | Finding | Verdict | Disposition |
|---|---|---|---|
| F1 | **The B5 flagship torn-view row passed with the seqlock DELETED** — the fake's lazy snapshots + descriptor-coupled entries made a torn view unrepresentable (a false pass on the exact ledger acceptance) | CONFIRMED (gating) | **Fixed:** eager read-time snapshots, LIVE-state layer reads, retry-count assertion; the seqlock-deletion mutant now kills BOTH interleaving rows (re-verified) |
| F2 | **5 of 11 B8 endpoint fixtures never wrote even under an OPEN epoch** (`not_equipped` / `not_in_menu` / `watchlist_not_found` / `not_draft` / an idempotent-no-op unequip-lean whose `standingLeans` was an object, not an array) — their zero-writes assertions were vacuous | CONFIRMED (gating) | **Fixed:** per-row fixture overrides (equipped bundle for unequip, valid SP-01/SP-02 lean pins, committed watchlist doc, draft bundle for hardness) + the anti-vacuity control extended to ALL 11 endpoints: open epoch ⇒ 200 **with writes** |
| F3 | **B3 deny-by-default evasions:** (a) two writes in one (file,fn,method,collection) tuple collide to one key — a second write in an allowlisted function shipped silently; (b) a ref passed as a function parameter produced NO site (invisible, not unresolved); (c) `ref['set'](…)` skipped | CONFIRMED | **Fixed (a):** the allowlist now pins a SITE COUNT per key (158 keys / 211 sites); count drift fails CI. **Fixed (c):** computed string-literal write methods recognized. **(b) documented** as a stated resolution limit with the compensating belts named (census chokepoint scans cover the shared helper surfaces; B8 behavioral; rules layer) |
| F4 | **M7's "full-request" claim measured ~half the real request** — the third message (`buildLiveContextBlock`) + tool schema are unmeasured | CONFIRMED | **Fixed honestly:** renamed to system+identity scope (`EVAL_IDENTITY_INPUT_TOKEN_BUDGET_ESTIMATE`), the coverage boundary stated in the header. The advisory-bearing surface is fully covered; the live-context fixture is recorded as out of proportion for this row's purpose — founder may order it separately |
| F5 | **A11's bare-domain predicate was a hand-copy of the kernel's `isDomain`** — faithful today (200k-case differential fuzz: 0 mismatches) but a live drift channel: a future kernel domain shape would false-pass the invariant on exactly the class it guards | CONFIRMED | **Fixed:** the invariant now imports the kernel's own `isDomain` |
| F6 | Dark byte-identity was key-absence, not byte-identity | PLAUSIBLE | **Hardened anyway:** a dark-build `contentHash` golden pinned — and verified equal against a build compiled at the PR-3 BASE (`0b400974`) in a worktree, so the dark path is provably byte-identical, not just key-stable |
| F7 | The B8 census-equality row is suite↔census sync, not census↔reality completeness | PLAUSIBLE | Recorded; census↔reality rests on the three chokepoint scans + B3 (with F3b's documented limit); spot-checks clean |
| F8 | M11 regex gaps (double-quoted specifiers, dynamic `import()`) | PLAUSIBLE | Recorded; zero occurrences in the prompt surface; the `export … from` shim attack was attempted and IS caught |

Sound under attack (lens 1): the `epoch_closed` sentinel's uniqueness (B8 non-vacuity), B3 rename-to-dodge (fails twice: stale + deny), all ten A11 bindings verbatim vs both ledgers, the M12 rows' defect-sensitivity, A13 exactly-once by construction + the M7 delta tripwire, call-time flag reads in every dark row, A15 render fail-closed on both assemblers.

## Lens 2 — Design / correctness

| # | Finding | Verdict | Disposition |
|---|---|---|---|
| F1 | **B3 scanner-invisible write classes** (empirical repros): computed methods, destructured methods, ref-as-parameter helpers, renamed batch handles via `db.batch()` construction, `.mjs` files unscanned | CONFIRMED | **Fixed:** `.batch()`/`.runTransaction()` construction recognized as Firestore-shaped; computed string-literal methods recognized; `.mjs` now scanned; the `out`-dir skip narrowed to `scripts/composition/out` only; parameter/destructure classes DOCUMENTED as stated limits with the compensating belts named |
| F2 | **The A7 boundary disagreed with the equip/save kernel on legitimately-persisted sparse shapes**: `paramValues: null`/`{}` false-quarantined (paramKeys were derived from paramValues, not `snap.params`; kernel judges only truthy paramValues, skips null values) — falsifying "the compile boundary can never disagree with the kernel," and a false quarantine blanks the agent's whole advisory surface at activation | CONFIRMED (gating for PR-4) | **Fixed:** guards now mirror the kernel exactly (truthy-object gate, `snap.params`-first key derivation, `param in paramValues` + non-null). Three sparse-shape regression rows + a kernel-side-by-side agreement row added |
| F3 | **Seqlock ABA**: generation-only comparison admits a rollback + re-activation landing on the SAME generation number with a different candidate tuple — the Sol cross-generation counterexample re-enabled through ABA | CONFIRMED | **Fixed:** the seqlock compares the FULL descriptor tuple (generation + epochId + candidateStateId + semanticHash); ABA contract row added; **generation monotonicity written into the ledger's B4 row** as a PR-4 writer obligation (stamped derived writes DO depend on it) |
| F4 | A present descriptor without a numeric `activationGeneration` coerced to 0 — colliding with the pre-activation sentinel (overlays under the dark-world stamp) | PLAUSIBLE (hardened) | **Fixed:** malformed descriptor now FAILS CLOSED (`MalformedActivationDescriptorError`); four malformed-shape rows added |
| F5 | A quarantined/blocked tension rule still rode `renderedTensionCandidates` into the manifest's DR-13 feed (zero readers today) | PLAUSIBLE (hardened) | **Fixed:** tension pairs are recorded only for rules that survive every block; regression row added |
| F6 | The A15 predicate ignores `validation.pass` — advisories render for surviving rules of a partially-errored build | ACCEPTED RISK | Founder-ruled Phase-2 posture ("validation is a recorded field, not a gate") deliberately preserved; recorded, not fixed |
| F7 | Registry format-mixed: ten cells param-keyed, ~15 single-param cells still bare | CONFIRMED (debt) | Disclosed, not fixed: single-param bare domains bind deterministically and the F2 fix removes their quarantine hazard; converting them is a transcription-scope decision for the founder |
| F8 | M11 dynamic-import gap | PLAUSIBLE | Recorded (theoretical; repo style static) |

Upheld under attack (lens 2): all ten ledger bindings (independently re-derived against templates AND ledgers); dark byte-identity of the splices against every constructed attack (no exception path, no field collision — `update-agent-settings` allowlist blocks user-persisted `compositionCompat`, no production battle can carry the slice); legacy compiler byte-identity incl. error order; B8 non-vacuity via sentinel uniqueness; manifestHash stability; the fail-closed render path; the stamp helpers.

**Forward gap (both lenses, PR-4 input):** compiled builds cover `equippedBundles` only — TRAIT-hosted rules never enter `compatVerdicts`, so advisories will not attach to trait rules when lit (their LEGALITY is covered by `checkCandidateTraitLegality` at the settings boundaries and the migration). Named for the PR-4 plan.

## Mutation record

| # | Mutation | Killed by | Result |
|---|---|---|---|
| N1 | Binding table: tv-12 param key dropped (bare domain restored) | A11 ledger-exact + no-bare-domain rows | ✅ 2 failed |
| N2 | `semanticHash` includes `migrationRunId` | M12 equal-semanticHash row | ✅ 1 failed |
| N3 | (live) unallowlisted `.set()` on agents scaffolded | B3 deny-by-default row | ✅ failed as designed |
| N4 | Fence helpers revert to fail-open on unrecognized state | B8 MISMATCHED arm (all endpoint rows) | ✅ 4+ failed |
| N5 | B5 seqlock re-read deleted | exhaustion row (pre-F1 fix) → **both interleaving rows post-F1** (re-verified) | ✅ |
| N6 | A7 quarantine dropped | A7 never-clamp row | ✅ 1 failed |
| N7 | A15 predicate ignores `quarantined` | predicate + both assemblers' A15 render rows | ✅ 3 failed |
| N8 | Eval splice severed (index never consulted) | A13 eval golden + M7 lit + delta rows | ✅ 3 failed |
| N9 | Advisory double-append | A13 exactly-once (both assemblers) + M7 delta | ✅ 4 failed |

## Verification evidence (final HEAD)

- Full vitest suite: **all green** (final count in the STOP report; includes the 45-row B8 suite, 8-row B5 contract, 18-row boundary+M7, activation goldens)
- Rules emulator: **128/128**
- `vite build`: clean
- Dark goldens: p4Equivalence battery + ruleCompatInvariantR + hardSoftOverride inline goldens **unchanged**; dark CompiledBuild `contentHash` golden verified equal at the PR-3 base in a worktree
- Import ratchet + honesty tripwire green (`compositionAdvisoryRender.js` registered same-commit)

## Standing disclosures (carried to the STOP report)

1. **FC-1**: the PR-4 flip changes the battle-doc manifest shape through non-fenced `resolvedAgentManifest.js` — treat the flip as concept-fence contact.
2. **Trait-channel advisories**: not carried by compiled builds (bundle-scoped inputs); legality covered elsewhere; PR-4 input.
3. **M7 scope**: system+identity message only; the live-context third message is unmeasured (stated in the test header).
4. **B3 stated limits**: ref-as-parameter and destructured writes are invisible to the static scan — compensated by the census chokepoints, B8, and the rules layer; documented in the scanner header.
5. **Registry format debt**: ~15 single-param bare-domain cells remain (legal; conversion is a founder scope call).
6. **A15/validation.pass**: the Phase-2 recorded-field ruling deliberately preserved (design F6).
7. **DEFAULT_TRAITS candidate object**: out of PR-3 scope — Phase 0 item 13 (CLEAR) assigned it to no PR; the closure sheet never names it; default-trait substitutions are event-time cargo (COMPOSITION_EVENT_LEDGER item 6).
8. **The binding restoration changes the migration population**: the six former needsBinding rows become plannable clamp entries — **re-run the dry-run before any `--apply`** (D1's ratified 15-entry count predates A11).
