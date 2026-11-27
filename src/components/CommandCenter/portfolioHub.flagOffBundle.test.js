// src/components/CommandCenter/portfolioHub.flagOffBundle.test.js
//
// The portfolio hub's slice 1 (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md §4 slice 1: "with the
// switch off, the build is identical to main's for every hub module"; review finding P1G-4). The build report proves it once,
// on a whole production build; this file keeps it proved. With COMMAND_CENTER_PORTFOLIO_HUB_ENABLED false, every site that
// reads the switch must fold to its text without the slice, and the slice's new modules must leave nothing behind. Part of
// what holds that is tree-shaking (the `/* @__PURE__ */` mark on hub/hubBookRead.js's createContext; Rollup's own knowledge
// of Object.freeze in hub/hubLayout.js), which no jsdom row can see. So each module is bundled the way the switch-off graph
// reaches it — Vite's own build, in memory, the production JSX transform, every import external but the switch's module,
// read with the switch false — and the output is compared:
//   hub/hubBookRead.js, hub/hubLayout.js, HubBookScope.jsx   imported and unused → nothing;
//   sections/ActivitySection.jsx   its three exports used → the same code as the file with its card site's ternary replaced
//                                  by today's `<IdeaBookEntry />`;
//   CommandCenterHub.jsx           its default used → the same code as the file with the connected arm's ternary replaced
//                                  by today's `<ConnectedHub key={site} …/>`;
//   PracticeField/IdeaBookEntry.jsx   what the hub takes with the switch off (the default, IDEA_BOOK_SCREEN_ON) → the same
//                                  code as the file without IdeaBookEntryView and the useIdeaBook re-export.
// The method is agentForm.flagOffBundle.test.js's (review fix SR-3), narrowed to this switch. The last row plants the leaks
// it names and checks each is seen.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { build } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const idOf = (rel) => path.join(REPO, rel).split(path.sep).join('/');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

const FLAGS = 'src/config/commandCenterPortfolioFlags.js';
const CONTEXT = 'src/components/CommandCenter/hub/hubBookRead.js';
const LAYOUT = 'src/components/CommandCenter/hub/hubLayout.js';
const SCOPE = 'src/components/CommandCenter/HubBookScope.jsx';
const ACTIVITY = 'src/components/CommandCenter/sections/ActivitySection.jsx';
const HUB = 'src/components/CommandCenter/CommandCenterHub.jsx';
const ENTRY_CARD = 'src/components/PracticeField/IdeaBookEntry.jsx';

const ENTRY = '\0portfolio-hub-flag-off-entry';
/** The switch's module as the switch-off graph reads it: false, whatever the file ships (a rollback reads the same). */
const switchOff = (code) => code.replace(/^(export const COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = )true;$/m, '$1false;');

/** One module bundled as the switch-off graph reaches it: `used` its exports read ([] for imported and unused); `source` replaces its text. */
async function bundle(rel, used, source = read(rel)) {
  const target = idOf(rel);
  const flags = idOf(FLAGS);
  const entry = used.length ? `export { ${used.join(', ')} } from ${JSON.stringify(target)};` : `import ${JSON.stringify(target)};`;
  const result = await build({
    configFile: false, envFile: false, publicDir: false, logLevel: 'silent', root: REPO,
    css: { postcss: {} }, // no search for the repo's PostCSS config, which loads Tailwind
    define: { 'process.env.NODE_ENV': '"production"' }, // the production JSX transform, not the test environment's jsxDEV
    esbuild: { jsx: 'automatic', jsxDev: false },
    plugins: [{
      name: 'portfolio-hub-flag-off-graph',
      enforce: 'pre',
      resolveId(spec, importer) {
        if (spec === ENTRY) return ENTRY;
        if (importer === ENTRY) return target;
        if (importer !== target) return null;
        return /(^|\/)commandCenterPortfolioFlags(\.js)?$/.test(spec) ? flags : { id: spec, external: true };
      },
      load(id) {
        if (id === ENTRY) return entry;
        if (id === flags) return switchOff(read(FLAGS));
        if (id === target) return source;
        return null;
      },
    }],
    build: {
      write: false, minify: false, sourcemap: false, modulePreload: false, copyPublicDir: false, reportCompressedSize: false, emptyOutDir: false,
      // 'strict' keeps the entry's exports, which an app build would drop; externals carry no side effects of their own.
      rollupOptions: { input: ENTRY, preserveEntrySignatures: 'strict', treeshake: { moduleSideEffects: 'no-external' }, onwarn() {} },
    },
  });
  const [chunk] = (Array.isArray(result) ? result[0] : result).output;
  return chunk.code;
}

