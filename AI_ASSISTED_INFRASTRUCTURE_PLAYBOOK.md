# AI-Assisted Infrastructure Playbook

**Purpose:** Codify the workflow patterns developed during the May 13, 2026 DRB sourcing fix session as the standard approach for infrastructure-level changes in FantasyTrades.
**Scope:** Data pipelines, cron jobs, prompt rewrites, vendor swaps, architecture refactors. NOT a fit for small features or one-file UI tweaks.
**Created:** May 13, 2026

---

## When to use this playbook

**Use it for:**
- Data pipeline changes (anything that affects what enters or leaves Firestore)
- Cron job creation, removal, or significant modification
- LLM prompt rewrites that affect production output
- Vendor swaps (API source changes — Sonar → EODHD, Anthropic → OpenRouter, etc.)
- Anything that touches multiple systems and has rollback complexity
- Changes where "looks fine" is harder to verify than "passes tests"

**Don't use it for:**
- Single-file UI component tweaks
- Bug fixes scoped to one function
- Adding a new test
- CSS / styling adjustments
- Anything reversible in under 60 seconds

The playbook adds overhead. The overhead is worth it when the cost of shipping a wrong implementation is high (silent data corruption, downstream system damage, hard rollback). For low-stakes changes, it's bureaucratic.

---

## The three-role model

The core innovation is treating an AI-assisted infrastructure change as a three-person operation, even when the same model class powers all three roles.

| Role | Played by | Owns | Does not do |
|---|---|---|---|
| **Product owner** | Flash | Decisions, priorities, scope, approvals | Implementation, code review |
| **Spec author / reviewer** | Brad-style Claude (chat) | Architecture decisions, spec writing, cross-context review, smoke test design | Hands-on file editing |
| **Implementation** | Claude Code (terminal) | Discovery audits, file edits, test writing, commit hygiene | Architectural choices, scope decisions |

The separation matters because each role has different incentives. Implementation Claude wants to ship what it built. Review Claude wants to break it. Flash wants to ship the product. Three perspectives in tension catch more than one perspective alone.

### Why this works even though it's the same model class

The roles operate in different sessions with different context windows. Review Claude does not see implementation Claude's reasoning — it sees only the artifact (diff, test output, file contents). This is structurally similar to a senior engineer reviewing a junior engineer's PR even when they have similar skills. The act of *reviewing without having built* surfaces issues the builder rationalized into the work.

Concrete examples from May 13 where the separation caught real bugs:
- PR 1: Implementation Claude wrote "never throw, return empty array on failure." Review Claude caught that this masked the `sourceFailures` tag and silenced real outages. Fixed before merge.
- PR 3: Implementation Claude had Feb 2026 CPI as Feb 11 in its discovery anchors (from web search snippets). Review Claude verified against bls.gov and caught the actual date is Feb 13. Fixed before commit.
- PR 2: Implementation Claude proposed an `event` field name; spec used `description`. Quick alignment in the report; would have been a downstream renderer issue if missed.

---

## The phased workflow

Every infrastructure change follows the same skeleton.

### Phase 0 — Discovery audit

**Goal:** Implementation Claude reads the existing code and reports back what it found before writing any new code.

