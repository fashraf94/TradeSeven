# FantasyTrades Pi and Harness Lab identity

Version: 1.0  
Date: 22 September 2026  
Status: Prepared for the docs-only PR under the founder's accepted reconciliation instructions. Recorded qualification is limited to the evidence stated below.

## Identity paragraph for the committed record

Pi is the FantasyTrades Harness Lab's independent reference execution runtime for controlled archetype experiments, operated by Flash, the Founder, on a local Windows machine with Codex/Astra supporting development. The recorded lane uses Pi **0.85.1**, launched through `pi.cmd` with a Node runner and JSONL RPC, using provider **`openai-codex`**, model **`gpt-5.6-sol`**, thinking **off**, and the `pi-default` system-prompt mode. Its workspace is `C:\Users\fashr\HarnessLab\pi-reference\stage2c-generalized-runner`. Pi is independent of Hermes, with no adopted nesting or shared-memory relationship. Its boundary is **tool-enforced, not an operating-system sandbox**: authorized input hashes, run-directory access, output rules, and recorded policy violations are checked by the runner/guard and independent verifier; this is not a claim of host-wide filesystem or process isolation. Pi Adapter V0 has a recorded functional pass and one independently verified Stage 2C positive-control pass. **The unauthorized-read negative control remains pending**, so these passes do not close Stage 2C or qualify the complete boundary. The neutral Harness Controller is subsequent work, and no completed application integration is certified here. **No superseding decision changes the 13 September firewall: the VPS operations agent, its machine, credentials, and peer route are out of scope. Which Hermes instance or role a future execution adapter targets: UNDECIDED.** The proposed Hermes Desktop control-surface role does not select that execution target or authorize a connection. Independent verification supplies evidence, the neutral controller is intended to record dispositions, the Founder retains acceptance/promotion authority, and existing application controls retain live-action authority.

## Qualification and evidence limits

| Item | Recorded status |
|---|---|
| Functional adapter | Prior development record reports Pi initialization/state/model/thinking/prompt/event capture and contract adjudication passed. This task did not rerun them. |
| Positive control | `STAGE2C_POSITIVE_CONTROL.json`, evidence timestamp **2026-09-22T00:34:47.346Z**, records `verification_pass: true` for run `PI-SMOKE-002-20260921T211947Z-1d8c2f5f-7e91-4172-8fc1-be7c71bdda70`. Its `status: qualified` applies to the positive control, not all Stage 2C boundary tests. |
| Negative control | `boundary-spec.json` identifies `PI-BOUNDARY-001`, a forbidden canary read, blocked-read/no-leak requirements, and `runner_pass: false` as the expected result. It is a specification, not an executed result. The accepted development status still has the narrow correction and run pending. |
| Success semantics | A settled or stopped runtime is not a successful mission. The verifier evaluates the output and boundary contract separately. The negative test must fail the mission while proving the unauthorized read was blocked. |
| Controller and Hermes adapter | Neutral controller is the next development stage. Future Hermes execution target remains undecided. No shared machine, credential, or peer route is authorized by this identity record. |
| Current machine | Windows host/workspace and launcher details come from the development record. No fresh machine inspection, current runtime-version probe, or new experiment was performed in this task. |

The positive-control artifact was read directly for this reconciliation. It records runner SHA-256 `D18B8F4B5A903F94B28804C85A3CEECDEED89701518453D3FF8CDEF42BBB633F`, workspace-guard SHA-256 `32BECC0037046F712FFD294AD3268A2730EF52816BF86774436446C8D63F037A`, and verifier SHA-256 `16AA08BA59C23B84F4BC1577EAB3D3B40C3941C7259D1DFEE462D2450DD9A417`. These identify the recorded result, not an assertion that later local files retain those bytes. Subsequent verifier/spec changes require explicit evidence lineage.

## Adapter direction, credentials, and ownership

- Into Pi: a bounded mission/work package, pinned runtime/model settings, authorized inputs, and declared output/tool rules.
- Out of Pi: RPC/events, artifacts, runner status, hashes, and policy-violation evidence for independent verification. A model response does not self-certify its correctness.
- Credentials: the development record places provider authentication in an external Pi credential home. This record does not grant application, production, VPS-ops, or cross-engine credential access. Credential values are excluded.
- Application relationship: S2 did not verify an application-side adapter to Pi or Hermes. That is a bounded evidence gap, not a claim that no adapter exists elsewhere.
- Harness/Oracle relationship: Oracle/regime definitions and platform `metricSnapshots` supply evaluation meaning and application evidence. The external lab supplies controlled execution and independent verification. Their exact integration contract remains to be established; this record does not declare them already integrated or substitute a new evaluation authority.

## Preserved decisions

The target architecture keeps Pi and Hermes as independent peer engines through adapters under a neutral Harness Controller. A future Hermes Desktop plugin/control surface remains a direction, not a completed implementation. Any selection of a Hermes execution target, host, credential boundary, or route requires an explicit recorded decision compatible with the standing firewall. Retiring or superseding the firewall requires a distinct founder decision. None is recorded here.

This file answers Fable A1–A4. Pilot provenance and the capture/S2 baseline reconciliation are in `FantasyTrades_Reconciliation_Addendum_V1_2026-09-22.md`.
