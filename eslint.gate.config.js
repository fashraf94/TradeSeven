// eslint.gate.config.js — THE INTERIM CI GATE
//
// The two rules that catch crashes, and nothing else yet. This is D1 from
// docs/audits/20260913_LINT_NODE_GLOBALS.md §9, landed once both reached
// zero (docs/audits/20260915_BUILD_CRASH_CLASS_A1_A4.md §6-A):
//
//   no-undef                     — an identifier read where it is not
//                                  defined. A ReferenceError that unmounts
//                                  the React tree the moment that code runs.
//                                  This is what A1 was.
//   react-hooks/rules-of-hooks   — a hook called conditionally, so the hook
//                                  COUNT depends on a condition. React
//                                  throws the moment that condition changes
//                                  between renders of a mounted component.
//                                  This is what A4 was, 19 times.
//
// WHY THIS DERIVES FROM eslint.config.js RATHER THAN RESTATING IT. The base
// config carries the file globs, the browser/Node globals unions and the
// parser options that decide whether `no-undef` is even meaningful for a
// given file — get those wrong and the gate is either blind or wrong. So the
// base is imported and every rule EXCEPT the two is switched off, which
// keeps one source for the matching and the globals. `defineConfig` has
// already flattened `extends` by the time we see it, so the two rules are
// reachable as plain keys.
//
// The two are forced to 'error' rather than inherited, so the gate cannot be
// quietly weakened by someone downgrading them to 'warn' in the base config.
//
// Everything else stays in `npm run lint` and is NOT gated: 875 errors and
// 119 warnings remain at the time this landed, and gating on them would mean
// `continue-on-error`, which is not a gate. Widening this list is a
// deliberate decision, one rule at a time, each time it reaches zero.
import { globalIgnores } from 'eslint/config'
import baseConfig from './eslint.config.js'

const GATE_RULES = new Set(['no-undef', 'react-hooks/rules-of-hooks'])

// TWO FILES THE GATE CANNOT SEE, and could not before it existed either.
// scripts/composition/cells_C5.js and cells_C7.js are bare object-literal
// FRAGMENTS — they open straight into `'ts-01': { … }` with no wrapper —
// so ESLint cannot parse them and reports a parse error instead of running
// any rule. They work in the pipeline: assemble.mjs reads each as TEXT,
// wraps it, and imports the result. They are the A5 finding in
// docs/audits/20260913_LINT_NODE_GLOBALS.md §7(a), where the record already
// notes they are "invisible to every rule, permanently".
//
// A parse error is not a `no-undef` and not a conditional hook, so it must
// not hold this gate red — and ignoring them here costs nothing that was
// not already lost, because no rule has ever run on them. Fixing them
// properly (wrap like cells_C1/C6, or ignore repo-wide) is a decision about
// the assembler's contract, which is A5's own task. `npm run lint` still
// reports them.
const UNPARSEABLE_FRAGMENTS = globalIgnores([
  'scripts/composition/cells_C5.js',
  'scripts/composition/cells_C7.js',
])

export default [UNPARSEABLE_FRAGMENTS, ...baseConfig].map((entry) =>
  entry.rules
    ? {
        ...entry,
        rules: Object.fromEntries(
          Object.keys(entry.rules).map((name) => [
            name,
            GATE_RULES.has(name) ? 'error' : 'off',
          ])
        ),
      }
    : entry
).concat([
  // Switching ~65 rules off makes every `eslint-disable` comment aimed at
  // one of them look unused, and ESLint 9 reports those as warnings by
  // default — 69 of them here. They are an artifact of the gate's narrow
  // rule set, not a finding, and `npm run lint` still reports the genuinely
  // unused ones. Off, so `--max-warnings 0` means what it says.
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
])
