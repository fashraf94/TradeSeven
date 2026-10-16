// src/components/CommandCenter/hubCopy.guard.test.js
//
// Command Center hub — the copy guard (spec V1.2 §11.3 "All strings
// centralized and guarded; no learning / improvement / intelligence / earned
// tier, unsupported source counts, fake history or preference authority").
// Covers both of the hub's copy tables, as the S0 report asked (L4-6): the
// hub's (hub/hubCopy.js, lazy chunk) and the gate's (hubGateCopy.js, main
// chunk).
//
//   1. no user-visible string is written anywhere else under
//      src/components/CommandCenter/ (JSX text, a quoted text child, or a
//      quoted accessible-name / label / title attribute) — the layout fixtures
//      are illustrative data and exempt;
//   2. the strings the spec fixes are exactly the spec's;
//   3. no string claims growth, counts, history or authority the hub does not
//      hold, and no prototype chrome word or "Tester" survives;
//   4. the hold's "1.3 s" agrees with the shipped hold (display agreement,
//      BUILD_RULES §9) — a tripwire on useHoldToDeploy.js's HOLD_MS.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HUB_COPY } from './hub/hubCopy';
import { HUB_GATE_COPY } from './hubGateCopy';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (source) => source
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const DIR = 'src/components/CommandCenter';
const COPY_TABLES = [`${DIR}/hub/hubCopy.js`, `${DIR}/hubGateCopy.js`];

function hubSourceFiles() {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      const child = path.join(abs, ent.name);
      if (ent.isDirectory()) { if (ent.name !== '__fixtures__') walk(child); continue; }
      if (/\.[mc]?jsx?$/.test(ent.name) && !/\.test\.[mc]?jsx?$/.test(ent.name)) out.push(path.relative(REPO_ROOT, child).split(path.sep).join('/'));
    }
  };
  walk(path.join(REPO_ROOT, DIR));
  return out.filter((rel) => !COPY_TABLES.includes(rel));
}

