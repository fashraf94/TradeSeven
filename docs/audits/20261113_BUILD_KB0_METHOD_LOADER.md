# Build KB-0 — the KB method loader (dark: an empty authorization list)

**Date:** 2026-11-13 · **Branch:** `claude/kb-loader` (cut from `origin/main` `d9b4e3c1` after `git fetch origin`; the harness's `claude/kb-loader-f552b8` was renamed before the first commit) · **Code head:** `bf449d2c` · **By:** Claude Code (Opus 5.5)
**Spec:** Shared Research spec V1.2 — Amendment A, §A2, §A3, §A5 (`docs/specs/20261113_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_A_KB_METHOD.md`, this branch's first commit) · **Review record:** `docs/audits/20261113_KB0_METHOD_LOADER_REVIEW.md`

## 1. Verdict

| | |
|---|---|
| **What was built** | Amendment A Part 1. The accepted method KB-IDEA-EVALUATION-001 v0.1 is imported byte for byte into `api/_utils/kb/packages/`. A loader re-proves the package's hash chain on every read: ten ordered checks, it never throws, and the provenance stays inside. The authorization list is shipped empty. The audience check is separate from `SHARED_RESEARCH_MODE`. An import script carries a `--check` mode. |
| **Dark?** | **Yes, by construction.** `KB_APP_USE = []`, so every authorized call answers `not_authorized`. Nothing outside `api/_utils/kb/` and `scripts/kb/` imports the module. No production file under `src/` reaches it, through any chain of imports. No flag, no environment variable, no database, no network, no model. The client `dist/` is byte-identical to `main`'s. |
| **The pins** | The zip `2323b799…a5`, the export file `6287e493…ac`, `method_text` `b0688fb3…4e`, the acceptance text `ec709781…ee` and the register text `64c9d29e…c6` all match. The amendment is byte-identical before and after the copy (`e3c9ec8a…20`). `--check` exits 0. |
| **Tests** | 4 new files, 265 rows, all passing on Linux. The Linux full suite (1,440 files, 32,132 tests), `lint:gate` and `vite build` all exit 0 (§5). |
| **Mutants** | The 14 required: **14 of 14 killed**. The whole battery: **90 of 90 killed** (§6). |
| **Review** | §2 multi-lens and adversarial: 4 lenses, then 4 refuters. 38 findings: **31 CONFIRMED · 6 PARTLY · 1 REFUTED**. Every confirmed or partly finding with a code or test remedy is fixed; 17 more items the refuters found in the fixes are fixed or recorded. |
| **Open for the founder** | 6 questions, none blocking; each reading fails closed (review record §6). FQ-1, one pin for activation. FQ-2, the title's binding (and reading R7). FQ-3, the register wrapper's name before a second package. FQ-4, readings R1–R8. FQ-5, keeping `deps`. FQ-6, deep-freezing the JSON imports. Plus one activation note (§9). |

## 2. In plain terms

- **What is proven on every read.** The app now holds the knowledge base's first accepted method, "Evaluating an Idea", as three files committed beside the server code. Every time anything asks for it, the loader recomputes every fingerprint:
  - the method's text must hash to the value its export and its acceptance record both name;
  - the acceptance record must be the exact record the export points to, and must say "accept" for this method, this version and this text;
  - the source register must be the exact register that record names.
  
  If any one of these fails, the answer is a named refusal, never an error. A caller then falls back to the baseline method and records why. Nothing is read from the founder's PC or from the Hermes queue: the bytes travel with the code.
- **What ships empty.** Accepting a method's content and allowing the app to use it are two separate acts. The second act is one entry in an authorization list, and that list ships empty. So even a method that passes every check is answered "not authorized", for every player. The list's emptiness is pinned by one test, which the founder's activation PR moves together with the first entry.
- **What nothing can do yet.** No route, no prompt and no screen imports the loader. A set of permanent tests proves that nothing outside its own folder (and its import script) uses it, and that nothing the browser loads can reach it, directly or through a chain of imports. The method's local file paths (its provenance) never leave the loader: an answer carries exactly eight plain fields.
- **What comes next.** KB-1 connects the loader to Shared Research's own-words investigation. A separate founder PR then adds the one authorization entry.

## 3. Changes by `file:line`

No fenced file (BUILD_RULES §1) was read or edited, and none is called. No existing file changed except `.gitattributes` (+3 lines) and `docs/README.md` (+3 rows). The branch diff has **0 deletions**. The full diff is 15 files: 12 new code, data and test files, plus the amendment, `.gitattributes` and `docs/README.md`. With this report and the review record, the branch holds 17 files.

| File | What |
|---|---|
| `docs/specs/20261113_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_A_KB_METHOD.md` | The amendment, byte-identical (the first commit, `cd583071`) |
| `docs/README.md:252` | The amendment's row (the prompt's wording, plus one clause noting that B1 has since merged); `:253–254` hold this report's and the review's rows |
| `.gitattributes:15–17` | `api/_utils/kb/packages/*.json text eol=lf`, with a comment in the file's own style |
| `api/_utils/kb/packages/KB-IDEA-EVALUATION-001-v0.1.export.json` | The release's export, byte for byte (11,160 B) |
| `api/_utils/kb/packages/KB-IDEA-EVALUATION-001-v0.1.acceptance.json` | `{ path, text }`: `ACCEPTANCE.json`'s exact text |
| `api/_utils/kb/packages/KB-CONTENT-001.source-register.json` | `{ path, text }`: `SOURCE-REGISTER.txt`'s exact text |
| `api/_utils/kb/packages/index.js:15` | `KB_PACKAGES`, from static `import … with { type: 'json' }` (the precedent: `api/_utils/stockThresholdPolicyRegistry.js:1`, VERIFIED) |
| `api/_utils/kb/authorizations.js:40` | `KB_APP_USE = Object.freeze([])`; the entry's shape is in the header comment |
| `api/_utils/kb/loader.js:59–76` | `KB_PACKAGE_SCHEMA`, `KB_AUDIENCES`, `KB_REFUSALS` (the ten, in order) |
| `loader.js:144–200` `checkParts` | Checks 2–7, at `:148`, `:153`, `:158`, `:167`, `:177`, `:183`. Each export field is read once, by its own check. |
| `loader.js:207` `verifyParts`; `:224` `verifyPackage` | Check 1 is at `:229` |
| `loader.js:249` `entrySnapshot`; `:282` `isEntryShape`; `:306` `isAuthorizationEntry` | Entries are judged on a null-prototype copy of their own plain data |
| `loader.js:325` `authorize` | Checks 8–10, at `:326`, `:335`, `:347` |
| `loader.js:383` `loadAuthorizedMethod`; `:404` `authorizedMethodFor` | The two authorized entry points |
| `api/_utils/kb/audience.js:30` | `inAudienceFor(uid)`. Its one import is `isCockpitOwnerAllowlisted` (`api/_utils/callRecords/mode.js:73`, VERIFIED). |
| `scripts/kb/import-release.mjs:88` `packageFilesOf`; `:171` `main` | Pure package building; the command line runs only when the file is invoked directly |
| `api/_utils/kb/{packages,loader,audience,boundary}.test.js` | §5 and §6 |

**Readings and routine choices** (the review record's FQ-4 asks the founder to confirm these):

| Reading | What was built |
|---|---|
| R1 | Check 8 matches entries on their shape without the audience, so check 10 can answer `audience` for an unknown one. The exported `isAuthorizationEntry` is strict. |
| R2 | Check 2 requires a non-empty `title`. The acceptance date sits in check 4. |
| R3 | `test_only` refuses anything but absent or `false`. |
| R4 | Unknown keys, getters, inherited fields and holes in `consumers` make an entry malformed. |
| R5 | Two entries for one version and consumer answer `not_authorized`. |
| R6 | A non-object `deps` reads as none given. |
| R7 | Check 6 also requires the record's `date` to equal `acceptedAt`. |
| R8 | `authorizedMethodFor` runs checks 1–10 bound to the offered entry. It does not call `loadAuthorizedMethod` by name. |

The import script also requires the following, each failing closed:
- the index row's `content_sha256` equals the verified method hash;
- the schema is `<release>/accepted-release/1`;
- no path or link leaves the release;
- no existing file is replaced with other bytes;
- no refusal names a local path.

## 4. The hashes (SHA-256)

| What | Expected | Measured |
|---|---|---|
| `KB-CONTENT-001-accepted-release.zip` (verified before opening; extracted to a scratch folder outside the repo; nothing in it executed or imported) | `2323b7999a9d7f2aae505b1072344d480ca474cb0facad695ca79396a0fbd8a5` | same |
| The amendment, the attachment | `e3c9ec8ac8a38879817ce77a086a1e99b220761d6ff7c07b06d80484265a0820` | same (23,164 B, LF, no BOM) |
| The amendment, the committed blob (`git show cd583071:…`) | same | same |
| The committed export file's bytes | `6287e493ef919402f942ee0e60544b32069f7ff7bb15c9374088a073006b79ac` | same |
| Its `method_text` (UTF-8) | `b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e` | same |
| The acceptance wrapper's `text` | `ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee` | same |
| The register wrapper's `text` | `64c9d29e349401b4c597b854a46c74da0701cfea577a2a4810214d609d386fc6` | same |

**The §A2 chain on the real release:** every link was recomputed and holds (the export → the acceptance record → the method text and the register). `git ls-files --eol` shows all three package files as `i/lf w/lf attr/text eol=lf`.

## 5. Tests (Linux, WSL worktree, Node 20.20.2, `TZ=UTC`; each exit code asserted, the `Test Files` line read directly)

All runs are at `24d3f04d`, the code head `bf449d2c` plus the review record (docs only) and a test-title fix, unless a row says otherwise. `main` was re-fetched before the final runs and had not moved from `d9b4e3c1`, so this tree is also the PR merged with `main`.

| # | Command | Exit | Result line |
|---|---|---|---|
| 1 | `npx vitest run api/_utils/kb/` | 0 | `Test Files  4 passed (4)` · `Tests  265 passed (265)` |
| 1 | `flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8` (the full suite) | 0 | `Test Files  1440 passed \| 10 skipped (1450)` · `Tests  32132 passed \| 120 skipped (32252)` |
| 2 | `npm run lint:gate` | 0 | clean (`eslint . --config eslint.gate.config.js --max-warnings 0`, no output) |
| 3 | `npx vite build`, `dist/` compared file by file (SHA-256) with a build of `main` `d9b4e3c1` in the same worktree | 0 | `✓ built in 23.74s`; **all 111 files of `dist/` are byte-identical to `main`'s** (CSS `index-Bt3Ms9P_.css` included), so no Tailwind class was minted from the new server files |
| 4 | `node scripts/kb/import-release.mjs --release <extracted> --id KB-IDEA-EVALUATION-001 --version 0.1 --out api/_utils/kb/packages --check` | 0 | three `same`, and the four pinned hashes printed |

**Earlier runs, kept for the record:**
- At `64959516` (the first code head): suite `1440 passed | 10 skipped (1450)` / `32064 passed | 120 skipped`.
- At `75ae40b1`: `lint:gate` exit 0, and `vite build` with a `dist/` identical to `main`'s.
- The Tailwind pre-check: `main` built with and without the three package files gives an identical `dist/`.

**No existing test, guard, baseline, golden or registry needed an edit.** On Windows, the four files run from the worktree with the parent install: 264 passed, plus 1 skipped (the Linux-only file-symlink row).

## 6. Mutation check and the review's split

**How the battery runs** (BUILD_RULES §2, reviewer isolation):
- It runs at the code head `bf449d2c`, in its own WSL worktree (`pd-ci-kb0-mut`), never in the working tree.
- Each mutant is one exact anchor, which must match exactly once; a stale anchor prints `BROKEN` and is not run.
- Each mutant runs the four KB test files.
- KILLED means vitest exits non-zero with at least one failed row (or with a load or unhandled error).
- Each file is restored from its saved bytes and compared afterwards. The defined ids are diffed against the ids actually run: 90 defined, 90 run, 0 skipped. The tree was clean after the run.

**Result: 90 of 90 killed; the 14 required, 14 of 14.**

| Required mutant | What it does | Killed by (first failing row; count) |
|---|---|---|
| KM-C1 | check 1 (`missing`) removed | "check 1 — an unknown id, and an unknown version" (13) |
| KM-C2 | check 2 (`schema`) removed | "check 2 — another schema" (6) |
| KM-C3 | check 3 (`identity`) removed | "check 3 — the export names another id" (5) |
| KM-C4 | check 4 (`not_accepted`) removed | "check 4 — status reviewed_candidate" (12) |
| KM-C5 | check 5 (`corrupt`) removed | "check 5 — one character of method_text changed" (8) |
| KM-C6 | check 6 (`acceptance_mismatch`) removed | "check 6 — one character of the acceptance text changed" (9) |
| KM-C7 | check 7 (`register_mismatch`) removed | "check 7 — one character of the register text changed" (4) |
| KM-C8 | check 8 (`not_authorized`) removed | "the order — 8 before 9" (12) |
| KM-C9 | check 9 (`scope`) removed | "the order — 9 before 10" (6) |
| KM-C10 | check 10 (`audience`) removed | "check 10 — the function answers false" (9) |
| KM-A1 | `inAudienceFor`: `'allowlist'` true for everyone | audience.test "'allowlist' true only for a uid on the test list" (2) |
| KM-A2 | `inAudienceFor`: an unknown audience true | audience.test "any other audience … never true" (11) |
| KM-P1 | the authorized answer also returns the export's `source` block | "the answer — exactly the eight fields" (3) |
| KM-L1 | `KB_APP_USE` holds a well-formed entry | **exactly one row**: packages.test "KB_APP_USE is [] — THE PIN" (1). This proves the activation PR moves one pin (FQ-1). |

**The other 76 mutants, by group (all killed):**

| Group | Mutants |
|---|---|
| The hash binding and the entry shape | KM-X1–X9, X11–X16 |
| The fixes' own guards | KM-X10, X17 (killed by the designed unhandled rejection), X18–X27 |
| The order of each adjacent pair of checks | KM-O23 to O67 |
| The import script | KM-S1–S14 (S10 and S14 by the Linux-only symlink row) |
| The answer's shape | KM-K1–K12 |
| The dark and purity guards | KM-D1–D17, including the transitive `src/` → `api/` → loader chain (KM-D12, killed by the permanent graph row too), and KM-U1 on the dark walk itself |

The first battery, at `664ddb79`, before the review: 34 of 34 killed. It also exposed a test-design flaw: KM-L1 reddened 13 never-throws rows beside the pin. That was fixed at `75ae40b1`.

**The review** (full record: `docs/audits/20261113_KB0_METHOD_LOADER_REVIEW.md`):
- **Wave 1, four lenses on snapshot trees of `75ae40b1`:**
  - KL1, the hash chain and its bindings;
  - KL2, fail-closed behavior and refusal order;
  - KL3, the dark guarantee and the provenance boundary;
  - KL4, test integrity.
- **Wave 2, four refuters,** one per lens. Each tried to refute every finding with a repro, then attacked the fixes.
- **Split: 31 CONFIRMED · 6 PARTLY · 1 REFUTED** (KL3-8: true, but the spec's own choice). The two must-fix findings were both test-integrity ones (KL4-1, KL4-2).
- **The refuters found 17 more items in the fixes.** The most important were:
  - the two entry points disagreeing on an ambiguous list (KLV2 NEW-1);
  - no transitive `src/` guard (KLV3 N1);
  - several scanner holes (KLV4).
  
  All are fixed, or recorded with a reason.

## 7. Not verified by this build

- **The server bundle carrying the JSON imports on Vercel.** No route imports the loader yet. KB-1's preview deployment is the first place that can prove it. The precedent (`stockThresholdPolicyRegistry.js`) does ship JSON imports.
- **The rules suite** (`npm run test:rules`) was not run: no rules, indexes or Firestore code changed.
- **The full suite ran on Linux only.** On Windows only the four new files ran: 264 passed, plus 1 skipped (the Linux-only symlink row).
- **The release's own claims beyond the three parts** (other methods, the manifest, the validation file) were not checked: they are not imported.

## 8. Found outside the task (reported, not fixed)

- **B1 merged into `main` after the prompt was grounded.** `0027a9ba`, so `api/_utils/sharedResearch/` and `api/forge/shared-research.js` now exist on `main`. Rule 8 still held: nothing there was created or edited. The README row keeps the prompt's "Part 2 awaits B1" and adds that B1 has since merged.
- **BUILD_RULES §3 versus a build prompt.** §3 asks every implementation task to begin with read-only discovery and a hard STOP. This build treated the amendment (grounded at `9ca96ff2`, with the founder's rulings applied) and the build prompt as that discovery and the go. Every anchor was re-verified at `d9b4e3c1`. This is not reported as a disagreement, but the founder may want §3 to say so explicitly.
- **The existing import-list comments.** `api/agent/chat.js` and `src/constants/leagueTournament.test.js` hold quotes inside comments in multi-line import lists, which defeat naive import scanners (KL4-2). That is not a bug, but any repo-wide import guard should read comment-stripped text.
- **`src/components/discover/themesDkb.js`** uses `import.meta.glob` to reach outside `src/`. It is legitimate, and it is the precedent that made the KL3-3 and KL4-2 belts necessary.

## 9. Next

- **KB-1** (Amendment A Part 2, branch `claude/shared-research-kb1`) builds after this PR is reviewed and merged. B1 is already on `main`.
- **KB-1 moves exactly one row:** `boundary.test.js`'s "nothing outside api/_utils/kb/ and scripts/kb/ imports it, or names it in any form", to admit its Shared Research consumer.
  - It must import only the named authorized entry points: `authorizedMethodFor`, `loadAuthorizedMethod`, `inAudienceFor` (and `KB_REFUSALS` if needed).
  - It must call them directly, with one argument.
  - The permanent rows stay: no import of the packages or the list; no `src/` reach, directly or transitively; no `deps` argument.
- **Activation** (§A6 step 5) is a separate founder PR: one entry in `KB_APP_USE`, its pin, and its `docs/approvals/` record.
  - **Note for that record (KL3-8):** the `'allowlist'` audience is `COCKPIT_ALLOWLIST_UIDS`, the same list about nine other gates read (Film Room cards, research ask, the Shared Research gate, the Huddle, the hypothesis gates, cockpit status, call records). Adding a uid to it for any of those features also gives that player the method, once an `'allowlist'` entry ships.
