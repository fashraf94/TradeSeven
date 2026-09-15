// src/config/backingBetaFlags.test.js
//
// Backing Beta PR 1 — BACKING_BETA_ENABLED: THE FLAG PIN (BUILD_RULES §2).
//
// BACKING_BETA_ENABLED ships FALSE by design (spec V1.3 §12 / §11, as amended
// by Amendment A §A7): PR 1–5 all merge dark and the founder flips it —
// together with ELIGIBILITY_ATTESTATION_ENABLED — in the flip PR after every
// §11 gate. The flag-pin guard (flagPinGuard.test.js) tracks this row against
// the live value and, because the flag sits in DARK_BY_DESIGN there, an
// accidental flip fails loudly with the runway note; a DELIBERATE flip moves
// the first row below to `true` and drops the DARK_BY_DESIGN entry in the same
// commit.
//
// Deliberately pins ONLY this flag (the eligibilityFlags.test.js / showItFlags
// precedent): pinning a flag obliges its docstring to name this file, so an
// unrelated flag added here "as context" would couple its future flip to this
// arc. ELIGIBILITY_ATTESTATION_ENABLED (PR 0) keeps its own pin suite — the two
// flags flip in one commit but are pinned apart.
//
// PR 1 HAS NO DOOR, and that is the substantive claim these rows defend. The
// PR ships constants, the week helper, the wallet/ledger primitives, the rules
// blocks and the two stake indexes — no endpoint, no UI, no caller, no
// document written. So there is no flag-off darkness suite to write here (there
// is no behavior to hold byte-identical) and, correspondingly, NOTHING reads
// the flag yet: the last row below pins that absence, so the day a PR-1 module
// grows a call-time read the pin fails and the reader is made deliberate.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BACKING_BETA_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

describe('Backing Beta PR 1 flag — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: BACKING_BETA_ENABLED is false at merge (spec V1.3 §12 — the flip PR flips it after every §11 gate)', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(BACKING_BETA_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof BACKING_BETA_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const BACKING_BETA_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite, the flip map and the DARK_BY_DESIGN entry', () => {
    const idx = SRC.indexOf('export const BACKING_BETA_ENABLED');
    expect(idx).toBeGreaterThan(-1);
    // THIS flag's own docstring — bounded below by the previous `export const`
    // (the flag-pin guard's docstringWindow rule), so a neighbour's FLIP MAP
    // (ELIGIBILITY_ATTESTATION_ENABLED sits directly above) can never satisfy
    // these rows on this flag's behalf.
    const prevExport = SRC.lastIndexOf('\nexport const ', idx - 2);
    const window = SRC.slice(prevExport + 1, idx);
    expect(window).toContain('Pinned by: backingBetaFlags.test.js');
    expect(window).toContain('FLIP MAP');
    expect(window).toContain('DARK_BY_DESIGN');
    // The routes' darkness is the flag's whole promise from PR 2 on; the
    // docstring says so even while PR 1 has no route to darken.
    expect(window).toContain('404s');
  });

  it('the docstring states that PR 1 adds no door — the honest FLIP MAP for a foundation PR', () => {
    const idx = SRC.indexOf('export const BACKING_BETA_ENABLED');
    const prevExport = SRC.lastIndexOf('\nexport const ', idx - 2);
    const window = SRC.slice(prevExport + 1, idx);
    // A FLIP MAP that listed doors this PR does not ship would be the copy
    // equivalent of a stale cron header (BUILD_RULES §6): a future reader must
    // not be able to infer a PR-1 surface from it.
    expect(window).toContain('PR 1 ADDS NO DOOR');
    expect(window).toMatch(/PR 1 — NONE/);
  });

  it('nothing in PR 1 reads the flag — the foundation ships with zero gated callers', () => {
    // BUILD_RULES §2 mutation check: this row fails the moment a PR-1 module
    // imports the flag, which is exactly the event that should be deliberate.
    // Scoped to THIS PR's modules by name; PR 2–5 add their own readers and
    // their own dark suites, and will delete the module they light from this
    // list — never the row.
    const PR1_MODULES = [
      'api/_utils/backingWallet.js',
      'api/_utils/backingWeek.js',
      'src/constants/backing.js',
    ];
    for (const rel of PR1_MODULES) {
      const text = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      expect(text, `${rel} reads BACKING_BETA_ENABLED — PR 1 gates nothing (spec V1.3 §12 PR 1)`)
        .not.toContain('BACKING_BETA_ENABLED');
    }
  });

  it('no backing endpoint exists yet — PR 1 ships no route to gate', () => {
    // The other half of "no door": the flag cannot be under-read if there is
    // nothing to read it in. Reds when PR 2 lands its route WITHOUT moving this
    // row, which is the moment the gated-read discipline starts to matter.
    const apiTournament = readdirSync(path.join(REPO_ROOT, 'api', 'tournament'));
    const backingRoutes = apiTournament.filter((f) => f.startsWith('backing-'));
    expect(backingRoutes, 'a backing-* route appeared under api/tournament — PR 2+ lands the first one WITH its 404-while-dark suite; update this row in that PR').toEqual([]);
  });
});
