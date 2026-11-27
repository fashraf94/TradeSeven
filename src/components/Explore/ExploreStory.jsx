// src/components/Explore/ExploreStory.jsx
//
// Explore Build 1 — THE STORY READER (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.4; E-1, E-4, E-8),
// as Explore Build 2 draws it (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.3–§4.5; B-6, B-7, B-10,
// B-11, B-12, B-14; build prompt K-7 to K-11, K-15).
//
// One column below 1000 px, in reading order: (a deep story's way up,) the origin and kind, (its company,) the title,
// the deck, the byline with Save for later; the JUMP ROW (ExploreJumpRow: a back arrow and the sections, pinned once
// scrolled past); the body and its parts table; "What the story leaves open"; then, on an overview, the connections
// before the questions and the panel, and on a deep story the other way round (B-14); the sources (only those a
// connection cites or no figure names, exploreView.js figureOnlySourceIdsOf); and on a deep story, "Where next".
// From 1000 px the built two-column page: the questions and the panel are placed beside the story, neither column
// scrolls on its own, there is no jump row, and a back link names where it goes (B-11).
//
// THE CONNECTIONS ARE ONE LIST at every width (B-6): the chain itself (ExploreChain, size 'story'), each branch opening
// in place. A door is drawn only for a deep story at hand (K-7). The branch the chosen question rests on is marked.
// The pinned bar (ExplorePinnedBar) carries the panel's own primary action while the panel's button is off screen, and
// below 1000 px the chosen question beside it.

import React, { useRef } from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { FORMS, KINDS, atLimitOf, dateOf, formOf, itemFor, parentOf, saveBusyOf } from './exploreView';
import { CAPS, S, T, wash } from './exploreStyle';
import { BookmarkError, Disclosure, Eyebrow, Icon, LinkBtn, SaveToggle, Tag, Tickers } from './exploreParts';
import ExploreQuestions from './ExploreQuestions';
import ExplorePanel, { progressLineOf } from './ExplorePanel';
import ExplorePinnedBar from './ExplorePinnedBar';
import ExploreChain, { CountLine, Legend, Mark } from './ExploreChain';
import ExploreJumpRow, { JUMP_ROW_PX } from './ExploreJumpRow';

const COPY = EXPLORE_COPY.story;
const CARD = EXPLORE_COPY.card;
const HOME = EXPLORE_COPY.home;
const PANEL = EXPLORE_COPY.panel;
const RESET = { appearance: 'none', font: 'inherit', background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' };
const focusQuietly = (el) => { if (el && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true }); };

export function OriginTags({ story }) {
  return (
    <>
      {story.lead === 'product' ? <Tag tone="purple">{CARD.product}</Tag> : story.reporter.name ? <Tag tone="gold">{CARD.fromReporter(story.reporter.name)}</Tag> : null}
      {story.sample && <Tag tone="copper" dim>{CARD.sample}</Tag>}
    </>
  );
}

/** The kind of story, as a tag: "Overview" or "Deep story". */
export const KindTag = ({ story }) => <span data-explore-kind={story.kind}><Tag dim>{story.kind === KINDS.DEEP ? HOME.deepStory : HOME.overview}</Tag></span>;

/** The action the pinned bar carries: the panel's primary, by the same form and the same read (never its own). */
export function barActionOf({ form, item, quota }) {
  if (form === FORMS.B) return { kind: 'continue', label: PANEL.continue, line: progressLineOf(item.open), sessionId: item.open.sessionId };
  if ((form === FORMS.A || form === FORMS.C) && !atLimitOf(quota)) return { kind: 'work', label: PANEL.work, line: PANEL.cost(quota.perDay, quota.investigationsToday) };
  return null;
}

