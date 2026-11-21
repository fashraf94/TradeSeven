# Practice Field fast mutation battery

A mutation battery for the Practice Field idea book that takes minutes, not hours. Tooling only: nothing here ships, and it changes no product code, flag, pin, rule or index.

```powershell
node scripts/practice-field/battery/run-battery.mjs --sha <commit> --mutants <path/to/mutants.mjs>
```

Run it on a **frozen** commit, with nothing else loading the machine. If another test run is going at the same time, a slow row can time out and show up as a false kill.

## The mutants file

```js
export const MUTANTS = [
  { id: 'N3-ambiguous-adjusted-automatically', item: 'T2D-03', named: 'optional label', edits: [
    { file: 'api/_utils/practiceField/adjustments.js', from: '        if (keys.length > 1) {', to: '        if (false) {' },
  ] },
];
```

- Each `from` must occur **exactly once** in the commit's text. Edits in the same file are applied in order, and each must still occur exactly once in the text so far.
- If an anchor fails, the mutant is reported `BROKEN MUTANT <id>: …` and is never run.
- Edits are spliced in, not passed through `String.replace`, so `$&` and `$$` in `to` stay literal.
- A mutants file belongs to the PR whose code it cuts. Its anchors match that code and no other, so this folder holds no mutants.

## What it does

1. **Trees.** It builds `--trees` (default 4) LF trees of the commit: `git -c core.autocrlf=false archive <sha> | tar`, plus a `node_modules` junction to the main checkout's install. The trees live in `%TEMP%\pf-battery\<sha12>\t<i>` and are reused while the commit is the same.
   - Each tree is checked by file count, and every file a mutant edits is compared byte for byte against `git cat-file blob`.
   - If a run was killed mid-mutant and left a file mutated, that file is restored at the next start.
2. **Baseline.** It runs the full row set **once**, sharded across the trees: tree *i* runs `--shard=i/N`, all at once. Every shard must be green, and together the shards are one full run.
   - The baseline gives the per-file times used for the quick cut.
   - A shard whose only failures are vitest timeouts re-runs those files alone. If they pass, the baseline counts as green and the rows are logged as load-sensitive. At e8d51fd6 one `evidence.test.js` row times out under the battery's own load.
   - Every run passes `--no-cache`, because all the trees share the install's `.vite/vitest` cache folder.
3. **Import graph** (`importGraph.mjs`). It maps each test file to the files it can reach: static and dynamic imports, `vi.mock`/`importActual` paths and `__mocks__` siblings, read by the repo's own parser-based reader (`api/_utils/filmRoom/__fixtures__/jsSource.js`).
   - Some test files are related to **every** mutant: those that read source as text, spawn processes, or load anything a static reading cannot follow.
4. **Per mutant.** One shared queue feeds all the trees. Each mutant runs in stages; in the default `--mode tiered` they are:
   - **`first`**: `--first-files` (default 6) related files, chosen in this order:
     - the cheapest file that killed this id before (`--prior`);
     - then the related files with the most kills per second of cost so far, counting `--prior` and this run, and no slower than that file. A file's cost is its baseline time plus about 4 s.
     - With no kills known yet, the cheapest files.
   - **`quick`**: the rest of the related files whose baseline time is ≤ `--quick-fraction` (default 0.35) × the slowest file's time. That is everything except the heaviest few.
   - **`full`**: the full row set, with the mutation still applied, judged exactly as the old runner judged.

   How a stage decides:
   - **A kill in any stage is final.** A kill needs a non-zero exit **and** at least one failing row.
   - If every failing row is a vitest timeout, those files are re-run alone with 1 worker before the kill counts. In the full stage, if they pass alone, the verdict is SURVIVED, because every row has then been seen to pass with the mutation in place.
   - **Anything else** (survived, load failure, errored, timeout) moves on to the next stage, and the full stage decides it.
   - The mutated files are then restored and compared byte for byte.

   Why a small first tier: every test file pays about 4 s of process start and module import before its first row, whatever its rows cost. 27 quick files take about 40 s even though their rows hold 50–90 s of CPU across 4 workers, while 6 well-chosen files settle most kills in 10–25 s.
   The kill history only **orders** the first tier. It never decides a verdict.

   **Pass the previous battery's results as `--prior`** whenever one exists, such as the build's battery when you run a fix round. With a prior the first tier usually holds the file that killed the mutant last time. Without one, the ranking has to be learned during the run.
