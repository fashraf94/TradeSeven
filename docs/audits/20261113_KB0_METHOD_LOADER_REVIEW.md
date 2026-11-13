# KB-0 — the KB method loader: the BUILD_RULES §2 review record

**Date:** 2026-11-13 · **Branch:** `claude/kb-loader` · **Base:** `main` `d9b4e3c1` · **Reviewed head:** `75ae40b1` · **Fixed head:** `9c2b6b86` · **By:** Claude Code (Opus 5.5), with eight subagents
**Spec:** `docs/specs/20261113_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_A_KB_METHOD.md` §A2, §A3, §A5 · **Build report:** `docs/audits/20261113_BUILD_KB0_METHOD_LOADER.md`

The diff crosses the §2 threshold (more than 10 files), so the review was mandatory. It ran in two waves:
- **Wave 1, four lenses.** Each lens reviewed its own `git archive` snapshot of `75ae40b1` (LF; `node_modules` was a junction) and was read-only on git and the working tree.
- **Wave 2, four refuters, one per lens.** Each refuter was told to *refute* every finding with a concrete repro, on two fresh snapshots: the reviewed code and the fixed code. It then judged whether each fix works and attacked the fix itself.

The mutating lens ran last, on its own WSL tree: the coordinator's battery (§5). Ids: lenses `KL1`–`KL4`, refuters `KLV1`–`KLV4`, mutants `KM-…`. These are unused elsewhere in the repo.

## 1. Verdict

| | Count |
|---|---|
| Lens findings | 38 (KL1 7, KL2 10, KL3 8, KL4 13); about 33 distinct (KL1-3 = KL2-1, KL1-1 = KL2-10 ≈ KL3-6, KL1-5 = KL2-4, KL3-7 ⊂ KL4-1, KL3-3 ≈ KL4-2) |
| Must-fix (as rated by the lens) | 2, both KL4 (test integrity) |
| Refuter verdicts | **31 CONFIRMED · 6 PARTLY · 1 REFUTED** |
| New items the refuters found in the fixes | 17 (KLV1 N1–N5, KLV2 NEW-1–NEW-4, KLV3 N1–N6 plus residuals, KLV4 survivors), all fixed or recorded below |
| Fixed | every CONFIRMED and PARTLY finding with a code or test remedy; commits `eabd6c3a`, `c24df95b`, `3c0e18a0`, `54c8d39e`, `e04f9d11`, `bf449d2c`, `9c2b6b86` |
| Left as founder questions | 6 (§6) |
| Accepted as notes | 4 (§7) |

No finding showed a way, with the shipped (empty) authorization list and no `deps` argument, to make an authorized entry point answer `ok: true`, to make any entry point throw, or to let provenance leave the module. (`verifyPackage` and `verifyParts` answer `ok` for the committed package by design: they need no authorization, and permanent rows keep every importer outside the module away from them.)

The fail-opens the lenses found need one of the following:
- an authorization list that CI's shipped-list rules reject;
- a `deps` argument that only tests pass;
- code running in the same process.

## 2. Lens KL1 — the hash chain and its bindings (refuter KLV1)

