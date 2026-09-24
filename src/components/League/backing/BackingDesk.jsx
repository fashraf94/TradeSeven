/* eslint-disable react-refresh/only-export-components -- the section helpers are co-located with the screen that consumes them, by design (the LeagueParts precedent) */
// src/components/League/backing/BackingDesk.jsx
//
// Backing desktop layouts — THE BACKING SCREEN ON DESKTOP (the desktop design,
// docs/design/backing/desktop/: `backing-desk-v2.jsx`, `backing-desk-week.jsx`;
// desktop briefs §2 and rev2 §3/§4/§6). LAYOUT ONLY: every figure, name and
// sentence here is the one the mobile screen renders, from the same hooks
// (BackingScreen owns them and hands them in) and the same copy module. Pure
// over its props — the dev preview page renders it from fixtures.
//
// THREE SECTIONS, chosen from the same derived state the strip shows (§9 —
// one mapping), switchable in the header:
//   · the WINDOW — three columns, as designed: the pods left (PodList, whole:
//     the same rows, the same seal, the endpoint's order), the team card
//     centre (last week's two portfolios side by side — the card's own
//     two-column book at desktop width), your backing right; "Back" swaps the
//     stake control into the right column, with its three disclosure lines
//     directly above Confirm (visible without scrolling at 1440×900 — the
//     screenshot harness measures it). The attestation step renders there
//     too: it is the stake control's own first step.
//   · YOUR BACKING — Monday–Friday takes the whole screen: the week cards, wide.
//   · RESULTS — Friday's results take the whole screen: the settled pools as
//     tables, the viewer's private record beside them (MyBackingStats).
//
// THE SEAL, AT DESKTOP WIDTH: a wider screen shows more at once — never more
// about a pool. Nothing on this screen reads a pot, a per-team figure, a
// payout or a count while a pool is open: the pod list is PodList, the rail
// shows the viewer's OWN stakes (the strip's own derivation over the pod list)
// and the sealed lockups, and the card and the stake control are the mobile
// build's. The seal row (PodList.test.jsx) renders this screen over a leaky
// open pool and asserts no figure reaches it.
//
// Tokens only (BUILD_RULES §10) — the League's obsidian map and alpha(); no
// inline `transition={{` literal (§11); the scoped <style> block follows the
// desktop lobby's LD_STYLE house pattern.

import React from 'react';
import { FINE_PRINT } from '../../../constants/backing';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono, Icon, LIcon } from '../LeagueParts';
import { MonoAttr, PointsMeter, SealRule, Sealed, Disclosures } from './BackingParts';
import PodList from './PodList';
import TeamCard from './TeamCard';
import StakeControl from './StakeControl';
import YourBacking from './YourBacking';
import { BackingResultsCardDesk } from './BackingResultsCard';
import MyBackingStats from './MyBackingStats';
import { POD_LIST, RESULTS, SCREEN, STAKE, STATS, STRIP, WEEK, screenStateLine, stripLines } from './backingCopy';
import { DESK_SECTION, STRIP_KIND, backingWindow } from './backingStripState';

/** The three desktop sections, in their header order. */
// The three sections live beside the strip's states (the strip's action names one); re-exported here.
export { DESK_SECTION };
const SECTION_LABEL = Object.freeze({ window: POD_LIST.title, week: WEEK.title, results: RESULTS.title });

/**
 * The section the screen opens on — from the strip's own derived state (the
 * header says what the strip says; this opens where the strip points):
 * stakes in play → Your Backing; the week banked → Results; else the window.
 */
export function deskDefaultSection(state, backedPods = 0) {
  if (state?.kind === STRIP_KIND.WEEK && backedPods > 0) return DESK_SECTION.WEEK;
  if (state?.kind === STRIP_KIND.BETWEEN) return DESK_SECTION.RESULTS;
  return DESK_SECTION.WINDOW;
}

/** The sections a viewer can open: the window and the results always; Your Backing while a backed pod has closed. */
export function deskSections(backedPods = 0) {
  return backedPods > 0
    ? [DESK_SECTION.WINDOW, DESK_SECTION.WEEK, DESK_SECTION.RESULTS]
    : [DESK_SECTION.WINDOW, DESK_SECTION.RESULTS];
}