5. **Report.** At the end it prints the tally and lists every defined id that got no verdict. `<out>/results.json` holds every stage's verdict, failing row names and time, and `<out>/runs/` holds every vitest JSON.

## Why the verdict equals the full folder's

Vitest runs each test file in isolation, so a file's rows fail the same way whatever else runs beside it.

- If an early stage kills, the same rows fail in a full run. The old judge (exit ≠ 0 and a failing row) then says KILLED as well.
- Every other verdict *is* a full-row-set verdict.

So the battery never reports a survivor, or a broken mutant, that the full folder would not report.

The graph only decides speed. A file the graph missed is still covered by the stage-2 run. `--verify` checks the graph anyway: for each mutant it also runs the full row set and records three things:

- whether the verdicts agree;
- whether each early stage's failing rows equal the full run's failing rows on the same files;
- whether every file that failed in the full run is inside the related set.

**What "related" buys here.** In the idea book, every product file is reached by 35 of the 38 test files, which is 326 of 341 CPU-seconds at e8d51fd6. So `--mode related` (the plain "related files only" rule) costs about as much as the full row set. The time is saved by the parallel trees and the small first tier.

## Verdicts

| Verdict | Meaning |
|---|---|
| KILLED | non-zero exit and at least one failing row (`by`: the stage that decided it) |
| SURVIVED | the full row set passes with the mutation in place |
| BROKEN | an anchor did not match, no JSON report was written, or the only failures were files that did not load |
| ERRORED | non-zero exit with no failing row (an unhandled error). **The old runner called this SURVIVED.** |
| TIMEOUT | a stage hit `--timeout` (default 900 s); the vitest process tree was killed |

## Options

| Option | Default | Meaning |
|---|---|---|
| `--mutants <file>` | (required) | the mutants module |
| `--sha <rev>` | `HEAD` | the commit to archive (any local ref) |
| `--trees N`, `--workers W` | 4, 4 | N trees in parallel, each vitest at `--maxWorkers=W` |
| `--mode` | `tiered` | `tiered` (first, then quick, then full), `related` (all related files, then full), `full` (every mutant on the full row set, as the old runner did) |
| `--first-files K` | 6 | the size of the first tier; 0 skips it |
| `--prior <results.json>` | none | a previous battery's results (this runner's or the old runner's; repeatable), used to order the first tier |
| `--quick-fraction F` | 0.35 | the quick cut, as a fraction of the slowest file's baseline time |
| `--only id,id` | all | run only these ids; an unknown id prints `SKIPPED` |
| `--verify` | off | also run the full row set for every mutant, and compare |
| `--rows a,b` | the idea book's five paths | the full row set |
| `--out <dir>`, `--work <dir>` | under `%TEMP%\pf-battery` | where results and trees go |
| `--node-modules <dir>` | the main checkout's | the install the junctions point at |
| `--timeout S` | 900 | the hard limit for one vitest run |
| `--clean` | | remove this commit's trees (with `--sha`) |

## Removing trees

Use `--clean`. It unlinks each tree's `node_modules` junction **first**, checks that the shared install still has `vitest/vitest.mjs`, and only then deletes the tree.

**Never run `rm -rf` or `Remove-Item -Recurse` on a tree whose `node_modules` junction is still there.** It can follow the junction and delete the install that every session on this machine uses.

## Limits

- The graph does not read config `setupFiles` or `globalSetup`; the repo's vitest config sets neither today. A mutant in a file that no test imports still gets its stage-2 full run.
- A test related "by mistake" only costs time.
- Windows first: it uses `System32\tar.exe` (bsdtar) and `taskkill /T`. Elsewhere it uses `tar` and process-group kill. The tree's junction is a plain symlink there.
