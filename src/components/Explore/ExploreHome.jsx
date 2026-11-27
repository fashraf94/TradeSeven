// src/components/Explore/ExploreHome.jsx
//
// Explore Build 1 — HOME (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.2, §3.7, §3.8; E-2, E-7), as
// Explore Build 2 draws it: THE FRONT PAGE (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.1, §4.2;
// B-3, B-4, B-5, B-8, B-16; build prompt K-12, K-13). Top to bottom on a phone:
//   1. the line under the page's heading, and search;
//   2. the shelf, "Your theses" (ExploreShelf) — here once it holds a thesis;
//   3. the hero: the newest overview's featured question, its group as tickers (a broad question) or its unknown
//      (a specific one), the chain at hero size with the question's branch marked and any door under its branch, the
//      count line, Read the story and Save for later;
//   4. "Start from something you use": one tile per other product-led overview (absent when there is none);
//   5. "Questions worth researching": the key, the topics, one card per other overview (B-3) with its chain in short;
//   — the shelf while it holds nothing;
//   6. "Latest deep stories": the newest three (absent when there is none);
//   7. Saved for later, as built.
// From 1000 px the hero sits beside a column holding the shelf and Saved for later, and the cards are three columns.
// The two placements a width decides (the shelf, Saved for later) are made by one media query, so each is drawn ONCE
// and the reading order is the visual order at every width (review C-1).
//
// Every state line is the read's (exploreView.js stateOf, shelfOf): reading, saving and choosing start nothing. A
// bookmark says "not researched" only when the read has answered (review A-1); "No longer available" only when the
// stories read holds every published story (A-2); a Save toggle acts only once the bookmarks are known (A-5). A story is
// in one place only: the hero's story is not also a card, a product-led overview is a tile and not a card, and a deep
// story is only in the Latest row. Nothing on the front page reads a story by id.

import React, { useState } from 'react';
import { EXPLORE_COMPARE_ROUTE } from '../../config/exploreFlags';
import { EXPLORE_COPY } from './exploreCopy';
import { RESEARCH, countsOf, dateOf, frontPageOf, itemFor, parentOf, saveBusyOf, stateOf, topicsOf } from './exploreView';
import { S, T, WIDE_QUERY, btnStyle } from './exploreStyle';
import { BookmarkError, Btn, Eyebrow, Notice, SaveToggle, StatusLine, Tag, useMatches } from './exploreParts';
import ExploreSearch from './ExploreSearch';
import ExploreShelf, { shelfHolds } from './ExploreShelf';
import ExploreChain, { CountLine, Legend, Mark } from './ExploreChain';
import { KindTag, OriginTags } from './ExploreStory';
import { GroupBlock, progressLineOf, endedLineOf } from './ExplorePanel';

