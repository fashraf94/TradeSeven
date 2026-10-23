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
//      hub-side modules hold no read, timer, listener or effect beyond the
//      listed allowances (S1: the ResizeObservers that measure the hub, the
//      sheet's focus effect, useUser for the header; S5: the three effects
//      below and the gate's fallback signal).
// Together with the gate suites (rendering the gate is the only thing that
// calls the import) this is the flag-off guarantee: with the hub flag false
// the pick is the legacy shell, the gate is never rendered, and the chunk is
// never requested.
//
// S5 moved this guard in the ways its rulings force, and in no other:
//   - R-S5-9: each gate is handed `hub={hubProps}` beside its site (the pinned
//     site text, the whole-block row and the gate's own props row moved with it);
//   - R-S5-7 again, review E1-1: each gate is also handed `onFallback={setHubFallback}`
//     so App can give the bug button and the season banner back while the legacy
//     fallback is on screen (the same rows, the gate's import list, and one more
//     allowance: hubFallbackSignal.jsx's single layout effect, rendered only inside
//     the gate's fallback, with its own negatives);
//   - R-S5-7: App's two chrome conditions read hubOwnsDashboard (hubChrome.js),
//     a third static edge from App into this directory (the edge row), pinned
//     as text in the S5 rows below;
//   - R-S5-1, R-S5-4: the hub now reaches the shipped sheets and services
//     (PERMITTED_TERMINALS) and has three effects (ALLOWED_ACTIVITY), each with
//     the negatives that keep it to itself; the selector list gained loadout.js.
// What it protects, after S5: the legacy elements' props, the single pick, the
// lazy chunk, the fixtures fence and the URL fence all pin what they pinned. Two
// things are narrower, and said so: (1) the "single flag read" now covers the
// pick; hubOwnsDashboard reads the same pure accessor as a default parameter, so
// App reads it twice per render and the two cannot diverge (review E1-2); (2) the
// import walk stops at every PERMITTED_TERMINALS module without entering it, so
// the "no firebase" and "no activity" rows no longer see inside the shipped
// sheets and services the hub reaches. The S5 rows below name what the hub takes
// from them (which exports; the one importer of the archetype tables; the only
// writes), and each terminal's own effects remain its own owner's.
//
// S3 merged after S5 (the founder's merge round). App's one `hub={hubProps}`
// object carries both slices' keys: the live games as one key (activeBattles,
// the retained poll list), the poll's metadata and refresh, the open handlers
// and S5's keys. S5's agent keys are gone, because the hub reads the agent
// through S3's owner-tagged reader. The S5 row that pins the object's text now
// pins the merged object (HUB_PROPS). S3's own gate-text rows were folded into
// S5's, which pin `hub={hubProps}` at both sites.

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

/**
 * Slices S3 and S5 (rulings R-S3-10, R-S5-9): App's data and actions for the
 * hub, ONE object handed to both gates as `hub={hubProps}`, written here as
 * the whitespace-collapsed App source reads it. The live games are one key
 * (`activeBattles`, the retained poll list the gate reads) and the agent is
 * not on it: the hub reads it through its own owner-tagged reader (the S3
 * merge with S5). A key S2b or S6 adds moves this text with it.
 */