// A user-visible string written in place: JSX text with a letter, a quoted
// text child with a letter, or a quoted accessible name / label / title.
const LITERAL_COPY = [
  // JSX text: words between a tag's end and the next tag. Code operators
  // (`(`, `)`, `&`, `|`, `=`, `;`) never sit in text, so `a > limit && (<div`
  // is not mistaken for it.
  { name: 'JSX text', re: />\s*([A-Za-z][^<>{}\n()&|=;]*?)\s*<\//g },
  { name: 'JSX text', re: />\s*([A-Za-z][^<>{}\n()&|=;]*?)\s*<[A-Za-z]/g },
  // A quoted child, not an attribute's value (`id={`h${uid}`}` is not copy).
  { name: 'quoted child', re: /(?<!=\s*)\{\s*(['"`])([^'"`\n]*[A-Za-z][^'"`\n]*)\1\s*\}/g },
  { name: 'quoted attribute', re: /\b(?:aria-label|ariaLabel|aria-description|label|title|placeholder|alt)=\s*(?:\{\s*)?(['"`])([^'"`\n]*[A-Za-z][^'"`\n]*)\1/g },
];

function literalCopyIn(code) {
  const hits = [];
  for (const { name, re } of LITERAL_COPY) {
    for (let m = re.exec(code); m !== null; m = re.exec(code)) hits.push(`${name}: ${m[0].trim().slice(0, 60)}`);
    re.lastIndex = 0;
  }
  return hits;
}

/** Every string value in a copy table, functions sampled with placeholder arguments. */
function strings(table) {
  const out = [];
  const visit = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') out.push(String(v(...Array.from({ length: Math.max(1, v.length) }, (_, i) => `ARG${i}`))));
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(table);
  return out;
}
const ALL_COPY = [...strings(HUB_COPY), ...strings(HUB_GATE_COPY)];

describe('copy centralization — every user-visible string is in a copy table', () => {
  it('no file under src/components/CommandCenter/ writes copy in place', () => {
    const files = hubSourceFiles();
    expect(files.length, 'the walk found nothing, so this row would be vacuous').toBeGreaterThan(20);
    const hits = files.flatMap((rel) => literalCopyIn(stripComments(read(rel))).map((h) => `${rel} — ${h}`));
    expect(hits).toEqual([]);
  });

  it('the scan is not vacuous: it flags each way copy can be written in place', () => {
    for (const planted of [
      '<p>Checking your games</p>',
      '<span>Ready to deploy<Icon name="x" /></span>',
      "<span>{'Hold to deploy'}</span>",
      '<button aria-label="Close">',
      '<HubButton ariaLabel={"Not now"}>',
      '<HubSheet title={`Completed games`} />',
      '<Row label="Game history" />',
    ]) {
      expect(literalCopyIn(planted), planted).not.toEqual([]);
    }
    // ...and leaves alone what is not copy.
    for (const fine of ['<span>{COPY.games.loading}</span>', "<span>{' '}</span>", '<div data-hub="shell" />', 'a > b && c < d', '{ready && rows.length > limit && (\n<div><HubLink />', '<stop id={`h${uid}`} />', '<circle fill={`url(#h${uid})`} />']) {
      expect(literalCopyIn(fine), fine).toEqual([]);
    }
  });
});

describe('the spec\'s own strings, exactly', () => {
  it('Partnership\'s reserved line (spec §8.3)', () => {
    expect(HUB_COPY.partnership.reserved).toBe("Partnership isn't part of this release. A preference will only ever stand once you confirm it.");
  });

  it('the hold helper lines (spec §5.5)', () => {
    expect(HUB_COPY.deploy.pointerHelp).toBe('Hold for 1.3 s. Release before the hold completes to cancel.');
    expect(HUB_COPY.deploy.keyboardHelp).toBe('Or press Enter or Space to deploy now.');
  });

  it('the initial lines (spec §3) and the activity heading (§8.2) and the career caption (§7)', () => {
    expect(HUB_COPY.games.loading).toBe('Checking your games');
    expect(HUB_COPY.deploy.states.checking).toBe('Checking eligibility…');
    expect(HUB_COPY.activity.label).toBe('Recent activity · your last 10 games and current loadout');
    expect(HUB_COPY.history.careerCaption).toBe('career · BaggerBomb vs CPU · as recorded');
  });

  it('the design\'s words where the spec keeps them: the areas, the tabs, Shadow\'s name line, the idle status', () => {
    expect(HUB_COPY.areas.names).toEqual(['Partnership', 'Shared Research', 'Equipped Archetype']);
    expect([HUB_COPY.phoneTabs.overview, HUB_COPY.phoneTabs.research, HUB_COPY.phoneTabs.partnership, HUB_COPY.phoneTabs.loadout])
      .toEqual(['Overview', 'Research', 'Partnership', 'Loadout']);
    expect(`${HUB_COPY.shadow.name} · ${HUB_COPY.shadow.role}`).toBe('Shadow · your research partner');
    expect(HUB_COPY.shadow.statusIdle).toBe('Idle · nothing running');
    expect(HUB_COPY.header.title).toBe('Command Center');
  });
});

describe('no claim the hub cannot back (spec §8.2, §11.3)', () => {
  const BANNED = [
    /\blearn/i, /\bimprov/i, /\bintelligen/i, /\bsmart(er)?\b/i, /\bearned\b/i, /\btier\b/i, /getting better/i,
    /\bevolv/i, /\bgrow(s|th|ing)?\b/i, /since your last visit/i, /\blevel(s|led)? up\b/i, /\bunlock/i,
    /\bsources?\s*·\s*\d/i, /\bremembers?\b/i, /\bTester\b/, /\bsimulat/i, /\bprototype\b/i, /\billustrative\b/i,
  ];

  it('no string in either copy table matches a banned claim', () => {
    const hits = ALL_COPY.flatMap((s) => BANNED.filter((re) => re.test(s)).map((re) => `${re.source}: ${s}`));
    expect(hits).toEqual([]);
  });

  it('the banned list catches what it names', () => {
    for (const s of ['Shadow learned your style', 'Shadow is improving', 'Since your last visit', 'Sources · 4', 'Tuesday, October 7 · Tester', 'Simulated sequence']) {
      expect(BANNED.some((re) => re.test(s)), s).toBe(true);
    }
  });

  it('no copy carries a count the hub does not hold: the only numbers written are the spec\'s 1.3 s and 10 games', () => {
    const numbers = ALL_COPY.flatMap((s) => s.replace(/ARG\d+/g, '').match(/\d+(\.\d+)?/g) || []);
    expect([...new Set(numbers)].sort()).toEqual(['1.3', '10']);
  });
});

describe('display agreement with the shipped hold (BUILD_RULES §9)', () => {
  it('the copy\'s 1.3 s is the shipped useHoldToDeploy HOLD_MS (1,300 ms)', () => {
    const hook = read('src/hooks/useHoldToDeploy.js');
    expect(hook).toMatch(/\nconst HOLD_MS = 1300;\n/);
    expect(HUB_COPY.deploy.pointerHelp).toContain(`${(1300 / 1000).toFixed(1)} s`);
  });
});
