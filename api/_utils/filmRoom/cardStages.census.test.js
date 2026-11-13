// api/_utils/filmRoom/cardStages.census.test.js
//
// Film Room Build C (spec docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md §3, "Readers that migrate together";
// acceptance C-VOCAB) — every reader of a card's stage reads the stage list, the open set and the open predicate from
// ONE export, src/data/cardStages.js. A static census over each reader's source (comments stripped): no reader holds a
// stage list of its own — an array of two or more stage words, or two stage comparisons chained in one expression —
// and each reader that judges a stage imports the export (the store re-exports it whole). Every reader is PLANTED with
// each kind of list to prove the census bites on it (the mutant: a reader with its own stage list). The copy's stage
// words cover exactly the vocabulary's stages.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_STAGES, OPEN_STAGES, isOpenStage } from '../../../src/data/cardStages.js';
import * as store from './cardStore.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const abs = (p) => path.join(REPO, p);

/** Every reader spec §3 names (and the build prompt adds), with the import of the one export it must hold — null where the reader judges no stage of its own. */
export const STAGE_READERS = Object.freeze({
  'api/_utils/filmRoom/cardStore.js': /from '\.\.\/\.\.\/\.\.\/src\/data\/cardStages\.js'/,
  'api/_utils/filmRoom/cardCounter.js': /import \{[^}]*\bisFollowedWatch\b[^}]*\} from '\.\/cardStore\.js'/,
  'api/_utils/filmRoom/cardRequest.js': null,
  'api/film-room/card.js': null,
  'src/screens/filmRoomV2/filmRoomCards.js': /from '\.\.\/\.\.\/data\/cardStages'/,
  'src/screens/filmRoomV2/FilmRoomCardRegions.jsx': /from '\.\.\/\.\.\/data\/cardStages'/,
  'src/screens/filmRoomV2/filmRoomCopy.js': null,
  'src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx': /from '\.\.\/\.\.\/\.\.\/data\/cardStages'/,
  'test/rules/filmRoomCardAttribution.rules.mjs': null,
});

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const STAGE = CARD_STAGES.join('|');
/** An array literal of two or more stage words, or two stage comparisons chained by && / || in one expression. */
const OWN_LIST = [
  new RegExp(`\\[\\s*(['"])(${STAGE})\\1\\s*,\\s*(['"])(${STAGE})\\3`),
  new RegExp(`stage\\s*[!=]==?\\s*(['"])(${STAGE})\\1\\s*(&&|\\|\\|)\\s*[\\w.?]*stage\\s*[!=]==?\\s*(['"])(${STAGE})\\4`),
  // C1 review A-12: a switch whose cases fall through two stage words is a list too
  new RegExp(`case\\s*(['"])(${STAGE})\\1\\s*:\\s*case\\s*(['"])(${STAGE})\\3`),
];
export const ownStageListsIn = (src) => OWN_LIST.map((re) => re.exec(stripComments(src))?.[0] ?? null).filter(Boolean);

describe('C-VOCAB — every reader reads the stages from the one export', () => {
  it('the readers exist (the census reads real files)', () => {
    for (const f of Object.keys(STAGE_READERS)) expect(existsSync(abs(f)), f).toBe(true);
  });

  for (const [file, importRe] of Object.entries(STAGE_READERS)) {
    it(`${file}: no stage list of its own${importRe ? ', and it imports the one export' : ''}`, () => {
      const src = readFileSync(abs(file), 'utf8');
      expect(ownStageListsIn(src), file).toEqual([]);
      if (importRe) expect(importRe.test(src), file).toBe(true);
    });
  }

  it('THE BITE: each reader, planted with a list of its own (an array, a chained comparison), is caught — every reader, both kinds', () => {
    for (const file of Object.keys(STAGE_READERS)) {
      const src = readFileSync(abs(file), 'utf8');
      expect(ownStageListsIn(`${src}\nconst OWN = ['card', 'nominated'];\n`).length, `${file} array`).toBe(1);
      expect(ownStageListsIn(`${src}\nconst open = (c) => c.stage === 'card' || c.stage === 'testing';\n`).length, `${file} chain`).toBe(1);
      expect(ownStageListsIn(`${src}\nconst open = (c) => c.stage !== 'tested' && c?.stage !== "installed";\n`).length, `${file} chain, other quotes`).toBe(1);
      expect(ownStageListsIn(`${src}\nswitch (c.stage) { case 'card':\n  case 'nominated': return true; default: return false; }\n`).length, `${file} switch`).toBe(1);
    }
    // a list in a comment is not code
    expect(ownStageListsIn("// the stages ['card', 'nominated'] were v1's\nconst x = 1;")).toEqual([]);
    // a single stage word is the vocabulary's word, not a list
    expect(ownStageListsIn("if (c.stage === 'retired') x();")).toEqual([]);
  });

  it('DOCUMENTED LIMIT, stated on purpose: an object keyed by stage words is not read as a list — the copy\'s stageWords and the store\'s SERVER_TRANSITIONS are such maps by design; the copy\'s keys are pinned equal to the vocabulary below instead', () => {
    expect(ownStageListsIn("const open = { card: true, nominated: true };")).toEqual([]);
  });

  it('the export itself is the one place the lists live — and the store\'s are the same objects', () => {
    const src = readFileSync(abs('src/data/cardStages.js'), 'utf8');
    expect(ownStageListsIn(src).length).toBeGreaterThan(0);
    expect(store.CARD_STAGES).toBe(CARD_STAGES);
    expect(store.OPEN_STAGES).toBe(OPEN_STAGES);
    expect(store.isOpenStage).toBe(isOpenStage);
  });

  it('the screen\'s stage words cover exactly the vocabulary\'s stages (installed reads "equipped")', async () => {
    const { FILM_ROOM_COPY } = await import('../../../src/screens/filmRoomV2/filmRoomCopy.js');
    expect(Object.keys(FILM_ROOM_COPY.cards.stageWords)).toEqual([...CARD_STAGES]);
    expect(FILM_ROOM_COPY.cards.stageWords.installed).toBe('equipped');
  });
});
