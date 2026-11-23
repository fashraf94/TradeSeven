// src/components/Explore/explore.guard.test.js
//
// Explore Build 1 — THE GUARDS THE BUILD ADDS (spec §7; build prompt K-3, K-13, K-15).
//   the boundary  nothing under src/components/Explore/ imports from src/components/CommandCenter/; the ONLY load of
//                 the sheet's body is ./loadSharedResearch.js (one load-time import(), nothing else of the directory);
//                 the ONLY importer of the research service is ./useExploreResearch.js, taking exactly
//                 { readExploreInvestigations }; no other Explore file names the sheet's directory in a string
//   the words     exploreCopy.js holds none of the investigation's own labels or the sheet's banned promises (E-1);
//                 its gated line is the hub's, word for word; the sheet host's lines are the hub wrapper's
//   the look      no hex color and no inline `transition={{` literal in any Explore file (BUILD_RULES §10, §11);
//                 every screen's words come from exploreCopy.js (no string children in JSX)
// The sheet's own boundary test (SharedResearch/sharedResearch.boundary.test.js) holds the same doors from its side,
// unedited. Its two scanners are restated below (importing a test file would run its rows here); the comment strip is
// its fixture's (test files may import it).

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import { stripComments } from '../SharedResearch/__fixtures__/sourceText';
import { HUB_COPY } from '../CommandCenter/hub/hubCopy';
import { EXPLORE_COPY } from './exploreCopy';

/** Every module specifier a file names (static, re-export, bare, dynamic, glob, require) — the sheet's scan, restated. */
function specifiersOf(text) {
  const c = stripComments(text);
  return [
    ...[...c.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\bimport\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\bimport\.meta\.glob\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\brequire\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
  ];
}
/** The string literals in the code that contain `fragment`. */
function namesInStrings(text, fragment) {
  const c = stripComments(text);
  return [...c.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]).filter((s) => s.includes(fragment));
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const rel = (p) => relative(REPO, p).replace(/\\/g, '/');
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
const isTest = (p) => /\.test\./.test(p);
const OURS = walk(HERE).filter((p) => !isTest(p));
const code = (p) => readFileSync(p, 'utf8');
const resolveFrom = (file, spec) => (spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(rel(file)), spec)) : spec.startsWith('@/') ? posix.join('src', spec.slice(2)) : spec.startsWith('/src/') ? spec.slice(1) : spec);
const targetsOf = (p, text = code(p)) => specifiersOf(text).map((s) => resolveFrom(p, s));
const LOADER = 'src/components/Explore/loadSharedResearch.js';
const READER = 'src/components/Explore/useExploreResearch.js';
const SERVICE = /^src\/services\/sharedResearchService(\.js)?$/;