| Id | Lens severity | Claim | KLV1 | Disposition |
|---|---|---|---|---|
| KL1-1 | should-fix | `title` and `acceptedAt` come from export fields that no run-time hash covers | PARTLY. True for both. Overstated for the title: two exact-value rows also pin it, and `method_text`'s first line names it. | **Date fixed** (`eabd6c3a`, reading R7): check 6 now requires the record's `date` to equal the export's. **Title → FQ-2.** |
| KL1-2 | should-fix | The register wrapper is named per release but its `path` is per method. A second method's import silently replaced it. | CONFIRMED. No run-time harm, since the registers are byte-identical, and CI catches it. | **Fixed** (`eabd6c3a`): the CLI refuses to replace any file with other bytes, checking all three before writing. **The naming → FQ-3.** |
| KL1-3 | should-fix | `authorizedMethodFor` offered one entry but served another (a stale entry, then a stay-only entry with a wider audience) | CONFIRMED. CI's list rules reject such a list. | **Fixed** (`eabd6c3a`, then `3c0e18a0` for KLV2 NEW-1): checks 8–10 bind to the offered entry. |
| KL1-4 | note | SHA-256 of a JS string as UTF-8 is not injective (a lone surrogate encodes as U+FFFD) | CONFIRMED. The real texts hold no U+FFFD, so no collision exists. | **Fixed** (`eabd6c3a`): only well-formed strings are hashed. |
| KL1-5 | note | Fields were read twice (getters could serve other text); the imports are unfrozen | CONFIRMED | **Fixed** for the reads (`eabd6c3a`, `3c0e18a0`). **Freezing → FQ-6.** |
| KL1-6 | note | The LF / no-BOM row tested the container files, not the texts | PARTLY. The pins already fail on these. | **Fixed** (`eabd6c3a`; `54c8d39e` covers every package). |
| KL1-7 | note | The script never cross-checked the index's `content_sha256`, and accepted any schema | PARTLY. A wholly consistent substitution is caught only by the §A2 pins. | **Fixed** (`eabd6c3a`). |

**KLV1's new items:**
- **N1** is KLV2's NEW-1 (§3), fixed.
- **N2:** `authorizedMethodFor` no longer literally calls `loadAuthorizedMethod`. → reading R8 (FQ-4).
- **N3:** R2 narrowed, because the acceptance date moved to check 4. → FQ-4.
- **N4:** a double read. Fixed (`3c0e18a0`).
- **N5:** the text rows covered only the real package. Fixed (`54c8d39e`).

## 3. Lens KL2 — fail-closed behavior and refusal order (refuter KLV2)

| Id | Lens severity | Claim | KLV2 | Disposition |
|---|---|---|---|---|
| KL2-1 | should-fix | The hand-off re-selects a different entry (= KL1-3) | CONFIRMED (low) | **Fixed** |
| KL2-2 | should-fix | A sparse `consumers` (`[, C]`) passes every shape check, including CI's, and lets an undefined consumer through | CONFIRMED. Needs two bugs. | **Fixed** (`eabd6c3a`): dense own-index copy; a missing or empty consumer never matches. |
| KL2-3 | note | `authorizedMethodFor` read `inAudience` before checks 1–7 | CONFIRMED | **Fixed** |
| KL2-4 | note | Fields read twice (= KL1-5) | CONFIRMED. The fix was incomplete: `acceptance` and `content_hash` were still read twice. | **Fixed** (`3c0e18a0`): each field is read once, by its own check. |
| KL2-5 | note | Inherited fields, getters and symbol keys pass the entry shape; `Object.prototype` pollution gives an audience | CONFIRMED | **Fixed** (`eabd6c3a`): checks use a null-prototype snapshot of the entry's own plain data. |
| KL2-6 | note / ruling | R1 means an unknown-audience entry is counted, not ignored | CONFIRMED | **Comment fixed** (`authorizations.js`). **R1 → FQ-4.** |
| KL2-7 | note / ruling | A candidate export with no acceptance block answered `schema` | CONFIRMED | **Fixed** (`eabd6c3a`): the date moved to check 4. |
| KL2-8 | note | A missing id or version matched (`undefined === undefined`) | PARTLY. The repro needed the whole chain fabricated. | **Fixed** (`eabd6c3a`) |
| KL2-9 | note | A rejected promise from an async `inAudience` was left unhandled | CONFIRMED. It kills the process under Node's default. | **Fixed** (`eabd6c3a`; `3c0e18a0` for NEW-3) |
| KL2-10 | note | `title` and `acceptedAt` unbound (= KL1-1) | CONFIRMED | Date fixed; **title → FQ-2** |