/** `code` with `from` (which must occur once) replaced by `to`. */
function replaceOnce(code, from, to, what) {
  expect(code.split(from), `${what}: the anchor moved — ${from.slice(0, 80)}`).toHaveLength(2);
  return code.replace(from, () => to);
}

const CARD_SITE = '{COMMAND_CENTER_PORTFOLIO_HUB_ENABLED ? <HubIdeaBookEntry /> : <IdeaBookEntry />}';
const SHELL_SITE = [
  '        ? COMMAND_CENTER_PORTFOLIO_HUB_ENABLED',
  '          ? <HubBookScope key={site}><ConnectedHub site={site} hub={hub} sections={resolved} /></HubBookScope>',
  '          : <ConnectedHub key={site} site={site} hub={hub} sections={resolved} />',
].join('\n');
const SHELL_TODAY = '        ? <ConnectedHub key={site} site={site} hub={hub} sections={resolved} />';

/** The sites without the slice: each ternary replaced by its switch-off arm, as the file read before the slice. */
const activityToday = (code) => replaceOnce(code, CARD_SITE, '<IdeaBookEntry />', 'ActivitySection.jsx');
const hubToday = (code) => replaceOnce(code, SHELL_SITE, SHELL_TODAY, 'CommandCenterHub.jsx');
/** IdeaBookEntry.jsx without the slice's two exports (the drawing part and the read's re-export), cut by their parsed ranges. */
function entryCardToday(code) {
  const body = Parser.extend(acornJsx()).parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body;
  const cuts = body.filter((node) => node.type === 'ExportNamedDeclaration' && (
    node.declaration?.id?.name === 'IdeaBookEntryView'
    || (!node.declaration && !node.source && node.specifiers.some((s) => s.exported.name === 'useIdeaBook'))));
  expect(cuts, 'IdeaBookEntry.jsx: the slice\'s two exports').toHaveLength(2);
  return cuts.sort((a, b) => b.start - a.start).reduce((text, node) => text.slice(0, node.start) + text.slice(node.end), code);
}

const ACTIVITY_USED = ['default', 'ActivityRows', 'ActivityAgeNote'];
const ENTRY_CARD_USED = ['default', 'IDEA_BOOK_SCREEN_ON'];

