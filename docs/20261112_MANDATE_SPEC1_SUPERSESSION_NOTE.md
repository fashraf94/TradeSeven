# Spec 1 (the Mandate) — supersession note

**Date:** 12 Nov 2026 · **Author:** the Practice Field chat (Fable) · **Status:** awaiting the founder's adoption; derived from concept V6.1 ruling 2 (approved 12 Nov 2026) and Astra's review C6-07 · **Applies to:** `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md`, `docs/MANDATE_RUNBOOK.md`, `docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md`. Their text is kept intact; the T0a build adds a one-line pointer to this note under each title.
**Destination:** `docs/20261112_MANDATE_SPEC1_SUPERSESSION_NOTE.md`, carried by the T0a build's commit. No docs-only PR.

## 1. What is retired

The **quarterly managed-portfolio product** that Spec 1 describes (one $10M book per player, three-month terms, rollover, the escape hatch, the founder-observed live acceptance wave) is retired as a product. No book of that kind was created between its switch-on on 14 Aug 2026 and the Phase 0 audit of 12 Nov 2026 (audit-reported; not independently verified in review). Its live acceptance wave (acceptance report Parts C and D) is cancelled. The runbook's live direct-and-batch exercise is cancelled. The open flip PRs #760, #761 and #762 are closed without merge.

## 2. What stays

The **engine** stays and is the substrate of the Practice Field's idea book (concept V6.1): the book document and valuation, execution with modelled friction, corporate actions, the shared universe snapshot, the daily close and its rows, risk metrics, the model call and transports, idempotency and revision discipline, the accelerated-clock harness, the in-repo acceptance harness, and the runbook's operational procedures where they describe the engine rather than the quarterly product.

The acceptance report's **harness wave stays as recorded evidence** for those components. It does not certify the idea book: its $10M, rollover and escape tests say nothing about $100,000 books, per-idea sub-ledgers, epochs or multi-idea behaviour.

## 3. What replaces it

- A new product kind, `idea_book`, with its own lifecycle (epochs, draining, handover) in place of quarterly repinning and the escape hatch. Specified in concept V6.1 and shared contract V2.
- A **new acceptance matrix** for the idea book, written with T1a, and a **new operating procedure** appended to the runbook with T1f. The existing report and runbook are not edited; they are pointed to.
- The transport for the idea book's pilot is direct. Batch transport is assessed separately.

## 4. Flags

`MANAGED_MANDATE_ENABLED`, `MANDATE_EVAL_ENABLED`, `MANDATE_CLOSE_ENABLED` and `MANDATE_FOUNDER_CREATE_ENABLED` remain as they are. Their docstrings are corrected in T0c to describe the lit state. `MANDATE_ROLLOVER_ENABLED` and `MANDATE_DORMANCY_DOWNSHIFT_ENABLED` stay false; the idea book does not use rollover.

Adopted by founder: ____ (date)
