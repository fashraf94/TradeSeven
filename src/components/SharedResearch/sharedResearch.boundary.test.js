// Shared Research B2 — THE BOUNDARY AND THE DARK GUARANTEE (build prompt K-2, K-3,
// STOP list; founder ruling P-1).
//   - no non-test file under src/components/SharedResearch/ imports from
//     src/components/CommandCenter/ (the hub's mount guard walks every such file; the
//     wrapper, HUB_SHEETS and the guard rows are the hub amendment's);
//   - nothing in the app imports the sheet (dark): no src/ file outside this
//     directory names it, test files aside;
//   - the body reaches the network only through src/services/sharedResearchService.js,
//     and that service only through fetchWithAuth and the two existing equip calls —
//     no model or provider anywhere here;
//   - SR_DROP_LAYER sits above the hub sheet (hub/hubStyle.js HUB_LAYERS.sheet) and
//     below the deploy ceremony (DeployCeremony.jsx Z_INDEX).

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SR_DROP_LAYER } from './sharedResearchStyle';
import { HUB_LAYERS } from '../CommandCenter/hub/hubStyle';
// Comments out; strings, templates and regex literals kept whole (review d3: a '/*' inside a string swallowed code).
import { stripComments } from './__fixtures__/sourceText';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const rel = (p) => relative(REPO, p).replace(/\\/g, '/');
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p, out); } else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
const isTest = (p) => /\.test\./.test(p);
/**
 * Every module specifier a file names — static imports and re-exports (spaced or not), bare imports, dynamic import()
 * (quotes or backticks, with or without options), import.meta.glob() and require() (review d2). The rows below back it
 * with a literal scan: any string naming the directory counts, however it would be used.
 */