// SCROLL MODEL (the desktop lobby's): the screen fills its host and never
// scrolls as a page; each column is its own bounded scroller. Narrower
// desktops tighten the side columns, then stack.
const DESK_STYLE = `
  .bkd-root { height: 100%; min-height: 0; display: flex; flex-direction: column; background: ${LTOKENS.bg}; color: ${LTOKENS.ink}; font-family: var(--app-font, 'Space Grotesk', system-ui, sans-serif); }
  .bkd-grid { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 400px minmax(0, 1fr) 380px; }
  .bkd-col { box-sizing: border-box; min-height: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
  .bkd-pods { padding: 22px 22px 32px; border-right: 1px solid ${LTOKENS.hair}; background: ${alpha(LTOKENS.surface, 0.32)}; }
  .bkd-card { padding: 26px 32px 40px; border-right: 1px solid ${LTOKENS.hair}; }
  .bkd-right { padding: 22px 22px 32px; background: ${alpha(LTOKENS.surface, 0.32)}; }
  .bkd-wide { box-sizing: border-box; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 24px 30px 40px; }
  .bkd-results { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 22px; align-items: start; }
  /* Last week's two portfolios sit side by side while the card column fits
     both; narrower, they stack rather than clip the tape's moves (PLACE-6). */
  @media (max-width: 1365px) {
    .bkd-card .bk-book { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  }
  @media (max-width: 1180px) {
    .bkd-grid { grid-template-columns: 340px minmax(0, 1fr) 340px; }
    .bkd-card { padding: 22px 22px 34px; }
    .bkd-results { grid-template-columns: minmax(0, 1fr) 360px; }
  }
  @media (max-width: 980px) {
    .bkd-grid { grid-template-columns: minmax(0, 1fr); overflow-y: auto; }
    /* Stacked, each column is as tall as its content: min-height back to auto,
       or a column's content paints over the next one (PLACE-3). */
    .bkd-col { height: auto; min-height: auto; overflow: visible; border-right: none; }
    .bkd-results { grid-template-columns: minmax(0, 1fr); }
  }
`;

// ── the header parts ────────────────────────────────────────────────────────
function BackLink({ onBack }) {
  return (
    <button type="button" className="lg-tap" data-backing="screen-back" onClick={onBack} style={{ all: 'unset', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: LTOKENS.ink2 }}>
      <LIcon name="arrowL" size={16} color={LTOKENS.ink2} />
      <Mono style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{SCREEN.back}</Mono>
    </button>
  );
}

function SectionTabs({ sections, section, onSection, accent }) {
  if (!Array.isArray(sections) || sections.length < 2) return null;
  return (
    <div role="tablist" aria-label={SCREEN.eyebrow} data-backing="desk-sections" style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      {sections.map((id) => {
        const on = id === section;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            className="lg-tap"
            data-desk-section={id}
            onClick={() => onSection?.(id)}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: '-0.005em', color: on ? LTOKENS.ink : LTOKENS.ink3, background: on ? alpha(accent, 0.14) : 'transparent', border: `1px solid ${on ? alpha(accent, 0.4) : 'transparent'}` }}
          >
            {SECTION_LABEL[id]}
          </button>
        );
      })}
    </div>
  );
}

function StateLine({ state, loading }) {
  return <MonoAttr data-backing="screen-state" style={{ display: 'block', fontSize: 10.5, color: LTOKENS.ink2, letterSpacing: '0.02em' }}>{loading ? SCREEN.loading : screenStateLine(state)}</MonoAttr>;
}

/** The whole-screen sections' header — back, the title and the state line, the section switch. */
function WideHeader({ state, loading, sections, section, onSection, onBack, accent }) {
  return (
    <div data-backing="desk-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, paddingBottom: 18, marginBottom: 20, borderBottom: `1px solid ${LTOKENS.hair}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <BackLink onBack={onBack} />
          <Eyebrow color={accent}>{SCREEN.eyebrow}</Eyebrow>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 8 }}>{SCREEN.title}</div>
        <StateLine state={state} loading={loading} />
      </div>
      <SectionTabs sections={sections} section={section} onSection={onSection} accent={accent} />
    </div>
  );
}

