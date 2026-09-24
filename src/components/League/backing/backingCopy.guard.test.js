// src/components/League/backing/backingCopy.guard.test.js
//
// Backing Beta PR 4 — THE COPY GUARD (spec V1.3 §5 lexicon, §9 honesty; the
// deskHonesty.test.js shape). Every backing UI file — the surfaces, the copy
// module, the hooks, the service seam, the derived line, the two PR 4 routes
// and the pitch validator — is scanned for the FORBIDDEN_TERMS in
// src/constants/backing.js: bet, wager, odds, cash out, win money, gamble.
//
// BRAND DISCIPLINE, NOT A LEGAL CLAIM (§9, D-t): the lexicon is back / backing
// / backer / pool / pot / pays ×; this suite establishes nothing about legal
// status.
//
// Comments are stripped before matching (the deskHonesty rule): the prose in
// each guarded file NAMES the forbidden terms in order to explain them — if
// comments were scanned, documenting the rule would violate it. What ships to
// a user is string literals and JSX text, and that is what is scanned.
//
// THE DIRECTORY IS SCANNED, so a new file under src/components/League/backing/
// is guarded the moment it exists (the battleView precedent), and the files
// outside it are listed by path. src/constants/backing.js itself is NOT
// guarded here: it is the negative list's own home and must name the terms;
// its co-located test proves its shipped copy is clean.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FORBIDDEN_TERMS, LEXICON } from '../../../constants/backing';
import { forbiddenTermRegExp } from '../../../constants/backingLexicon';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');

const DIR_SOURCES = readdirSync(HERE)
  .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f))
  .map((f) => path.join(HERE, f));

const LISTED = [
  'src/services/backingService.js',
  'src/hooks/useBackingPods.js',
  'src/hooks/useMyBacking.js',
  'src/hooks/useBackingWallet.js',
  'src/hooks/useEligibility.js',
  'src/hooks/useTeamCard.js',
  'src/hooks/useMyPitch.js',
  'src/constants/deriveWeekLine.js',
  'src/constants/teamPitch.js',
  'api/tournament/team-card.js',
  'api/team/pitch.js',
  'api/_utils/teamPitch.js',
  // PR 5 — every new file: the three hooks, the emitter, the four routes,
  // their helpers, the backing-safe approach line, the dev preview page and
  // the admin Sybil watch (a report is copy too).
  'src/hooks/useBackingResults.js',
  'src/hooks/useMyBackingStats.js',
  'src/hooks/useTrainerStats.js',
  'src/services/backingTelemetry.js',
  'src/constants/backingApproach.js',
  'src/screens/BackingPreviewScreen.jsx',
  'api/backing/event.js',
  'api/backing/results.js',
  'api/backing/my-stats.js',
  'api/backing/trainer-stats.js',
  'api/_utils/backingEvents.js',
  'api/_utils/backingResults.js',
  'api/_utils/backingStats.js',
  'api/_utils/backingSybilWatch.js',
  'scripts/backing-sybil-watch.js',
  // The pre-flip cleanup (Amendment C §C1, D-af): the team-label resolver and
  // the team-labels route — every name a backing surface shows passes through
  // them, so their words are held to the same lexicon.
  'api/_utils/backingTeamLabels.js',
  'api/backing/team-labels.js',
  // The desktop layouts build: every host that now mounts a backing surface
  // on desktop — the lobby (the strip in the centre, the full-window screen),
  // the shared centre it opened (the strip's slot under the entry and under
  // the waiting room), the stats' desktop home beside the pitch — and the
  // desktop screenshot harness (its fixture copy reaches the pictures).
  'src/components/League/LeagueLobbyDesktop.jsx',
  'src/components/League/liveDraft/SlotCenter.jsx',
  'src/components/League/WhileYouWait.jsx',
  'src/components/Dashboard/desktop/IdentityPanel.jsx',
  'scripts/backing-screenshots/desktop.render.jsx',
].map((rel) => path.join(REPO, rel));

