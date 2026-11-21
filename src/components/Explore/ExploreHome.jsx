// src/components/Explore/ExploreHome.jsx
//
// Explore Build 1 — HOME (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.2, §3.7, §3.8; E-2, E-7).
// Top to bottom on a phone: the line under the page's heading ("Explore" is the Search page's own heading); search;
// Research in progress (only with an open investigation in the read); the question cards (one per featured question,
// newest story first: the QUESTION is the headline); Saved for later; Browse topics. From 1000 px, Research in
// progress, Saved and topics sit in a right-hand column that scrolls with the page. One DOM at every width.
//
// Every state line is the read's (exploreView.js stateOf): reading, saving and choosing start nothing.

import React, { useState } from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { BOOKMARKS_MAX, RESEARCH, dateOf, featuredCardsOf, itemFor, stateOf, topicsOf } from './exploreView';
import { S, T, btnStyle, wash } from './exploreStyle';
import { Btn, Eyebrow, Notice, SaveToggle, StatusLine } from './exploreParts';
import ExploreSearch from './ExploreSearch';
import { OriginTags } from './ExploreStory';
import { progressLineOf, endedLineOf } from './ExplorePanel';

const COPY = EXPLORE_COPY.home;
const CARD = EXPLORE_COPY.card;
const STATE = EXPLORE_COPY.state;
const BOOKMARK = EXPLORE_COPY.bookmark;

/** The state line's words (spec §3.7), from stateOf's view of the read. */
export function stateLinesOf(state) {
  if (!state) return [];
  if (state.kind === 'open') {
    return [progressLineOf({ filled: state.filled, parts: state.parts }), Number.isSafeInteger(state.stepsLeft) ? STATE.stepsLeft(state.stepsLeft) : null].filter(Boolean);
  }
  if (state.kind === 'saved' || state.kind === 'concluded') return [endedLineOf({ ended: state.kind, at: state.at })];
  if (state.kind === 'bookmarked') return [COPY.savedState];
  return [];
}

function StateLine({ state }) {
  const lines = stateLinesOf(state);
  if (!lines.length) return null;
  const tone = state.kind === 'open' ? 'teal' : state.kind === 'bookmarked' ? 'ink2' : 'gold';
  return <p data-explore-state={state.kind} style={{ ...S.small, color: tone === 'ink2' ? T.ink2 : T[tone], fontWeight: 600 }}>{lines.join(' · ')}</p>;
}

function BookmarkError({ bookmarks, storyId }) {
  const error = bookmarks.error;
  if (!error || error.storyId !== storyId) return null;
  const words = error.kind === 'cap' ? BOOKMARK.cap(BOOKMARKS_MAX) : error.kind === 'remove' ? BOOKMARK.failedRemove : BOOKMARK.failedSave;
  return <Notice role="alert" tone="copper"><span data-explore-bookmark-error={error.kind}>{words}</span></Notice>;
}

function QuestionCard({ story, question, item, saved, bookmarks, onOpenStory, onContinue }) {
  const state = stateOf({ item, bookmarked: saved });
  const open = item?.open ?? null;
  return (
    <article style={{ ...S.box, padding: 'clamp(16px, 3vw, 24px)', borderRadius: 18, gap: 12 }} data-explore-card={story.id}>
      <div style={S.row}><OriginTags story={story} /></div>
      <h3 className="ftx-qh" data-explore-card-question="">{question.text}</h3>
      <p style={S.meta}>
        <span style={{ color: T.ink, fontWeight: 600 }}>{story.title}</span>
        {' · '}
        {CARD.byline(story.reporter.name, dateOf(story.publishedAt))}
      </p>
      <StateLine state={state} />
      <div style={S.actions}>
        <Btn
          key="primary"
          kind="primary"
          data-explore-card-primary={open ? 'continue' : 'read'}
          onClick={(event) => (open ? onContinue(event, open.sessionId) : onOpenStory(story.id, question.id, event))}
        >
          {open ? CARD.continue : CARD.read}
        </Btn>
        {open && <Btn key="read" kind="secondary" onClick={(event) => onOpenStory(story.id, question.id, event)} data-explore-card-read="">{CARD.read}</Btn>}
        <SaveToggle key="save" pressed={saved} busy={bookmarks.pending.includes(story.id)} label={CARD.save} onToggle={() => bookmarks.toggle(story)} />
      </div>
      <BookmarkError bookmarks={bookmarks} storyId={story.id} />
    </article>
  );
}