const HUB_PROPS = "const hubProps = { activeBattles: activeAgentBattles, activePoll: activeAgentBattlesPoll, refreshActiveBattles, "
  + "openGame: handleOpenAgentBattle, openFilmRoom: (battle) => { setCurrentBattle(battle); setScreen('filmRoom'); }, "
  + 'setScreen, onOpenForge, setSidebarOpen, unreadCount, };';

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

  it('renders the gate only on the hub pick, handing it its site, App\'s one hub object (S3, S5) and that same legacy element, unframed', () => {
    expect(BLOCK).toMatch(
      /\{dashboardPick\.shell === DASHBOARD_SHELLS\.HUB\s*\?\s*<CommandCenterHubGate site="mobile" hub=\{hubProps\} legacy=\{legacyDashboard\} onFallback=\{setHubFallback\} \/>\s*:\s*legacyDashboard\}/,
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

  it('renders the gate only on the hub pick, with its site, App\'s one hub object (S3, S5), that legacy element and the sidebar offset as its frame', () => {
    expect(BLOCK).toMatch(
      /\{dashboardPick\.shell === DASHBOARD_SHELLS\.HUB \? \(\s*<CommandCenterHubGate\s+site="desktop"\s+hub=\{hubProps\}\s+legacy=\{legacyDesktopDashboard\}\s+frame=\{\(hubOutput\) => <div style=\{sidebarOffsetStyle\}>\{hubOutput\}<\/div>\}\s+onFallback=\{setHubFallback\}\s*\/>\s*\) : legacyDesktopDashboard\}/,
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
      + '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? <CommandCenterHubGate site="mobile" hub={hubProps} legacy={legacyDashboard} onFallback={setHubFallback} /> : legacyDashboard} '
      + '</div> </ErrorBoundary>',
    );
  });

  it('desktop', () => {
    expect(siteTree('const legacyDesktopDashboard')).toBe(
      'return ( <ErrorBoundary name="Dashboard" onNavigateDashboard={() => { setScreen(\'home\'); }}> <div style={containerStyle}> '
      + '{isStarfieldOn() ? <StarfieldBackground mode="desktop" liveGames={starfieldLiveGames} /> : <DesktopBackground isDesktop={isDesktop} />} '
      + '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? ( <CommandCenterHubGate site="desktop" hub={hubProps} legacy={legacyDesktopDashboard} '
      + 'frame={(hubOutput) => <div style={sidebarOffsetStyle}>{hubOutput}</div>} onFallback={setHubFallback} /> ) : legacyDesktopDashboard} '
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
      '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? <CommandCenterHubGate site="mobile" hub={hubProps} legacy={legacyDashboard} onFallback={setHubFallback} /> : legacyDashboard}',
      '</div> </ErrorBoundary> ); }',
      "const sidebarOffsetStyle = { marginLeft: sidebarCollapsed ? '64px' : '220px', transition: 'margin-left 0.2s ease' };",
      'const legacyDesktopDashboard = dashboardPick.legacyShell === DASHBOARD_SHELLS.COMMAND_DASHBOARD_DESKTOP ? (',
      `<div style={sidebarOffsetStyle}> <CommandDashboardDesktop ${props('CommandDashboardDesktop')} /> </div>`,
      `) : ( <DashboardDesktop ${props('DashboardDesktop')} /> );`,
      boundaryOpen,
      '{isStarfieldOn() ? <StarfieldBackground mode="desktop" liveGames={starfieldLiveGames} /> : <DesktopBackground isDesktop={isDesktop} />}',
      '{dashboardPick.shell === DASHBOARD_SHELLS.HUB ? ( <CommandCenterHubGate site="desktop" hub={hubProps} legacy={legacyDesktopDashboard} frame={(hubOutput) => <div style={sidebarOffsetStyle}>{hubOutput}</div>} onFallback={setHubFallback} /> ) : legacyDesktopDashboard}',
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

// ── S5: the hub's props, the Forge bridge and the two chrome conditions ─────
//
// App.jsx is imported by one suite, at desktop width, so what S5 added to it is
// pinned as source text (comments stripped, whitespace collapsed) and the
// decisions it calls are tested where they live (hubChrome.test.js).

describe('S5 mount sites — the hub\'s props, the Forge bridge and the chrome conditions (rulings R-S5-5, R-S5-7, R-S5-9)', () => {
  const flat = APP.replace(/\s+/g, ' ');
  const GET_SCREEN_CONTENT = flat.indexOf('const getScreenContent = () => {');

  it('hubProps is built OUTSIDE the dashboard block, from values App already holds, and handed to both gates', () => {
    expect(flat).toContain(HUB_PROPS);
    expect(BLOCK).not.toContain('hubProps =');
    expect(count(/\bhubProps\b/)).toBe(3);
    expect(BLOCK.match(/hub=\{hubProps\}/g)).toHaveLength(2);
    expect(flat.indexOf('const hubProps')).toBeGreaterThan(-1);
    expect(flat.indexOf('const hubProps')).toBeLessThan(GET_SCREEN_CONTENT);
  });

  it('the two keys the phone menu needs, the drawer and the unread count, are state App already holds, declared before hubProps and handed to the legacy dashboards too (founder ruling Q-S5-1)', () => {
    expect(flat).toContain('const [sidebarOpen, setSidebarOpen] = useState(false);');
    expect(flat).toContain('const [unreadCount, setUnreadCount] = useState(0);');
    expect(flat.indexOf('const [sidebarOpen, setSidebarOpen]')).toBeLessThan(flat.indexOf('const hubProps'));
    expect(flat.indexOf('const [unreadCount, setUnreadCount]')).toBeLessThan(flat.indexOf('const hubProps'));
    expect(flat).toContain('setSidebarOpen={setSidebarOpen} unreadCount={unreadCount}');
  });

  it('the menu button is wired by the phone composition only: PhoneHub hands the header the action, WideHub does not, and the header draws it for the phone alone', () => {
    const hubSource = stripComments(read(HUB_FILE('CommandCenterHub.jsx')));
    expect(hubSource.match(/onOpenMenu=/g)).toHaveLength(1);
    expect(hubSource.indexOf('onOpenMenu=')).toBeGreaterThan(hubSource.indexOf('function PhoneHub'));
    expect(hubSource.indexOf('onOpenMenu=')).toBeLessThan(hubSource.indexOf('function WideHub'));
    expect(stripComments(read(HUB_FILE('HubHeader.jsx')))).toContain("const canMenu = phone && typeof onOpenMenu === 'function';");
  });

  it('onOpenForge sets the Forge\'s first area (when the request names one) in the SAME handler as showForge, and otherwise is the bare setShowForge(true)', () => {
    expect(flat).toContain('const onOpenForge = (request) => { const area = forgeAreaOf(request); if (area) setForgeInitialView(area); setShowForge(true); };');
    expect(flat.indexOf('const onOpenForge')).toBeLessThan(GET_SCREEN_CONTENT);
    // setForgeInitialView has exactly three callers: the reset effect, the watchlist editor's return, and this bridge.
    expect(count(/\bsetForgeInitialView\(/)).toBe(3);
  });

  it('the effect that resets the Forge\'s view for the NEXT open is unchanged, so every existing Forge open still lands on the overview', () => {
    expect(flat).toContain("useEffect(() => { if (showForge) setForgeInitialView('overview'); }, [showForge]);");
    expect(flat).toContain("const [forgeInitialView, setForgeInitialView] = useState('discover');");
    expect(flat).toContain('initialArea={forgeInitialView}');
  });

  it('the hub\'s chrome predicate is computed once, from the screen and the Forge flag, before the screens are chosen', () => {
    expect(flat).toContain('const hubOwnsScreen = hubOwnsDashboard({ screen, showForge, hubFailed: hubFallback });');
    // the ONE inert state the fallback signal needs: declared once, set only through the two gates' onFallback
    expect(flat).toContain('const [hubFallback, setHubFallback] = useState(false);');
    expect(count(/\bsetHubFallback\b/)).toBe(3);
    expect(count(/\bhubFallback\b/)).toBe(2);
    expect(count(/\bhubOwnsDashboard\b/)).toBe(2);
    expect(flat.indexOf('const hubOwnsScreen')).toBeLessThan(GET_SCREEN_CONTENT);
    expect(flat).toContain("import { forgeAreaOf, hubOwnsDashboard } from './components/CommandCenter/hubChrome';");
  });

  it('the active-season banner is withheld while the hub is the dashboard, and keeps every condition it had', () => {
    expect(flat).toContain("{user && isMobile && screen !== 'home' && !GAMEPLAY_SCREENS.includes(screen) && activeSeason && activeSeasonEntry && !hubOwnsScreen && (");
    expect(count(/<ActiveSeasonBanner\b/)).toBe(1);
  });

  it('the ClashBot widget stays mounted for every signed-in user; only its `hidden` gained the hub condition, beside the Battle View\'s', () => {
    expect(count(/<ClashBotWidget\b/)).toBe(1);
    expect(flat).toMatch(/\{user && \( <ClashBotWidget user=\{user\} screen=\{screen\} gameMode=\{gameMode\} currentBattle=\{currentBattle\} colors=\{colors\} isDesktop=\{isDesktop\} hidden=\{\(isCharacterPaneOn\(\) && screen === 'battle' && currentBattle\?\.agentDeployed === true\) \|\| hubOwnsScreen\} \/> \)\}/);
  });

  it('hubChrome.js stays tiny for the main chunk: it imports the hub flag accessor and nothing else', () => {
    expect(importsOf('src/components/CommandCenter/hubChrome.js')).toEqual(['../../config/featureFlags']);
    expect(stripComments(read('src/components/CommandCenter/hubChrome.js'))).not.toMatch(/\b(?:window|document|localStorage|sessionStorage|setTimeout|useEffect|fetch)\b/);
  });

  it('the legacy shells are still handed no hub prop: S5 added nothing to a legacy element', () => {
    for (const tag of Object.keys(LEGACY_PROPS_AT_495EE07B)) expect(propsOf(tag).some((line) => /hub/i.test(line)), tag).toBe(false);
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
    // Reads every file under src/: 2.4 s alone, over the 5 s default when the suite runs wide.
  }, 30000);

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

/**
 * Static module edges: `import … from`, side-effect `import '…'`, and `export … from` re-exports,
 * spaced or not (`from"x"`, `import"x"`), at a line start or after a `;` (S1 review L5-19).
 */
const MODULE_EDGE = /(?:^|[\n;])\s*(?:import|export)\b\s*(?:[^'"]*?\bfrom\s*)?['"]([^'"]+)['"]/g;

/** Load-time edges: `import(…)`, `require(…)` and `import.meta.glob(…)` with a literal specifier (S1 review L5-8). */
const LAZY_EDGE = /\b(?:import|require|import\.meta\.glob(?:Eager)?)\s*\(\s*(['"`])([^'"`]+)\1/g;

function lazyImportsOfCode(code) {
  const specs = [];
  for (let m = LAZY_EDGE.exec(code); m !== null; m = LAZY_EDGE.exec(code)) specs.push(m[2]);
  LAZY_EDGE.lastIndex = 0;
  return specs;
}

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

/** Every string literal (quotes or backticks) that is a path into, or onto, a directory named CommandCenter. */
const HUB_DIR_LITERAL = /(['"`])((?:[^'"`\n]*\/)?CommandCenter(?:\/[^'"`\n]*)?)\1/g;

function hubDirLiterals(code) {
  const out = [];
  for (let m = HUB_DIR_LITERAL.exec(code); m !== null; m = HUB_DIR_LITERAL.exec(code)) out.push(m[2]);
  HUB_DIR_LITERAL.lastIndex = 0;
  return out;
}

/**
 * Import / re-export edges from `rel` that land in the hub directory (relative specifiers and the @/ alias):
 * static ones as `a -> b`, load-time ones (`import()`, `require()`, `import.meta.glob()`) as `a -> lazy b`.
 */
function edgesIntoHub(rel, code) {
  const resolve = (spec) => {
    if (spec.startsWith('.')) return resolveRelative(rel, spec);
    if (spec.startsWith('@/')) return resolveRelative('src/index.js', `./${spec.slice(2)}`);
    return null;
  };
  const into = (spec) => {
    const resolved = resolve(spec);
    return resolved && resolved.startsWith(`${HUB_DIR}/`) ? resolved : null;
  };
  return [
    ...importsOfCode(code).map(into).filter(Boolean).map((to) => `${rel} -> ${to}`),
    ...lazyImportsOfCode(code).map(into).filter(Boolean).map((to) => `${rel} -> lazy ${to}`),
  ];
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
  // S2a (prompt §4): the pure deploy selectors' three shipped, Node-clean inputs, each
  // already in the main graph — App imports commandCenterLiveBattles and leagueTournament;
  // hypothesisRecords arrives through App → the Command dashboards → services/agentDeploy —
  // so the hub chunk duplicates none (the S2a review's build comparison, A4-3).
  'src/utils/commandCenterLiveBattles.js': 'deriveDeployGate and DEPLOY_BLOCK_REASON — the retained gate the deploy selector computes (spec §3.1)',
  'src/constants/leagueTournament.js': 'TRAINING_CLONE_ID_PREFIX — the active poll\'s training-clone exclusion (spec §3)',
  'src/constants/hypothesisRecords.js': 'DEPLOY_REFUSAL_CODE and DUE_DEPLOY_LINE — the review-due refusal the translator keeps (ruling R-S2A-2)',
  // S3 (the readers): the shipped readers and their shipped inputs. Each is already in the
  // main graph but reviewAvailability.js, which only the hub chunk reaches (the Film Room
  // coordinator's one helper, spec §6).
  'src/services/authIdentity.js': 'useAuthIdentity — the one identity source App\'s poll uses too (ruling R-S3-2)',
  'src/hooks/useAgent.js': 'the owner-tagged ranked agent read (ruling R-S3-4)',
  'src/services/completedAgentBattles.js': 'the completed read the legacy hook shares — the ten-game window (ruling R-S3-5)',
  'src/utils/reviewAvailability.js': 'getReviewAvailability, unmodified — the coordinator\'s only Film Room helper (ruling R-S3-6)',
  'src/utils/stockThresholdModel.js': 'displayedStockScores and STOCK_RESULT_UNAVAILABLE — the scores a reader may show (v2 Ruling 16; R-S3-7)',
  'src/adapters/baggerbombAdapter.js': 'derivePhase and toMillis — the Desk\'s pre-open rule and the one timestamp normalizer (R-S3-8, spec §8.2)',
  'src/utils/marketSchedule.js': 'getMarketState — the market clock the pre-open rule reads (R-S3-8)',
  'src/constants/filmTape.js': 'FILM_ROOM_ROUTE — the helper\'s target, the only route a tape opens (spec §6)',
  // S3 and S5 both read the flags, so the one terminal carries both reasons.
  'src/config/featureFlags.js': 'CASUAL_CLONE_CONCURRENCY_ENABLED, read at render as the shells read it (ruling R-S3-9); '
    + 'the flags the Loadout reads, through hub/hubFlags.js, and the hub flag accessor hubChrome.js reads (rulings R-S5-2, R-S5-7)',
  // S5 (prompt §3): the owner's loadout and the retained entry points reach the shipped sheets, services and flags,
  // all of them already in the main graph (the shells import them), so the hub chunk duplicates none.
  'src/utils/equipSlots.js': 'getEquipSlots — which slots the shells render; the adjustments card follows it (ruling R-S5-1)',
  'src/utils/traitSlotSummary.js': 'getTraitSlotSummary — the adjustments summary (ruling R-S5-1)',
  'src/data/archetypeDisplay.js': "getArchetypeDisplayName, read only through hub/archetypeLines.js — the hub's one §2.3 importer (ruling R-S5-1)",
  'src/data/archetypeIdentity.js': 'the archetype dispositions, read only through hub/archetypeLines.js (ruling R-S5-1)',
  'src/services/forgeWatchlistService.js': 'listWatchlists — the equipped list resolves against the existing list route, read per mount (ruling R-S5-1)',
  'src/components/Forge/Watchlist/filterWatchlistsByStatus.js': "the shells' committed-lists filter",
  'src/services/agentService.js': "equipWatchlist / unequipWatchlist — today's approved writes, from the watchlist sheet (ruling R-S5-4)",
  'src/hooks/useMasteryProfile.js': "the owner's mastery profile for the agent record sheet — zero reads while the surface is dark",
  'src/constants/agentProgression.js': "getLevelConfig / getNextLevelInfo — the record sheet's level inputs, the pure functions useAgent uses",
  'src/components/ClashBot/ClashBotWidget.jsx': "CLASHBOT_OPEN_EVENT — the bug report's open event; the widget stays mounted at App (ruling R-S5-7)",
  'src/components/Dashboard/AgentRecordSheet.jsx': 'the shipped agent record sheet, reused unchanged (ruling R-S5-4)',
  'src/components/Dashboard/ArchetypePicker.jsx': 'the shipped archetype picker, reused unchanged (ruling R-S5-4)',
  'src/components/Dashboard/EquipSheet.jsx': 'the shipped watchlist sheet, reused unchanged (ruling R-S5-4)',
  'src/components/Dashboard/TraitsSheet.jsx': 'the shipped traits sheet, reused unchanged (ruling R-S5-4)',
  // S4 (rulings R-S4-1, R-S4-4): the brief's existing hook, which owns its read and its one retry (the hub adds no read of
  // its own), and the shared lean kernel Activity asks which standing leans a game would carry (Display-Agreement §9).
  'src/hooks/useDailyRegimeBrief.js': 'the Daily Regime Brief hook, reused unchanged but for the additive generatedAt (ruling R-S4-4)',
  'api/_utils/leanRevalidation.js': 'acceptedStandingLeans — the kernel the battle snapshot and the Forge use; Activity lists only the leans a game would carry (ruling R-S4-1)',
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
  /\bonSnapshot\b/, /\bgetDoc\w*\s*\(/, /\bfetch\s*(?:\?\.)?\s*\(/, /\bquery\s*\(/, /\bonAuthStateChanged\b/, /\bonIdTokenChanged\b/,
  /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/, /\brequestIdleCallback\b/, /\bqueueMicrotask\b/,
  // A handler assigned on any receiver (`document.body.onkeydown = f`), not only the globals (S1 review L5-19).
  /\baddEventListener\b/, /\.addListener\s*\(/, /\.on[a-z]+\s*=(?!=)/,
  /\bsubscribe\b/, /\bsubscribe\w*\s*\(/,
  /\bResizeObserver\b/, /\bIntersectionObserver\b/, /\bMutationObserver\b/, /\bPerformanceObserver\b/,
  /\b(?:BroadcastChannel|WebSocket|EventSource|XMLHttpRequest|Worker|sendBeacon|matchMedia)\b/,
  /\buseEffect\b/, /\buseLayoutEffect\b/, /\buseInsertionEffect\b/, /\buseSyncExternalStore\b/,
  /\b(?:local|session)Storage\b/,
];

// The hub side's only switches are its props: no URL, history or cookie can
// reach it (ruling R-S1-4: the build branch carries no URL override of any
// kind). The never-merge smoke branch's `?hubFixtures=` reds this, by design.
// The build-time environment and the document's own URL are switches too (S1 review L5-7).
const URL_SWITCHES = [
  /\blocation\b/, /\bURLSearchParams\b/, /\bsearchParams\b/, /\bhistory\.\w+State\b/, /\bdocument\.cookie\b/,
  /\bimport\.meta\.env\b/, /\bdocument\.(?:URL|documentURI|referrer|baseURI)\b/,
];

/** The gate's one sanctioned use of `location`: the real page reload, pinned whole by the S0 row above. */
const GATE_RELOAD = 'export function reloadPage(location = window.location) {\n  location.reload();\n}';

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
  // S3 (rulings R-S3-5, R-S3-6): the review coordinator's thin hook — the real clock's
  // timers handed to the pure scheduler (hub/reviewScheduler.js holds none), the page's
  // visibility and focus listeners, and the effect that owns the scheduler for one owner.
  [HUB_FILE('hub/useHubCompletedBattles.js')]: ['\\bsetTimeout\\b', '\\baddEventListener\\b', '\\buseEffect\\b'],
  // S3: the effect that refreshes the window when a live id leaves a successful poll.
  [HUB_FILE('hub/useHubReaders.js')]: ['\\buseEffect\\b'],
  // S5: the Loadout's lists read (once per mount; never a timer), the overlay stack's provider (it releases the
  // background if the hub unmounts), and the sheet hook's unmount release.
  [HUB_FILE('hub/useHubLoadout.js')]: ['\\buseEffect\\b'],
  [HUB_FILE('hub/HubOverlays.jsx')]: ['\\buseEffect\\b'],
  [HUB_FILE('hub/useHubSheets.js')]: ['\\buseEffect\\b'],
  // S5 (review E1-1): the gate's fallback signal, one layout effect in its own file, rendered only inside the fallback.
  [HUB_FILE('hubFallbackSignal.jsx')]: ['\\buseLayoutEffect\\b'],
  // S4 (ruling R-S4-3): Later's store. The one pattern covers both storages, so a row below pins that the file names
  // sessionStorage and never localStorage; it has no effect, timer or listener.
  [HUB_FILE('hub/useHubLater.js')]: ['\\b(?:local|session)Storage\\b'],
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

describe('S1 hub side — nothing reads, waits, listens or subscribes beyond the listed allowances (S1: the ResizeObservers and useUser; S5: its three effects, the shipped sheets and services it names)', () => {
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

  it('S2a: the scan reaches the selectors directory, and none of its modules holds an allowance', () => {
    const selectors = hubDirFiles().filter((rel) => rel.startsWith(`${HUB_DIR}/hub/selectors/`));
    expect(selectors.sort()).toEqual([
      HUB_FILE('hub/selectors/attemptReducer.js'),
      HUB_FILE('hub/selectors/attemptVocabulary.js'),
      HUB_FILE('hub/selectors/deployState.js'),
      // S3: the outcome selector (R-S3-7) and the readers' input shapes (R-S3-9).
      HUB_FILE('hub/selectors/gameOutcome.js'),
      HUB_FILE('hub/selectors/loadout.js'),
      HUB_FILE('hub/selectors/ownership.js'),
      HUB_FILE('hub/selectors/readerInputs.js'),
    ]);
    expect(Object.keys(ALLOWED_ACTIVITY).filter((rel) => rel.includes('/selectors/'))).toEqual([]);
    expect(selectors.flatMap(activityIn)).toEqual([]);
    expect(selectors.flatMap(urlSwitchesIn)).toEqual([]);
    // ...and the hub module reaches the selector and the vocabulary, so the walk's terminal
    // list is exact. The reducer has no caller until S2b's provider, so no chunk carries it yet.
    const { seen } = graph(HUB_FILE('CommandCenterHub.jsx'));
    expect(seen).toEqual(expect.arrayContaining([
      HUB_FILE('hub/selectors/attemptVocabulary.js'), HUB_FILE('hub/selectors/deployState.js'), HUB_FILE('hub/selectors/ownership.js'),
      HUB_FILE('hub/selectors/loadout.js'),
    ]));
    expect(seen).not.toContain(HUB_FILE('hub/selectors/attemptReducer.js'));
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

  it('the gate, its copy and the picker: no URL, environment or cookie switch either — the gate\'s `location` is its pinned reload alone (ruling R-S1-4; S1 review L5-7)', () => {
    const gate = stripComments(read(GATE));
    expect(gate.split(GATE_RELOAD)).toHaveLength(2);
    const codes = {
      [GATE]: gate.replace(GATE_RELOAD, ''),
      'src/components/CommandCenter/hubGateCopy.js': stripComments(read('src/components/CommandCenter/hubGateCopy.js')),
      'src/components/CommandCenter/pickDashboardShell.js': stripComments(read('src/components/CommandCenter/pickDashboardShell.js')),
    };
    const hits = Object.entries(codes).flatMap(([rel, code]) => URL_SWITCHES.filter((re) => re.test(code)).map((re) => `${rel}: ${re.source}`));
    expect(hits).toEqual([]);
  });

  it('the gate\'s only firebase contact is the house error log, used on a failed load', () => {
    expect(importsOf(GATE).sort()).toEqual(['../../theme/cssTokens', '../ErrorBoundary', './hubFallbackSignal', './hubGateCopy', 'react']);
    expect(importsOf(HUB_FILE('hubFallbackSignal.jsx'))).toEqual(['react']);
    expect(stripComments(read(GATE))).toMatch(/import \{ logErrorToFirebase \} from '\.\.\/ErrorBoundary';/);
  });

  it('the gate\'s copy table imports nothing: the hub\'s copy table stays in the lazy chunk (S1 review L2-1)', () => {
    expect(importsOf('src/components/CommandCenter/hubGateCopy.js')).toEqual([]);
  });

  it('the main graph reaches the hub directory only through App → the gate, the picker and the chrome predicates (S1 review L2-1, L5-8; S5 R-S5-7)', () => {
    // Every other hub module stays out of the main chunk and out of every page
    // load: no src/ file outside the directory may import one, statically or at
    // load time (`import()`, `require()`, `import.meta.glob()`), relative or
    // through the @/ alias, nor name a path into it in a string literal — App
    // included, whose only two such literals are its two static imports.
    const outside = sourceFiles().filter((rel) => !rel.startsWith(`${HUB_DIR}/`));
    expect(outside.length, 'the src walk found nothing, so this row would be vacuous').toBeGreaterThan(100);
    // Each file is read and stripped once and both scans share it: 2.7 s alone with the
    // two passes reading separately, over the 5 s default when the suite runs wide.
    const codeOf = new Map(outside.map((rel) => [rel, stripComments(read(rel))]));
    const edges = outside.flatMap((rel) => edgesIntoHub(rel, codeOf.get(rel)));
    expect(edges.sort()).toEqual([
      `src/App.jsx -> ${HUB_FILE('CommandCenterHubGate.jsx')}`,
      `src/App.jsx -> ${HUB_FILE('hubChrome.js')}`,
      `src/App.jsx -> ${HUB_FILE('pickDashboardShell.js')}`,
    ]);
    const literals = outside.flatMap((rel) => hubDirLiterals(codeOf.get(rel)).map((lit) => `${rel}: ${lit}`));
    expect(literals.sort()).toEqual([
      'src/App.jsx: ./components/CommandCenter/CommandCenterHubGate',
      'src/App.jsx: ./components/CommandCenter/hubChrome',
      'src/App.jsx: ./components/CommandCenter/pickDashboardShell',
    ]);
  }, 30000);

  it('the edge scan is not vacuous: it resolves relative and @/ imports, re-exports and load-time imports into the directory', () => {
    expect(edgesIntoHub('src/components/Navigation/BottomNav.jsx', "import { BOTTOM_NAV_ATTRIBUTE } from '../CommandCenter/hub/navClearance';"))
      .toEqual([`src/components/Navigation/BottomNav.jsx -> ${HUB_FILE('hub/navClearance.js')}`]);
    expect(edgesIntoHub('src/App.jsx', "export { HUB_COPY } from '@/components/CommandCenter/hub/hubCopy';"))
      .toEqual([`src/App.jsx -> ${HUB_FILE('hub/hubCopy.js')}`]);
    expect(edgesIntoHub('src/App.jsx', "import x from './components/Dashboard/CommandDashboard';")).toEqual([]);
    // Load-time edges (L5-8: GF1, GF2, GX4) and the unspaced static form (L5-19: GA6, GX1).
    expect(edgesIntoHub('src/App.jsx', "import('./components/CommandCenter/hub/hubCopy');"))
      .toEqual([`src/App.jsx -> lazy ${HUB_FILE('hub/hubCopy.js')}`]);
    expect(edgesIntoHub('src/components/Navigation/BottomNav.jsx', "const m = () => import('../CommandCenter/hub/navClearance');"))
      .toEqual([`src/components/Navigation/BottomNav.jsx -> lazy ${HUB_FILE('hub/navClearance.js')}`]);
    expect(edgesIntoHub('src/App.jsx', "const f = () => import('./components/CommandCenter/__fixtures__/hubLayoutFixtures');"))
      .toEqual([`src/App.jsx -> lazy ${HUB_FILE('__fixtures__/hubLayoutFixtures.js')}`]);
    expect(edgesIntoHub('src/App.jsx', "require('./components/CommandCenter/hub/hubStyle');"))
      .toEqual([`src/App.jsx -> lazy ${HUB_FILE('hub/hubStyle.js')}`]);
    expect(edgesIntoHub('src/App.jsx', "import { x } from\"./components/CommandCenter/hub/hubStyle\";"))
      .toEqual([`src/App.jsx -> ${HUB_FILE('hub/hubStyle.js')}`]);
    expect(importsOfCode("import * as t from\"../../../constants/leagueTournament\";\nimport\"./side.css\";")).toEqual(['../../../constants/leagueTournament', './side.css']);
    // ...and the literal scan sees a relative path into the directory, a template literal included.
    expect(hubDirLiterals("const p = '../CommandCenter/hub/navClearance';")).toEqual(['../CommandCenter/hub/navClearance']);
    expect(hubDirLiterals('import(`./components/CommandCenter/${name}`);')).toEqual(['./components/CommandCenter/${name}']);
    expect(hubDirLiterals("import x from './components/Dashboard/CommandDashboard';")).toEqual([]);
  });

  it('the gate hands the hub its site and App\'s one hub object, and nothing else — reading nothing in it (rulings R-S3-10, R-S5-9)', () => {
    const code = stripComments(read(GATE));
    expect(code).toMatch(/function CommandCenterHubGate\(\{ site, hub, legacy, frame = unframed, onFallback \}\)/);
    expect(code.match(/<Hub\b[^>]*\/>/g)).toEqual(['<Hub site={site} hub={hub} />']);
    // The gate only forwards it: no member of `hub` is read here.
    expect(code).not.toMatch(/\bhub\s*(?:\?\.|\.|\[)/);
    expect(/\bhub\s*(?:\?\.|\.|\[)/.test('const p = hub.activePoll;')).toBe(true);
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
      // S1 review L5-19: an optional call and a handler on any receiver.
      "fetch?.('/api/hub');", 'document.body.onkeydown = f;',
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
      // S3's two allowances allow only themselves.
      [HUB_FILE('hub/useHubCompletedBattles.js')]: ['setInterval(f, 1000);', 'requestAnimationFrame(f);', 'new ResizeObserver(cb);', 'useLayoutEffect(() => {});', 'onSnapshot(q, cb);'],
      [HUB_FILE('hub/useHubReaders.js')]: ['setTimeout(f, 0);', "window.addEventListener('focus', f);", 'useLayoutEffect(() => {});', 'getDocFromServer(ref);'],
      [HUB_FILE('hub/reviewScheduler.js')]: ['setTimeout(f, 0);', 'useEffect(() => {}, []);', "document.addEventListener('visibilitychange', f);"],
      // S5: each new effect allows its own effect and nothing else — above all, no timer, poll or focus listener on the lists read.
      [HUB_FILE('hub/useHubLoadout.js')]: ['setInterval(refresh, 60000);', "window.addEventListener('focus', refresh);", 'setTimeout(refresh, 0);', 'useLayoutEffect(() => {});', "document.addEventListener('visibilitychange', refresh);"],
      [HUB_FILE('hub/HubOverlays.jsx')]: ['setTimeout(f, 0);', 'new MutationObserver(cb);', "document.addEventListener('keydown', f);", 'useLayoutEffect(() => {});'],
      [HUB_FILE('hub/useHubSheets.js')]: ['setTimeout(f, 0);', "window.addEventListener('resize', f);", 'useLayoutEffect(() => {});'],
      // S5 (review E1-1): the signal allows its one layout effect and nothing else: no passive effect, timer, listener or frame callback.
      [HUB_FILE('hubFallbackSignal.jsx')]: ['useEffect(() => {}, []);', 'setTimeout(f, 0);', "window.addEventListener('focus', f);", 'requestAnimationFrame(f);', 'new ResizeObserver(cb);'],
      // S4: Later's store allows its storage and nothing else — no effect, timer, listener, frame or read.
      [HUB_FILE('hub/useHubLater.js')]: ['useEffect(() => {}, []);', 'useLayoutEffect(() => {});', 'setTimeout(f, 0);', 'setInterval(f, 1000);', "window.addEventListener('storage', f);", 'requestAnimationFrame(f);', 'getDocs(q);', 'new BroadcastChannel("x");'],
    };
    for (const [rel, lines] of Object.entries(negatives)) {
      for (const line of lines) expect(activityInCode(rel, line), `${rel}: ${line}`).not.toEqual([]);
    }
    for (const line of [
      "new URLSearchParams(location.search).get('hubFixtures')", 'window.location.search', "history.replaceState(null, '', url)",
      // S1 review L5-7: the build-time environment and the document's own URL.
      'import.meta.env.VITE_HUB_FIXTURES', "document.URL.includes('hubFixtures')", "new URLSearchParams(window.location.search).get('hubFixtures')",
    ]) {
      expect(URL_SWITCHES.some((re) => re.test(line)), line).toBe(true);
    }
    // The gate's reload names `location` (so it must be lifted out), and lifting it out leaves any other use in view.
    expect(URL_SWITCHES.some((re) => re.test(GATE_RELOAD))).toBe(true);
    expect(URL_SWITCHES.some((re) => re.test(`${GATE_RELOAD}\nconst q = window.location.search;`.replace(GATE_RELOAD, '')))).toBe(true);
    // ...and the edge scan follows re-exports, so a barrel cannot hide a module.
    expect(importsOfCode("export { default as useX } from '../../hooks/useX';\nexport * from './more';"))
      .toEqual(['../../hooks/useX', './more']);
  });
});

describe('S1 hub side — colour and motion only through the tokens (ruling R-S1-2; BUILD_RULES §10, §11)', () => {
  // No id-stripping before the hex scan: it once deleted every quoted lowercase
  // hex starting a–f along with the ids it meant (S1 review L5-1). Ids such as
  // '#root' or `url(#h${uid})` never had the hex shape to begin with.
  const HEX = /#[0-9a-fA-F]{3,8}\b/;
  // Raw colours that are not hex (S1 review L5-4): a numeric rgb()/hsl(), or a
  // CSS colour name as the value of a colour property. `tint()` composes
  // rgba(var(--ft-…-rgb), a), which this never matches; transparent and
  // currentColor are not colour names here.
  const RAW_FUNCTION_COLOUR = /\b(?:rgba?|hsla?)\(\s*\d/;
  const NAMED_COLOUR = /\b(?:color|background(?:Color)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|fill|stroke|stopColor|boxShadow|textShadow|caretColor|accentColor)\s*[:=]\s*\{?\s*(['"`])[^'"`\n]*\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gr[ae]y|silver|gold|teal|navy|cyan|magenta|lime|maroon|olive|aqua|fuchsia|brown|indigo|violet|crimson|coral|salmon|tomato|turquoise)\b[^'"`\n]*\1/;
  // SVG paint never takes a var() or a composed rgba(var()) string — cssVar, the
  // C map, tint() or the hairlines (hazard H8; S1 review L5-5).
  const SVG_PAINT_VAR = /\b(?:stroke|fill|stopColor|stop-color)=\{?\s*(?:cssVar\(|C\.\w|['"`]var\(|tint\(|HAIR\b|HAIR_2\b)/;
  const CSS_TRANSITION = /\b(?:transition|animation)\s*:\s*['"`]/;
  // Motion written as a key — a style property (transitionDuration,
  // WebkitTransition), an animate/initial/variants `transition: {…}` override,
  // or CSS inside a string (S1 review L5-6). The house writes motion only as
  // the `transition={motionToken(…)}` prop, which this never matches.
  const MOTION_KEY = /\b(?:Webkit|Moz|ms)?[Tt]ransition\w*\s*:|\b(?:Webkit|Moz|ms)?[Aa]nimation\w*\s*:/;
  const colourHitsIn = (code) => [
    HEX.test(code) && 'hex', RAW_FUNCTION_COLOUR.test(code) && 'rgb()/hsl()', NAMED_COLOUR.test(code) && 'colour name',
  ].filter(Boolean);

  it('no raw colour anywhere under src/components/CommandCenter/ — no hex, no numeric rgb()/hsl(), no colour name (fixtures and the tests\' kit included)', () => {
    const hits = hubDirFiles().flatMap((rel) => colourHitsIn(stripComments(read(rel))).map((kind) => `${rel}: ${kind}`));
    expect(hits).toEqual([]);
  });

  it('SVG paint attributes take a computed hex (readToken) or currentColor, never a var() reference (hazard H8)', () => {
    const hits = hubDirFiles().filter((rel) => SVG_PAINT_VAR.test(stripComments(read(rel))));
    expect(hits).toEqual([]);
  });

  it('no CSS transition or animation, as a string or as a key: motion goes through motionToken (the motion guard counts only transition={{)', () => {
    const hits = hubDirFiles().filter((rel) => {
      const code = stripComments(read(rel));
      return CSS_TRANSITION.test(code) || MOTION_KEY.test(code);
    });
    expect(hits).toEqual([]);
  });

  it('the scans flag what they name, through the same pipeline the rows use', () => {
    // Raw colours (L5-1, L5-4): lowercase, uppercase, core and non-core hex; numeric rgba; a colour name.
    for (const planted of [
      "export const LEAK = '#ecfffb';", '<path stroke="#ecfffb" />', "pos: '#bada55',", "color: '#9a9dab'", '<stop stopColor="#5EEAD4" />',
      'const glow = `#ecfffb`;', "border: '1px solid #ecfffb'", "color: '#fff'",
      "export const HAIR = 'rgba(255, 255, 255, 0.07)';", "color: 'white',", "border: '1px solid black'",
    ]) {
      expect(colourHitsIn(planted), planted).not.toEqual([]);
    }
    for (const fine of [
      "document.querySelector('#root')", "id: '#hub-panel'", '<circle fill={`url(#h${uid})`} />', "background: tint('teal', 0.12)",
      "color: C.ink", "background: 'transparent'", '<path fill="currentColor" />', "tone=\"gold\"", "AREA_TOKEN = ['teal', 'teal', 'gold']",
    ]) {
      expect(colourHitsIn(fine), fine).toEqual([]);
    }
    expect(SVG_PAINT_VAR.test('<path stroke={cssVar(\'teal\')} />')).toBe(true);
    expect(SVG_PAINT_VAR.test('<circle fill="var(--ft-teal)" />')).toBe(true);
    expect(SVG_PAINT_VAR.test('<path stroke={C.teal} />')).toBe(true);
    expect(SVG_PAINT_VAR.test('<path fill={HAIR} />')).toBe(true);
    expect(SVG_PAINT_VAR.test('<path stroke={stroke} />')).toBe(false);
    expect(SVG_PAINT_VAR.test('<path stroke="currentColor" />')).toBe(false);
    expect(CSS_TRANSITION.test("style={{ transition: 'border-color .2s' }}")).toBe(true);
    expect(CSS_TRANSITION.test("animation: 'ffPulse 1.2s ease-in-out infinite'")).toBe(true);
    // Motion as a key (L5-6: GT1, GT2, GT3, GT5).
    for (const planted of [
      ".concat(' [data-hub=\"shell\"] button { transition: background-color 200ms ease; }')", "transitionDuration: '200ms',",
      'animate={{ opacity: 1, transition: { duration: 0.4 } }}', "WebkitTransition: 'opacity 200ms',", "animationName: 'pulse',",
    ]) {
      expect(MOTION_KEY.test(planted), planted).toBe(true);
    }
    expect(MOTION_KEY.test('transition={motionToken(\'smooth\', { reducedMotion })}')).toBe(false);
    expect(CSS_TRANSITION.test('transition={motionToken(\'smooth\', { reducedMotion })}')).toBe(false);
  });
});

// ── S5: what the hub takes from the shipped modules it may now reach is NAMED ─
//
// PERMITTED_TERMINALS lets the import walk stop at a whole module, so the walk
// alone can no longer see which of its exports the hub uses (review E1-2: the
// closure grew from 48 to 117 modules, and a hub file could have imported
// `createAgent` from agentService without any row noticing). These rows name
// the exports. Add to a list only when a ruling says the hub may use more.

/** The names `code` imports from a module whose specifier ends with `tail`: `{ a as b }` → 'a', a default import → 'default'. */
function importedNames(code, tail) {
  const names = [];
  const statement = /import\s+([^'";]+?)\s+from\s+['"]([^'"]+)['"]/g;
  for (let m = statement.exec(code); m !== null; m = statement.exec(code)) {
    if (!m[2].endsWith(tail)) continue;
    const clause = m[1].trim();
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) names.push(...braces[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean));
    if (clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim()) names.push('default');
  }
  return names;
}

describe('S5 — the exports the hub takes from the shipped services, hooks and flags (review E1-2)', () => {
  const NAMED = Object.freeze({
    '/services/agentService': ['equipWatchlist', 'unequipWatchlist'],
    '/services/forgeWatchlistService': ['listWatchlists'],
    // S3's readers, merged in: the identity source, the completed read and the owner-tagged agent read (reads only).
    '/services/authIdentity': ['useAuthIdentity'],
    '/services/completedAgentBattles': ['fetchRecentCompletedAgentBattles'],
    '/hooks/useAgent': ['default'],
    '/hooks/useMasteryProfile': ['default'],
    // S4: the brief's own hook (one default import, in hub/useHubBrief.js) and the lean kernel (one name, in hub/activityRows.js).
    '/hooks/useDailyRegimeBrief': ['default'],
    '/api/_utils/leanRevalidation.js': ['acceptedStandingLeans'],
    '/ClashBot/ClashBotWidget': ['CLASHBOT_OPEN_EVENT'],
    '/utils/equipSlots': ['getEquipSlots'],
    '/utils/traitSlotSummary': ['getTraitSlotSummary'],
    '/constants/agentProgression': ['getLevelConfig', 'getNextLevelInfo'],
    '/config/featureFlags': ['CASUAL_CLONE_CONCURRENCY_ENABLED', 'RELEASE3_CHARACTER_TAB_ENABLED', 'isCommandCenterHubOn', 'isHypothesisRecordsOn'],
    '/data/archetypeDisplay': ['getArchetypeDisplayName'],
    '/data/archetypeIdentity': ['default', 'getArchetypeIdentity'],
  });

  it('across every file of the directory, exactly these names and no others', () => {
    const files = hubDirFiles();
    for (const [tail, expected] of Object.entries(NAMED)) {
      const found = [...new Set(files.flatMap((rel) => importedNames(stripComments(read(rel)), tail)))].sort();
      expect(found, tail).toEqual([...expected].sort());
    }
  });

  // The S3 merge with S5 (review MR-1): the deploy state and the Loadout take ONE agent read, so the hub reads the agent
  // in one file, once.
  it('one agent read in the whole hub: only hub/useHubReaders.js imports useAgent, under that name, and calls it once', () => {
    const importers = hubDirFiles().filter((rel) => importedNames(stripComments(read(rel)), '/hooks/useAgent').length > 0);
    expect(importers).toEqual([HUB_FILE('hub/useHubReaders.js')]);
    const readers = stripComments(read(HUB_FILE('hub/useHubReaders.js')));
    expect(readers).toContain("import useAgent from '../../../hooks/useAgent';");
    expect(readers.match(/\buseAgent\(/g)).toHaveLength(1);
    // The count bites: a second read is two.
    expect(`${readers}\nconst again = useAgent(signedInUid);`.match(/\buseAgent\(/g)).toHaveLength(2);
  });

  it('the only writes the hub can make are the two equips: nothing else of agentService, and no other service of the shipped set', () => {
    const files = hubDirFiles();
    const writers = files.filter((rel) => importedNames(stripComments(read(rel)), '/services/agentService').length > 0);
    expect(writers).toEqual([HUB_FILE('LoadoutSheets.jsx')]);
    const services = files.flatMap((rel) => importsOf(rel).filter((spec) => /\/services\//.test(spec)).map((spec) => `${rel}: ${spec}`));
    expect(services.sort()).toEqual([
      `${HUB_FILE('LoadoutSheets.jsx')}: ../../services/agentService`,
      `${HUB_FILE('hub/useHubLoadout.js')}: ../../../services/forgeWatchlistService`,
      // S3's readers (merged in): two reads, no write — their names are pinned in NAMED above.
      `${HUB_FILE('hub/useHubCompletedBattles.js')}: ../../../services/authIdentity`,
      `${HUB_FILE('hub/useHubCompletedBattles.js')}: ../../../services/completedAgentBattles`,
      `${HUB_FILE('hub/useHubReaders.js')}: ../../../services/authIdentity`,
    ].sort());
  });

  it('the legacy archetype tables are imported by exactly one hub file (the §2.3 ratchet records one line)', () => {
    const importers = hubDirFiles().filter((rel) => (
      importedNames(stripComments(read(rel)), '/data/archetypeDisplay').length > 0
      || importedNames(stripComments(read(rel)), '/data/archetypeIdentity').length > 0
    ));
    expect(importers).toEqual([HUB_FILE('hub/archetypeLines.js')]);
  });

  it('the matcher sees what it should (the rows above are not vacuous)', () => {
    const code = "import ARCH, { a, b as c } from '../../x/archetypeIdentity';\nimport {\n  one,\n  two,\n} from '../y/agentService';\nimport z from './z';";
    expect(importedNames(code, '/archetypeIdentity').sort()).toEqual(['a', 'b', 'default']);
    expect(importedNames(code, '/agentService').sort()).toEqual(['one', 'two']);
    expect(importedNames(code, '/nothing')).toEqual([]);
  });
});

// ── S4: what the hub reads and stores for Activity, the next action, Later and the brief ────────────────────────────

describe('S4 — the brief is read only through the connected readers; Later stores in sessionStorage alone', () => {
  it('the brief hook is imported by one hub file (hub/useHubBrief.js) and that file is used by one (hub/useHubReaders.js), so a hub without App\'s object reads no brief', () => {
    const files = hubDirFiles();
    const importers = files.filter((rel) => importedNames(stripComments(read(rel)), '/hooks/useDailyRegimeBrief').length > 0);
    expect(importers).toEqual([HUB_FILE('hub/useHubBrief.js')]);
    const users = files.filter((rel) => importedNames(stripComments(read(rel)), '/hub/useHubBrief').length > 0 || importedNames(stripComments(read(rel)), './useHubBrief').length > 0);
    expect(users).toEqual([HUB_FILE('hub/useHubReaders.js')]);
    // ...and neither the shells nor ConnectedHub call it: they only receive its section.
    expect(stripComments(read(HUB_FILE('CommandCenterHub.jsx')))).not.toMatch(/\buseHubBrief\b|\buseDailyRegimeBrief\b/);
  });

  it('the hub reads the brief hook once, and calls no other brief or Firestore reader', () => {
    const brief = stripComments(read(HUB_FILE('hub/useHubBrief.js')));
    expect(brief.match(/\buseDailyRegimeBrief\(/g)).toHaveLength(1);
    const readers = stripComments(read(HUB_FILE('hub/useHubReaders.js')));
    expect(readers.match(/\buseHubBrief\(/g)).toHaveLength(1);
    expect(`${readers}\nconst again = useHubBrief();`.match(/\buseHubBrief\(/g)).toHaveLength(2);
  });

  it('Later\'s store is sessionStorage alone: no localStorage, no cookie, no URL; the key is cc.later.{uid}', () => {
    const later = stripComments(read(HUB_FILE('hub/useHubLater.js')));
    expect(later).toMatch(/\bsessionStorage\b/);
    expect(later).not.toMatch(/\blocalStorage\b/);
    expect(later).not.toMatch(/\bdocument\.cookie\b|\bindexedDB\b/);
    expect(later).toContain("const PREFIX = 'cc.later.';");
    // The scan bites: a localStorage use is not sessionStorage.
    expect(/\blocalStorage\b/.test(`${later}\nlocalStorage.setItem('k', 'v');`)).toBe(true);
  });

  it('no hub file but Later\'s names a storage at all', () => {
    const users = hubDirFiles().filter((rel) => /\b(?:local|session)Storage\b/.test(stripComments(read(rel))));
    expect(users).toEqual([HUB_FILE('hub/useHubLater.js')]);
  });
});
