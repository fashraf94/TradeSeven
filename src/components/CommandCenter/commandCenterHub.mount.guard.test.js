// src/components/CommandCenter/commandCenterHub.mount.guard.test.js
//
// Command Center hub, slices S0 and S1 — the mount sites and the flag-off
// guarantee (spec V1.2 §4, §11.3 "source guard on both mount sites"; "no chunk
// import/read/listener/timer with hub false"), and S1's hub-side scan.
//
// S1 changed the sites in one way, deliberately (prompt §4.1): each gate is
// handed its site, site="mobile" / site="desktop", because the hub composes by
// its own width AND the site (founder ruling R-S1-3). The pinned text below
// moved with it in the same commit; nothing else at either site changed.
//
// Only one suite renders App.jsx (src/App.xpModal.jsdom.test.jsx, desktop
// only, for the XP modal), so the two dashboard sites are pinned as source
// text, comments stripped — the starfield.inert.test.jsx technique. starfield.inert already
// pins the starfield / background ternaries at both sites; this file pins what
// S0 added around them:
//   1. ONE pick, made at render inside the dashboard block, from the four
//      named inputs, read by BOTH sites;
//   2. each site's legacy element is chosen from the pick and is the element
//      the hub-off branch renders — the gate gets that same element;
//   3. the gate renders only on the hub pick, framed on desktop by the same
//      sidebar offset CommandDashboardDesktop sits in;
//   4. nothing reaches the hub chunk except the gate's dynamic import, and the
//      hub-side modules hold no read, timer, listener or effect beyond S1's
//      listed allowances (the ResizeObservers that measure the hub, the
//      sheet's focus effect, useUser for the header).
// Together with the gate suites (rendering the gate is the only thing that
// calls the import) this is the flag-off guarantee: with the hub flag false
// the pick is the legacy shell, the gate is never rendered, and the chunk is
// never requested.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

/** Block comments and full-line `//` comments out, so prose never satisfies a row. */
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const APP = stripComments(read('src/App.jsx'));
const count = (re) => (APP.match(new RegExp(re.source, 'g')) || []).length;

/** The dashboard screen's block: from its `if` to the next screen's. */
function dashboardBlock() {
  const start = APP.indexOf("if (screen === 'dashboard') {");
  const end = APP.indexOf("if (screen === 'builder') {", start);
  expect(start, 'the dashboard screen block moved — re-anchor this guard').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return APP.slice(start, end);
}
const BLOCK = dashboardBlock();

describe('S0 mount sites — one pick, read by both sites', () => {
  it('the pick is made once, inside the dashboard block, from the four named inputs', () => {
    expect(count(/\bpickDashboardShell\(/)).toBe(1);
    expect(BLOCK).toMatch(
      /const dashboardPick = pickDashboardShell\(\{\s*hubOn: isCommandCenterHubOn\(\),\s*isMobile,\s*mobileDashboardOn: COMMAND_DASHBOARD_ENABLED,\s*desktopDashboardOn: COMMAND_DASHBOARD_DESKTOP_ENABLED,\s*\}\);/,
    );
  });

  it('the pick precedes both sites: mobile first, then desktop', () => {
    const pickAt = BLOCK.indexOf('const dashboardPick = pickDashboardShell(');
    const mobileAt = BLOCK.indexOf('if (isMobile) {');
    const desktopAt = BLOCK.indexOf('const legacyDesktopDashboard');
    expect(pickAt).toBeGreaterThan(-1);
    expect(mobileAt).toBeGreaterThan(pickAt);
    expect(desktopAt).toBeGreaterThan(mobileAt);
  });

  it('the hub flag is read only through its accessor, once, at render (never COMMAND_CENTER_HUB_ENABLED)', () => {
    expect(count(/\bCOMMAND_CENTER_HUB_ENABLED\b/)).toBe(0);
    expect(count(/\bisCommandCenterHubOn\(\)/)).toBe(1);
    expect(BLOCK).toContain('hubOn: isCommandCenterHubOn(),');
  });

  it('the accessor App calls is featureFlags\' own, un-aliased and never shadowed', () => {
    // The name appears twice: the featureFlags import and the one call. An
    // alias, a local wrapper or a second binding (say, one adding a URL
    // override) changes the count or the import line.
    expect(APP).toMatch(/import \{[^}]*\bisCommandCenterHubOn \} from '\.\/config\/featureFlags';/);
    expect(APP).not.toMatch(/\bisCommandCenterHubOn as\b/);
    expect(count(/\bisCommandCenterHubOn\b/)).toBe(2);
  });

  it('the two dashboard flags reach the sites only through the pick — no direct ternary survives', () => {
    // Each appears in the featureFlags import and in the pick, nowhere else.
    expect(count(/\bCOMMAND_DASHBOARD_ENABLED\b/)).toBe(2);
    expect(count(/\bCOMMAND_DASHBOARD_DESKTOP_ENABLED\b/)).toBe(2);
    expect(APP).not.toMatch(/\bCOMMAND_DASHBOARD_ENABLED\s*\?/);
    expect(APP).not.toMatch(/\bCOMMAND_DASHBOARD_DESKTOP_ENABLED\s*\?/);
  });
});