export default function ExploreHome({ explore, stocksData, onOpenStory, onContinue, onOpenCompany, onOwnWords, introRef }) {
  const { research, stories, bookmarks } = explore;
  const [topic, setTopic] = useState(null);
  const list = stories.status === 'ready' ? stories.list : [];
  const cards = featuredCardsOf(list).filter((c) => !topic || c.story.topics.includes(topic));
  const topics = topicsOf(list);
  const isSaved = (id) => bookmarks.list.some((b) => b.storyId === id);
  const ready = research.status === RESEARCH.READY;
  const inProgress = ready ? research.items.filter((it) => it.open) : [];
  const storyById = new Map(list.map((s) => [s.id, s]));

  return (
    <div data-explore-screen="home" style={{ ...S.col, gap: 22 }}>
      <p ref={introRef} tabIndex={-1} style={{ ...S.meta, fontSize: 15, maxWidth: 560, outline: 'none' }} data-explore-intro="">{COPY.intro}</p>
      <div className="ftx-grid" data-ftx-grid="home">
        <div className="ftx-col" data-ftx-col="main">
          <div className="ftx-o1">
            <ExploreSearch stories={list} research={research} stocksData={stocksData} onOpenStory={onOpenStory} onOpenCompany={onOpenCompany} onOwnWords={onOwnWords} />
          </div>
          <section className="ftx-o3" aria-label={COPY.questionsLabel} style={{ ...S.col, gap: 14 }} data-explore-cards="">
            {stories.status === 'idle' || stories.status === 'loading' ? <StatusLine>{COPY.loading}</StatusLine> : null}
            {stories.status === 'failed' && (
              <div style={S.section}>
                <Notice role="alert" tone="copper">{COPY.failed}</Notice>
                <div><Btn onClick={stories.retry} data-explore-retry-stories="">{COPY.tryAgain}</Btn></div>
              </div>
            )}
            {stories.status === 'ready' && list.length === 0 && <p role="status" style={{ ...S.meta, fontSize: 15 }} data-explore-empty="">{COPY.empty}</p>}
            {stories.status === 'ready' && list.length > 0 && cards.length === 0 && <p role="status" style={S.meta}>{COPY.noTopicMatch}</p>}
            {cards.map(({ story, question }) => (
              <QuestionCard
                key={`${story.id}:${question.id}`}
                story={story}
                question={question}
                item={itemFor(research, story.id)}
                saved={isSaved(story.id)}
                bookmarks={bookmarks}
                onOpenStory={onOpenStory}
                onContinue={onContinue}
              />
            ))}
          </section>
        </div>
        <div className="ftx-col" data-ftx-col="side">
          {inProgress.length > 0 && (
            <section className="ftx-o2" aria-labelledby="ftx-prog-h" style={S.section} data-explore-in-progress="">
              <Eyebrow as="h2" id="ftx-prog-h" tone="teal">{COPY.inProgress}</Eyebrow>
              {inProgress.map((it) => (
                <div key={it.storyId} style={{ ...S.card, border: `1px solid ${wash('teal', 0.3)}` }} data-explore-progress-row={it.storyId}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, color: T.ink, overflowWrap: 'anywhere' }}>{it.open.question ?? storyById.get(it.storyId)?.title ?? ''}</span>
                  <StateLine state={stateOf({ item: it })} />
                  <div><Btn kind="primary" onClick={(event) => onContinue(event, it.open.sessionId)} data-explore-progress-continue="">{CARD.continue}</Btn></div>
                </div>
              ))}
            </section>
          )}
          <section className="ftx-o4" aria-labelledby="ftx-saved-h" style={S.section} data-explore-saved="">
            <Eyebrow as="h2" id="ftx-saved-h">{COPY.saved}</Eyebrow>
            {bookmarks.status === 'loading' && <StatusLine>{COPY.savedLoading}</StatusLine>}
            {bookmarks.status === 'failed' && (
              <div style={S.section}>
                <Notice role="alert" tone="copper">{COPY.savedFailed}</Notice>
                <div><Btn onClick={bookmarks.retry} data-explore-retry-bookmarks="">{COPY.tryAgain}</Btn></div>
              </div>
            )}
            {bookmarks.status === 'ready' && bookmarks.list.length === 0 && <p style={S.small}>{COPY.savedEmpty}</p>}
            {bookmarks.list.map((b) => {
              const story = storyById.get(b.storyId) ?? null;
              const gone = stories.status === 'ready' && !story;
              return (
                <div key={b.storyId} style={{ ...S.card, gap: 6 }} data-explore-saved-row={b.storyId} data-explore-gone={gone ? 'true' : undefined}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, color: T.ink, overflowWrap: 'anywhere' }}>{story?.title ?? b.title}</span>
                  {gone ? <p style={S.small}>{COPY.gone}</p> : <StateLine state={stateOf({ item: itemFor(research, b.storyId), bookmarked: true })} />}
                  <div style={S.actions}>
                    {story && <Btn onClick={(event) => onOpenStory(story.id, null, event)} data-explore-saved-read="">{CARD.read}</Btn>}
                    {gone && (
                      <Btn ariaDisabled={bookmarks.pending.includes(b.storyId)} onClick={() => bookmarks.remove(b.storyId)} data-explore-saved-remove="">{COPY.remove}</Btn>
                    )}
                  </div>
                  <BookmarkError bookmarks={bookmarks} storyId={b.storyId} />
                </div>
              );
            })}
          </section>
          {topics.length > 0 && (
            <section className="ftx-o5" aria-labelledby="ftx-topic-h" style={S.section} data-explore-topics="">
              <Eyebrow as="h2" id="ftx-topic-h">{COPY.topics}</Eyebrow>
              <div style={S.row}>
                {[null, ...topics].map((t) => (
                  <button
                    key={t ?? '*'}
                    type="button"
                    className="ftx-btn"
                    aria-pressed={topic === t ? 'true' : 'false'}
                    onClick={() => setTopic(t)}
                    data-explore-topic={t ?? '*'}
                    style={{ ...btnStyle('secondary'), borderRadius: 999, padding: '8px 14px', ...(topic === t ? { borderColor: T.teal, color: T.teal } : {}) }}
                  >
                    <span style={{ fontSize: 13.5 }}>{t ?? COPY.allTopics}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
