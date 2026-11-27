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