describe('the portfolio switch off: the slice folds away (spec §4 slice 1; review P1G-4)', () => {
  it('the switch module read here is the switch-off one, whatever the file ships', () => {
    expect(switchOff(read(FLAGS))).toMatch(/^export const COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = false;$/m);
    expect(switchOff('export const COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = true;')).toBe('export const COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = false;');
  });

  it.each([
    ['hub/hubBookRead.js (its context is marked pure)', CONTEXT],
    ['hub/hubLayout.js (Rollup knows Object.freeze is pure)', LAYOUT],
    ['HubBookScope.jsx (a function declaration and nothing else)', SCOPE],
  ])('%s, imported and unused: nothing', async (_what, rel) => {
    expect((await bundle(rel, [])).trim()).toBe('');
  }, 30000);

  it('sections/ActivitySection.jsx: the same code as with today\'s card site', async () => {
    const source = read(ACTIVITY);
    const [now, today] = [await bundle(ACTIVITY, ACTIVITY_USED, source), await bundle(ACTIVITY, ACTIVITY_USED, activityToday(source))];
    expect(now).toBe(today);
    expect(now).not.toMatch(/HubIdeaBookEntry|IdeaBookEntryView|HubBookReadContext|COMMAND_CENTER_PORTFOLIO_HUB_ENABLED/);
  }, 30000);

  it('CommandCenterHub.jsx: the same code as with today\'s connected arm', async () => {
    const source = read(HUB);
    const [now, today] = [await bundle(HUB, ['default'], source), await bundle(HUB, ['default'], hubToday(source))];
    expect(now).toBe(today);
    expect(now).not.toMatch(/HubBookScope|COMMAND_CENTER_PORTFOLIO_HUB_ENABLED/);
  }, 30000);

  it('PracticeField/IdeaBookEntry.jsx, as the hub takes it with the switch off: the same code as without the slice\'s two exports', async () => {
    const source = read(ENTRY_CARD);
    const [now, today] = [await bundle(ENTRY_CARD, ENTRY_CARD_USED, source), await bundle(ENTRY_CARD, ENTRY_CARD_USED, entryCardToday(source))];
    expect(now).toBe(today);
    expect(now).not.toMatch(/IdeaBookEntryView/);
  }, 30000);

  it('the check bites: each leak it names is seen, through the same path', async () => {
    expect((await bundle(CONTEXT, [], replaceOnce(read(CONTEXT), '/* @__PURE__ */ createContext(null)', 'createContext(null)', 'hubBookRead.js'))).trim(),
      'the mark off the context: the call survives').not.toBe('');
    expect((await bundle(SCOPE, [], `${read(SCOPE)}\nconsole.info('scope');\n`)).trim(),
      'a module-level statement in the scope survives').not.toBe('');
    expect((await bundle(LAYOUT, [], `${read(LAYOUT)}\nconsole.info(hubLayoutOf());\n`)).trim(),
      'a module-level call in the decision module survives').not.toBe('');
    const activity = read(ACTIVITY);
    const unfolded = replaceOnce(activity, CARD_SITE, '{COMMAND_CENTER_PORTFOLIO_HUB_ENABLED || true ? <HubIdeaBookEntry /> : <IdeaBookEntry />}', 'ActivitySection.jsx');
    expect(await bundle(ACTIVITY, ACTIVITY_USED, unfolded),
      'a card site that does not fold differs from today\'s').not.toBe(await bundle(ACTIVITY, ACTIVITY_USED, activityToday(activity)));
    const hub = read(HUB);
    const propped = replaceOnce(hub, SHELL_SITE, SHELL_SITE.replace(': <ConnectedHub key={site} ', ': <ConnectedHub key={site} book={null} '), 'CommandCenterHub.jsx');
    expect(await bundle(HUB, ['default'], propped),
      'a new prop on today\'s shell element, even unused, differs from today\'s').not.toBe(await bundle(HUB, ['default'], hubToday(hub)));
    const card = read(ENTRY_CARD);
    const READ_LINE = '  const { read, refresh } = useIdeaBook({ enabled: PRACTICE_FIELD_SCREEN_ENABLED });\n';
    const reaching = replaceOnce(card, READ_LINE, `${READ_LINE}  if (read.status === 'never') return <IdeaBookEntryView read={read} refresh={refresh} />;\n`, 'IdeaBookEntry.jsx');
    expect(await bundle(ENTRY_CARD, ENTRY_CARD_USED, reaching),
      'the default card reaching the drawing part ships it with the switch off').not.toBe(await bundle(ENTRY_CARD, ENTRY_CARD_USED, entryCardToday(card)));
  }, 60000);
});

