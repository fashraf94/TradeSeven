Source-integrity note: the Forge spec is available, and I found the exact locked `FORGE_RULES_THESIS_V1_2.md`. The exact `AGENT_LEARNING_CHARTER_V1.md` is not present in the accessible attachments or File Library results. I found downstream documents quoting it, but I did not substitute those for the Charter. So I am not going to invent clause-by-clause Charter conformance. Findings below are grounded in the Forge spec itself and the actual Rules Thesis. Charter-dependent conformance remains open until the Charter is supplied.

S-1. BLOCKER

Sections: §2 proposal card, §3.2, §4.4–§4.6, §8 H4/H7.

The spec lets a Hunch alter trading before its own “On trial” state exists. The example Hunch offers “Equip,” §4.6 says Accept compiles and equips it, while §3.2 says “On trial” begins only when the backing lesson reaches Testable and is in a trial.

Why it matters: a low-maturity agent claim becomes persistent behavior before the evidence system says it is ready to test. If it later becomes Testable, the “On trial” label is semantically empty because the behavior was already live.

Smallest fix: Hunch counter cards get no equip action. Counter-origin behavior enters trading only through the Phase B trial state once it is Testable.

S-2. BLOCKER

Sections: §7 C1/C2, §11 PR 1\.

`FORGE_PROVENANCE_WRITES` gates the act of stamping provenance and defaults to false. C2 simultaneously requires provenance to exist before Assignments V2 and Direct writers arrive “from day one.”

Why it matters: after PR 1 merges but before the flag flips, new writers still create items without provenance. Those origins are then irretrievably lost or downgraded to migrated/unknown. The rollout mechanism defeats the invariant it is supposed to protect.

Smallest fix: provenance stamping becomes unconditional once the schema lands. Gate rendering separately.

S-3. MAJOR

Sections: §3.4, §7 C2.

The race fallback only recovers provenance for watchlist entries carrying the existing `source` tag. C2 also names the Direct menu as a competing writer, yet gives no recovery path for a directed lean or rule written before provenance lands.

Why it matters: the spec claims the race is resolved when only one class of writer has a recoverable precursor field. A Direct-origin item can silently become `system_migrated`, losing the very attachment history this arc exists to preserve.

Smallest fix: make provenance a hard prerequisite for every new equip-side writer, rather than treating merge order as sufficient.

S-4. MAJOR

Sections: §1.1, §1.2, §4.5, §14. Thesis §2.1, §4.1, locked decision 4\.

The claimed Thesis conformance does not hold. The Thesis says Forge rules are user- or archetype-authored, and its locked decision 4 defers agent-initiated rule proposals to post-launch. This spec introduces receipt-driven agent proposals that can compile into Forge rules and does not declare the arc post-launch or reopen that ruling.

Why it matters: this is not a UX-only amendment to “rules are authored, not learned.” It changes who originates a rule and when agent-initiated rule proposals enter the product.

Smallest fix: either obtain an explicit upstream amendment or keep counter-origin proposals away from Forge-rule targets until the Thesis permits them.

S-5. MAJOR

Sections: §4.5, §5.5, §8 H7, §14. Thesis §2.4 and §9.5.

The acceptance test checks whether a learned control visibly changes behavior, but the Thesis also says a rule that duplicates a discipline fails the rule test. No duplicate-discipline gate exists here.

Why it matters: the same learned pattern can exist as a dossier discipline at precedence layer 6 and then be compiled into a Forge rule at layers 3–4. That silently elevates one learned belief through two channels.

Smallest fix: the proposal gate must also reject or explicitly resolve a compilation target that duplicates an active discipline.

S-6. MAJOR

Sections: §3.1–§3.2, §5.3.

`archetype_default` represents two materially different origins: archetype-seeded and focus-scouted. The provenance object contains no focus ID, source reference, or equivalent field, yet the UI promises labels such as “Default · Contrarian” and “Scouted · Buy the Dip.”

Why it matters: one stored value cannot prove both labels. Reading the old watchlist `source` field to recover the distinction would leave provenance itself non-canonical.

Smallest fix: preserve the distinguishing origin inside the canonical provenance object.

S-7. MAJOR

Sections: §1.1, §2, §3.4, §8 H2.

The thesis says “why is this in my agent?” is always answerable from the item in one tap. Migrated items deliberately render no chip.

Why it matters: the oldest and likely most common items are precisely the ones for which the core record interaction disappears. “Unknown source” is honest. No affordance at all contradicts the record contract.

Smallest fix: render a neutral source-unavailable state that opens the same provenance sheet without guessing authorship.

S-8. MAJOR

Sections: §3.2, §4.1, §4.4.

The pre-Phase-B ontology is internally unstable. §4.1 says the Ledger holds proposals only before Phase B and that proposals become Hunch-tier lessons after Phase B. §3.2 already defines `agent_proposed` as having a backing lesson at Hunch and later derives its label from that lesson.

Why it matters: an accepted counter proposal created before Phase B has no defined `lessonId` or transition into the later lesson state. Its future “On trial” and “Learned” labels have nothing canonical to derive from.

Smallest fix: decide whether a counter proposal is a lesson record from birth. Do not change its object identity when Phase B arrives.

S-9. MAJOR

Sections: §4.3, §8 H3.

H3 says proposals are server-computed and template-rendered, and the model never mints one. Chat-origin items are explicitly “recorded by the model” from conversation after endorsement.

Why it matters: endorsement proves the user assented to something. It does not prove the model extracted the endorsed intent correctly. The Accept preview protects final equip, but the Ledger itself can still misstate what the user said.