const COPY = EXPLORE_COPY.home;
const CARD = EXPLORE_COPY.card;
const STATE = EXPLORE_COPY.state;
const CHAIN = EXPLORE_COPY.chain;
const RESET = { appearance: 'none', font: 'inherit', background: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left' };

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

const byline = (story) => (
  <p style={S.meta}>
    <span style={{ color: T.ink, fontWeight: 600 }}>{story.title}</span>
    {' · '}
    {CARD.byline(story.reporter.name, dateOf(story.publishedAt))}
  </p>
);

/** The hero (Amendment B §4.1 item 3, B-8): an overview's featured question, never a large count. */
function Hero({ story, question, byId, wide, saved, bookmarks, onOpenStory, onOpenCompany }) {
  const compare = EXPLORE_COMPARE_ROUTE === true; // the switch, read at call time (K-2): the literal, which the build folds
  const origin = `hero:${story.id}`;
  const tags = <div style={S.row}><OriginTags story={story} /><KindTag story={story} /></div>;
  const head = <h2 id={`ftx-hero-h-${story.id}`} className="ftx-qh" style={{ textWrap: 'balance' }} data-explore-hero-question="">{question.text}</h2>;
  const what = question.broad
    ? <GroupBlock question={question} compare={compare} onOpenCompany={onOpenCompany} keyPrefix={`hero:${question.id}`} notes={false} />
    : question.unknown
      ? <p style={{ ...S.body, fontSize: 13.5 }} data-explore-hero-unknown=""><span style={{ ...S.eyebrow, display: 'inline', marginRight: 8 }}>{COPY.stillUnknown}</span>{question.unknown}</p>
      : null;
  const chain = <ExploreChain story={story} size="hero" byId={byId} thisConnection={question.fromConnection} onOpenStory={onOpenStory} />;
  const actions = (
    <div style={S.section}>
      <div style={S.actions}>
        <Btn kind="primary" onClick={(event) => onOpenStory(story.id, question.id, event)} data-explore-hero-read="">{CARD.read}</Btn>
        <SaveToggle kind="secondary" pressed={saved} busy={saveBusyOf(bookmarks, story.id)} label={CARD.save} onToggle={() => bookmarks.toggle(story, origin)} />
      </div>
      <p style={S.small}>{COPY.free}</p>
      <BookmarkError bookmarks={bookmarks} storyId={story.id} origin={origin} />
    </div>
  );
  const shell = { ...S.box, padding: 'clamp(16px, 3vw, 28px)', borderRadius: 18 };
  return (
    <article style={shell} data-explore-hero={story.id} aria-labelledby={`ftx-hero-h-${story.id}`}>
      {wide ? (
        <div className="ftx-hero">
          <div style={{ ...S.col, gap: 14 }}>{tags}{head}{byline(story)}{what}{actions}</div>
          <div className="ftx-hero-side">{chain}<CountLine story={story} /></div>
        </div>
      ) : (
        <div className="ftx-hero">{tags}{head}{byline(story)}{what}<div style={{ padding: '4px 0' }}>{chain}</div><CountLine story={story} />{actions}</div>
      )}
    </article>
  );
}

/** One card per overview (B-3): the question first, the chain in short (a door only marked), the counts, the story. */
function QuestionCard({ story, question, byId, item, saved, known, bookmarks, onOpenStory, onContinue }) {
  const state = stateOf({ item, bookmarked: saved && known });
  const origin = `card:${story.id}:${question.id}`;
  const open = item?.open ?? null;
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, borderTop: `1px solid ${T.hair}`, paddingTop: 14 }} data-explore-card={story.id}>
      <div style={S.row}><OriginTags story={story} /><KindTag story={story} /></div>
      <h3 className="ftx-qh" style={{ textWrap: 'pretty' }} data-explore-card-question="">{question.text}</h3>
      <div style={{ paddingTop: 4 }}><ExploreChain story={story} size="card" byId={byId} /></div>
      <CountLine story={story} />
      {byline(story)}
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
        <SaveToggle key="save" pressed={saved} busy={saveBusyOf(bookmarks, story.id)} label={CARD.save} onToggle={() => bookmarks.toggle(story, origin)} />
      </div>
      <BookmarkError bookmarks={bookmarks} storyId={story.id} origin={origin} />
    </article>
  );
}