export function specifiersOf(code) {
  const c = stripComments(code);
  return [
    ...[...c.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\bimport\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\bimport\.meta\.glob\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...c.matchAll(/\brequire\s*\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
  ];
}
/** The string literals in the code (quotes or backticks) that contain `fragment` — the backstop for forms a scan misses. */
export function namesInStrings(code, fragment) {
  const c = stripComments(code);
  return [...c.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]).filter((s) => s.includes(fragment));
}
const resolveFrom = (file, spec) => {
  if (spec.startsWith('@/')) return posix.join('src', spec.slice(2));
  if (spec.startsWith('/src/')) return spec.slice(1); // root-absolute: Vite resolves it from the project root
  if (!spec.startsWith('.')) return spec;
  return posix.normalize(posix.join(posix.dirname(rel(file)), spec));
};

const OURS = walk(HERE).filter((p) => !isTest(p));

describe('the boundary (K-2)', () => {
  it('the walk is alive: the body, the hook, the copy, the view, the style, the parts, six screens, the kit', () => {
    expect(OURS.length).toBeGreaterThanOrEqual(13);
  });
  it.each(OURS.map((p) => [rel(p), p]))('%s imports nothing from src/components/CommandCenter/', (_r, p) => {
    const into = specifiersOf(readFileSync(p, 'utf8')).map((s) => resolveFrom(p, s)).filter((t) => t.startsWith('src/components/CommandCenter'));
    expect(into).toEqual([]);
  });
  it('the scan bites (planted)', () => {
    const body = join(HERE, 'SharedResearchSheetBody.jsx');
    for (const planted of [
      "import { HUB_COPY } from '../CommandCenter/hub/hubCopy';", "const H = () => import('../CommandCenter/HubSheet');",
      "export { useHubOverlays } from '@/components/CommandCenter/hub/HubOverlays';", 'const H = () => import(`../CommandCenter/HubSheet`);',
      "import{HUB_COPY}from'../CommandCenter/hub/hubCopy';", "export*from'../CommandCenter/hub/hubCopy';",
      "import X from '/src/components/CommandCenter/HubSheet';", "const m = import.meta.glob('../CommandCenter/*.jsx');",
      "const H = () => import('../CommandCenter/HubSheet', { with: {} });",
    ]) {
      expect(specifiersOf(planted).map((s) => resolveFrom(body, s)).some((t) => t.startsWith('src/components/CommandCenter')), planted).toBe(true);
    }
  });
  it.each(OURS.map((p) => [rel(p), p]))('%s names no hub path in any string', (_r, p) => {
    expect(namesInStrings(readFileSync(p, 'utf8'), 'CommandCenter/')).toEqual([]);
  });
});

describe('dark by construction (K-3)', () => {
  it('no src/ file outside this directory imports it, test files aside', () => {
    const outside = walk(resolve(REPO, 'src')).filter((p) => !isTest(p) && !rel(p).startsWith('src/components/SharedResearch/'));
    expect(outside.length).toBeGreaterThan(500);
    // A cheap text filter first: a file that never writes the directory's name cannot import it (the src walk is slow).
    const importers = outside.map((p) => [p, readFileSync(p, 'utf8')]).filter(([, c]) => c.includes('SharedResearch'))
      .filter(([p, c]) => specifiersOf(c).map((s) => resolveFrom(p, s)).some((t) => t.startsWith('src/components/SharedResearch')));
    expect(importers.map(([p]) => rel(p))).toEqual([]);
    // …and no string outside names the directory, whatever form would load it (review d2: backticks, globs, '/src/…')
    const naming = outside.map((p) => [p, readFileSync(p, 'utf8')]).filter(([, c]) => c.includes('SharedResearch/'))
      .filter(([, c]) => namesInStrings(c, 'SharedResearch/').length > 0);
    expect(naming.map(([p]) => rel(p))).toEqual([]);
  }, 30_000);
  it('the dark scans bite (planted: a backtick lazy import, a root-absolute import, a glob)', () => {
    const discover = resolve(REPO, 'src/components/discover/DiscoverPanel.jsx');
    for (const planted of [
      'const B = () => import(`../SharedResearch/SharedResearchSheetBody`);',
      "import B from '/src/components/SharedResearch/SharedResearchSheetBody';",
      "const all = import.meta.glob('../SharedResearch/*.jsx');",
      // review d3: a '/*' in the glob's own string, or in a line comment, before a later real block comment
      "const all = import.meta.glob('../SharedResearch/*.jsx');\n/** a later doc comment */\nexport default all;",
      "// see ParamControls/* below\nimport B from '../SharedResearch/SharedResearchSheetBody';\n/* end */",
    ]) {
      expect(specifiersOf(planted).map((s) => resolveFrom(discover, s)).some((t) => t.startsWith('src/components/SharedResearch')), planted).toBe(true);
      expect(namesInStrings(planted, 'SharedResearch/').length, planted).toBeGreaterThan(0);
    }
  });
  it('the comment strip keeps strings, templates and regex literals whole (review d3)', () => {
    expect(stripComments("a('x/*y'); /* gone */ b(`p//q`); // gone\nc(/[/*]+/g, 1 / 2); /* gone */")).toBe("a('x/*y');   b(`p//q`); \nc(/[/*]+/g, 1 / 2);  ");
    expect(stripComments("return /'/.test(s) ? 'a' : 'b'; // gone")).toBe("return /'/.test(s) ? 'a' : 'b'; ");
    expect(stripComments('<p>a</p> {/* gone */}<X a={b}/> // gone\r\nnext')).toBe('<p>a</p> { }<X a={b}/> \r\nnext'); // JSX: no false regex
  });
  it('nothing outside the directory reaches the service either (the body is its one importer)', () => {
    const files = walk(resolve(REPO, 'src')).filter((p) => !isTest(p));
    const importers = files.map((p) => [p, readFileSync(p, 'utf8')]).filter(([, c]) => c.includes('sharedResearchService'))
      .filter(([p, c]) => specifiersOf(c).map((s) => resolveFrom(p, s)).some((t) => /src\/services\/sharedResearchService(\.js)?$/.test(t)));
    expect(importers.map(([p]) => rel(p))).toEqual(['src/components/SharedResearch/useSharedResearch.js']);
  }, 30_000);
});

describe('the network: one service, no model or provider (STOP list)', () => {
  it('only the service names fetch or a route; the service names fetchWithAuth and the two equip calls only', () => {
    for (const p of OURS.filter((x) => !x.includes('__fixtures__'))) { // the kit is the rows' fake route
      const c = stripComments(readFileSync(p, 'utf8'));
      expect(/\bfetch\s*\(|XMLHttpRequest|\/api\//.test(c), rel(p)).toBe(false);
    }
    const svc = readFileSync(resolve(REPO, 'src/services/sharedResearchService.js'), 'utf8');
    expect(specifiersOf(svc).sort()).toEqual(['../utils/fetchWithAuth', './hypothesisVersionService', './loadoutService']);
    expect([...stripComments(svc).matchAll(/'(\/api\/[^'?]+)/g)].map((m) => m[1])).toEqual(['/api/forge/shared-research']);
  });
  it('no model, provider or SDK is named anywhere in the directory or the service', () => {
    for (const p of [...OURS, resolve(REPO, 'src/services/sharedResearchService.js')]) {
      expect(/anthropic|claude-|openrouter|exa\.ai|queryExa|messages\.create/i.test(stripComments(readFileSync(p, 'utf8'))), rel(p)).toBe(false);
    }
  });
});

describe('the drop modal\'s layer (ruling P-1)', () => {
  it('SR_DROP_LAYER is above the hub sheet and below the deploy ceremony', () => {
    const ceremony = Number(/const Z_INDEX = (\d+);/.exec(readFileSync(resolve(REPO, 'src/components/Dashboard/deployCeremony/DeployCeremony.jsx'), 'utf8'))[1]);
    expect(SR_DROP_LAYER).toBeGreaterThan(HUB_LAYERS.sheet);
    expect(SR_DROP_LAYER).toBeLessThan(ceremony);
    expect(SR_DROP_LAYER).toBe(1001);
  });
  it('the body passes it, and "Investigate this", to the one SignalDropEntry it mounts', () => {
    const body = stripComments(readFileSync(join(HERE, 'SharedResearchSheetBody.jsx'), 'utf8'));
    expect(body.match(/<SignalDropEntry\b[^>]*>/g)).toEqual([expect.stringMatching(/ctaLabel=\{COPY\.investigateCta\}.*zIndex=\{SR_DROP_LAYER\}/)]);
  });
});
