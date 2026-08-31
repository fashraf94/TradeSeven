// src/screens/trainingDraftRoomCopyParity.test.js
//
// PARITY TRIPWIRE — the draft-completion card exists TWICE: the live path
// (DraftBoardRoom, shared by training and competitive) and the legacy flag-off
// path (TrainingDraftRoomScreen's LegacyTrainingDraftRoom). Both hand-roll the
// same two strings and the same `finalStatus === BATTLE` test, so a fix applied
// to one and not the other leaves the two paths disagreeing about the same pod —
// which is exactly how the pre-open bug reached the ranked drafter.
//
// These are SOURCE-TEXT assertions on purpose (the decide.baselineGate.test.js
// idiom): rendering LegacyTrainingDraftRoom would need the whole draft stack
// mocked, and what actually needs guarding is that the two files stay identical
// in this respect. The behavioural coverage lives in
// DraftBoardRoom.smoke.test.jsx.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const LIVE = 'src/components/League/draft/DraftBoardRoom.jsx';
const LEGACY = 'src/screens/TrainingDraftRoomScreen.jsx';

const LIVE_SRC = read(LIVE);
const LEGACY_SRC = read(LEGACY);

const AWAITING_COPY = 'Your pod is locked in and waiting for the next market open.';
const LIVE_COPY = 'Your pod is live — the five-day battle has begun.';

describe('draft-completion copy parity (live vs legacy path)', () => {
  it('both paths carry the same two completion strings', () => {
    for (const [rel, src] of [[LIVE, LIVE_SRC], [LEGACY, LEGACY_SRC]]) {
      expect(src, `${rel} lost the awaiting copy`).toContain(AWAITING_COPY);
      expect(src, `${rel} lost the live copy`).toContain(LIVE_COPY);
    }
  });

  it('both paths gate the live copy on the pre-open phase, not on status alone', () => {
    // The defect this guards: `finalStatus === GROUP_STATUS.BATTLE` alone is true
    // ~40 minutes before the bell for a Mon-08:45 slot pod.
    const GUARD = 'finalStatus === GROUP_STATUS.BATTLE && !preOpen';
    for (const [rel, src] of [[LIVE, LIVE_SRC], [LEGACY, LEGACY_SRC]]) {
      expect(src, `${rel} does not gate the live copy on preOpen`).toContain(GUARD);
      expect(src, `${rel} still has an ungated status test`)
        .not.toMatch(/finalStatus === GROUP_STATUS\.BATTLE;/);
    }
  });

  it('both paths resolve preOpen through the shared hook, not a local re-derivation', () => {
    for (const [rel, src] of [[LIVE, LIVE_SRC], [LEGACY, LEGACY_SRC]]) {
      expect(src, `${rel} does not import usePreOpenPhase`).toMatch(/import usePreOpenPhase from '[^']*hooks\/usePreOpenPhase'/);
      expect(src, `${rel} does not call usePreOpenPhase(group)`).toContain('usePreOpenPhase(group)');
    }
  });

  it('anti-vacuous: the assertions are matched against real, non-empty sources', () => {
    expect(LIVE_SRC.length).toBeGreaterThan(1000);
    expect(LEGACY_SRC.length).toBeGreaterThan(1000);
    // and the guard string is genuinely discriminating — it must NOT appear in a
    // file that never had the completion card.
    expect(read('src/screens/leagueTrainingBattleFraming.js')).not.toContain(LIVE_COPY);
  });
});