/** The boundary's problems over Explore's files ({ rel, code }): none when it holds. */
export function exploreBoundaryProblemsOf(files) {
  const problems = [];
  for (const f of files) {
    const p = resolve(REPO, f.rel);
    const targets = targetsOf(p, f.code);
    if (targets.some((t) => t.startsWith('src/components/CommandCenter'))) problems.push(`imports the hub: ${f.rel}`);
    if (namesInStrings(f.code, 'CommandCenter/').length) problems.push(`names the hub in a string: ${f.rel}`);
    const sheet = targets.filter((t) => t.startsWith('src/components/SharedResearch'));
    if (f.rel === LOADER) {
      if (JSON.stringify(specifiersOf(f.code)) !== JSON.stringify(['../SharedResearch/SharedResearchSheetBody.jsx'])) problems.push(`the loader imports more than the body: ${f.rel}`);
      if (!stripComments(f.code).includes("import('../SharedResearch/SharedResearchSheetBody.jsx')")) problems.push(`the loader does not import() the body: ${f.rel}`);
    } else {
      if (sheet.length) problems.push(`loads the sheet's directory: ${f.rel}`);
      if (namesInStrings(f.code, 'SharedResearch/').length) problems.push(`names the sheet's directory in a string: ${f.rel}`);
    }
    const service = targets.filter((t) => SERVICE.test(t));
    if (f.rel === READER) {
      const clauses = [...stripComments(f.code).matchAll(/\bimport\b\s*([^'"`;]*?)\s*\bfrom\s*['"`]([^'"`]+)['"`]/g)].filter((m) => SERVICE.test(resolveFrom(p, m[2]))).map((m) => m[1].replace(/\s+/g, ''));
      if (service.length !== 1 || JSON.stringify(clauses) !== JSON.stringify(['{readExploreInvestigations}'])) problems.push(`the reader imports more of the service than its read: ${f.rel}`);
    } else if (service.length) problems.push(`imports the research service: ${f.rel}`);
    if (f.rel !== READER && namesInStrings(f.code, 'sharedResearchService').length) problems.push(`names the research service in a string: ${f.rel}`); // review D-5
  }
  return problems;
}

describe('the boundary (K-3)', () => {
  const files = OURS.map((p) => ({ rel: rel(p), code: code(p) }));
  it('the walk is alive: the runtime, the tab, the screens, the host, the loader, the reader, the copy, the fixtures', () => {
    const names = files.map((f) => f.rel.replace('src/components/Explore/', ''));
    expect(names).toEqual(expect.arrayContaining([
      'ExploreRuntime.jsx', 'ExploreTab.jsx', 'ExploreHome.jsx', 'ExploreStory.jsx', 'ExplorePanel.jsx', 'ExploreQuestions.jsx', 'ExploreSearch.jsx',
      'ExplorePinnedBar.jsx', 'ExploreSheetHost.jsx', 'loadSharedResearch.js', 'useExploreResearch.js', 'exploreCopy.js', 'exploreView.js',
      'exploreSources.js', 'exploreStyle.js', 'exploreParts.jsx', '__fixtures__/stories.js', '__fixtures__/exploreKit.js',
    ]));
  });
  it('holds on the real files', () => {
    expect(exploreBoundaryProblemsOf(files)).toEqual([]);
  });
  it('the scan bites (planted, one file at a time)', () => {
    const at = (r) => files.map((f) => (f.rel === `src/components/Explore/${r[0]}` ? { ...f, code: r[1] } : f));
    for (const planted of [
      ['ExploreHome.jsx', "import { HUB_COPY } from '../CommandCenter/hub/hubCopy';"],
      ['ExploreHome.jsx', "const H = () => import('../CommandCenter/HubSheet');"],
      ['ExploreTab.jsx', "const B = () => import('../SharedResearch/SharedResearchSheetBody.jsx');"],
      ['exploreCopy.js', "export { SR_COPY } from '../SharedResearch/sharedResearchCopy';"],
      ['ExplorePanel.jsx', "import { openInvestigation } from '../../services/sharedResearchService';"],
      ['ExploreSearch.jsx', "import { readExploreInvestigations } from '../../services/sharedResearchService';"],
      ['__fixtures__/stories.js', "const where = '../SharedResearch/__fixtures__/answers.json';"],
      ['useExploreResearch.js', "import { readExploreInvestigations, takeStep } from '../../services/sharedResearchService';"],
      ['useExploreResearch.js', "import * as svc from '../../services/sharedResearchService';"],
      ['ExploreTab.jsx', "const where = '../../services/sharedResearchService';"],
      ['loadSharedResearch.js', "let p = null;\nexport function loadSharedResearch() { return import('../SharedResearch/SharedResearchSheetBody.jsx'); }\nexport { SR_COPY } from '../SharedResearch/sharedResearchCopy';"],
    ]) {
      expect(exploreBoundaryProblemsOf(at(planted)).length, planted.join(' :: ')).toBeGreaterThan(0);
    }
  });
});

/** Props whose value a player can read or hear: any aria-* word, a placeholder, a title, an alt, a label. */
const shownProp = (name) => typeof name === 'string' && (/^aria-(label|description|roledescription|valuetext|placeholder)$/.test(name) || ['placeholder', 'title', 'alt', 'label'].includes(name));
const literalText = (v) => (v?.type === 'StringLiteral' ? v.value : v?.type === 'TemplateLiteral' ? v.quasis.map((q) => q.value.cooked).join('') : null);
/**
 * The words a JSX file writes itself (review A-8): JSX text with a letter; a string or template literal standing as a
 * JSX child (`{'Words'}`); and a shown prop given a letter literal, bare or in braces (`label="…"`, `aria-label={'…'}`).
 */
function wordsWrittenIn(text) {
  const out = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXText' && /[A-Za-z]/.test(node.value)) out.push(node.value.trim());
    if ((node.type === 'JSXElement' || node.type === 'JSXFragment') && Array.isArray(node.children)) {
      for (const c of node.children) {
        const t = c.type === 'JSXExpressionContainer' ? literalText(c.expression) : null;
        if (t && /[A-Za-z]/.test(t)) out.push(t);
      }
    }
    if (node.type === 'JSXAttribute' && shownProp(node.name?.name)) {
      const t = node.value?.type === 'JSXExpressionContainer' ? literalText(node.value.expression) : literalText(node.value);
      if (t && /[A-Za-z]/.test(t)) out.push(`${node.name.name}="${t}"`);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(parse(text, { sourceType: 'module', plugins: ['jsx'] }).program);
  return out;
}

/** The words the page must never use (E-1; the sheet's banned promises, K-13). */
const BANNED = [/supported/i, /source-backed/i, /verified/i, /confirmed/i, /confidence/i, /shadow/i, /watched/i, /will sell/i, /sells at/i, /holds it/i, /held for/i, /expire/i];

describe('the words (K-13, E-1)', () => {
  const copy = readFileSync(join(HERE, 'exploreCopy.js'), 'utf8');
  it.each(BANNED.map((b) => [String(b), b]))('exploreCopy.js never says %s', (_n, b) => {
    expect(b.test(copy)).toBe(false);
  });
  it('the banned list bites (planted)', () => {
    for (const word of ['Supported', 'Source-backed', 'Verified', 'Confirmed', 'confidence 80%', 'Shadow', 'watched', 'it will sell', 'sells at', 'holds it', 'held for', 'expires']) {
      expect(BANNED.some((b) => b.test(`x ${word} y`)), word).toBe(true);
    }
  });
  it('the gated line is the hub\'s research.disabled, word for word; its second line is the prompt\'s', () => {
    expect(EXPLORE_COPY.panel.gated).toBe(HUB_COPY.research.disabled);
    expect(EXPLORE_COPY.panel.gatedNote).toBe('You can read the stories; starting an investigation needs research access.');
  });
  it('the sheet host\'s lines are the hub wrapper\'s (loading, failed load, Try again)', () => {
    expect(EXPLORE_COPY.sheet.loading).toBe(HUB_COPY.research.loading);
    expect(EXPLORE_COPY.sheet.loadFailed).toBe(HUB_COPY.research.door.loadFailed);
    expect(EXPLORE_COPY.sheet.tryAgain).toBe(HUB_COPY.research.door.tryAgain);
    expect(EXPLORE_COPY.sheet.title).toBe(HUB_COPY.research.workTitle);
  });
  it('the spec\'s fixed lines, as approved (SQ-1 to SQ-4)', () => {
    expect(EXPLORE_COPY.home.intro).toBe('Start with a question. Research begins only when you choose to work one.');
    expect(EXPLORE_COPY.panel.cost(3, 1)).toBe('Uses 1 of your 3 investigations today · 1 used');
    expect(EXPLORE_COPY.panel.limit(3)).toBe("You've used today's 3 investigations. Save this story and start it tomorrow.");
    expect(EXPLORE_COPY.panel.onePerStory).toBe('One investigation per story. Continue this one to take it further.');
    expect(Object.values(EXPLORE_COPY.story.basis)).toEqual(['Source cited', "Reporter's reading", 'No source yet']);
  });
  it('the founder\'s lines of Nov 22, word for word (SQ-7: "its source"; SQ-8: search at the daily limit)', () => {
    expect(EXPLORE_COPY.panel.startsFirstStep).toBe("Your agent's first step checks the story against its source.");
    expect(EXPLORE_COPY.search.limit(3)).toBe("You've used today's 3 investigations. Try this one tomorrow.");
    expect(EXPLORE_COPY.search.limit(7)).toBe("You've used today's 7 investigations. Try this one tomorrow.");
  });
  it('"What starts with it" never says that the sources or the company leads travel into the investigation (spec §4, N-3)', () => {
    const starts = [EXPLORE_COPY.panel.startsQuestion, EXPLORE_COPY.panel.startsFirstStep, EXPLORE_COPY.panel.startsCompanies].join(' ');
    expect(starts).not.toMatch(/lead|scope|carr(y|ies)|comes with|source references/i);
    expect(copy).not.toMatch(/What comes with it/);
  });
  it('no screen writes its own words: no JSX text, and no visible attribute given as a literal, holds a letter', () => {
    for (const p of OURS.filter((x) => /.jsx$/.test(x))) expect(wordsWrittenIn(code(p)), rel(p)).toEqual([]);
  });
  it('the words scan bites (planted)', () => {
    expect(wordsWrittenIn('export const X = () => <p aria-label="Close it">Hello there</p>;').sort()).toEqual(['Hello there', 'aria-label="Close it"']);
    expect(wordsWrittenIn('export const X = () => <p aria-label={COPY.x}>{COPY.y}</p>;')).toEqual([]);
    // review A-8's evasions, each now caught
    for (const planted of [
      "export const X = () => <p>{'Supported'}</p>;",
      'export const X = () => <p>{`Source-backed`}</p>;',
      "export const X = () => <p aria-label={'Verified'} />;",
      'export const X = () => <p aria-description="Confirmed" />;',
      'export const X = () => <SaveToggle label="Supported" />;',
      "export const X = () => <Tag>{'Source-backed'}</Tag>;",
      "export const X = () => <>{'Words'}</>;",
    ]) expect(wordsWrittenIn(planted).length, planted).toBeGreaterThan(0);
  });
});

describe('the build\'s files outside Explore stay outside the sheet too (K-3; refuter on D-5)', () => {
  const OTHERS = ['src/components/Search/SearchDiscover.jsx', 'src/components/Search/SearchOverlay.jsx', 'src/components/Search/companyMatch.js', 'src/components/Navigation/BottomNav.jsx', 'src/components/Navigation/DesktopSidebar.jsx', 'src/config/exploreFlags.js'];
  it.each(OTHERS)('%s imports neither the sheet nor the service, nor names either in a string', (r) => {
    const p = resolve(REPO, r);
    const text = readFileSync(p, 'utf8');
    const targets = targetsOf(p, text);
    expect(targets.filter((t) => t.startsWith('src/components/SharedResearch') || SERVICE.test(t))).toEqual([]);
    expect([...namesInStrings(text, 'SharedResearch/'), ...namesInStrings(text, 'sharedResearchService')]).toEqual([]);
  });
});

describe('the bookmark document and its rules block agree (review D-7)', () => {
  it('the title bound is the rules\' bound, and the four keys are the rules\' four', async () => {
    const rules = readFileSync(resolve(REPO, 'firestore.rules'), 'utf8');
    const { BOOKMARK_TITLE_MAX } = await import('./exploreView');
    expect(rules).toContain(`request.resource.data.title.size() <= ${BOOKMARK_TITLE_MAX}`);
    expect(rules).toContain("request.resource.data.keys().hasOnly(['storyId', 'storyVersion', 'title', 'savedAt'])");
    const src = readFileSync(join(HERE, 'exploreSources.js'), 'utf8');
    expect(src).toMatch(/storyId: story\.id,\s*storyVersion: story\.version,\s*title: story\.title\.slice\(0, BOOKMARK_TITLE_MAX\),\s*savedAt: serverTimestamp\(\),/);
  });
});

describe('the look (BUILD_RULES §10, §11; K-15)', () => {
  it.each(OURS.map((p) => [rel(p), p]))('%s holds no hex color and no inline transition literal', (_r, p) => {
    const c = stripComments(code(p));
    expect(c.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(c).not.toMatch(/transition=\{\{/);
  });
  it('no box of the page scrolls on its own (E-4, N-6): the page\'s rules set no overflow scroll, no height cap, no sticky', async () => {
    const { EXPLORE_CSS } = await import('./exploreStyle');
    const rules = EXPLORE_CSS.replace(/\s+/g, ' ');
    expect(rules).not.toMatch(/overflow(-y|-x)?\s*:\s*(auto|scroll)/);
    expect(rules).not.toMatch(/max-height|position\s*:\s*sticky/);
    for (const p of OURS.filter((x) => /Explore(Home|Story|Panel|Questions|Search|Tab)\.jsx$/.test(x))) {
      expect(stripComments(code(p)), rel(p)).not.toMatch(/overflow[XY]?\s*:\s*'(auto|scroll)'|maxHeight|position\s*:\s*'sticky'/);
    }
  });
  it('the scan bites (planted)', () => {
    expect('color: \'#5eead4\''.match(/#[0-9a-fA-F]{3,8}\b/g)).not.toBeNull();
    expect('<motion.div transition={{ duration: 0.2 }} />').toMatch(/transition=\{\{/);
  });
});
