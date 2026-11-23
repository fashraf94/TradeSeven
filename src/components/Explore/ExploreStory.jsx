// src/components/Explore/ExploreStory.jsx
//
// Explore Build 1 — THE STORY READER (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.4; E-1, E-4, E-8).
// One column on a phone, in the spec's order: origin, beat, title, deck; the byline with Save for later; the body as
// written (inferred statements arrive qualified in the text — the reader adds no qualifier, E-8); the parts table;
// "What the story leaves open"; the questions; the panel; the published connections (collapsed, each with one of the
// three E-1 labels); the sources (collapsed, each with its own date). Two columns from 1000 px: items 1–5, 8, 9 on the
// left and 6, 7 on the right. One DOM at every width; neither column scrolls on its own.
//
// The pinned bar (ExplorePinnedBar) carries the panel's own primary action while the panel's button is off screen.

import React, { useRef } from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { FORMS, atLimitOf, dateOf, formOf, itemFor, saveBusyOf } from './exploreView';
import { S, T, wash } from './exploreStyle';
import { BookmarkError, Disclosure, Eyebrow, LinkBtn, SaveToggle, Tag } from './exploreParts';
import ExploreQuestions from './ExploreQuestions';
import ExplorePanel, { progressLineOf } from './ExplorePanel';
import ExplorePinnedBar from './ExplorePinnedBar';

const COPY = EXPLORE_COPY.story;
const CARD = EXPLORE_COPY.card;
const PANEL = EXPLORE_COPY.panel;

export function OriginTags({ story }) {
  return (
    <>
      {story.lead === 'product' ? <Tag tone="purple">{CARD.product}</Tag> : story.reporter.name ? <Tag tone="gold">{CARD.fromReporter(story.reporter.name)}</Tag> : null}
      {story.sample && <Tag tone="copper" dim>{CARD.sample}</Tag>}
    </>
  );
}

/** The action the pinned bar carries: the panel's primary, by the same form and the same read (never its own). */
export function barActionOf({ form, item, quota }) {
  if (form === FORMS.B) return { kind: 'continue', label: PANEL.continue, line: progressLineOf(item.open), sessionId: item.open.sessionId };
  if ((form === FORMS.A || form === FORMS.C) && !atLimitOf(quota)) return { kind: 'work', label: PANEL.work, line: PANEL.cost(quota.perDay, quota.investigationsToday) };
  return null;
}

export default function ExploreStory({
  story, research, bookmarks, choice, onChoice, onBack, onWork, onContinue, onViewIt, titleRef, navBelow = false, barLeft = 0, sheetOpen = false,
}) {
  const primaryRef = useRef(null);
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
  const work = (event) => onWork(event, story, value);
  const published = dateOf(story.publishedAt);
  // the story rows the side block spans beside them from 1000 px (the article, the body, and each optional block)
  const leftRows = 2 + (story.openQuestion ? 1 : 0) + (story.connections.length > 0 ? 1 : 0) + (story.sources.length > 0 ? 1 : 0);

  const setEdit = (text) => onChoice({ ...choice, edits: { ...choice.edits, [question.id]: text } });
  const reset = () => {
    const edits = { ...choice.edits };
    delete edits[question.id];
    onChoice({ ...choice, edits });
  };

  return (
    <div data-explore-screen="story" style={{ paddingBottom: 96 }}>
      <div style={{ marginBottom: 8 }}><LinkBtn onClick={onBack} data-explore-back="">{COPY.back}</LinkBtn></div>
      <div className="ftx-grid" data-ftx-grid="story" style={{ '--ftx-left-rows': leftRows }}>
          <article style={{ ...S.col, gap: 14 }}>
            <div style={S.row}><OriginTags story={story} />{story.reporter.beat && <span style={S.small}>{story.reporter.beat}</span>}</div>
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
          <div style={{ ...S.col, gap: 18 }}>
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
            <div style={{ ...S.box, background: wash('copper', 0.06), border: `1px solid ${wash('copper', 0.3)}`, gap: 6 }} data-explore-leaves-open="">
              <Eyebrow tone="copper">{COPY.leavesOpen}</Eyebrow>
              <p style={{ margin: 0, fontSize: 16.5, fontWeight: 600, lineHeight: 1.4, color: T.ink, overflowWrap: 'anywhere' }}>{story.openQuestion}</p>
            </div>
          )}
          <div data-ftx-side="" style={{ ...S.col, gap: 22 }}>
            <ExploreQuestions story={story} selectedId={question.id} onSelect={(id) => onChoice({ ...choice, selectedId: id })} />
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
            />
          </div>
          {story.connections.length > 0 && (
            <div data-explore-connections="">
              <Disclosure label={COPY.connections} count={String(story.connections.length)}>
                {story.connections.map((c) => (
                  <div key={c.who} style={{ ...S.card, gap: 6 }} data-explore-connection={c.basis}>
                    <div style={S.row}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{c.who}</span>
                      <Tag tone={c.basis === 'source_cited' ? 'teal' : c.basis === 'reporters_reading' ? 'gold' : 'ink2'} dim={c.basis === 'no_source_yet'}>{COPY.basis[c.basis]}</Tag>
                    </div>
                    {c.what && <p style={{ ...S.body, fontSize: 13.5 }}>{c.what}</p>}
                    {c.basisLine && <p style={S.meta}>{c.basisLine}</p>}
                    {c.leads.length > 0 && <p style={S.small}>{COPY.leads(c.leads.join(' · '))}</p>}
                  </div>
                ))}
                <p style={S.small}>{COPY.connectionsClose}</p>
              </Disclosure>
            </div>
          )}
          {story.sources.length > 0 && (
            <div data-explore-sources="">
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
        />
      )}
    </div>
  );
}