**Output:** A discovery report covering:
- Files that will be touched (with current state and line counts)
- Files that are *adjacent* and might be affected (with explicit notes on whether they will or won't change)
- Existing patterns the new code should match
- Known issues, edge cases, or weirdness in the current code
- A "DO NOT MODIFY" list confirming scope boundaries
- Open questions for the product owner

**STOP after discovery.** Implementation Claude does not proceed to Phase 1 until the discovery is reviewed and approved.

**What review looks for:**
- Scope drift in the discovery itself (mentioning files that aren't actually relevant)
- Missing files (audit didn't catch something)
- Misunderstood existing patterns
- Discovery anchors that need primary-source verification (e.g., dates, version numbers, API contracts)

### Phase 1 — Foundation / data

**Goal:** Build the load-bearing data structures or scaffolding that later phases consume. Often this is the most important phase because it locks in shape decisions.

**Sub-phase pattern when data is involved:**
- **Phase 1a — Draft (no commit):** Implementation Claude proposes the data inline in chat, no files touched. Review verifies against primary sources.
- **Phase 1b — Commit:** After Phase 1a approval, implementation Claude commits the verified data.

This sub-phase split is *the* load-bearing pattern when data correctness matters. It separates "I have the right shape" from "I have the right values."

**STOP after Phase 1.** Wait for approval before Phase 2.

### Phase 2 — Wrappers / adapters

**Goal:** Build any wrapper, adapter, or interface code that connects the new foundation to existing systems.

This phase usually has the highest test coverage because it's where contract mismatches live. Edge cases (boundary partitions, empty inputs, error paths) should all have dedicated tests.

**STOP after Phase 2.** Wait for approval before Phase 3.

### Phase 3 — Wire it in

**Goal:** Swap the existing system to use the new code. Often the smallest commit in line count but the highest risk because it changes user-facing behavior.

**Sub-phase split for prompt changes:**
- **Phase 3a — Cron / system swap:** Mechanical change. Just plumbing.
- **Phase 3b — Prompt rewrite:** Separate atomic commit. Prompts have outsized impact on output; isolating the commit makes rollback surgical.

**STOP after Phase 3.** Wait for approval before Phase 4.

### Phase 4 — Smoke test

**Goal:** Deploy to preview, run the cron / endpoint, verify the actual output against expectations before merging to main.

This phase is run by the product owner (Flash), not implementation Claude. Implementation Claude provides:
- Branch name and commit hash
- Curl command or test invocation
- Expected output characteristics (what should be in the Firestore doc / response)
- Rollback command if smoke test fails

**Merge gate:** Review Claude verifies the smoke test output before greenlighting merge to main. The smoke test is the strongest evidence the architecture works — stronger than any test suite.

---

## The STOP-point discipline

Every phase ends with an explicit STOP point. Implementation Claude does not begin the next phase without explicit approval.

**Why this matters:**
- Catches scope drift early (before sunk-cost bias kicks in)
- Surfaces honest deviations from spec ("Phase 2 was harder than expected because X")
- Lets the product owner re-prioritize between phases without wasted work
- Prevents "I'm three commits deep and now I have to amend" debt

**STOP points cost a few extra round-trips.** That cost is real. The benefit is that no PR ever ships with the "wait, I noticed something halfway through Phase 4" surprise. If something doesn't fit, it gets surfaced at the STOP rather than rationalized into the work.

**STOP-point report format** (what implementation Claude returns at each pause):

```
Phase N — Complete. STOP for approval.
Commit: <hash> — <commit message>
Branch: <branch name> (pushed: yes/no)

Files changed:
- path/to/file.js (N lines added, M lines removed)

Tests:
Test Files  X passed (X)
     Tests  Y passed (Y)
   Duration  Z

Scope check:
- DO NOT MODIFY items all verified untouched ✓
- Any unexpected adjacent changes: <none / list>

Open questions before next phase:
- <numbered list, or "none">

Standing by for Phase N+1 approval.
```

This format makes review fast. Same shape every phase, same fields, same headings. Cognitive load on the reviewer drops because they know exactly where to look for each piece of information.

---

## Cross-context review — the highest-leverage pattern

When implementation Claude finishes a phase, review Claude reads the phase report as if they had no prior context for the implementation.

**The discipline:** Review Claude must verify the work against the spec, not against implementation Claude's reasoning. The phase report should stand on its own as evidence the work is correct.

**What review Claude does at each phase:**

| Phase | Review actions |
|---|---|
| Phase 0 (discovery) | Read existing code paths mentioned. Verify nothing important is missing. Confirm scope. |
| Phase 1 (foundation) | If data: verify against primary sources independently. If scaffolding: confirm shape matches downstream consumers. |
| Phase 2 (wrapper) | Mentally walk through edge cases. Confirm contract compatibility with existing system. Check tests for coverage gaps. |
| Phase 3 (wire in) | Read the actual diff (not just the description). Confirm scope is minimal. Verify the "DO NOT MODIFY" list held. |
| Phase 4 (smoke test) | Compare actual production-like output to expected. Verify no fabrication / regression. |

**When review Claude finds a problem:**
1. State what's wrong in concrete terms (file, line, expected vs. actual)
2. Propose the fix
3. Hand back to implementation Claude with explicit "fix this, don't proceed to next phase yet"

**When review Claude doesn't find a problem:**
1. State what was verified (which items were checked)
2. Greenlight the next phase

---

## Data verification before commit

When a change involves hardcoded data (dates, mappings, vendor IDs, configuration), verification happens *before* the data hits a commit.

**The pattern:**

1. Implementation Claude proposes the data inline in chat or in a report
2. Review Claude verifies against primary sources (NOT secondary aggregators)
3. Product owner spot-checks for sanity
4. Only after approval does implementation Claude commit

**What counts as a primary source:**
- The agency that publishes the data (bls.gov for BLS data, bea.gov for BEA data, etc.)
- The vendor's official API documentation, not third-party wrappers
- The code being deprecated (for migration mappings — read the actual code, don't paraphrase)

**What doesn't count:**
- LLM web search snippets (often paraphrased or out-of-date)
- Wikipedia summaries of agency calendars
- Cached pages from search engines
- "I'm pretty sure" or "this is the usual pattern"

When primary sources are inaccessible (sandbox network restrictions, paywalled docs), the verification responsibility moves to whoever has access. In May 13's DRB session, Claude Code's sandbox couldn't reach agency calendars; Brad-Claude had web access and pulled the canonical schedules. The role swap is fine — the rule is *primary source must be touched somewhere in the chain*.

---

## Branch and PR cadence

**One task = one branch = one PR.** No branch carries multiple unrelated changes.

**Multi-phase work on the same branch:** Fine, as long as the phases are tightly coupled. The May 13 PR 3 had three commits on one branch (data population + wrapper + cron swap + prompt rewrite); they're a single logical change to a single subsystem.

**Multi-PR work for a session:** Each PR should be independently revertable. If PR 2 builds infrastructure that PR 3 wires in, both should still merge atomically — meaning PR 2 can sit unmerged and not break main, and PR 3 can be reverted without forcing PR 2 to revert.

**Commit message format:** `<type>(<scope>): <imperative description>` — e.g., `feat(drb): populate 2026 macro calendar arrays from agency primary sources`. Imperative voice ("populate" not "populated"). Scope in parens. Type prefix (`feat`, `fix`, `refactor`, `test`, `chore`).

**PR description:** Always populate. "No description provided" is technical debt. Template:

```markdown
## Summary
<2-3 sentence what + why>

## What's in this PR
- <bullet list of changes>

## What's NOT in this PR
- <bullet list of explicit non-changes; useful for reviewer scope>

## Verification
- Test suite: <count>
- Smoke test: <link or summary>

## Rollback
- <command or commit to revert>
```

---

## Tone and communication conventions

Patterns that worked during May 13 and should carry forward:

**Implementation Claude → Review Claude:**
- Surface honest deviations at the STOP, not in retrospect
- When uncertain, ask before guessing
- Refuse to invent data when context is incomplete (e.g., when a paste placeholder didn't render — STOP and request the missing data rather than fabricate)
- Report counts, not vague descriptions ("12 entries" not "the standard year")

**Review Claude → Implementation Claude:**
- Verify the artifact against the spec, not against implementation reasoning
- When approving, state what was verified
- When rejecting, state the concrete issue and the fix
- Don't redo the implementation Claude's discovery — trust the discovery report unless it contradicts itself

**Both → Flash:**
- Surface decision points clearly with options + tradeoffs
- Make a recommendation, but don't act on it until Flash confirms
- Don't ask for analysis when the decision is binary and obvious
- Don't make Flash a tiebreaker on questions you should answer yourselves

**Flash → Both:**
- Decisive product calls keep momentum
- Override your own prior decisions when new information warrants
- Trust the technical recommendation when you've delegated the technical role; question it when something feels off

---

## Anti-patterns to avoid

**Anti-pattern: Skipping discovery to "save time."**
Discovery is the cheapest phase. Skipping it means Phase 1 has implicit assumptions that bite in Phase 3. The May 13 session would have shipped a wrong Feb CPI date without discovery's anchor list surfacing the candidate dates.

**Anti-pattern: Bundling phases in a single commit.**
Phase 2 commit and Phase 3 commit being one commit means rollback is unsurgical. Even when the changes look small, separate commits.

**Anti-pattern: Letting review Claude become a rubber stamp.**
If review Claude never finds anything wrong, either implementation Claude is genuinely perfect (unlikely) or review Claude is reading the report without verifying the artifact. The verification IS the value.

**Anti-pattern: Smoke testing in production.**
Preview deploys exist for this reason. Smoke test on preview, verify the output, then merge to main. The cost of a preview deploy is ~2 minutes; the cost of shipping a broken cron to production is hours.

**Anti-pattern: Adding documentation that just restates code.**
If a doc would essentially be "here's what the code does, in English," skip it. Documentation earns its place by explaining *why* the code looks the way it does — design decisions, rejected alternatives, source URLs, rollback paths.

---

## When the playbook doesn't work

This isn't a universal pattern. Signs you're in a context where the playbook is overkill:

- The change is fully reversible in under 60 seconds
- The change touches one file and no shared interfaces
- The change is exploratory (you don't know yet if it'll ship)
- You're working alone on a personal project with no production consequences
- The stakes are "feature looks slightly different" rather than "data is wrong"

For those cases, just write the code. The playbook is for when "looks fine" is hard to verify, when there's downstream blast radius, or when an LLM-driven implementation could quietly produce wrong output.

---

## Reference: May 13 session as the canonical example

The DRB sourcing fix session executed this playbook end-to-end across three PRs in a single working day. See `FANTASYTRADES_SESSION_SUMMARY_MAY13_2026_DRB_SOURCING_FIX.md` for the narrative and `DRB_SOURCING_TECHNICAL_REFERENCE.md` for the technical outcome. Key moments where the playbook earned its place:

- **PR 1 Phase 1 STOP:** Caught the never-throw bug masking failures
- **PR 3 Phase 0 discovery:** Caught the Feb 2026 CPI date error
- **PR 3 Phase 1a/1b split:** Verified all 71 hardcoded dates against agency sources before commit
- **PR 3 Phase 4 smoke test:** Proved the architecture worked end-to-end before merge

The playbook overhead (phase reports, STOP points, cross-context review) added perhaps 30 minutes across the day. The bugs and data errors it caught would have cost hours to fix post-merge and could have shipped wrong production output.

---

*End of playbook. Iterate on this document as patterns evolve.*