**KLV2's new items in the fixes:**
- **NEW-1 (low).** On an ambiguous list, the two entry points disagreed. **Fixed** (`3c0e18a0`): checks 8–9 run over the whole list and require the single match to be the offered entry.
- **NEW-2 (nit).** Reading all fields up front changed the refusal order on hostile input. **Fixed** (`3c0e18a0`).
- **NEW-3 (nit).** The KL2-9 fix called a foreign thenable's `then`. **Fixed** (`3c0e18a0`): only a native Promise is handled, through `Promise.prototype.then.call`.
- **NEW-4:** the title stays in check 2. → FQ-4.

**Fuzz:** 1,517 hostile calls per tree gave 0 throws and 0 badly shaped answers.

## 4. Lens KL3 — the dark guarantee and the provenance boundary (refuter KLV3)

| Id | Lens severity | Claim | KLV3 | Disposition |
|---|---|---|---|---|
| KL3-1 | should-fix (KB-1 constraint) | `deps` skips the empty list and the committed bytes | CONFIRMED (low). It is the spec's test seam. | **Guarded** (`eabd6c3a`, hardened in `e04f9d11`): a permanent row requires every outside call to pass one argument, called directly. Renamed imports, `.call`/`.apply`/`.bind` and `?.(` are all refused. **Keeping `deps` → FQ-5.** |
| KL3-2 | should-fix | The dark row is all-or-nothing: KB-1's move would also admit the packages and the list | CONFIRMED | **Fixed** (`eabd6c3a`, plus a text belt in `e04f9d11`): permanent rows bar any outside import of `packages/**` or `authorizations.js`, and any naming of them. |
| KL3-3 | should-fix | The `src/` guard missed `import.meta.glob`, `new URL` and `index.html` | CONFIRMED | **Fixed** (`eabd6c3a`, `e04f9d11`, `bf449d2c`): text row over `src/` and `index.html`; a production `src/` glob, URL or template-import pattern reaching into `api/`; and an import-graph walk. |
| KL3-4 | should-fix (small) | The script followed a link out of the release | CONFIRMED (low) | **Fixed** (`eabd6c3a`). The index went through the same check in `e04f9d11`. |
| KL3-5 | should-fix | Refusals printed absolute local paths | CONFIRMED (low) | **Fixed** (`eabd6c3a`, `e04f9d11`): only the script's own messages reach a refusal; `--out` and `EISDIR` cases are refused cleanly. |
| KL3-6 | note | Unfrozen imports, title and date unbound | PARTLY. Overstated: the mutating code must already import the provenance, which a permanent row now forbids. | Date fixed; **title → FQ-2, freezing → FQ-6** |
| KL3-7 | note | The provenance assertion was dead; `DRIVE_PATH` was narrow | CONFIRMED (impact overstated) | **Fixed** (`eabd6c3a`, `e04f9d11`): every value equals the package's own field for every package; `LOCAL_PATH` no longer matches URL schemes. |
| KL3-8 | note | The `allowlist` audience shares `COCKPIT_ALLOWLIST_UIDS` with about nine gates | **REFUTED as a KB-0 defect.** True as a fact, but it is the spec's choice (§A3.5, R-KB-2). | Recorded for the activation step (build report §9) |

**KLV3's new items:**
- **N1 (should-fix).** No permanent row stopped `src/` reaching the module *transitively* once KB-1 moves its row. **Fixed** (`e04f9d11`): a permanent import-graph walk from every production `src/` file. It is proven on a planted chain, and it is not vacuous: `src/` reaches `api/` today.
- **N2.** A backslash specifier evaded the scan on Linux. **Fixed.**
- **N3.** A `'//'` string ate a call. **Fixed** (raw and stripped scans).
- **N4.** Partial write before an `EISDIR`. **Fixed** (stat pre-check).
- **N5.** Test gap for a path-bearing system error. **Fixed.**
- **N6.** The URL false positive in `LOCAL_PATH`. **Fixed.**

**Client bundle:** KL3 compiled Tailwind with and without the new files and got identical CSS. The coordinator's builds give an identical `dist/` (build report §5).