/** A deep story's "Where next" (Amendment B §4.4): one step up, where you are, and the overview's other connections. */
function WhereNext({ story, parent, byId, onOpenStory }) {
  const { overview, connection } = parent;
  const name = overview.subject ?? overview.title;
  const across = overview.connections.filter((c) => c.ref !== connection.ref);
  return (
    <section aria-labelledby={`ftx-next-h-${story.id}`} style={{ ...S.section, borderTop: `1px solid ${T.hair}`, paddingTop: 20 }} data-explore-where-next="" data-explore-section="sources">
      <h3 id={`ftx-next-h-${story.id}`} style={S.h2}>{COPY.whereNext}</h3>
      <button type="button" className="ftx-btn" data-explore-where-up={overview.id} data-explore-focus="where:up" onClick={(event) => onOpenStory(overview.id, null, event, { branch: connection.ref })} style={{ ...RESET, minHeight: 48, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ width: 14, display: 'flex', justifyContent: 'center', color: T.teal }}><Icon name="up" /></span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ ...CAPS, color: T.ink3 }}>{COPY.oneStepUp}</span>
          <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: T.teal, overflowWrap: 'anywhere' }}>{overview.title}</span>
        </span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }} data-explore-you-are-here="">
        <Mark basis="origin" size={14} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ ...CAPS, color: T.ink3 }}>{COPY.youAreHere}</span>
          <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.25, color: T.ink, overflowWrap: 'anywhere' }}>{story.subject ?? story.title}</span>
        </span>
      </div>
      {across.length > 0 ? (
        <>
          <span style={{ ...CAPS, color: T.ink3, paddingTop: 6 }}>{COPY.across(name)}</span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {across.map((c) => {
              const target = c.leadsToStory ? byId.get(c.leadsToStory) ?? null : null;
              const deep = target && target.kind === KINDS.DEEP ? target : null;
              return (
                <li key={c.ref}>
                  <button type="button" className="ftx-btn" data-explore-where-step={c.ref} data-explore-focus={`where:${c.ref}`} onClick={(event) => onOpenStory(overview.id, null, event, { branch: c.ref })} style={{ ...RESET, minHeight: 44, width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <Mark basis={c.basis} size={12} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: T.ink, overflowWrap: 'anywhere' }}>{c.who}</span>
                      <span className="ftx-sr">{COPY.basis[c.basis]}</span>
                      {deep ? <span style={{ fontSize: 13, lineHeight: 1.35, color: T.ink, overflowWrap: 'anywhere' }} data-explore-where-door={deep.id}><span style={{ ...CAPS, color: T.teal, marginRight: 6 }}>{HOME.deepStory}</span>{deep.title}</span> : null}
                    </span>
                    <span aria-hidden="true" style={{ color: deep ? T.teal : T.ink3, display: 'flex' }}><Icon name="right" /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p style={S.meta}>{COPY.acrossNote}</p>
        </>
      ) : null}
    </section>
  );
}

export default function ExploreStory({
  story, byId, research, bookmarks, choice, onChoice, backLabel, onBack, onWork, onContinue, onViewIt, onOpenStory, onOpenCompany,
  open, onToggleBranch, titleRef, navBelow = false, barLeft = 0, sheetOpen = false,
}) {
  const rootRef = useRef(null);
  const primaryRef = useRef(null);
  const connectionsHeadRef = useRef(null);
  const questionsHeadRef = useRef(null);
  const selectedId = choice.selectedId;
  const question = story.questions.find((q) => q.id === selectedId) ?? story.questions[0];
  const value = Object.hasOwn(choice.edits, question.id) ? choice.edits[question.id] : question.text;
  const form = formOf(research, story.id);
  const item = itemFor(research, story.id);
  const quota = research?.status === 'ready' ? research.quota : null;
  const saved = bookmarks.list.some((b) => b.storyId === story.id);
  const saveBusy = saveBusyOf(bookmarks, story.id);
  const toggleFrom = (origin) => () => bookmarks.toggle(story, origin);
  const bar = barActionOf({ form, item, quota });
  const work = (event) => onWork(event, story, value, question.id);
  const published = dateOf(story.publishedAt);
  const deep = story.kind === KINDS.DEEP;
  const parent = parentOf(story, byId);
  const hasConnections = story.connections.length > 0;
  const hasSources = story.sources.length > 0;
  // the story rows the side block spans beside them from 1000 px (the article, the body, and each optional block)
  const leftRows = 2 + (story.openQuestion ? 1 : 0) + (hasConnections ? 1 : 0) + (hasSources ? 1 : 0) + (parent ? 1 : 0);

  const setEdit = (text) => onChoice({ ...choice, edits: { ...choice.edits, [question.id]: text } });
  const reset = () => {
    const edits = { ...choice.edits };
    delete edits[question.id];
    onChoice({ ...choice, edits });
  };

  // B-14's order, with what the story has; Story never carries a count
  const sections = (deep ? ['story', 'questions', 'connections', 'sources'] : ['story', 'connections', 'questions', 'sources'])
    .filter((id) => (id === 'connections' ? hasConnections : id === 'sources' ? hasSources : true))
    .map((id) => ({ id, label: COPY.jump[id], count: id === 'story' ? null : id === 'questions' ? story.questions.length : id === 'connections' ? story.connections.length : story.sources.length }));
  /** A jump (K-10): scroll the section in, clear of the pinned row (the story itself: to the top), then its heading takes focus. */
  const jumpTo = (id) => {
    const heading = {
      story: titleRef?.current,
      connections: connectionsHeadRef.current,
      questions: questionsHeadRef.current,
      sources: rootRef.current?.querySelector('[data-explore-sources] button') ?? null,
    }[id];
    if (!heading) return;
    if (id === 'story') window.scrollTo(0, 0);
    else window.scrollTo(0, Math.max(0, Math.round(heading.getBoundingClientRect().top + window.scrollY - JUMP_ROW_PX - 8)));
    focusQuietly(heading);
  };

  const connections = hasConnections ? (
    <section key="connections" aria-labelledby={`ftx-conn-h-${story.id}`} style={{ ...S.section, gap: 12 }} data-explore-connections="" data-explore-section="connections">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 id={`ftx-conn-h-${story.id}`} ref={connectionsHeadRef} tabIndex={-1} style={{ ...S.h2, outline: 'none' }}>{COPY.connections}</h3>
        <span style={S.meta}>{story.connections.length}</span>
      </div>
      <CountLine story={story} />
      <Legend />
      <div style={{ paddingTop: 4 }}>
        <ExploreChain story={story} size="story" byId={byId} thisConnection={question.fromConnection} open={open} onToggle={onToggleBranch} onOpenStory={onOpenStory} onOpenCompany={onOpenCompany} />
      </div>
      <p style={{ ...S.meta, borderTop: `1px solid ${T.hair}`, paddingTop: 12 }}>{COPY.leadsNote}</p>
      <p style={S.small}>{COPY.connectionsClose}</p>
    </section>
  ) : null;

  const side = (
    <div key="side" data-ftx-side="" data-explore-section="questions" style={{ ...S.col, gap: 22 }}>
      <ExploreQuestions story={story} selectedId={question.id} onSelect={(id) => onChoice({ ...choice, selectedId: id })} headingRef={questionsHeadRef} />
      <ExplorePanel
        form={form}
        story={story}
        question={question}
        value={value}
        onEdit={setEdit}
        onReset={reset}
        item={item}
        quota={quota}
        saved={saved}
        saveBusy={saveBusy}
        onToggleSave={toggleFrom('panel')}
        saveError={<BookmarkError bookmarks={bookmarks} storyId={story.id} origin="panel" />}
        onWork={work}
        onContinue={onContinue}
        onViewIt={onViewIt}
        onRetry={research?.retry}
        primaryRef={primaryRef}
        refreshing={research?.refreshing === true}
        onOpenCompany={onOpenCompany}
      />
    </div>
  );

  return (
    <div ref={rootRef} data-explore-screen="story" data-explore-story-kind={story.kind} style={{ paddingBottom: 96 }}>
      <div className="ftx-wide-only" style={{ marginBottom: 8 }}><LinkBtn onClick={onBack} data-explore-back="">{COPY.backTo(backLabel)}</LinkBtn></div>
      <div className="ftx-grid" data-ftx-grid="story" style={{ '--ftx-left-rows': leftRows }}>
        <article style={{ ...S.col, gap: 14 }} data-explore-section="story">
          {parent ? (
            <div style={{ margin: '-8px 0 -6px' }}>
              <button type="button" className="ftx-btn" aria-label={COPY.wayUp(parent.overview.subject ?? parent.overview.title, parent.connection.who)} data-explore-way-up={parent.overview.id} data-explore-focus="wayup" onClick={(event) => onOpenStory(parent.overview.id, null, event, { branch: parent.connection.ref })} style={{ ...RESET, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: T.teal, maxWidth: '100%' }}>
                <Icon name="up" />
                <span style={{ fontSize: 14, lineHeight: 1.35, minWidth: 0, overflowWrap: 'anywhere' }}>{HOME.path(parent.overview.subject ?? parent.overview.title, parent.connection.who)}</span>
              </button>
            </div>
          ) : null}
          <div style={S.row}><OriginTags story={story} /><KindTag story={story} />{story.reporter.beat && <span style={S.small}>{story.reporter.beat}</span>}</div>
          {deep && story.about.length > 0 ? (
            <div style={{ ...S.row, gap: 10 }} data-explore-about="">
              <span style={{ ...CAPS, color: T.ink3 }}>{COPY.about}</span>
              <Tickers list={story.about} onOpen={onOpenCompany} keyPrefix="about" />
            </div>
          ) : null}
          <h2 ref={titleRef} className="ftx-h1" tabIndex={-1} data-explore-story-title="" style={{ outline: 'none', textWrap: 'balance' }}>{story.title}</h2>
          {story.deck && <p className="ftx-deck" style={{ fontSize: 18, textWrap: 'pretty' }}>{story.deck}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 0', borderTop: `1px solid ${T.hair}`, borderBottom: `1px solid ${T.hair}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              {story.reporter.name && <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{story.reporter.name}</span>}
              <span style={S.small} data-explore-published="">{COPY.published(published, story.evidenceSpan)}</span>
            </div>
            <SaveToggle kind="secondary" pressed={saved} busy={saveBusy} label={CARD.save} onToggle={toggleFrom('byline')} />
          </div>
          <BookmarkError bookmarks={bookmarks} storyId={story.id} origin="byline" />
        </article>
        <ExploreJumpRow sections={sections} rootRef={rootRef} onJump={jumpTo} backLabel={backLabel} onBack={onBack} left={barLeft} inertNow={sheetOpen} blocksKey={parent ? 'where-next' : ''} />
        <div style={{ ...S.col, gap: 18 }} data-explore-section="story">
          <div className="ftx-prose" data-explore-body="">{story.body.map((p, i) => <p key={i} style={{ textWrap: 'pretty' }}>{p}</p>)}</div>
          {story.parts.length > 0 && (
            <div role="table" aria-label={COPY.parts.caption} style={{ ...S.box, gap: 0, padding: '4px 14px' }} data-explore-parts="">
              <div role="row" className="ftx-sr">
                <span role="columnheader">{COPY.parts.name}</span><span role="columnheader">{COPY.parts.job}</span><span role="columnheader">{COPY.parts.timing}</span>
              </div>
              {story.parts.map((p, i) => (
                <div role="row" key={p.name} className="ftx-parts" style={{ borderTop: i ? `1px solid ${T.hair}` : 'none' }}>
                  <span role="rowheader" style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{p.name}</span>
                  <span role="cell" style={{ fontSize: 13.5, color: T.ink }}>{p.job}</span>
                  <span role="cell" style={S.meta}>{p.timing}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {story.openQuestion && (
          <div style={{ ...S.box, background: wash('copper', 0.06), border: `1px solid ${wash('copper', 0.3)}`, gap: 6 }} data-explore-leaves-open="" data-explore-section="story">
            <Eyebrow tone="copper">{COPY.leavesOpen}</Eyebrow>
            <p style={{ margin: 0, fontSize: 16.5, fontWeight: 600, lineHeight: 1.4, color: T.ink, overflowWrap: 'anywhere' }}>{story.openQuestion}</p>
          </div>
        )}
        {deep ? [side, connections] : [connections, side]}
        {hasSources && (
          <div data-explore-sources="" data-explore-section="sources">
            <Disclosure label={COPY.sources} count={String(story.sources.length)}>
              <p style={S.meta}>{COPY.sourcesOpen(published)}</p>
              {story.sources.map((s) => (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10, borderTop: `1px solid ${T.hair}` }} data-explore-source={s.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{s.name}</span>
                    {s.dated && <span style={S.meta} data-explore-source-dated="">{COPY.evidenceDated(s.dated)}</span>}
                  </div>
                  {s.kind && <span style={S.small}>{s.kind}</span>}
                  {s.excerpt && <p style={{ ...S.body, fontSize: 13.5, color: T.ink2 }}>“{s.excerpt}”</p>}
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: T.teal, fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{COPY.openSource}</a>}
                </div>
              ))}
            </Disclosure>
          </div>
        )}
        {parent ? <WhereNext story={story} parent={parent} byId={byId} onOpenStory={onOpenStory} /> : null}
      </div>
      {bar && (
        <ExplorePinnedBar
          targetRef={primaryRef}
          targetKey={`${story.id}:${form}:${bar.kind}`}
          label={bar.label}
          line={bar.line}
          onAct={bar.kind === 'continue' ? (event) => onContinue(event, bar.sessionId) : work}
          disabled={bar.kind === 'work' && !value.trim()}
          refreshing={research?.refreshing === true}
          inertNow={sheetOpen}
          navBelow={navBelow}
          left={barLeft}
          question={bar.kind === 'continue' ? item.open.question ?? value : value}
          onQuestion={() => jumpTo('questions')}
        />
      )}
    </div>
  );
}