/** "Start from something you use" (B-5): one tile per product-led overview that is not the hero. */
function StartRow({ tiles, onOpenStory }) {
  return (
    <section aria-labelledby="ftx-start-h" style={S.section} data-explore-start="">
      <h2 id="ftx-start-h" style={S.h2}>{COPY.startFrom}</h2>
      <div className="ftx-tiles">
        {tiles.map((s) => {
          const { n, sourced, unchecked } = countsOf(s);
          return (
            <button key={s.id} type="button" className="ftx-rowbtn" data-explore-tile={s.id} onClick={(event) => onOpenStory(s.id, null, event)} style={{ ...RESET, minHeight: 64, padding: '10px 14px', borderRadius: 14, border: `1px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center', minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: T.ink, minWidth: 0, overflowWrap: 'anywhere' }}><Mark basis="origin" size={9} />{s.productName ?? s.subject ?? s.title}</span>
              <span style={{ fontSize: 12, color: T.ink2, lineHeight: 1.35 }}>{CHAIN.count(n, sourced, unchecked)}</span>
              {s.sample ? <span><Tag tone="copper" dim>{CARD.sample}</Tag></span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** "Latest deep stories" (B-4): the newest three, each under its overview and connection when the overview is at hand. */
function LatestRow({ latest, byId, onOpenStory }) {
  return (
    <section aria-labelledby="ftx-latest-h" style={S.section} data-explore-latest-row="">
      <h2 id="ftx-latest-h" style={S.h2}>{COPY.latest}</h2>
      <p style={S.meta}>{COPY.latestNote}</p>
      <div className="ftx-latest">
        {latest.map((d) => {
          const parent = parentOf(d, byId);
          return (
            <button key={d.id} type="button" className="ftx-btn" data-explore-latest={d.id} onClick={(event) => onOpenStory(d.id, null, event)} style={{ ...RESET, border: 'none', borderTop: `1px solid ${T.hair}`, minHeight: 48, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={S.row}><Tag dim>{COPY.deepStory}</Tag>{d.sample ? <Tag tone="copper" dim>{CARD.sample}</Tag> : null}</span>
              {parent ? <span style={{ ...S.eyebrow, color: T.ink2 }} data-explore-latest-path="">{COPY.path(parent.overview.subject ?? parent.overview.title, parent.connection.who)}</span> : null}
              <span style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, color: T.ink, overflowWrap: 'anywhere' }}>{d.title}</span>
              {d.about.length > 0 ? <span style={S.meta} data-explore-latest-about="">{COPY.about(d.about)}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Saved for later, as built (spec §3.8). */
function SavedList({ explore, storyById, onOpenStory }) {
  const { research, stories, bookmarks } = explore;
  const ready = research.status === RESEARCH.READY;
  return (
    <section aria-labelledby="ftx-saved-h" style={S.section} data-explore-saved="">
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
        // missing from a read that holds every published story: really gone; missing from a partial read: unknown
        const gone = stories.status === 'ready' && stories.complete === true && !story;
        const unknown = !story && !gone;
        return (
          <div key={b.storyId} style={{ ...S.card, gap: 6 }} data-explore-saved-row={b.storyId} data-explore-gone={gone ? 'true' : undefined}>
            {story?.sample && <div style={S.row}><Tag tone="copper" dim>{CARD.sample}</Tag></div>}
            <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, color: T.ink, overflowWrap: 'anywhere' }}>{story?.title ?? b.title}</span>
            {gone ? <p style={S.small}>{COPY.gone}</p> : unknown ? null : <StateLine state={stateOf({ item: itemFor(research, b.storyId), bookmarked: ready })} />}
            <div style={S.actions}>
              {story && <Btn onClick={(event) => onOpenStory(story.id, null, event)} data-explore-saved-read="">{CARD.read}</Btn>}
              {!story && (
                <Btn ariaDisabled={saveBusyOf(bookmarks, b.storyId)} onClick={() => bookmarks.remove(b.storyId, `saved:${b.storyId}`)} data-explore-saved-remove="">{COPY.remove}</Btn>
              )}
            </div>
            <BookmarkError bookmarks={bookmarks} storyId={b.storyId} origin={`saved:${b.storyId}`} />
          </div>
        );
      })}
    </section>
  );
}

export default function ExploreHome({ explore, byId, stocksData, onOpenStory, onContinue, onViewIt, onOpenCompany, onOwnWords, introRef }) {
  const { research, stories, bookmarks } = explore;
  const [topic, setTopic] = useState(null);
  const wide = useMatches(WIDE_QUERY);
  const list = stories.status === 'ready' ? stories.list : [];
  const page = frontPageOf(list);
  const topics = topicsOf(page.cards);
  const cards = page.cards.filter((c) => !topic || c.story.topics.includes(topic));
  const isSaved = (id) => bookmarks.list.some((b) => b.storyId === id);
  const ready = research.status === RESEARCH.READY;
  const holds = shelfHolds(research);
  const shelf = (placement) => <ExploreShelf research={research} byId={byId} onContinue={onContinue} onViewIt={onViewIt} placement={placement} />;
  const saved = <SavedList explore={explore} storyById={byId} onOpenStory={onOpenStory} />;

  return (
    <div data-explore-screen="home" style={{ ...S.col, gap: 22 }}>
      <p ref={introRef} tabIndex={-1} style={{ ...S.meta, fontSize: 15, maxWidth: 560, outline: 'none' }} data-explore-intro="">{COPY.intro}</p>
      <div>
        <ExploreSearch stories={list} byId={byId} storiesReady={stories.status === 'ready'} research={research} stocksData={stocksData} onOpenStory={onOpenStory} onOpenCompany={onOpenCompany} onOwnWords={onOwnWords} />
      </div>
      <div className="ftx-grid" data-ftx-grid="home">
        <div className="ftx-col" data-ftx-col="main">
          {!wide && holds ? shelf('top') : null}
          {page.hero ? (
            <Hero story={page.hero.story} question={page.hero.question} byId={byId} wide={wide} saved={isSaved(page.hero.story.id)} bookmarks={bookmarks} onOpenStory={onOpenStory} onOpenCompany={onOpenCompany} />
          ) : null}
        </div>
        {wide ? <div className="ftx-col" data-ftx-col="side">{shelf('side')}{saved}</div> : null}
      </div>
      {page.tiles.length > 0 ? <StartRow tiles={page.tiles} onOpenStory={onOpenStory} /> : null}
      <section aria-labelledby="ftx-cards-h" style={{ ...S.col, gap: 14 }} data-explore-cards="">
        {page.cards.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', columnGap: 16, rowGap: 8, flexWrap: 'wrap' }}>
              <h2 id="ftx-cards-h" style={S.h2}>{COPY.questionsLabel}</h2>
              <Legend />
            </div>
            {topics.length > 0 && (
              <div style={S.row} data-explore-topics="" role="group" aria-label={COPY.topics}>
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
            )}
          </>
        ) : <h2 id="ftx-cards-h" className="ftx-sr">{COPY.questionsLabel}</h2>}
        {stories.status === 'idle' || stories.status === 'loading' ? <StatusLine>{COPY.loading}</StatusLine> : null}
        {stories.status === 'failed' && (
          <div style={S.section}>
            <Notice role="alert" tone="copper">{COPY.failed}</Notice>
            <div><Btn onClick={stories.retry} data-explore-retry-stories="">{COPY.tryAgain}</Btn></div>
          </div>
        )}
        {stories.status === 'ready' && list.length === 0 && <p role="status" style={{ ...S.meta, fontSize: 15 }} data-explore-empty="">{COPY.empty}</p>}
        {page.cards.length > 0 && cards.length === 0 && <p role="status" style={S.meta}>{COPY.noTopicMatch}</p>}
        {cards.length > 0 ? (
          <div className="ftx-cards">
            {cards.map(({ story, question }) => (
              <QuestionCard
                key={story.id}
                story={story}
                question={question}
                byId={byId}
                item={itemFor(research, story.id)}
                saved={isSaved(story.id)}
                known={ready}
                bookmarks={bookmarks}
                onOpenStory={onOpenStory}
                onContinue={onContinue}
              />
            ))}
          </div>
        ) : null}
      </section>
      {!wide && !holds ? shelf('after-cards') : null}
      {page.latest.length > 0 ? <LatestRow latest={page.latest} byId={byId} onOpenStory={onOpenStory} /> : null}
      {wide ? null : saved}
    </div>
  );
}