## 5. Lens KL4 — test integrity (refuter KLV4); the mutation lens

| Id | Lens severity | Claim | KLV4 | Disposition |
|---|---|---|---|---|
| KL4-1 | **must-fix** | The register assertion could never fire; the top-level keys of `verifyPackage`/`verifyParts` were unpinned | CONFIRMED | **Fixed** (`eabd6c3a`, `c24df95b`) |
| KL4-2 | **must-fix** | The dark walk missed a quote in a comment inside a multi-line import, `import.meta.glob` and `new URL` | CONFIRMED. The first fix was incomplete. | **Fixed** (`c24df95b`, `e04f9d11`, `bf449d2c`): raw plus stripped scans everywhere; text belts; template imports; the graph walk. |
| KL4-3 | should-fix / ruling | Part 4's "with the shipped list…" row followed the pin (made conditional at `75ae40b1`) | CONFIRMED as a description | **Built to the letter** (unconditional) before the push; **whether it may follow the pin → FQ-1** |
| KL4-4 | should-fix | Check order unpinned for checks 2–5 | CONFIRMED. The first fix left the "1 before 2" text half. | **Fixed** (`c24df95b`, `bf449d2c`): a two-defect row per adjacent pair. |
| KL4-5 | should-fix | Single-consumer entries only | CONFIRMED. The first fix left the last-consumer variant. | **Fixed** (`c24df95b`, `bf449d2c`) |
| KL4-6 | should-fix | `--check` proven only against missing files | CONFIRMED | **Fixed** (`c24df95b`) |
| KL4-7 | should-fix | R2/R3 pinned only for absent or truthy values | CONFIRMED | **Fixed** (`c24df95b`) |
| KL4-8 | should-fix | A fixed list of four modules | CONFIRMED | **Fixed** (`c24df95b`, union scan in `bf449d2c`) |
| KL4-9 | note | No row for unsafe `--id`/`--version` | CONFIRMED | **Fixed** |
| KL4-10 | note | No row for an entry naming another id | CONFIRMED | **Fixed** |
| KL4-11 | note | Scanner limits (`const { env } = process`, `fetch.call`, `'//'` strings) | CONFIRMED | `process`/`fetch` at any mention and raw scans **fixed** (`bf449d2c`); the rest are **recorded** as known limits in `boundary.test.js`'s header. |
| KL4-12 | note | `spawnSync` without a timeout | CONFIRMED (a 25 s hang blocked the row for 51.5 s) | **Fixed** (20 s) |
| KL4-13 | note | `DRIVE_PATH` is narrow | PARTLY. The premise was wrong (the hits were `https:/`), and the first fix regressed (it matched URLs). | **Fixed** (`e04f9d11`) |

**KLV4's survivors against `c24df95b`** were each re-run as a mutant in the final battery: `KM-D11`, `KM-D14`–`KM-D17`, `KM-U1`, `KM-X23`–`KM-X27`.

**The battery, at `9c2b6b86`:** 90 mutants, each from one exact anchor, run in a WSL worktree. A mutant is KILLED only when vitest exits non-zero with failed rows (or a load error). Each file is restored from its saved bytes, and the defined ids are diffed against the ids actually run. The result is in the build report §6.

## 6. Founder questions (none blocks the merge: each reading fails closed)

- **FQ-1. One row or two for activation (KL4-3).** Part 4 words `loader.test.js`'s "with the shipped list, both entry points answer `not_authorized`" row without a condition, and it is built that way. So the founder's activation PR moves two rows: that one, and `packages.test.js`'s pin (`KB_APP_USE` equals `[]`). The alternative was built and then reverted. While the list is empty, the row asserts `not_authorized`; from the first entry, it asserts that each entry loads for its own consumers only. That way activation moves only the pin. May the row follow the pin?
- **FQ-2. The title's binding (KL1-1, KL2-10, KL3-6).**
  - Reading **R7**, added here: check 6 binds the acceptance record's `date` to `acceptedAt`, so the date is now covered by the entry's `acceptanceSha256`.
  - The `title` has no run-time binding. The record has no title field, and the export's byte pin (build time) is its only guard.
  - Options: keep R7 and leave the title build-time-only, or also require `method_text`'s first line to equal `${id} v${version} — ${title}`. That is true for both methods in KB-CONTENT-001, but it is a KB convention, not a spec rule.