describe('S0 mount sites — the mobile site', () => {
  it('chooses CommandDashboard or DashboardLoop from the pick\'s legacy shell', () => {
    expect(BLOCK).toContain(
      'const DashboardComponent = dashboardPick.legacyShell === DASHBOARD_SHELLS.COMMAND_DASHBOARD ? CommandDashboard : DashboardLoop;',
    );
    expect(BLOCK).toMatch(/const legacyDashboard = \(\s*<DashboardComponent\b/);
  });

  it('renders the gate only on the hub pick, handing it its site and that same legacy element, unframed', () => {
    expect(BLOCK).toMatch(
      /\{dashboardPick\.shell === DASHBOARD_SHELLS\.HUB\s*\?\s*<CommandCenterHubGate site="mobile" legacy=\{legacyDashboard\} \/>\s*:\s*legacyDashboard\}/,
    );
  });
});

describe('S0 mount sites — the desktop site', () => {
  it('keeps the sidebar offset as App\'s, on CommandDashboardDesktop only; DashboardDesktop offsets itself', () => {
    expect(BLOCK).toContain(
      "const sidebarOffsetStyle = { marginLeft: sidebarCollapsed ? '64px' : '220px', transition: 'margin-left 0.2s ease' };",
    );
    expect(BLOCK).toMatch(
      /const legacyDesktopDashboard = dashboardPick\.legacyShell === DASHBOARD_SHELLS\.COMMAND_DASHBOARD_DESKTOP \? \(\s*<div style=\{sidebarOffsetStyle\}>\s*<CommandDashboardDesktop\b[\s\S]*?\/>\s*<\/div>\s*\) : \(\s*<DashboardDesktop\b/,
    );
    const desktopShell = BLOCK.slice(BLOCK.indexOf('<DashboardDesktop'));
    expect(desktopShell.slice(0, desktopShell.indexOf('/>'))).toContain('sidebarCollapsed={sidebarCollapsed}');
  });

  it('renders the gate only on the hub pick, with its site, that legacy element and the sidebar offset as its frame', () => {
    expect(BLOCK).toMatch(
      /\{dashboardPick\.shell === DASHBOARD_SHELLS\.HUB \? \(\s*<CommandCenterHubGate\s+site="desktop"\s+legacy=\{legacyDesktopDashboard\}\s+frame=\{\(hubOutput\) => <div style=\{sidebarOffsetStyle\}>\{hubOutput\}<\/div>\}\s*\/>\s*\) : legacyDesktopDashboard\}/,
    );
  });
});

/**
 * A site's returned tree, from `return (` through `</ErrorBoundary>`, with
 * emptied JSX comments (`{}` once the comment text is stripped) dropped and
 * whitespace collapsed — so a row compares structure, not formatting.
 */
function siteTree(fromAnchor) {
  const at = BLOCK.indexOf(fromAnchor);
  expect(at, `anchor ${fromAnchor} moved — re-anchor this guard`).toBeGreaterThan(-1);
  const start = BLOCK.indexOf('return (', at);
  const end = BLOCK.indexOf('</ErrorBoundary>', start) + '</ErrorBoundary>'.length;
  expect(start).toBeGreaterThan(at);
  expect(BLOCK.slice(end).trimStart().startsWith(');')).toBe(true);
  return BLOCK.slice(start, end).replace(/\{\s*\}/g, '').replace(/\s+/g, ' ').trim();
}

describe('S0 mount sites — each site\'s whole tree: the Dashboard boundary, the container, the background, then the pick', () => {
  // The pre-S0 trees with ONLY the shell child replaced by the pick's ternary:
  // same boundary (its name and its back action), same container, the starfield
  // / background first. A shell or gate moved out of the boundary, ahead of the
  // background or into a fragment changes the flag-off render and fails here.
  it('mobile', () => {
    expect(siteTree('if (isMobile) {')).toBe(
      'return ( <ErrorBoundary name="Dashboard" onNavigateDashboard={() => { setScreen(\'home\'); }}> <div style={containerStyle}> '
      + '{isStarfieldMobileOn() ? <StarfieldBackground mode="mobile" liveGames={starfieldLiveGames} /> : <DesktopBackground isDesktop={isDesktop} />} '
      + '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? <CommandCenterHubGate site="mobile" legacy={legacyDashboard} /> : legacyDashboard} '
      + '</div> </ErrorBoundary>',
    );
  });

  it('desktop', () => {
    expect(siteTree('const legacyDesktopDashboard')).toBe(
      'return ( <ErrorBoundary name="Dashboard" onNavigateDashboard={() => { setScreen(\'home\'); }}> <div style={containerStyle}> '
      + '{isStarfieldOn() ? <StarfieldBackground mode="desktop" liveGames={starfieldLiveGames} /> : <DesktopBackground isDesktop={isDesktop} />} '
      + '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? ( <CommandCenterHubGate site="desktop" legacy={legacyDesktopDashboard} '
      + 'frame={(hubOutput) => <div style={sidebarOffsetStyle}>{hubOutput}</div>} /> ) : legacyDesktopDashboard} '
      + '</div> </ErrorBoundary>',
    );
  });
});

/** A legacy element's props, one per line, in source order. */
function propsOf(tag) {
  const open = BLOCK.indexOf(`<${tag}\n`);
  expect(open, `<${tag} moved — re-anchor this guard`).toBeGreaterThan(-1);
  const close = BLOCK.indexOf('/>', open);
  return BLOCK.slice(open + tag.length + 2, close).split('\n').map((line) => line.trim()).filter(Boolean);
}

// Frozen from 495ee07b (spec §11.3 "unchanged legacy render checks"): S0 moved
// these three elements into consts and must not have touched a prop. No suite
// renders these shells through App with their props asserted, so these lists
// are where a dropped or renamed prop shows.
const LEGACY_PROPS_AT_495EE07B = {
  DashboardComponent: [
    'user={user}', 'setShowForge={setShowForge}', 'onCreateAgentBattle={handleCreateAgentTrainingBattle}',
    'onEnterBattle={handleEnterCeremonyBattle}', 'onOpenAgentBattle={handleOpenAgentBattle}', 'activeBattles={activeBattles}',
    'activeDraftBattles={activeDraftBattles}', 'activeTrainingBattles={activeTrainingBattles}',
    'activeAgentBattles={activeAgentBattles}', 'voiceLayerCaches={voiceLayerCaches}', 'lobbyBattles={lobbyBattles}',
    'completedBattles={completedBattles}', 'setCurrentBattle={setCurrentBattle}', 'setCurrentDraft={setCurrentDraft}',
    'setScreen={setScreen}', 'setActiveBattleId={setActiveBattleId}', 'setBattleToJoin={setBattleToJoin}',
    'copyToClipboard={copyToClipboard}', 'setShowBaggerBombModal={setShowBaggerBombModal}',
    'setShowSnakeDraftModal={setShowSnakeDraftModal}', 'setShowBaggerBombTrainingConfirm={setShowBaggerBombTrainingConfirm}',
    'setShowTrainingConfirmModal={setShowTrainingConfirmModal}', 'setTrainingConfirmType={setTrainingConfirmType}',
    'setSidebarOpen={setSidebarOpen}', 'unreadCount={unreadCount}', 'activeDraftBanner={activeDraftBanner}',
    'setActiveDraftBanner={setActiveDraftBanner}', 'onStoryPress={(story) => handleStorySelect(story)}',
  ],
  CommandDashboardDesktop: [
    'user={user}', 'setScreen={setScreen}', 'setSidebarOpen={setSidebarOpen}', 'unreadCount={unreadCount}',
    'setShowForge={setShowForge}', 'setCurrentBattle={setCurrentBattle}', 'activeAgentBattles={activeAgentBattles}',
    'voiceLayerCaches={voiceLayerCaches}', 'onCreateAgentBattle={handleCreateAgentTrainingBattle}',
    'onEnterBattle={handleEnterCeremonyBattle}', 'onOpenAgentBattle={handleOpenAgentBattle}',
  ],
  DashboardDesktop: [
    'user={user}', 'activeBattles={activeBattles}', 'activeDraftBattles={activeDraftBattles}',
    'activeTrainingBattles={activeTrainingBattles}', 'activeAgentBattles={activeAgentBattles}', 'lobbyBattles={lobbyBattles}',
    'completedBattles={completedBattles}', 'setCurrentBattle={setCurrentBattle}', 'setCurrentDraft={setCurrentDraft}',
    'setScreen={setScreen}', 'setActiveBattleId={setActiveBattleId}', 'setBattleToJoin={setBattleToJoin}',
    'copyToClipboard={copyToClipboard}', 'setShowBaggerBombModal={setShowBaggerBombModal}',
    'setShowSnakeDraftModal={setShowSnakeDraftModal}', 'setShowBaggerBombTrainingConfirm={setShowBaggerBombTrainingConfirm}',
    'setShowTrainingConfirmModal={setShowTrainingConfirmModal}', 'setTrainingConfirmType={setTrainingConfirmType}',
    'activeDraftBanner={activeDraftBanner}', 'setActiveDraftBanner={setActiveDraftBanner}',
    'sidebarCollapsed={sidebarCollapsed}', 'onStoryPress={(story) => handleStorySelect(story)}',
  ],
};

describe('S0 mount sites — the three legacy elements keep their pre-S0 props', () => {
  it.each(Object.keys(LEGACY_PROPS_AT_495EE07B))('<%s> has exactly its 495ee07b props, in order', (tag) => {
    expect(propsOf(tag)).toEqual(LEGACY_PROPS_AT_495EE07B[tag]);
  });
});

describe('S0 mount sites — the dashboard block from the pick to its end, as a whole', () => {
  it('is exactly the pick, the mobile site and the desktop site: nothing added, removed or reordered', () => {
    // The rows above pin the parts; this one pins that nothing sits between
    // them — no early `return` that skips a site's boundary, no shadowing
    // `dashboardPick`, no sibling inside a wrapper, no second element. Built
    // from the same frozen prop lists, normalized like siteTree().
    const props = (tag) => LEGACY_PROPS_AT_495EE07B[tag].join(' ');
    const boundaryOpen = 'return ( <ErrorBoundary name="Dashboard" onNavigateDashboard={() => { setScreen(\'home\'); }}> <div style={containerStyle}>';
    const expected = [
      'const dashboardPick = pickDashboardShell({ hubOn: isCommandCenterHubOn(), isMobile, mobileDashboardOn: COMMAND_DASHBOARD_ENABLED, desktopDashboardOn: COMMAND_DASHBOARD_DESKTOP_ENABLED, });',
      'if (isMobile) {',
      'const DashboardComponent = dashboardPick.legacyShell === DASHBOARD_SHELLS.COMMAND_DASHBOARD ? CommandDashboard : DashboardLoop;',
      `const legacyDashboard = ( <DashboardComponent ${props('DashboardComponent')} /> );`,
      boundaryOpen,
      '{isStarfieldMobileOn() ? <StarfieldBackground mode="mobile" liveGames={starfieldLiveGames} /> : <DesktopBackground isDesktop={isDesktop} />}',
      '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? <CommandCenterHubGate site="mobile" legacy={legacyDashboard} /> : legacyDashboard}',
      '</div> </ErrorBoundary> ); }',
      "const sidebarOffsetStyle = { marginLeft: sidebarCollapsed ? '64px' : '220px', transition: 'margin-left 0.2s ease' };",
      'const legacyDesktopDashboard = dashboardPick.legacyShell === DASHBOARD_SHELLS.COMMAND_DASHBOARD_DESKTOP ? (',
      `<div style={sidebarOffsetStyle}> <CommandDashboardDesktop ${props('CommandDashboardDesktop')} /> </div>`,
      `) : ( <DashboardDesktop ${props('DashboardDesktop')} /> );`,
      boundaryOpen,
      '{isStarfieldOn() ? <StarfieldBackground mode="desktop" liveGames={starfieldLiveGames} /> : <DesktopBackground isDesktop={isDesktop} />}',
      '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? ( <CommandCenterHubGate site="desktop" legacy={legacyDesktopDashboard} frame={(hubOutput) => <div style={sidebarOffsetStyle}>{hubOutput}</div>} /> ) : legacyDesktopDashboard}',
      '</div> </ErrorBoundary> ); }',
    ].join(' ');
    const fromPick = BLOCK.slice(BLOCK.indexOf('const dashboardPick = pickDashboardShell('));
    expect(fromPick.replace(/\{\s*\}/g, '').replace(/\s+/g, ' ').trim()).toBe(expected);
  });
});

describe('S0 mount sites — each shell is mounted once, and only through the pick', () => {
  it('one mount per legacy shell, two gates, and no other way in', () => {
    expect(count(/<DashboardComponent\b/)).toBe(1);
    expect(count(/<CommandDashboardDesktop\b/)).toBe(1);
    expect(count(/<DashboardDesktop\b/)).toBe(1);
    // CommandDashboard and DashboardLoop render only as DashboardComponent.
    expect(count(/<CommandDashboard\b(?!Desktop)/)).toBe(0);
    expect(count(/<DashboardLoop\b/)).toBe(0);
    expect(count(/<CommandCenterHubGate\b/)).toBe(2);
    // ...and no other reference at all (createElement, a prop, an alias): the
    // import's binding and path, plus the two tags.
    expect(count(/\bCommandCenterHubGate\b/)).toBe(4);
    expect(count(/<CommandCenterHub\b(?!Gate)/)).toBe(0);
  });

  it('App imports the gate and the picker statically, and never the hub module', () => {
    expect(APP).toContain("import CommandCenterHubGate from './components/CommandCenter/CommandCenterHubGate';");
    expect(APP).toContain("import { pickDashboardShell, DASHBOARD_SHELLS } from './components/CommandCenter/pickDashboardShell';");
    // No literal naming the hub module, in any form (hubPathLiterals, below).
    expect(hubPathLiterals(APP)).toEqual([]);
  });
});

// ── The hub chunk: one way in, and nothing running inside it ────────────────

const SOURCE_FILE = /\.[mc]?jsx?$/;
const TEST_FILE = /\.test\.[mc]?jsx?$/;

/** Every non-test source file under src/ (.js, .jsx, .mjs, .cjs). */
function sourceFiles() {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.') || ent.name === '__golden__') continue;
      const child = path.join(abs, ent.name);
      if (ent.isDirectory()) walk(child);
      else if (SOURCE_FILE.test(ent.name) && !TEST_FILE.test(ent.name)) {
        out.push(path.relative(REPO_ROOT, child).split(path.sep).join('/'));
      }
    }
  };
  walk(path.join(REPO_ROOT, 'src'));
  return out;
}

