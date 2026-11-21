// Shared Research B2 — THE BOUNDARY AND THE DARK GUARANTEE (build prompt K-2, K-3,
// STOP list; founder ruling P-1).
//   - no non-test file under src/components/SharedResearch/ imports from
//     src/components/CommandCenter/ (the hub's mount guard walks every such file; the
//     wrapper, HUB_SHEETS and the guard rows are the hub amendment's);
//   - the sheet has TWO doors (Command Center Amendment E V1.1 §3.2, E-2; ruling R-D3; B6a X-6):
//     the src/ files outside this directory that import it, and those whose strings name the
//     directory, are src/components/CommandCenter/hub/loadSharedResearch.js and, once the
//     Explore build adds it, src/components/Explore/loadSharedResearch.js — each one
//     load-time import() of the body — test files aside; a third fails;
//   - the service has one reader outside this directory (B6a X-6):
//     src/components/Explore/useExploreResearch.js, importing only readExploreInvestigations;
//   - the body reaches the network only through src/services/sharedResearchService.js,
//     and that service only through fetchWithAuth and the two existing equip calls —
//     no model or provider anywhere here;
//   - SR_DROP_LAYER sits above the hub sheet (hub/hubStyle.js HUB_LAYERS.sheet) and
//     below the deploy ceremony (DeployCeremony.jsx Z_INDEX).

import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/**
 * The sheet's doors (B6a X-6): the hub's research loader (Amendment E V1.1 §3.2), and Explore's own loader — each one
 * load-time import() of the body. Explore's need not exist (it is the Explore build's); no third file may load the body.
 */
const THE_DOOR = 'src/components/CommandCenter/hub/loadSharedResearch.js';
const EXPLORE_DOOR = 'src/components/Explore/loadSharedResearch.js';
const DOORS = Object.freeze({
  [THE_DOOR]: '../../SharedResearch/SharedResearchSheetBody.jsx',
  [EXPLORE_DOOR]: '../SharedResearch/SharedResearchSheetBody.jsx',
});
/** The service's one reader outside this directory (B6a X-6): Explore's hook, and only its read. */
const EXPLORE_READER = 'src/components/Explore/useExploreResearch.js';
const SERVICE = /^src\/services\/sharedResearchService(\.js)?$/;
const OUR_SERVICE_USER = 'src/components/SharedResearch/useSharedResearch.js';