const GUARDED = [...DIR_SOURCES, ...LISTED];

/** Comments stripped; string literals and JSX text remain. */
function strippedSource(file) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// The ONE matcher, shared with the team-card projection's approach filter (R-B-5).
const termRe = (term) => forbiddenTermRegExp(term);

describe('the backing copy guard — no forbidden term in any backing UI file', () => {
  it('guards a non-empty set that includes the copy module, the strip, the card, the control and the routes', () => {
    expect(GUARDED.length).toBeGreaterThan(10);
    const names = GUARDED.map((f) => path.basename(f));
    for (const must of ['backingCopy.js', 'BackingStrip.jsx', 'TeamCard.jsx', 'StakeControl.jsx', 'PodList.jsx', 'YourBacking.jsx', 'BackingScreen.jsx', 'team-card.js', 'pitch.js', 'deriveWeekLine.js', 'BackingResultsCard.jsx', 'MyBackingStats.jsx', 'TrainerStats.jsx', 'results.js', 'my-stats.js', 'trainer-stats.js', 'event.js', 'backingTelemetry.js',
      // the desktop layouts build
      'BackingDesk.jsx', 'LeagueLobbyDesktop.jsx', 'SlotCenter.jsx', 'WhileYouWait.jsx', 'IdentityPanel.jsx', 'desktop.render.jsx']) {
      expect(names, `${must} is not under the guard`).toContain(must);
    }
    for (const f of GUARDED) expect(() => readFileSync(f), `${f} does not exist`).not.toThrow();
  });

  for (const file of GUARDED) {
    const rel = path.relative(REPO, file);
    for (const term of FORBIDDEN_TERMS) {
      it(`${rel} contains no "${term}"`, () => {
        const hit = strippedSource(file).match(termRe(term));
        expect(hit, hit ? `"${term}" appears in ${rel}. The lexicon is ${LEXICON.join(' / ')} — see src/constants/backing.js.` : '').toBeNull();
      });
    }
  }
});

describe('the guard is not vacuous', () => {
  it('the term regex matches a forbidden word as a whole word, case-insensitively, and phrases across whitespace', () => {
    expect('Place your BET now'.match(termRe('bet'))).not.toBeNull();
    expect('cash   out'.match(termRe('cash out'))).not.toBeNull();
    // ...and does not fire on words that merely contain one.
    expect('between the lines'.match(termRe('bet'))).toBeNull();
    expect('no cash value'.match(termRe('cash out'))).toBeNull();
  });

  it('comment stripping removes both comment forms and leaves a URL-like `://` alone', () => {
    const src = '// bet in a line comment\nconst a = "https://x"; /* wager in a block */ const b = 1;';
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(stripped).not.toMatch(/\bbet\b/);
    expect(stripped).not.toMatch(/\bwager\b/);
    expect(stripped).toContain('https://x');
  });

  it('the desktop layouts\' own words are under the scan: the DESK labels and the strip\'s "Back a team" (positive control)', () => {
    const copy = strippedSource(path.join(HERE, 'backingCopy.js'));
    expect(copy).toContain('Back a team');
    expect(copy).toContain('New total');
    expect(copy).toContain('Pays ×');
  });

  it('the copy module actually carries the lexicon it is held to (positive control)', () => {
    const copy = strippedSource(path.join(HERE, 'backingCopy.js')).toLowerCase();
    for (const word of ['backing', 'pool', 'pot', 'backer']) expect(copy).toContain(word);
  });

  it('MUTATION ROW — a forbidden term planted in backing copy is caught by the same scan', () => {
    const planted = strippedSource(path.join(HERE, 'backingCopy.js')) + "\nexport const X = 'Place your odds here';";
    const hits = FORBIDDEN_TERMS.filter((term) => planted.match(termRe(term)));
    expect(hits).toEqual(['odds']);
  });
});