const GATE = 'src/components/CommandCenter/CommandCenterHubGate.jsx';

/**
 * Every string literal — quotes or backticks, with or without an extension —
 * that names the hub module, wherever it sits: import(), from, require,
 * import.meta.glob or anything else. A literal naming CommandCenterHubGate does
 * not count. Each is reported with whether it is the argument of an import().
 */
const HUB_PATH_LITERAL = /(['"`])([^'"`\n]*\bCommandCenterHub(?:\.[mc]?jsx?)?)\1/g;

function hubPathLiterals(code) {
  const out = [];
  for (let m = HUB_PATH_LITERAL.exec(code); m !== null; m = HUB_PATH_LITERAL.exec(code)) {
    const viaImportCall = /\bimport\s*\(\s*$/.test(code.slice(Math.max(0, m.index - 24), m.index));
    out.push(`${viaImportCall ? 'import(' : ''}${m[2]}`);
  }
  HUB_PATH_LITERAL.lastIndex = 0;
  return out;
}

describe('S0 hub chunk — reached only through the gate\'s dynamic import', () => {
  it('the one reference to the hub module in src/ is the gate\'s import()', () => {
    const files = sourceFiles();
    expect(files.length, 'the src walk found nothing, so this row would be vacuous').toBeGreaterThan(100);
    const refs = files.flatMap((rel) => hubPathLiterals(stripComments(read(rel))).map((ref) => `${rel} ${ref}`));
    expect(refs).toEqual([`${GATE} import(./CommandCenterHub`]);
  });

  it('the reference scan is not vacuous: it sees every form a reference can take', () => {
    for (const planted of [
      "import('./components/CommandCenter/CommandCenterHub.jsx');",
      'import(`./components/CommandCenter/CommandCenterHub`);',
      "import.meta.glob('./components/CommandCenter/CommandCenterHub.jsx', { eager: true });",
      "const Hub = require('../CommandCenter/CommandCenterHub');",
      "import Hub from '@/components/CommandCenter/CommandCenterHub';",
    ]) {
      expect(hubPathLiterals(planted), planted).toHaveLength(1);
    }
    expect(hubPathLiterals("import CommandCenterHubGate from './components/CommandCenter/CommandCenterHubGate';")).toEqual([]);
  });

  it('the gate\'s default export binds that import and the real page reload', () => {
    const code = stripComments(read(GATE));
    expect(code).toContain("export default createCommandCenterHubGate(() => import('./CommandCenterHub'));");
    expect(code).toMatch(/export function reloadPage\(location = window\.location\) \{\n {2}location\.reload\(\);\n\}/);
    expect(code).toMatch(/export function createCommandCenterHubGate\(importHub, \{ reload = reloadPage \} = \{\}\)/);
  });
});

/** Static module edges: `import … from`, side-effect `import '…'`, and `export … from` re-exports. */
const MODULE_EDGE = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function importsOfCode(code) {
  const specs = [];
  for (let m = MODULE_EDGE.exec(code); m !== null; m = MODULE_EDGE.exec(code)) specs.push(m[1]);
  MODULE_EDGE.lastIndex = 0;
  return specs;
}
const importsOf = (rel) => importsOfCode(stripComments(read(rel)));

function resolveRelative(fromRel, spec) {
  const base = path.join(path.dirname(path.join(REPO_ROOT, fromRel)), spec);
  const hit = [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js')]
    .find((c) => existsSync(c) && !c.endsWith(path.sep));
  return hit ? path.relative(REPO_ROOT, hit).split(path.sep).join('/') : null;
}

// S1 (prompt §5): the hub side may reach these shipped first-party modules.
// The walk records them and does not enter them: each is owned, reviewed and
// guarded elsewhere, and its own effects are its own. Anything else outside
// src/components/CommandCenter/ that the hub reaches fails the walk.
const PERMITTED_TERMINALS = Object.freeze({
  'src/contexts/UserContext.jsx': 'useUser() — the signed-in user for the header line (prompt §4.1)',
  'src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx': 'the shipped hold control, rendered disabled with no onComplete (prompt §4.4)',
  'src/theme/cssTokens.js': 'the colour token bridge (BUILD_RULES §10)',
  'src/theme/motion.js': 'the motion vocabulary (BUILD_RULES §11)',
});
/** framer-motion: motion.div and useReducedMotion (the house precedent for OS reduced motion); react-dom: createPortal for the sheet. */
const PERMITTED_PACKAGES = Object.freeze(['framer-motion', 'react', 'react-dom']);

/** The modules the hub reaches inside its own directory, the permitted terminals it stops at, and every bare package. */
function graph(entryRel) {
  const seen = new Set();
  const terminals = new Set();
  const bare = new Set();
  const queue = [entryRel];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    for (const spec of importsOf(rel)) {
      if (!spec.startsWith('.')) { bare.add(spec); continue; }
      const resolved = resolveRelative(rel, spec);
      expect(resolved, `unresolvable import ${spec} from ${rel}`).not.toBeNull();
      if (Object.hasOwn(PERMITTED_TERMINALS, resolved)) { terminals.add(resolved); continue; }
      queue.push(resolved);
    }
  }
  return { seen: [...seen], terminals: [...terminals], bare: [...bare] };
}

// A read, a timer, a listener, a subscription or an effect. S0's hub side held
// none (spec §4). S1's may hold only the allowances below. Each pattern names
// ONE thing, so allowing it in a file allows nothing else.
const ACTIVITY = [
  /\bonSnapshot\b/, /\bgetDoc\w*\s*\(/, /\bfetch\s*\(/, /\bquery\s*\(/, /\bonAuthStateChanged\b/, /\bonIdTokenChanged\b/,
  /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/, /\brequestIdleCallback\b/, /\bqueueMicrotask\b/,
  /\baddEventListener\b/, /\.addListener\s*\(/, /\b(?:window|document|globalThis|self)\.on[a-z]+\s*=(?!=)/,
  /\bsubscribe\b/, /\bsubscribe\w*\s*\(/,
  /\bResizeObserver\b/, /\bIntersectionObserver\b/, /\bMutationObserver\b/, /\bPerformanceObserver\b/,
  /\b(?:BroadcastChannel|WebSocket|EventSource|XMLHttpRequest|Worker|sendBeacon|matchMedia)\b/,
  /\buseEffect\b/, /\buseLayoutEffect\b/, /\buseInsertionEffect\b/, /\buseSyncExternalStore\b/,
  /\b(?:local|session)Storage\b/,
];

// The hub side's only switches are its props: no URL, history or cookie can
// reach it (ruling R-S1-4: the build branch carries no URL override of any
// kind). The never-merge smoke branch's `?hubFixtures=` reds this, by design.
const URL_SWITCHES = [/\blocation\b/, /\bURLSearchParams\b/, /\bsearchParams\b/, /\bhistory\.\w+State\b/, /\bdocument\.cookie\b/];

const HUB_DIR = 'src/components/CommandCenter';
const HUB_FILE = (name) => `${HUB_DIR}/${name}`;

/**
 * The S1 allowances, by file: the ResizeObservers that measure the hub (its
 * width, the stage connector, the strip and BottomNav) with the layout effects
 * that attach them, and the sheet's focus / inert effect. The test kit defines
 * a stand-in ResizeObserver. Nothing else anywhere in the directory.
 */
const ALLOWED_ACTIVITY = Object.freeze({
  [HUB_FILE('hub/useHubWidth.js')]: ['\\bResizeObserver\\b', '\\buseLayoutEffect\\b'],
  [HUB_FILE('hub/useNavClearance.js')]: ['\\bResizeObserver\\b', '\\buseLayoutEffect\\b'],
  [HUB_FILE('ShadowStage.jsx')]: ['\\bResizeObserver\\b', '\\buseLayoutEffect\\b'],
  [HUB_FILE('HubSheet.jsx')]: ['\\buseEffect\\b'],
  [HUB_FILE('__fixtures__/hubTestKit.js')]: ['\\bResizeObserver\\b'],
});

function activityInCode(rel, code) {
  const allowed = ALLOWED_ACTIVITY[rel] || [];
  return ACTIVITY.filter((re) => !allowed.includes(re.source) && re.test(code)).map((re) => `${rel}: ${re.source}`);
}
const activityIn = (rel) => activityInCode(rel, stripComments(read(rel)));
const urlSwitchesIn = (rel) => URL_SWITCHES.filter((re) => re.test(stripComments(read(rel)))).map((re) => `${rel}: ${re.source}`);

/** Every non-test source file under src/components/CommandCenter/. */
function hubDirFiles() {
  return sourceFiles().filter((rel) => rel.startsWith(`${HUB_DIR}/`));
}

describe('S1 hub side — nothing reads, waits, listens or subscribes beyond its ResizeObservers and useUser', () => {
  it('the hub module\'s whole import graph stays in its directory, but for the permitted shipped modules', () => {
    const { seen, terminals, bare } = graph(HUB_FILE('CommandCenterHub.jsx'));
    expect(seen).toContain(HUB_FILE('hub/hubCopy.js'));
    expect(seen.filter((rel) => !rel.startsWith(`${HUB_DIR}/`))).toEqual([]);
    expect(terminals.sort()).toEqual(Object.keys(PERMITTED_TERMINALS).sort());
    expect(bare.sort()).toEqual([...PERMITTED_PACKAGES].sort());
    expect(bare.filter((s) => /^firebase(\/|$)/.test(s))).toEqual([]);
  });

  it('no hub module reaches the layout fixtures or the tests\' kit', () => {
    const { seen } = graph(HUB_FILE('CommandCenterHub.jsx'));
    expect(seen.filter((rel) => rel.includes('/__fixtures__/'))).toEqual([]);
  });

  it('every file in the directory: no activity but the listed allowances', () => {
    const files = hubDirFiles();
    expect(files.length, 'the CommandCenter walk found nothing, so this row would be vacuous').toBeGreaterThan(20);
    expect(files.flatMap(activityIn)).toEqual([]);
  });

  it('the allowances are exactly where they are used, so none goes stale', () => {
    for (const [rel, patterns] of Object.entries(ALLOWED_ACTIVITY)) {
      const code = stripComments(read(rel));
      for (const source of patterns) expect(new RegExp(source).test(code), `${rel} no longer uses ${source}`).toBe(true);
    }
  });

  it('useUser is read in one place, the hub root, for the header line', () => {
    const users = hubDirFiles().filter((rel) => /\buseUser\b/.test(stripComments(read(rel))));
    expect(users).toEqual([HUB_FILE('CommandCenterHub.jsx')]);
  });

  it('the hub side loads nothing later: no import() or require() in its graph', () => {
    // A dynamic import is an edge the static walk cannot follow (firebase/auth
    // loaded at render, say), so the hub side has none.
    const { seen } = graph(HUB_FILE('CommandCenterHub.jsx'));
    const lazy = seen.filter((rel) => /\b(?:import|require)\s*\(/.test(stripComments(read(rel))));
    expect(lazy).toEqual([]);
  });

  it('no URL, history or cookie reaches the hub side (ruling R-S1-4)', () => {
    const { seen } = graph(HUB_FILE('CommandCenterHub.jsx'));
    expect(seen.flatMap(urlSwitchesIn)).toEqual([]);
  });

  it('the gate, its copy and the picker: no read, timer, listener or effect of their own', () => {
    const files = [
      GATE,
      'src/components/CommandCenter/hubGateCopy.js',
      'src/components/CommandCenter/pickDashboardShell.js',
    ];
    expect(files.flatMap(activityIn)).toEqual([]);
  });

  it('the gate\'s only firebase contact is the house error log, used on a failed load', () => {
    expect(importsOf(GATE).sort()).toEqual(['../../theme/cssTokens', '../ErrorBoundary', './hubGateCopy', 'react']);
    expect(stripComments(read(GATE))).toMatch(/import \{ logErrorToFirebase \} from '\.\.\/ErrorBoundary';/);
  });

  it('the gate hands the hub its site and nothing else', () => {
    const code = stripComments(read(GATE));
    expect(code).toMatch(/function CommandCenterHubGate\(\{ site, legacy, frame = unframed \}\)/);
    expect(code.match(/<Hub\b[^>]*\/>/g)).toEqual(['<Hub site={site} />']);
  });

  it('the picker imports nothing and touches no global — it reads only its argument', () => {
    const PICKER = 'src/components/CommandCenter/pickDashboardShell.js';
    expect(importsOf(PICKER)).toEqual([]);
    expect(stripComments(read(PICKER))).not.toMatch(
      /\b(?:window|document|globalThis|self|navigator|location|history|localStorage|sessionStorage|process|Date|performance)\b/,
    );
  });

  it('the scans are not vacuous: each flags what it plants, and an allowance allows only itself', () => {
    const planted = [
      'setTimeout(() => {}, 0);', "window.addEventListener('focus', f);", 'window.onfocus = () => {};',
      "window.matchMedia('(max-width: 768px)').addListener(f);", 'queueMicrotask(f);', 'new BroadcastChannel("x");',
      'onSnapshot(q, cb);', 'getDocFromServer(ref);', 'subscribeToAgentDoc(id, cb);', 'onAuthStateChanged(auth, f);',
      'useEffect(() => {}, []);', 'navigator.sendBeacon(url);', 'new IntersectionObserver(cb);', 'new MutationObserver(cb);',
      'useLayoutEffect(() => {});', 'new ResizeObserver(cb);',
    ];
    for (const line of planted) {
      expect(ACTIVITY.some((re) => re.test(line)), line).toBe(true);
    }
    // Each allowance's negatives still red in its own file.
    const negatives = {
      [HUB_FILE('HubSheet.jsx')]: ['setTimeout(close, 300);', "document.addEventListener('keydown', onKey);", 'useLayoutEffect(() => {});', 'new ResizeObserver(cb);'],
      [HUB_FILE('hub/useHubWidth.js')]: ['new IntersectionObserver(cb);', 'useEffect(() => {}, []);', 'requestAnimationFrame(f);'],
      [HUB_FILE('hub/useNavClearance.js')]: ['new MutationObserver(cb);', "window.addEventListener('resize', f);", 'setInterval(f, 100);'],
      [HUB_FILE('ShadowStage.jsx')]: ['useEffect(() => {}, []);', 'requestAnimationFrame(f);'],
      [HUB_FILE('CommandCenterHub.jsx')]: ['new ResizeObserver(cb);', 'useEffect(() => {}, []);'],
    };
    for (const [rel, lines] of Object.entries(negatives)) {
      for (const line of lines) expect(activityInCode(rel, line), `${rel}: ${line}`).not.toEqual([]);
    }
    for (const line of ["new URLSearchParams(location.search).get('hubFixtures')", 'window.location.search', "history.replaceState(null, '', url)"]) {
      expect(URL_SWITCHES.some((re) => re.test(line)), line).toBe(true);
    }
    // ...and the edge scan follows re-exports, so a barrel cannot hide a module.
    expect(importsOfCode("export { default as useX } from '../../hooks/useX';\nexport * from './more';"))
      .toEqual(['../../hooks/useX', './more']);
  });
});
