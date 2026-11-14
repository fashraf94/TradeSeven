// Shared Research B2 — THE COPY GUARD (build prompt K-5; spec §7.1, §7.3; ruling P-5).
//   - every SR_COPY string passes the hub's banned list (restated here and pinned to
//     hubCopy.guard.test.js's own text), plus "Shadow", "confidence" and "%";
//   - the lines held for answers without a `message` are the server's (copy.js), word for word;
//   - the gated line is the hub's (hubCopy.js research.disabled — spec §4.1's hubCopy.js:145);
//   - the honest line is REVIEW_HONEST_LINE with the agent's name, plus the research-to-game line;
//   - the screens write no words of their own: no JSX text, aria-label, placeholder or title literal
//     with a letter in it — every word is SR_COPY's, the shared vocabulary's or the server's.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SR_COPY } from './sharedResearchCopy';
import { SR_SERVER_COPY } from '../../../api/_utils/sharedResearch/copy.js';
import { HUB_COPY } from '../CommandCenter/hub/hubCopy';
import { REVIEW_HONEST_LINE } from '../../constants/hypothesisRecords';
// Comments out; strings, templates and regex literals kept whole (review d3: a '/*' inside a string swallowed code).
import { stripComments } from './__fixtures__/sourceText';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

// The hub's banned list, as hubCopy.guard.test.js:375-379 writes it (pinned below), plus this sheet's three.
const HUB_BANNED = [
  /\blearn/i, /\bimprov/i, /\bintelligen/i, /\bsmart(er)?\b/i, /\bearned\b/i, /\btier\b/i, /getting better/i,
  /\bevolv/i, /\bgrow(s|th|ing)?\b/i, /since your last visit/i, /\blevel(s|led)? up\b/i, /\bunlock/i,
  /\bsources?\s*·\s*\d/i, /\bremembers?\b/i, /\bTester\b/, /\bsimulat/i, /\bprototype\b/i, /\billustrative\b/i,
];
const OURS = [/Shadow/, /confidence/i, /%/];
const BANNED = [...HUB_BANNED, ...OURS];

/** Every string SR_COPY can produce: values, and each function called with placeholder arguments. */
function copyStrings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'function') {
    const arity = Math.max(node.length, 1);
    for (const args of [Array(arity).fill('ARG'), Array(arity).fill(1), Array(arity).fill(2), Array(arity).fill(['Apple Inc.'])]) {
      try { copyStrings(node(...args), out); } catch { /* a placeholder of the wrong type */ }
    }
  } else if (Array.isArray(node)) node.forEach((v) => copyStrings(v, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => copyStrings(v, out));
  return out;
}
const ALL = copyStrings(SR_COPY);

describe('the copy table (K-5)', () => {
  it('the walk is alive', () => {
    expect(ALL.length).toBeGreaterThan(150);
  });
  it('no string matches a banned claim, "Shadow", "confidence" or "%"', () => {
    const hits = ALL.flatMap((s) => BANNED.filter((re) => re.test(s)).map((re) => `${re.source}: ${s}`));
    expect(hits).toEqual([]);
  });
  it('the banned list catches what it names (a planted line each)', () => {
    for (const s of ['Your agent learned this', 'Shadow found it', 'High confidence', 'Up 62%', 'Since your last visit', 'It is improving']) {
      expect(BANNED.some((re) => re.test(s)), s).toBe(true);
    }
  });
  it('the hub\'s part is the hub\'s list, word for word (hubCopy.guard.test.js)', () => {
    const src = readFileSync(resolve(HERE, '../CommandCenter/hubCopy.guard.test.js'), 'utf8');
    const block = /const BANNED = \[([\s\S]*?)\];/.exec(src)[1];
    const theirs = [...block.matchAll(/\/((?:\\\/|[^/\n])+)\/([a-z]*)/g)].map((m) => `/${m[1]}/${m[2]}`);
    expect(theirs).toEqual(HUB_BANNED.map(String));
  });
});

describe('words held from elsewhere, pinned equal (ruling P-5; spec §4.1)', () => {
  it('each line held for an answer with no message is the server\'s copy.js line, word for word', () => {
    for (const [code, line] of Object.entries(SR_COPY.server)) expect(line, code).toBe(SR_SERVER_COPY[code]);
    expect(Object.keys(SR_COPY.server).sort()).toEqual(['budget_spent', 'daily_limit', 'findings_full', 'frame_failed', 'framing_limit', 'step_failed', 'step_limit']);
  });
  it('the gated line is the hub\'s', () => {
    expect(SR_COPY.gated).toBe(HUB_COPY.research.disabled);
  });
  it('the honest line is REVIEW_HONEST_LINE with the agent\'s name, then the research-to-game line', () => {
    expect(SR_COPY.honest('Atlas')).toBe(`${REVIEW_HONEST_LINE.replace('[AGENT]', 'Atlas')} A link between research and a game is shown only once the game records it.`);
    expect(SR_COPY.honest(SR_COPY.agentFallback).startsWith('Your agent ')).toBe(true);
  });
  it('the agent\'s fallback is "your agent" — never a name', () => {
    expect(SR_COPY.agentFallback).toBe('your agent');
  });
});

const sourceFiles = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__fixtures__') sourceFiles(p, out); } else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
};
/** Literal words in JSX: text between tags, and the accessible-name attributes written as plain strings. */
export function literalWordsOf(code) {
  const c = stripComments(code);
  const text = [...c.matchAll(/>([^<>{}()=;]*[A-Za-z][^<>{}()=;]*)</g)].map((m) => m[1].trim()).filter(Boolean);
  const attrs = [...c.matchAll(/\b(aria-label|placeholder|title|alt)="([^"]*[A-Za-z][^"]*)"/g)].map((m) => `${m[1]}="${m[2]}"`);
  return [...text, ...attrs];
}

describe('the screens write no words of their own', () => {
  const files = sourceFiles(HERE).filter((p) => p.endsWith('.jsx'));
  it('the scan reads the body, the parts and every screen', () => {
    expect(files.map((p) => relative(HERE, p).replace(/\\/g, '/')).sort()).toEqual([
      'SharedResearchSheetBody.jsx', 'parts.jsx', 'screens/Adopt.jsx', 'screens/Discard.jsx', 'screens/Framing.jsx', 'screens/Previews.jsx', 'screens/Start.jsx', 'screens/Work.jsx',
    ]);
  });
  it.each(files.map((p) => [relative(REPO, p).replace(/\\/g, '/'), p]))('%s: no JSX text or name attribute with a letter', (_rel, p) => {
    expect(literalWordsOf(readFileSync(p, 'utf8'))).toEqual([]);
  });
  it('the scan bites (planted)', () => {
    expect(literalWordsOf('return <p>Investigate this</p>;')).toEqual(['Investigate this']);
    expect(literalWordsOf('return <input placeholder="Type here" />;')).toEqual(['placeholder="Type here"']);
    expect(literalWordsOf('return <p>{COPY.x} · {COPY.y}</p>;')).toEqual([]);
  });
  it('no file in the directory names "Shadow"', () => {
    const named = sourceFiles(HERE).filter((p) => /Shadow/.test(stripComments(readFileSync(p, 'utf8'))));
    expect(named).toEqual([]);
  });
});