Smallest fix: separate the honesty regimes explicitly. Counter proposals are deterministic/server-computed. Chat proposals are model-extracted, user-endorsed, and preview-confirmed.

S-10. MAJOR

Sections: §3.3, §8 H2, §14.

The spec allows `user_forge` provenance to be client-stamped even though provenance later supports source labels, learned attribution, auditability, and anti-laundering claims.

Why it matters: unless the server independently constrains exactly which operation is allowed to stamp `user_forge`, the client is asserting the fact the record later presents as verified provenance.

Needs Phase 0: can a client mutate or choose provenance on an existing item, or does the server derive it from a narrowly authenticated manual-equip operation?

S-11. MAJOR

Sections: §4.1, §4.7.

The Ledger is described as “two kinds of item, one store,” but migration temporarily makes `forgeSuggestions[]` and `agents/{id}/ledger/{ledgerId}` two live representations. No canonical-write rule, deduplication key, or status cutover is defined.

Why it matters: a suggestion accepted in the Ledger can remain pending in the old array, reappear after migration, duplicate, or lose its final state.

Smallest fix: define one canonical writer before read-through starts, plus an idempotent migration identity and retirement rule.

S-12. MAJOR

Sections: §4.5, §10, §11 PRs 4–6.

The counters are called “Phase B step 0,” while PR 4 and PR 5 implement and surface them before the Phase B design document in PR 6\. The spec also says P, N, and the window will be set by that later Phase B document.

Why it matters: the implementation would harden detector semantics before the document that owns those semantics exists. PR 5 is especially problematic because it exposes a user-facing Hunch based on placeholder definitions.

Smallest fix: a report-only exploratory run can precede Phase B. User-facing counter cards cannot.

S-13. MAJOR

Sections: §4.5 RF-02, §14.

RF-02 labels itself “general” and “R1-portable” because its movement is ATR-relative. ATR normalization does not establish portability outside the arena that generated the observations.

Why it matters: §14 itself says provenance is never laundered and arena-proven evidence stays labeled arena. RF-02 quietly upgrades its claim territory without evidence for that upgrade.

Smallest fix: keep RF-02 arena-scoped until separate evidence supports broader portability.

S-14. MAJOR

Sections: §4.5 RF-03, §10 Q-06.

RF-03 uses `watchlist names × battles` as its denominator. That counts battles where a name was unavailable, ineligible, never reached the agent’s consideration set, lacked a slot, or never produced an entry opportunity.

Why it matters: “dead weight” can result from absence of opportunity rather than a bad focus choice. The resulting remove/refresh recommendation looks data-grounded while measuring exposure poorly.

Needs Phase 0: can persisted data distinguish a watchlist name that was genuinely eligible and considered from one that merely existed on the list?

S-15. MAJOR

Sections: §4.5 RF-01/RF-02, §10 Q-05/Q-05b, §11 PR 5\.

Neither RF-01 nor RF-02 yet defines the counterfactual tightly enough to justify its compile target. RF-01 openly depends on unresolved scorer semantics. RF-02 treats a further ≥1 ATR move by close as evidence for “hold longer,” which does not establish that the frozen game-scoring outcome would have improved.

Why it matters: the system risks converting hindsight price movement into behavioral advice. Under S-1, the user is then invited to equip it.

Needs Phase 0: replay the exact untaken policy through the deterministic scorer under the frozen rule set and identify the game metric the proposal claims would differ.

S-16. MAJOR

Sections: §5.5, §8 H1, §10. Thesis §9.5.

H1 claims every agent-specific trading input is visible, yet the spec never requires an exhaustive inventory of agent-specific runtime inputs. It names `disciplines` and `consolidatedInsight`, while the Thesis precedence ladder names “Dossier disciplines and convictions” as behavioral inputs.

Why it matters: one unlisted per-agent field read by Haiku makes the central “record” claim false without producing a visible failure.

Needs Phase 0: enumerate every per-agent field read by evaluation, compilation, and execution. Each must map to a visible record item or to a specifically justified platform-level exclusion.

S-17. MAJOR

Sections: §2, §4.5–§4.6, §1.2 Users 1+2 ruling.

The primary Forge surface puts up to three Hunch counter proposals in front of users who are explicitly not expected to build. Each asks for Equip / Not now / Why, and some require a slot swap.

Why it matters: the redesign says Forge becomes reading-first for casual players, but step 0 turns the hero area into a low-confidence configuration inbox. That adds a decision before the evidence system itself regards the idea as Testable.

Smallest fix: Hunches remain informational. The primary record asks for action only once an item has reached an actionable maturity state.

S-18. MINOR

Sections: §2, §11.

The headline “what it’s learned with you” and the empty-state promise that play will cause shared learning to appear are not explicitly gated on the miner or Phase B being live.

Why it matters: the reframe can ship before the learning system does, making the Forge promise a growth loop that the deployed system does not yet provide.

Smallest fix: use learning language only when the learning path is live for that agent.

Charter conformance status: not adjudicated. The exact `AGENT_LEARNING_CHARTER_V1.md` is missing, so I would not sign off §1.2, §8, or §14’s Charter claims from downstream quotations.

Three findings I would fix first: S-1, S-2, S-4.

If step 0 had to be half its size, I would cut the RF-01/RF-02/RF-03 counter cards entirely. Keep provenance, the honesty fixes, and the chat-origin Ledger. Move deterministic learning proposals behind the Phase B design.

&nbsp;