// ── the window: the right column's resting state — your backing so far ─────
function DeskRail({ windowState, wallet, uid, accent, onOpenSeat }) {
  const stakes = windowState?.kind === STRIP_KIND.STAKED && Array.isArray(windowState.stakes) ? windowState.stakes : [];
  return (
    <div data-backing="desk-rail" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <Eyebrow color={stakes.length > 0 ? accent : LTOKENS.ink3}>{stakes.length > 0 ? STRIP.head.staked(windowState.pods) : STRIP.eyebrow.open}</Eyebrow>
        {uid && <PointsMeter left={wallet?.left ?? null} total={wallet?.total ?? 0} compact />}
      </div>
      {stakes.length > 0 ? (
        <div data-backing="desk-rail-stakes" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {stakes.map((x) => (
            <button
              key={x.stakeId ?? `${x.groupId}-${x.teamOdUserId}`}
              type="button"
              className="lg-tap"
              data-backing="desk-rail-stake"
              onClick={() => onOpenSeat?.(x.groupId, x.teamOdUserId)}
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 12, background: alpha(accent, 0.07), border: `1px solid ${alpha(accent, 0.26)}` }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: LTOKENS.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.teamName}</div>
                <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{x.podName}</Mono>
              </div>
              {x.closed && <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{STRIP.lockedRow}</Mono>}
              <Mono style={{ fontSize: 13, fontWeight: 700, color: accent }}>{STRIP.stakeRow(x.amount)}</Mono>
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
            <Sealed label={POD_LIST.sealedPot} size="sm" />
            <Sealed label={POD_LIST.sealedPays} size="sm" />
          </div>
        </div>
      ) : (
        <div data-backing="desk-rail-empty" style={{ padding: '13px 14px', borderRadius: 13, border: `1px dashed ${LTOKENS.hair2}`, fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>{STRIP.sub.open}</div>
      )}
      <div>
        <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{STAKE.disclosuresTitle}</Mono>
        <Disclosures />
      </div>
      <SealRule compact />
    </div>
  );
}

/** The centre before a seat is chosen — what the card column is for, in the screen's own words. */
function CardEmpty({ accent }) {
  return (
    <div data-backing="desk-card-empty" style={{ marginTop: 36, padding: '26px 24px', borderRadius: 16, border: `1px dashed ${LTOKENS.hair2}`, background: alpha(LTOKENS.bg, 0.4), textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <LIcon name="eyeR" size={22} color={accent} />
      <div style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', lineHeight: 1.35, maxWidth: 420 }}>{SCREEN.intro}</div>
      <Mono style={{ fontSize: 10.5, color: accent, fontWeight: 600, letterSpacing: '0.04em' }}>{POD_LIST.tapSeat}</Mono>
    </div>
  );
}

function WindowView(props) {
  const {
    accent, uid, pods, state, windowState, wallet, eligibility, myPitch, view, cardQuery, pod,
    sections, section, onSection, onBack, onOpenSeat, onToStake, onToCard, onBacked, onOpenTape, services,
  } = props;
  // The chip is the WINDOW's: shown while any listed pool is open, reading
  // that window's close — its gate and its words from one derivation, never
  // the viewer's own strip line (a returning backer's "Settles after Friday's
  // close" beside open pools; PLACE-5 / WIRE-4 / OBS-2, the desktop review).
  const win = backingWindow(pods.pods);
  const card = cardQuery?.card ?? null;
  const selectedSeat = view.kind !== 'list' && view.groupId && view.odUserId ? { groupId: view.groupId, odUserId: view.odUserId } : null;
  const staking = view.kind === 'stake' && card != null;
  return (
    <div className="bkd-grid" data-desk-section-view="window">
      {/* LEFT — the pods, whole, under the screen's own header */}
      <div className="lg-scroll bkd-col bkd-pods" data-desk-col="pods">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
          <BackLink onBack={onBack} />
          {win && (
            <span data-backing="desk-close" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, whiteSpace: 'nowrap' }}>
              <Icon name="clock" size={11} color={LTOKENS.ink3} />
              <Mono style={{ fontSize: 10, color: LTOKENS.ink2, fontWeight: 600, letterSpacing: '0.04em' }}>{stripLines(win).when}</Mono>
            </span>
          )}
        </div>
        <Eyebrow color={accent} style={{ marginBottom: 6 }}>{SCREEN.eyebrow}</Eyebrow>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 7 }}>{SCREEN.title}</div>
        <StateLine state={state} loading={pods.loading && !pods.data} />
        <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.5, margin: '9px 0 12px' }}>{SCREEN.intro}</div>
        <div style={{ marginBottom: 12 }}><SectionTabs sections={sections} section={section} onSection={onSection} accent={accent} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SealRule compact />
          {pods.error && !pods.data
            ? <div role="alert" style={{ fontSize: 12.5, color: LTOKENS.ink2 }}>{SCREEN.unavailable}</div>
            : <PodList pods={pods.pods} accent={accent} onOpenSeat={(p, team) => onOpenSeat?.(p.groupId, team.odUserId)} selectedSeat={selectedSeat} />}
          <div style={{ marginTop: 6, padding: '11px 13px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{SCREEN.fineprintLabel}</Mono>
            <div data-backing="fine-print" style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.5 }}>{FINE_PRINT}</div>
          </div>
        </div>
      </div>

      {/* CENTRE — the team card; the stake control never displaces it */}
      <div className="lg-scroll bkd-col bkd-card" data-desk-col="card">
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {view.kind === 'list' ? <CardEmpty accent={accent} />
            : cardQuery?.loading ? <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{SCREEN.loading}</Mono>
              : !card ? <div role="alert" style={{ fontSize: 12.5, color: LTOKENS.ink2 }}>{SCREEN.cardUnavailable}</div>
                : (
                  <TeamCard
                    card={card}
                    pod={pod}
                    accent={accent}
                    onBack={onToStake}
                    onOpenTape={onOpenTape}
                    myPitch={card.seat?.isViewer ? myPitch : null}
                  />
                )}
        </div>
      </div>

      {/* RIGHT — your backing so far; the stake control (and its attestation step) swaps in here */}
      <div className="lg-scroll bkd-col bkd-right" data-desk-col="right">
        {staking ? (
          <div data-backing="desk-stake">
            <StakeControl
              card={card}
              pod={pod}
              wallet={wallet}
              eligibility={eligibility}
              accent={accent}
              services={services}
              layout="desktop"
              onBacked={onBacked}
              onClose={onToCard}
              onCancel={onToCard}
            />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 14 }}>
              <Icon name="lock" size={11} color={LTOKENS.ink3} />
              <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, lineHeight: 1.5 }}>{SCREEN.sealRule}</Mono>
            </div>
          </div>
        ) : (
          <DeskRail windowState={windowState} wallet={wallet} uid={uid} accent={accent} onOpenSeat={onOpenSeat} />
        )}
      </div>
    </div>
  );
}

