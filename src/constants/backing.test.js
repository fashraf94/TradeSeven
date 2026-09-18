// src/constants/backing.test.js
//
// Backing Beta PR 1 — locks the export SHAPE and the VALUES of the zero-import
// backing constants (spec V1.3 §2, §3, §4, §5, §10; §12 PR 1's "+test:
// allowance, caps, min, lexicon, the fine-print and three disclosure strings").
//
// These are not tuning knobs. Every number here is a founder-locked economy
// value from the §15 rulings ledger, and the two copy blocks are the spec's own
// verbatim wording — so the rows below assert LITERALS, not ranges. A value
// that moves moves the spec first.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this test's real import of the
// module is the runtime guard for the api/ -> src/ imports in
// api/_utils/backingWeek.js and api/_utils/backingWallet.js — it explodes in
// this Node test env if a browser-only dep ever enters the graph. Never mock it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWANCE_BP,
  PER_TEAM_CAP_BP,
  MIN_STAKE_BP,
  VALIDITY_MIN_BACKERS,
  VALIDITY_MIN_TEAMS,
  POOL_MIN_WINDOW_MS,
  POOL_EXCLUDED_SLOT_IDS,
  BACKING_EVENT_ALLOWLIST,
  FINE_PRINT,
  DISCLOSURES,
  POOL_STRIP,
  LEXICON,
  FORBIDDEN_TERMS,
} from './backing.js';
import * as BACKING from './backing.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'backing.js'), 'utf8');