/** A specifier resolved from a repo-relative file path (the walk's `resolveFrom`, for files given by path). */
const resolveRel = (file, spec) => resolveFrom(resolve(REPO, file), spec);
/** Every src/ file, test files aside, as { rel, code } — read once for the rows below (the src walk is slow). */
let SRC_FILES = null;
const srcFiles = () => {
  if (!SRC_FILES) SRC_FILES = walk(resolve(REPO, 'src')).filter((p) => !isTest(p)).map((p) => ({ rel: rel(p), code: readFileSync(p, 'utf8') }));
  return SRC_FILES;
};
/** Each import of the service a file makes: its clause (`{ a }`, `* as s`, `x`, '' for a bare or dynamic one) and its specifier. */
function serviceImportsOf(file, code) {
  const c = stripComments(code);
  const forms = [
    ...[...c.matchAll(/\bimport\b\s*([^'"`;]*?)\s*\bfrom\s*['"`]([^'"`]+)['"`]/g)].map((m) => ({ clause: m[1].replace(/\s+/g, ' ').trim(), spec: m[2] })),
    ...[...c.matchAll(/\bexport\b\s*([^'"`;]*?)\s*\bfrom\s*['"`]([^'"`]+)['"`]/g)].map((m) => ({ clause: `export ${m[1].trim()}`, spec: m[2] })),
  ];
  const named = forms.filter((f) => SERVICE.test(resolveRel(file, f.spec)));
  const other = specifiersOf(code).filter((s) => SERVICE.test(resolveRel(file, s))).length - named.length; // bare, dynamic, glob, require
  return [...named, ...Array.from({ length: Math.max(0, other) }, () => ({ clause: '', spec: '(another form)' }))];
}

/**
 * The doors' rule and the reader's, over `files` ({ rel, code }, test files aside): the problems found, none when it holds.
 *   - the files outside this directory that import it are among the two doors, and the hub's door is one of them;
 *   - each door present makes exactly one import of the directory, its load-time import() of the body;
 *   - the files outside whose strings name the directory are the doors present, each naming only the body;
 *   - the service is imported by useSharedResearch.js inside, and outside by Explore's reader at most, which imports
 *     exactly `{ readExploreInvestigations }` and nothing else of it.
 */
export function doorProblemsOf(files) {
  const problems = [];
  const outside = files.filter((f) => !f.rel.startsWith('src/components/SharedResearch/'));
  const importers = outside.filter((f) => f.code.includes('SharedResearch'))
    .filter((f) => specifiersOf(f.code).map((s) => resolveRel(f.rel, s)).some((t) => t.startsWith('src/components/SharedResearch')))
    .map((f) => f.rel);
  for (const r of importers) if (!Object.hasOwn(DOORS, r)) problems.push(`not a door, yet loads the sheet: ${r}`);
  if (!importers.includes(THE_DOOR)) problems.push(`the hub's door does not load the sheet: ${THE_DOOR}`);
  for (const door of Object.keys(DOORS).filter((d) => importers.includes(d))) {
    const code = outside.find((f) => f.rel === door).code;
    const body = DOORS[door];
    if (JSON.stringify(specifiersOf(code)) !== JSON.stringify([body])) problems.push(`${door} imports more than the body, or not by its path: ${JSON.stringify(specifiersOf(code))}`);
    if (!stripComments(code).includes(`import('${body}')`)) problems.push(`${door} does not load the body with one load-time import(): ${body}`);
  }
  const naming = outside.filter((f) => f.code.includes('SharedResearch/') && namesInStrings(f.code, 'SharedResearch/').length > 0).map((f) => f.rel);
  for (const r of naming) {
    if (!Object.hasOwn(DOORS, r) || !importers.includes(r)) problems.push(`names the sheet's directory in a string: ${r}`);
    else if (JSON.stringify(namesInStrings(outside.find((f) => f.rel === r).code, 'SharedResearch/')) !== JSON.stringify([`'${DOORS[r]}'`])) problems.push(`${r} names more of the directory than the body`);
  }
  const users = files.filter((f) => f.code.includes('sharedResearchService')).map((f) => ({ rel: f.rel, imports: serviceImportsOf(f.rel, f.code) })).filter((u) => u.imports.length > 0);
  for (const u of users) {
    if (u.rel === OUR_SERVICE_USER) continue;
    if (u.rel !== EXPLORE_READER) { problems.push(`imports the service, and is neither the sheet's hook nor Explore's reader: ${u.rel}`); continue; }
    if (u.imports.length !== 1 || u.imports[0].clause.replace(/\s+/g, '') !== '{readExploreInvestigations}') problems.push(`${u.rel} (Explore's reader) imports more of the service than its read: ${JSON.stringify(u.imports)}`);
  }
  if (!users.some((u) => u.rel === OUR_SERVICE_USER)) problems.push(`the sheet's hook no longer imports the service: ${OUR_SERVICE_USER}`);
  return problems;
}

/** Stand-in files, written to a temp directory (never into src/, where a parallel scan of src/ could meet them) and read back. */
function withStandIns(standIns, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'sr-doors-'));
  try {
    const files = Object.entries(standIns).map(([at, code]) => {
      const p = join(dir, at.replace(/\//g, '__'));
      writeFileSync(p, code);
      return { rel: at, code: readFileSync(p, 'utf8') };
    });
    return fn(files);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const EXPLORE_DOOR_CODE = "let pending = null;\nexport function loadSharedResearch() {\n  if (!pending) pending = import('../SharedResearch/SharedResearchSheetBody.jsx').catch((e) => { pending = null; throw e; });\n  return pending;\n}\n";
const EXPLORE_READER_CODE = "import { readExploreInvestigations } from '../../services/sharedResearchService';\nexport default function useExploreResearch() { return readExploreInvestigations; }\n";

describe('the doors (K-3; Command Center Amendment E V1.1 §3.2; B6a X-6)', () => {
  it('the real tree holds: outside this directory only the doors load the sheet, only the hook and Explore\'s reader import the service', () => {
    const files = srcFiles();
    expect(files.length).toBeGreaterThan(500);
    expect(doorProblemsOf(files)).toEqual([]);
    const door = files.find((f) => f.rel === THE_DOOR).code;
    expect(specifiersOf(door)).toEqual(['../../SharedResearch/SharedResearchSheetBody.jsx']);
    expect(stripComments(door)).toMatch(/\bimport\('\.\.\/\.\.\/SharedResearch\/SharedResearchSheetBody\.jsx'\)/);
    expect(namesInStrings(door, 'SharedResearch/')).toEqual(["'../../SharedResearch/SharedResearchSheetBody.jsx'"]);
  }, 30_000);
  it('with stand-ins for Explore\'s two files (created and removed here), the rule still holds', () => {
    withStandIns({ [EXPLORE_DOOR]: EXPLORE_DOOR_CODE, [EXPLORE_READER]: EXPLORE_READER_CODE }, (standIns) => {
      const files = [...srcFiles().filter((f) => !standIns.some((s) => s.rel === f.rel)), ...standIns];
      expect(doorProblemsOf(files)).toEqual([]);
    });
  }, 30_000);
  it('any third importer fails: of the body, of the directory, of the service — beside the two stand-ins', () => {
    const third = {
      'src/components/Explore/ExploreHome.jsx': "const B = () => import('../SharedResearch/SharedResearchSheetBody.jsx');\nexport default B;\n",
      'src/components/Explore/ExploreCopy.js': "export { SR_COPY } from '../SharedResearch/sharedResearchCopy';\n",
      'src/components/Explore/ExploreStory.jsx': "import { takeStep } from '../../services/sharedResearchService';\nexport default takeStep;\n",
      // a second reader, taking exactly the read: still a third importer of the service
      'src/components/Explore/ExploreSearch.jsx': "import { readExploreInvestigations } from '../../services/sharedResearchService';\nexport default readExploreInvestigations;\n",
      'src/components/discover/DiscoverPanel.jsx': "const B = () => import(`../SharedResearch/SharedResearchSheetBody`);\nexport default B;\n",
    };
    for (const [at, code] of Object.entries(third)) {
      withStandIns({ [EXPLORE_DOOR]: EXPLORE_DOOR_CODE, [EXPLORE_READER]: EXPLORE_READER_CODE, [at]: code }, (standIns) => {
        const files = [...srcFiles().filter((f) => !standIns.some((s) => s.rel === f.rel)), ...standIns];
        const problems = doorProblemsOf(files);
        expect(problems.some((p) => p.includes(at)), `${at}: ${JSON.stringify(problems)}`).toBe(true);
      });
    }
  }, 30_000);
  it('the doors stay doors: a static import, a second import, or a reader that takes more than its read fails', () => {
    const bad = [
      [EXPLORE_DOOR, "import B from '../SharedResearch/SharedResearchSheetBody.jsx';\nexport default B;\n"],
      [EXPLORE_DOOR, `${EXPLORE_DOOR_CODE}export { SR_COPY } from '../SharedResearch/sharedResearchCopy';\n`],
      [EXPLORE_READER, "import * as service from '../../services/sharedResearchService';\nexport default service.readExploreInvestigations;\n"],
      [EXPLORE_READER, "import { readExploreInvestigations, openInvestigation } from '../../services/sharedResearchService';\nexport default [readExploreInvestigations, openInvestigation];\n"],
      [EXPLORE_READER, `${EXPLORE_READER_CODE}export const lazy = () => import('../../services/sharedResearchService');\n`],
    ];
    for (const [at, code] of bad) {
      const standIns = { [EXPLORE_DOOR]: EXPLORE_DOOR_CODE, [EXPLORE_READER]: EXPLORE_READER_CODE, [at]: code };
      withStandIns(standIns, (files0) => {
        const files = [...srcFiles().filter((f) => !files0.some((s) => s.rel === f.rel)), ...files0];
        expect(doorProblemsOf(files).some((p) => p.includes(at)), code).toBe(true);
      });
    }
  }, 30_000);
  it('the hub\'s door is required: a tree without it fails', () => {
    expect(doorProblemsOf(srcFiles().filter((f) => f.rel !== THE_DOOR))).toContain(`the hub's door does not load the sheet: ${THE_DOOR}`);
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
  it('the service\'s importers today: the sheet\'s hook only (Explore\'s reader joins it with the Explore build)', () => {
    const importers = srcFiles().filter((f) => f.code.includes('sharedResearchService'))
      .filter((f) => specifiersOf(f.code).map((s) => resolveRel(f.rel, s)).some((t) => SERVICE.test(t))).map((f) => f.rel);
    expect(importers.filter((r) => r !== EXPLORE_READER)).toEqual([OUR_SERVICE_USER]);
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

describe('the thesis builder\'s files (B4 build prompt K-2, K-3, K-18 d)', () => {
  const NEW = ['builderMode.js', 'builderParts.jsx', 'thesisView.js', 'screens/Builder.jsx', 'screens/ThesisReady.jsx', 'screens/ThesisSaved.jsx'];
  it('each new file is in the walk above, so each passes the boundary, the hub-path and the network rows', () => {
    const walked = OURS.map((p) => relative(HERE, p).replace(/\\/g, '/'));
    for (const f of NEW) expect(walked, f).toContain(f);
  });
  it('the switch is read in ONE place (K-3): builderMode.js, the one file here that imports the flag module or names the builder mode', () => {
    const readers = OURS.filter((p) => {
      const c = readFileSync(p, 'utf8');
      return specifiersOf(c).map((s) => resolveFrom(p, s)).some((t) => /src\/config\/sharedResearchFlags(\.js)?$/.test(t)) || /SHARED_RESEARCH_BUILDER_MODE/.test(stripComments(c));
    });
    expect(readers.map((p) => relative(HERE, p).replace(/\\/g, '/'))).toEqual(['builderMode.js']);
    // ...and it reads at call time, inside the function: no module-scope read of the literal
    const reader = stripComments(readFileSync(join(HERE, 'builderMode.js'), 'utf8'));
    expect(reader).toMatch(/export function sharedResearchBuilderMode\(\) \{\s*return SHARED_RESEARCH_BUILDER_MODE === 'on' \? 'on' : 'off';\s*\}/);
    expect(reader).not.toMatch(/\btry\b/); // a try would stop Rollup folding the literal (review 4D-1)
    expect(reader.match(/SHARED_RESEARCH_BUILDER_MODE/g)).toHaveLength(2); // the import and the one read
  });
  it('the body reads the mode only for Start, and chooses the view by the session (K-2)', () => {
    const body = stripComments(readFileSync(join(HERE, 'SharedResearchSheetBody.jsx'), 'utf8'));
    expect(body.match(/sharedResearchBuilderMode\(\)/g)).toHaveLength(1);
    expect(body).toMatch(/isBuilderSession\(sr\.inv\.session\)/);
    expect(body).not.toMatch(/builderStart\s*\?\s*\(?\s*<Builder/);
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