// ── Slice 3 (spec 20261126 §4 slice 3; Amendment A PH-25 to PH-28): the book layout folds away too ──────────────────────────
//
// Slice 3 reads the switch at many sites, each a literal ternary (`COMMAND_CENTER_PORTFOLIO_HUB_ENABLED && … ? book : today`) or a
// statement guarded by it (`if (COMMAND_CENTER_PORTFOLIO_HUB_ENABLED && …) …;`). Rather than an anchor per site, the file "without
// the switch" is made from its parse: every such ternary replaced by its switch-off arm, every such statement removed (slice 1's bare
// `COMMAND_CENTER_PORTFOLIO_HUB_ENABLED ? a : b` too). Each file is then bundled as the switch-off graph takes it, both ways; the code
// must be the same, and the site count is pinned so the transform cannot quietly find nothing.
// What these rows prove, and what they do not (review S3G-3): every switch site folds to its off arm, and the new modules and table
// leave nothing. They do not prove the off arms are main's text, nor that an edit outside a site (a prop, a default parameter) is
// absent: that is each slice's whole-build comparison with main (the build report's §4.3), where every non-map file is byte-identical.

const JSX_PARSER = Parser.extend(acornJsx());
const SWITCH = 'COMMAND_CENTER_PORTFOLIO_HUB_ENABLED';
/** A test that reads the switch first: the switch itself, or `switch && …` (its leftmost operand). */
function readsSwitchFirst(test) {
  let node = test;
  while (node && node.type === 'LogicalExpression' && node.operator === '&&') node = node.left;
  return node?.type === 'Identifier' && node.name === SWITCH;
}
/** `code` without the switch: each switch ternary by its off arm, each switch-guarded statement gone. Returns the text and the count. */
function withoutSwitch(code) {
  const sites = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if ((node.type === 'ConditionalExpression' || node.type === 'IfStatement') && readsSwitchFirst(node.test)) { sites.push(node); return; }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === 'string') visit(v);
    }
  };
  visit(JSX_PARSER.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }));
  const text = [...sites].sort((a, b) => b.start - a.start).reduce((out, node) => {
    const off = node.type === 'IfStatement' ? (node.alternate ? code.slice(node.alternate.start, node.alternate.end) : '') : code.slice(node.alternate.start, node.alternate.end);
    return out.slice(0, node.start) + off + out.slice(node.end);
  }, code);
  return { text, count: sites.length };
}

const SLICE3_FILES = Object.freeze([
  // [file, the exports the switch-off graph takes from it, the switch sites it holds]
  [HUB, ['default'], 16],
  ['src/components/CommandCenter/PhoneTabs.jsx', ['PhonePanel', 'PhoneTabRow'], 4],
  ['src/components/CommandCenter/ShadowStage.jsx', ['PhoneStage', 'ShadowStage'], 1],
  ['src/components/CommandCenter/Armory.jsx', ['default', 'ArmorySheetContext', 'ArmoryStageContext', 'PHONE_ARMORY', 'PHONE_ARMORY_GRID', 'PHONE_HERO', 'PhoneArmoryDetails', 'PhoneArmoryRing', 'PhoneArmoryScope', 'armoryHeroRead', 'phoneArmoryGridHeight', 'phoneArmoryLayout'], 2],
  [ACTIVITY, ACTIVITY_USED, 1],
  ['src/components/PracticeField/IdeaBookScreen.jsx', ['default'], 3],
]);
const SLICE3_MODULES = Object.freeze([
  'src/components/CommandCenter/BookLayout.jsx',
  'src/components/CommandCenter/sections/BookOverview.jsx',
  'src/components/CommandCenter/hub/bookTabs.js',
  'src/components/PracticeField/ideaBookPartsOptions.js',
]);