describe('backing constants — the module contract', () => {
  it('has zero imports (Node-clean by construction — BUILD_RULES §4)', () => {
    expect(SRC).not.toMatch(/^\s*import\s/m);
    expect(SRC).not.toMatch(/\brequire\(/);
  });

  it('exports exactly the PR 1 surface — nothing has drifted in', () => {
    // A closed list, so an export added without a locking row here is a
    // failure rather than an unguarded constant.
    expect(Object.keys(BACKING).sort()).toEqual([
      'ALLOWANCE_BP',
      'BACKING_EVENT_ALLOWLIST',
      'DISCLOSURES',
      'FINE_PRINT',
      'FORBIDDEN_TERMS',
      'LEXICON',
      'MIN_STAKE_BP',
      'PER_TEAM_CAP_BP',
      'POOL_EXCLUDED_SLOT_IDS',
      'POOL_MIN_WINDOW_MS',
      'POOL_STRIP',
      'VALIDITY_MIN_BACKERS',
      'VALIDITY_MIN_TEAMS',
    ]);
  });

  it('every non-scalar export is frozen (§12: an Object.freeze\'d constants module)', () => {
    for (const [name, value] of Object.entries(BACKING)) {
      if (value !== null && typeof value === 'object') {
        expect(Object.isFrozen(value), `${name} is not frozen`).toBe(true);
      }
    }
  });

  it('writes nothing into src/constants/leagueTournament.js (§12 — its tuning shape is test-locked)', () => {
    const league = readFileSync(path.join(HERE, 'leagueTournament.js'), 'utf8');
    for (const name of ['ALLOWANCE_BP', 'PER_TEAM_CAP_BP', 'MIN_STAKE_BP', 'POOL_MIN_WINDOW_MS', 'BACKING_EVENT_ALLOWLIST']) {
      expect(league, `${name} leaked into the tournament tuning module`).not.toContain(name);
    }
  });
});

describe('the economy — §2 (D-a, D-f, D-h)', () => {
  it('the weekly allowance is 1,000 BP', () => {
    expect(ALLOWANCE_BP).toBe(1000);
  });

  it('the per-team cap is 500 BP and the minimum stake is 50 BP', () => {
    expect(PER_TEAM_CAP_BP).toBe(500);
    expect(MIN_STAKE_BP).toBe(50);
  });

  it('the three are integers and coherent: min ≤ cap ≤ allowance', () => {
    for (const [name, v] of [['ALLOWANCE_BP', ALLOWANCE_BP], ['PER_TEAM_CAP_BP', PER_TEAM_CAP_BP], ['MIN_STAKE_BP', MIN_STAKE_BP]]) {
      expect(Number.isInteger(v), `${name} is not an integer — BP is integer-only (§3)`).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
    // Not decoration: a cap above the allowance would make the per-team cap
    // unreachable, and a minimum above the cap would make every stake illegal.
    expect(MIN_STAKE_BP).toBeLessThanOrEqual(PER_TEAM_CAP_BP);
    expect(PER_TEAM_CAP_BP).toBeLessThanOrEqual(ALLOWANCE_BP);
  });
});

describe('validity — §3 (D-n)', () => {
  it('is ≥3 unique backers and ≥2 distinct teams', () => {
    expect(VALIDITY_MIN_BACKERS).toBe(3);
    expect(VALIDITY_MIN_TEAMS).toBe(2);
  });

  it('the team floor cannot exceed the backer floor (two teams need two backers at least)', () => {
    expect(VALIDITY_MIN_TEAMS).toBeLessThanOrEqual(VALIDITY_MIN_BACKERS);
  });
});

describe('the window — §4 (D-c amended, D-x)', () => {
  it('POOL_MIN_WINDOW_MS is exactly 24 hours in milliseconds', () => {
    expect(POOL_MIN_WINDOW_MS).toBe(86_400_000);
  });

  it('POOL_EXCLUDED_SLOT_IDS is exactly the Mon 08:45 slot (D-x, §14)', () => {
    expect(POOL_EXCLUDED_SLOT_IDS).toEqual(['mon-0845']);
  });

  it('names a slot id that actually exists in the live slot schedule', () => {
    // A typo'd id would exclude nothing and fail silently — the worst shape for
    // a safety list. Read as TEXT, not imported: this module is zero-import by
    // rule, and the test is where the two are allowed to meet.
    const slots = readFileSync(path.join(HERE, '..', 'config', 'liveDraftSlots.js'), 'utf8');
    for (const id of POOL_EXCLUDED_SLOT_IDS) {
      expect(slots, `${id} is not a configured slot id (src/config/liveDraftSlots.js)`).toContain(`id: '${id}'`);
    }
  });
});

describe('telemetry — §10 (D-p)', () => {
  it('is exactly the five client events, in spec order', () => {
    expect(BACKING_EVENT_ALLOWLIST).toEqual([
      'window_viewed',
      'team_card_opened',
      'stake_control_opened',
      'your_backing_viewed',
      'results_viewed',
    ]);
  });

  it('does NOT carry stake_confirmed — the stake endpoint writes that server-side (§10, §9)', () => {
    // A client able to post stake_confirmed would assert a stake the server had
    // not written, which §9 forbids outright.
    expect(BACKING_EVENT_ALLOWLIST).not.toContain('stake_confirmed');
  });
});

describe('copy — §5 fine print and the three §4 Confirm lines (D-t, D-q, D-n)', () => {
  it('FINE_PRINT is the §5 string, verbatim', () => {
    expect(FINE_PRINT).toBe(
      "Backing Points are a weekly allowance for the game. They can't be bought, transferred, or redeemed, and have no cash value.",
    );
  });

  it('DISCLOSURES carries exactly the three lines, verbatim, one source each', () => {
    expect(Object.keys(DISCLOSURES).sort()).toEqual(['loadouts', 'payout', 'validity']);
    expect(DISCLOSURES.loadouts).toBe('Loadouts can change nightly during the week.');
    expect(DISCLOSURES.payout).toBe(
      "Your payout isn't known until the pool closes, and it will change as other people back teams.",
    );
    expect(DISCLOSURES.validity).toBe(
      'Your stake becomes final only if this pool meets its participation minimum at close. Otherwise it is void.',
    );
  });

  it('the three lines are distinct — one source each, never one string reused', () => {
    const lines = Object.values(DISCLOSURES);
    expect(new Set(lines).size).toBe(3);
  });

  it('LEXICON is the §5 vocabulary', () => {
    expect(LEXICON).toEqual(['back', 'backing', 'backer', 'pool', 'pot', 'pays ×']);
  });

  it('FORBIDDEN_TERMS is the six terms backing copy never uses', () => {
    expect(FORBIDDEN_TERMS).toEqual(['bet', 'wager', 'odds', 'cash out', 'win money', 'gamble']);
    // The PR 4 guard matches case-insensitively, so the source list must be
    // lowercase or the guard silently under-matches.
    for (const term of FORBIDDEN_TERMS) expect(term).toBe(term.toLowerCase());
  });

  it("this PR's own shipped copy is clean under the guard it feeds", () => {
    // The guard's inputs must pass the guard. Word-boundary matching so 'bet'
    // does not fire on 'better' — the same rule PR 4's copy guard will need,
    // stated here first because this is where the term list lives.
    const shipped = [
      FINE_PRINT,
      ...Object.values(DISCLOSURES),
      // The Amendment B §B6 strings are shipped copy too, and a term that
      // slipped into the pool strip would be just as visible as one in the
      // fine print.
      ...Object.values(POOL_STRIP).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
    ];
    for (const term of FORBIDDEN_TERMS) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      for (const line of shipped) {
        expect(re.test(line), `"${term}" appears in shipped backing copy: ${line}`).toBe(false);
      }
    }
  });

  it('POOL_STRIP carries the two §B6 open states, verbatim', () => {
    expect(Object.keys(POOL_STRIP).sort()).toEqual(['belowFloor', 'qualified', 'yourBacking']);
    expect(POOL_STRIP.belowFloor).toEqual({
      headline: 'Pool needs support',
      backers: 'Backers {count} of {floor}',
      teamSpread: 'Team spread: needs another team',
    });
    expect(POOL_STRIP.qualified).toEqual({
      headline: 'Pool qualified',
      backers: 'Backers: threshold met',
      teamSpread: 'Team spread: threshold met',
    });
    expect(POOL_STRIP.yourBacking).toBe('Your backing: {amount} BP');
  });

  it('NEITHER open state has a pot line — there is no pot fact to bind one to (§B5)', () => {
    // Not a copy preference: §B5 moves `potTotal` off the public pool document,
    // so a pot string here would be a label with no payload field behind it —
    // the §9 display-agreement failure applied to copy. The row fails the day
    // someone adds one.
    const everyString = Object.values(POOL_STRIP)
      .flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)));
    for (const line of everyString) {
      expect(line, `"${line}" mentions the pot`).not.toMatch(/\bpot\b|\bpot total\b/i);
    }
    // `Your backing` is the viewer's OWN stake, which §B2 keeps visible
    // throughout — the one BP figure an open pool may show.
    expect(POOL_STRIP.yourBacking).toContain('{amount}');
  });

  it('the qualified state names NO NUMBER — once met, the signals freeze (§B2)', () => {
    // §B2: "Never 4, 5, 6." The qualified block is the copy half of that — it
    // has no placeholder to interpolate a count into, so a surface rendering it
    // has nothing to leak.
    for (const line of Object.values(POOL_STRIP.qualified)) {
      expect(line, `"${line}" carries a placeholder`).not.toMatch(/\{/);
      expect(line).not.toMatch(/\d/);
    }
    // The below-floor block does carry the count, and its floor with it (§B4 —
    // below the floor the spectator is told what the pool needs).
    expect(POOL_STRIP.belowFloor.backers).toContain('{count}');
    expect(POOL_STRIP.belowFloor.backers).toContain('{floor}');
  });

  it('every nested POOL_STRIP block is frozen too, not just the top level', () => {
    for (const [name, value] of Object.entries(POOL_STRIP)) {
      if (value !== null && typeof value === 'object') {
        expect(Object.isFrozen(value), `POOL_STRIP.${name} is not frozen`).toBe(true);
      }
    }
  });

  it('FORBIDDEN_TERMS and LEXICON do not overlap — the guard cannot forbid its own vocabulary', () => {
    const forbidden = new Set(FORBIDDEN_TERMS);
    for (const word of LEXICON) expect(forbidden.has(word.toLowerCase())).toBe(false);
  });
});