function WeekView({ accent, inPlay, onOpenTape, now, battlesByGroup, header }) {
  return (
    <div className="lg-scroll bkd-wide" data-desk-section-view="week">
      {header}
      {/* The pools here have CLOSED — revealed at close — so no seal line rides this view. */}
      <YourBacking inPlay={inPlay} accent={accent} onOpenTape={onOpenTape} now={now} battlesByGroup={battlesByGroup} layout="desktop" />
    </div>
  );
}

function ResultsView({ accent, results, myStats, onOpenTape, header }) {
  const weeks = Array.isArray(results?.weeks) ? results.weeks : [];
  // "Nothing yet" and "unavailable" are ANSWERS: until a read has answered (a
  // reply or an error) the section says it is loading — a hook enabled on this
  // very render has not started yet, and its first commit is no answer (WIRE-5).
  const resultsAnswered = results?.data != null || results?.error != null;
  return (
    <div className="lg-scroll bkd-wide" data-desk-section-view="results">
      {header}
      <div className="bkd-results">
        <div data-backing="results-section" data-layout="desktop" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <Eyebrow color={LTOKENS.gold}>{RESULTS.eyebrow}</Eyebrow>
          {(results?.loading || !resultsAnswered) && weeks.length === 0 && <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{RESULTS.loading}</Mono>}
          {!results?.loading && resultsAnswered && weeks.length === 0 && (
            <div data-backing="results-empty" style={{ padding: '14px 15px', borderRadius: 13, border: `1px dashed ${LTOKENS.hair2}`, fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>
              {results?.error ? RESULTS.unavailable : RESULTS.empty}
            </div>
          )}
          {weeks.map((week) => (
            <div key={week.weekKey} data-backing="results-week" data-week={week.weekKey} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{RESULTS.weekTitle(week.weekKey)}</Mono>
              {(Array.isArray(week.pools) ? week.pools : []).map((p) => <BackingResultsCardDesk key={p.groupId} pod={p} accent={accent} onOpenTape={onOpenTape} />)}
            </div>
          ))}
          {results?.nextBefore && (
            <button type="button" className="lg-tap" data-backing="results-more" onClick={results.loadMore} disabled={results.loadingMore} style={{ all: 'unset', cursor: 'pointer', alignSelf: 'flex-start', padding: '7px 11px', borderRadius: 10, border: `1px solid ${LTOKENS.hair2}`, color: LTOKENS.ink2, fontSize: 12, fontWeight: 600 }}>
              {results.loadingMore ? RESULTS.loadingMore : RESULTS.loadMore}
            </button>
          )}
        </div>

        {/* the viewer's private record — theirs alone; never a ranking */}
        <aside data-backing="desk-record" style={{ borderRadius: 16, padding: '14px 16px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}` }}>
          <Eyebrow color={LTOKENS.ink3}>{STATS.eyebrow}</Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', margin: '4px 0 10px' }}>{STATS.title}</div>
          {myStats?.data ? <MyBackingStats stats={myStats.data} />
            : myStats?.error ? <div role="alert" style={{ fontSize: 12, color: LTOKENS.ink2 }}>{STATS.unavailable}</div>
              : <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{STATS.loading}</Mono>}
          <div style={{ marginTop: 10, padding: '6px 9px', borderRadius: 8, background: alpha(LTOKENS.bg, 0.5), display: 'inline-block' }}>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{STATS.label}</Mono>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The desktop Backing screen. Controlled: BackingScreen (the app) or the dev
 * preview page owns `view` / `section` and passes the handlers.
 *   view    — { kind: 'list' | 'card' | 'stake', groupId, odUserId } (the mobile screen's own)
 *   section — 'window' | 'week' | 'results'
 */
export default function BackingDesk({
  accent = LX.energy, uid = null,
  pods, state, windowState, inPlay, wallet, eligibility, myPitch = null,
  view, cardQuery = null, pod = null,
  section = DESK_SECTION.WINDOW, sections = [DESK_SECTION.WINDOW, DESK_SECTION.RESULTS], onSection,
  onBack, onOpenSeat, onToStake, onToCard, onBacked, onOpenTape,
  results = null, myStats = null, now = new Date(), services = null, battlesByGroup = null,
}) {
  const header = (
    <WideHeader state={state} loading={pods?.loading && !pods?.data} sections={sections} section={section} onSection={onSection} onBack={onBack} accent={accent} />
  );
  return (
    <div className="bkd-root" data-backing="screen" data-view={view?.kind ?? 'list'} data-layout="desktop" data-desk-section={section}>
      <style>{DESK_STYLE}</style>
      {section === DESK_SECTION.WEEK ? (
        <WeekView accent={accent} inPlay={inPlay} onOpenTape={onOpenTape} now={now} battlesByGroup={battlesByGroup} header={header} />
      ) : section === DESK_SECTION.RESULTS ? (
        <ResultsView accent={accent} results={results} myStats={myStats} onOpenTape={onOpenTape} header={header} />
      ) : (
        <WindowView
          accent={accent} uid={uid} pods={pods ?? { pods: [], data: null, loading: false, error: null }} state={state} windowState={windowState}
          wallet={wallet} eligibility={eligibility} myPitch={myPitch} view={view ?? { kind: 'list', groupId: null, odUserId: null }} cardQuery={cardQuery} pod={pod}
          sections={sections} section={section} onSection={onSection} onBack={onBack} onOpenSeat={onOpenSeat}
          onToStake={onToStake} onToCard={onToCard} onBacked={onBacked} onOpenTape={onOpenTape} services={services}
        />
      )}
    </div>
  );
}