describe('the portfolio switch off: slice 3\'s book layout folds away (spec §4 slice 3)', () => {
  it.each(SLICE3_FILES)('%s: the same code as the file without the switch (%j used; %i sites)', async (rel, used, sites) => {
    const source = read(rel);
    const without = withoutSwitch(source);
    expect(without.count, `${rel}: the switch sites the transform found`).toBe(sites);
    expect(without.text).not.toMatch(new RegExp(`\\b${SWITCH}\\s*(?:&&|\\?)`));
    const [now, today] = [await bundle(rel, used, source), await bundle(rel, used, without.text)];
    expect(now).toBe(today);
    expect(now).not.toMatch(/HubBookReadContext|IdeaBookPartsOptions|PhoneArmorySheet|BookPhoneBody|BookWideBody|BOOK_SHEETS|COMMAND_CENTER_PORTFOLIO_HUB_ENABLED/);
  }, 60000);

  it.each(SLICE3_MODULES)('%s, imported and unused: nothing', async (rel) => {
    expect((await bundle(rel, [])).trim()).toBe('');
  }, 30000);

  // Review S3G-3: the copy table gained a table of its own (PORTFOLIO_HUB_COPY), outside any switch site. Taken as the switch-off
  // graph takes the module (its three other tables), it must leave nothing: the same code as the module with that declaration cut.
  it('hub/hubCopy.js, as the switch-off graph takes it: the same code as without PORTFOLIO_HUB_COPY', async () => {
    const rel = 'src/components/CommandCenter/hub/hubCopy.js';
    const used = ['HUB_COPY', 'AGENT_FORM_COPY', 'ARMORY_COPY'];
    const source = read(rel);
    const decl = JSX_PARSER.parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
      .filter((node) => node.type === 'ExportNamedDeclaration' && node.declaration?.declarations?.[0]?.id?.name === 'PORTFOLIO_HUB_COPY');
    expect(decl).toHaveLength(1);
    const without = source.slice(0, decl[0].start) + source.slice(decl[0].end);
    const [now, today] = [await bundle(rel, used, source), await bundle(rel, used, without)];
    expect(now).toBe(today);
    expect(now).not.toMatch(/PORTFOLIO_HUB_COPY|Needs you|deskRowLabel/);
  }, 30000);

  it('the transform and the check bite: a site that does not fold, an unmarked context and a module-level table each differ or survive', async () => {
    // The transform sees a planted site, and turns it to its off arm.
    expect(withoutSwitch(`const a = ${SWITCH} && x ? 1 : 2; if (${SWITCH} && y) z();`)).toEqual({ text: 'const a = 2; ', count: 2 });
    // A book read that does not fold (`||` keeps the context read alive) ships with the switch off.
    const phone = read('src/components/CommandCenter/PhoneTabs.jsx');
    const unfolded = phone.replace(`${SWITCH} && use(HubBookReadContext)`, `${SWITCH} || use(HubBookReadContext)`);
    expect(unfolded).not.toBe(phone);
    expect(await bundle('src/components/CommandCenter/PhoneTabs.jsx', ['PhonePanel', 'PhoneTabRow'], unfolded),
      'a site that does not fold differs from the file without the switch').not.toBe(await bundle('src/components/CommandCenter/PhoneTabs.jsx', ['PhonePanel', 'PhoneTabRow'], withoutSwitch(phone).text));
    const options = 'src/components/PracticeField/ideaBookPartsOptions.js';
    expect((await bundle(options, [], replaceOnce(read(options), '/* @__PURE__ */ createContext(null)', 'createContext(null)', 'ideaBookPartsOptions.js'))).trim(),
      'the mark off the parts\' options context: the call survives').not.toBe('');
    const layoutFile = 'src/components/CommandCenter/BookLayout.jsx';
    expect((await bundle(layoutFile, [], `${read(layoutFile)}\nconst LEAK = Object.freeze({ bar: C.ink, list: [C.teal] });\nconsole.info(LEAK);\n`)).trim(),
      'a module-level statement in the book layout survives').not.toBe('');
  }, 90000);
});
