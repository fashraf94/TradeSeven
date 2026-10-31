// @vitest-environment jsdom
//
// src/components/League/DeskLeaderboard.levelField.render.test.jsx
//
// Ruling F3 of Oct 30, 2026 (flags-on build): the desk leaderboard's crown follows the tie rule the League's two game
// boards already follow (isLevelBoard, arenaStateMap.js). It used to crown the first row of the whole field by list
// position, so a fully level field crowned somebody who leads nobody. Not behind any flag.
//
// renderToString, with the icon a recording stand-in, so a row reads the crown by the row it sits in. The rows hold the
// rule from both sides: a level field has no crown, and a real leader keeps it.

import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// LeagueDeskParts reaches src/firebase/config.js, which throws at import time without credentials (DeskSeasonRail.render.test.jsx).
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('./LeagueParts', async (importOriginal) => ({ ...(await importOriginal()), LIcon: ({ name }) => <i data-test-icon={name} /> }));

const { DeskLeaderboard } = await import('./LeagueDeskParts');

const fieldOf = (...scores) => ({
  field: Object.fromEntries(scores.map((score, i) => [`p${i}`, { id: `p${i}`, name: `Seat${i}`, archName: 'Speculator', score, kind: 'cpu' }])),
});
/** Each drawn row, top first: its name and whether it wears the crown. */
function rows(st) {
  const host = document.createElement('div');
  host.innerHTML = renderToString(<DeskLeaderboard st={st} accent="#5EEAD4" />);
  return [...host.querySelectorAll('span')].filter((el) => /^Seat\d$/.test(el.textContent)).map((name) => {
    const row = name.parentElement.parentElement.parentElement;
    return { name: name.textContent, crown: row.querySelector('[data-test-icon="crown"]') != null, rank: row.firstElementChild.textContent };
  });
}
const crowns = (st) => rows(st).filter((r) => r.crown).map((r) => r.name);

describe('the desk leaderboard\'s crown follows the tie rule (F3)', () => {
  it('a level field, as every field reads before its first bell: no crown, and the top row shows its number', () => {
    const r = rows(fieldOf(0, 0, 0, 0));
    expect(r).toHaveLength(4);
    expect(r.map((x) => x.crown)).toEqual([false, false, false, false]);
    expect(r[0].rank).toBe('1');
  });

  it('a level field away from zero: no crown', () => {
    expect(crowns(fieldOf(12.5, 12.5, 12.5))).toEqual([]);
  });

  it('a normal field crowns its leader, and only its leader', () => {
    expect(crowns(fieldOf(8, 21, 3, 14))).toEqual(['Seat1']);
  });

  it('the rows below the crown keep their numbers', () => {
    expect(rows(fieldOf(9, 7, 5)).map((x) => x.rank)).toEqual(['', '2', '3']);
  });

  it('a partial tie keeps the crown: tied at the top, the first row by list position, as today', () => {
    expect(crowns(fieldOf(5, 5, 4, 3))).toEqual(['Seat0']);
  });

  it('a partial tie keeps the crown: tied below the leader', () => {
    expect(crowns(fieldOf(9, 2, 2, 2))).toEqual(['Seat0']);
  });

  it('level is exact: totals that print alike but differ still have a leader (any lead counts)', () => {
    expect(crowns(fieldOf(5.02, 5.03, 5.01))).toEqual(['Seat1']);
  });

  it('a lone player leads nobody, as on the game boards', () => {
    expect(crowns(fieldOf(40))).toEqual([]);
    expect(rows(fieldOf(40))[0].rank).toBe('1');
  });

  it('an empty field draws its honest empty state and no crown', () => {
    const html = renderToString(<DeskLeaderboard st={fieldOf()} accent="#5EEAD4" />);
    expect(html).toContain('Standings appear once');
    expect(html).not.toContain('data-test-icon="crown"');
  });
});
