// src/components/CommandCenter/commandCenterHub.mount.guard.test.js
//
// Command Center hub, slice S0 — the mount sites and the flag-off guarantee
// (spec V1.2 §4, §11.3 "source guard on both mount sites"; "no chunk
// import/read/listener/timer with hub false").
//
// No test can import App.jsx (BUILD_RULES §2: `vite build` is the only check
// there), so the two dashboard sites are pinned as source text, comments
// stripped — the starfield.inert.test.jsx technique. starfield.inert already
// pins the starfield / background ternaries at both sites; this file pins what
// S0 added around them:
//   1. ONE pick, made at render inside the dashboard block, from the four
//      named inputs, read by BOTH sites;
//   2. each site's legacy element is chosen from the pick and is the element
//      the hub-off branch renders — the gate gets that same element;
//   3. the gate renders only on the hub pick, framed on desktop by the same
//      sidebar offset CommandDashboardDesktop sits in;
//   4. nothing reaches the hub chunk except the gate's dynamic import, and the
//      hub-side modules hold no read, timer, listener or effect.
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

  it('renders the gate only on the hub pick, handing it that same legacy element, unframed', () => {
    expect(BLOCK).toMatch(
      /\{dashboardPick\.shell === DASHBOARD_SHELLS\.HUB\s*\?\s*<CommandCenterHubGate legacy=\{legacyDashboard\} \/>\s*:\s*legacyDashboard\}/,
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

  it('renders the gate only on the hub pick, with that legacy element and the sidebar offset as its frame', () => {
    expect(BLOCK).toMatch(
      /\{dashboardPick\.shell === DASHBOARD_SHELLS\.HUB \? \(\s*<CommandCenterHubGate\s+legacy=\{legacyDesktopDashboard\}\s+frame=\{\(hubOutput\) => <div style=\{sidebarOffsetStyle\}>\{hubOutput\}<\/div>\}\s*\/>\s*\) : legacyDesktopDashboard\}/,
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
      + '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? <CommandCenterHubGate legacy={legacyDashboard} /> : legacyDashboard} '
      + '</div> </ErrorBoundary>',
    );
  });

  it('desktop', () => {
    expect(siteTree('const legacyDesktopDashboard')).toBe(
      'return ( <ErrorBoundary name="Dashboard" onNavigateDashboard={() => { setScreen(\'home\'); }}> <div style={containerStyle}> '
      + '{isStarfieldOn() ? <StarfieldBackground mode="desktop" liveGames={starfieldLiveGames} /> : <DesktopBackground isDesktop={isDesktop} />} '
      + '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? ( <CommandCenterHubGate legacy={legacyDesktopDashboard} '
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
// these three elements into consts and must not have touched a prop. No test
// renders App.jsx, so these lists are where a dropped or renamed prop shows.
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

describe('S0 mount sites — each shell is mounted once, and only through the pick', () => {
  it('one mount per legacy shell, two gates, and no other way in', () => {
    expect(count(/<DashboardComponent\b/)).toBe(1);
    expect(count(/<CommandDashboardDesktop\b/)).toBe(1);
    expect(count(/<DashboardDesktop\b/)).toBe(1);
    // CommandDashboard and DashboardLoop render only as DashboardComponent.
    expect(count(/<CommandDashboard\b(?!Desktop)/)).toBe(0);
    expect(count(/<DashboardLoop\b/)).toBe(0);
    expect(count(/<CommandCenterHubGate\b/)).toBe(2);
    expect(count(/<CommandCenterHub\b(?!Gate)/)).toBe(0);
  });

  it('App imports the gate and the picker statically, and never the hub module', () => {
    expect(APP).toContain("import CommandCenterHubGate from './components/CommandCenter/CommandCenterHubGate';");
    expect(APP).toContain("import { pickDashboardShell, DASHBOARD_SHELLS } from './components/CommandCenter/pickDashboardShell';");
    expect(APP).not.toMatch(/CommandCenter\/CommandCenterHub['"]/);
  });
});

// ── The hub chunk: one way in, and nothing running inside it ────────────────

/** Every non-test JS/JSX file under src/. */
function sourceFiles() {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.') || ent.name === '__golden__') continue;
      const child = path.join(abs, ent.name);
      if (ent.isDirectory()) walk(child);
      else if (/\.(js|jsx)$/.test(ent.name) && !/\.test\.(js|jsx)$/.test(ent.name)) {
        out.push(path.relative(REPO_ROOT, child).split(path.sep).join('/'));
      }
    }
  };
  walk(path.join(REPO_ROOT, 'src'));
  return out;
}

const GATE = 'src/components/CommandCenter/CommandCenterHubGate.jsx';

describe('S0 hub chunk — reached only through the gate\'s dynamic import', () => {
  it('the one reference to the hub module in src/ is the gate\'s import()', () => {
    const files = sourceFiles();
    expect(files.length, 'the src walk found nothing, so this row would be vacuous').toBeGreaterThan(100);
    const refs = [];
    for (const rel of files) {
      const code = stripComments(read(rel));
      const re = /(import\s*\(\s*|from\s+|require\s*\(\s*)['"]((?:\.{1,2}\/|@\/)[^'"]*\bCommandCenterHub)['"]/g;
      for (let m = re.exec(code); m !== null; m = re.exec(code)) refs.push(`${rel} ${m[1].trim()}${m[2]}`);
    }
    expect(refs).toEqual([`${GATE} import(./CommandCenterHub`]);
  });

  it('the gate\'s default export binds that import and the real page reload', () => {
    const code = stripComments(read(GATE));
    expect(code).toContain("export default createCommandCenterHubGate(() => import('./CommandCenterHub'));");
    expect(code).toMatch(/export function reloadPage\(location = window\.location\) \{\n {2}location\.reload\(\);\n\}/);
    expect(code).toMatch(/export function createCommandCenterHubGate\(importHub, \{ reload = reloadPage \} = \{\}\)/);
  });
});

const RELATIVE_IMPORT = /(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function importsOf(rel) {
  const code = stripComments(read(rel));
  const specs = [];
  for (let m = RELATIVE_IMPORT.exec(code); m !== null; m = RELATIVE_IMPORT.exec(code)) specs.push(m[1]);
  RELATIVE_IMPORT.lastIndex = 0;
  return specs;
}

function resolveRelative(fromRel, spec) {
  const base = path.join(path.dirname(path.join(REPO_ROOT, fromRel)), spec);
  const hit = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')].find((c) => existsSync(c) && !c.endsWith(path.sep));
  return hit ? path.relative(REPO_ROOT, hit).split(path.sep).join('/') : null;
}

/** First-party modules reachable from an entry, plus every bare package they import. */
function graph(entryRel) {
  const seen = new Set();
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
      queue.push(resolved);
    }
  }
  return { seen: [...seen], bare: [...bare] };
}

// A read, a timer, a listener, a subscription or an effect — none may exist on
// the hub side in S0 (spec §4: no hub data read, timer, listener,
// target-progress subscription, provider or ceremony effect).
const ACTIVITY = [
  /\bonSnapshot\b/, /\bgetDocs?\s*\(/, /\bfetch\s*\(/, /\bquery\s*\(/,
  /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/, /\brequestIdleCallback\b/,
  /\baddEventListener\b/, /\bsubscribe\b/, /\b(?:Intersection|Resize|Mutation)Observer\b/,
  /\buse(?:Layout|Insertion)?Effect\b/, /\buseSyncExternalStore\b/,
  /\b(?:local|session)Storage\b/,
];

function activityIn(rel) {
  const code = stripComments(read(rel));
  return ACTIVITY.filter((re) => re.test(code)).map((re) => `${rel}: ${re.source}`);
}

describe('S0 flag-off guarantee — nothing on the hub side reads, waits, listens or subscribes', () => {
  it('the hub module\'s whole import graph: no firebase, no read, timer, listener or effect', () => {
    const { seen, bare } = graph('src/components/CommandCenter/CommandCenterHub.jsx');
    expect(seen).toContain('src/components/CommandCenter/hub/hubCopy.js');
    expect(bare.filter((s) => /^firebase(\/|$)/.test(s))).toEqual([]);
    expect(bare.sort()).toEqual(['react']);
    expect(seen.flatMap(activityIn)).toEqual([]);
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

  it('the picker imports nothing — it reads only its argument', () => {
    expect(importsOf('src/components/CommandCenter/pickDashboardShell.js')).toEqual([]);
  });

  it('the activity scan is not vacuous: it flags a planted timer, listener, read and effect', () => {
    const planted = [
      'setTimeout(() => {}, 0);', "window.addEventListener('focus', f);",
      'onSnapshot(q, cb);', 'useEffect(() => {}, []);', 'getDoc(ref);',
    ];
    for (const line of planted) {
      expect(ACTIVITY.some((re) => re.test(line)), line).toBe(true);
    }
  });
});