- **FQ-3. The register wrapper's name (KL1-2).**
  - §A3.1 names it per release (`KB-CONTENT-001.source-register.json`), but its `path` is the method's.
  - So the release's second method (KB-APP-EVIDENCE-001, §A7) cannot be imported beside the first. The script now refuses rather than overwrite.
  - Rename it per method (`<id>-v<version>.source-register.json`) before the second package, or keep one per release and drop the method-specific `path`?
- **FQ-4. The readings as built.**
  - **R1:** check 8 matches entries without judging the audience, so an unknown audience answers `audience` and counts toward ambiguity. The exported `isAuthorizationEntry` stays strict.
  - **R2:** check 2 requires a non-empty `title`. The acceptance date moved to check 4 (KL2-7).
  - **R3:** `test_only` refuses anything but absent or `false`.
  - **R4:** unknown keys, getters and inherited fields make an entry malformed.
  - **R5:** two entries for one version and consumer answer `not_authorized`.
  - **R6:** a non-object `deps` reads as none given.
  - **R7:** see FQ-2.
  - **R8:** `authorizedMethodFor` runs `verifyPackage` and then checks 8–10 bound to the offered entry. It does not call `loadAuthorizedMethod` by name; the refusals are the same, but bound to that entry.
- **FQ-5. `deps` (KL3-1).** §A3.3 gives both entry points a `deps` parameter for tests. A permanent row now pins that no caller outside the module passes it. Should KB-1 keep the seam, or move the tests to `vi.mock` and drop the parameter?
- **FQ-6. Freezing the imports (KL1-5, KL3-6).** The build prompt says `packages/index.js` holds "no other code", so the three JSON objects are not deep-frozen. In-process code could mutate the `title`. (The date would now be refused, and the text is re-hashed on every read.) Allow a deep-freeze helper there?

## 7. Accepted as notes

- The script trusts the release's own index, so a wholly consistent substituted release imports cleanly. Only the §A2 pins in `packages.test.js` catch substitution (KL1-7, KLV1). That is by design: the pins are the founder-reviewed anchor.
- A hard link inside the release cannot be detected. The bytes stay hash-bound (KLV3).
- A write that fails part-way, after the pre-checks pass (a full disk, say), can leave some files written. It is refused with `REFUSED: write`.
- Static scans cannot see a specifier built at run time. The known limits are listed in `boundary.test.js`.
- Not verified: whether Vercel's file tracer bundles the three JSON imports. No route imports the loader yet; KB-1's preview covers it (build report §8).

## 8. What no refuter saw

Each refuter judged the reviewed tree (`75ae40b1`) and one fixed tree: KLV1–KLV3 saw `eabd6c3a`; KLV4 saw `c24df95b`. The changes after those trees were **not re-refuted**:
- `loader.js` at `3c0e18a0` (KLV2's NEW-1 to NEW-3);
- the import script at `e04f9d11` (KLV3's residuals);
- the test changes at `54c8d39e`, `e04f9d11`, `bf449d2c` and the final head. The final head made the "shipped list" row unconditional, added a left boundary to `NAMES_KB_DATA` so the repo's `dkb/` tree cannot trip it, and set a 30 s timeout on the repo-scale rows.

What covers them instead:
- **The final battery,** with a mutant for every fix (90 of 90 killed, build report §6). It was re-run on the final head.
- **KLV2's fuzz,** re-run on the final `loader.js` (unchanged since `3c0e18a0`): 1,517 hostile calls, 0 throws, 0 badly shaped answers.
