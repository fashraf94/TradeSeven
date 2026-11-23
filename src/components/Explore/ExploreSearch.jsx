// src/components/Explore/ExploreSearch.jsx
//
// Explore Build 1 — SEARCH (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.3, E-3; build prompt K-12).
// One field. As the player types, in this order:
//   1. stories and questions (exploreView.js storyMatchesOf, over the loaded stories): a tap opens the story with
//      that question selected;
//   2. companies, by the Search page's own matcher (src/components/Search/companyMatch.js — the one SearchOverlay
//      uses, never a copy): a tap opens AssetResearch;
//   3. "Work '{text}' from your own words", always last, from three characters, ONLY when the research read is
//      ready (K-12): a tap opens the sheet's own-words start with the text in it; nothing is sent until the player
//      continues there. At the daily limit (the read's quota, by the panel's own atLimitOf — founder ruling SQ-8,
//      Nov 22, 2026) the row is not drawn: in its place, one line saying the day's investigations are used.
// Never a dead end: with no story and no company, "No story on this yet." — and for a player without access, the
// line that points at companies instead; said only once the stories read has answered (review A-3). There is no
// "not available" row. Typing sends nothing.

import React, { useMemo, useState } from 'react';
import { matchCompanies, researchAssetOf } from '../Search/companyMatch';
import { EXPLORE_COPY } from './exploreCopy';
import { OWN_WORDS_MIN, RESEARCH, atLimitOf, storyMatchesOf } from './exploreView';
import { S, T, rowBtnStyle, wash } from './exploreStyle';
import { Eyebrow, Icon, Tag } from './exploreParts';

const COPY = EXPLORE_COPY.search;
const CARD = EXPLORE_COPY.card;
const STORY_ROWS = 6;
const COMPANY_ROWS = 5;

export default function ExploreSearch({ stories, storiesReady = true, research, stocksData = [], onOpenStory, onOpenCompany, onOwnWords }) {
  const [text, setText] = useState('');
  const typed = text.trim();
  const priceMap = useMemo(() => {
    const map = {};
    (stocksData || []).forEach((s) => { map[s.symbol] = s; });
    return map;
  }, [stocksData]);
  const storyRows = typed ? storyMatchesOf(stories, typed).slice(0, STORY_ROWS) : [];
  const companies = typed ? matchCompanies(typed).slice(0, COMPANY_ROWS) : [];
  const access = research?.status === RESEARCH.READY;
  // At the daily limit (founder ruling SQ-8): the panel's own test on the read's own quota, never a second rule.
  const atLimit = access && atLimitOf(research.quota);
  const ownWords = access && typed.length >= OWN_WORDS_MIN;

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} style={S.section} data-explore-search="">
      <label htmlFor="ftx-search" className="ftx-sr">{COPY.label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 16, top: 18, color: T.ink2 }}><Icon name="search" /></span>
        <input
          id="ftx-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={COPY.label}
          autoComplete="off"
          style={{ ...S.input, minHeight: 52, paddingLeft: 44, borderRadius: 14, background: T.surface }}
        />
      </div>
      {typed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-explore-search-results="">
          {storyRows.length > 0 && <Eyebrow>{COPY.stories}</Eyebrow>}
          {storyRows.map((r) => (
            <button
              key={`${r.story.id}:${r.questionId}`}
              type="button"
              className="ftx-rowbtn"
              data-explore-result="story"
              onClick={(event) => onOpenStory(r.story.id, r.questionId, event)}
              style={rowBtnStyle}
            >
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{r.text}</span>
              <span style={S.meta}>{r.story.title}</span>
              {r.story.sample && <span><Tag tone="copper" dim>{CARD.sample}</Tag></span>}
            </button>
          ))}
          {companies.length > 0 && <Eyebrow>{COPY.companies}</Eyebrow>}
          {companies.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              className="ftx-rowbtn"
              data-explore-result="company"
              onClick={() => onOpenCompany(researchAssetOf(stock, priceMap))}
              style={rowBtnStyle}
            >
              <span style={{ fontSize: 15, fontWeight: 700 }}>{COPY.company(stock.symbol, stock.name)}</span>
              <span style={S.meta}>{COPY.companyNote}</span>
            </button>
          ))}
          {storiesReady && storyRows.length === 0 && companies.length === 0 && (
            <p role="status" style={S.meta} data-explore-no-story="">{access ? COPY.noStory : COPY.noStoryNoAccess}</p>
          )}
          {ownWords && atLimit && (
            <p role="status" style={S.meta} data-explore-search-limit="">{COPY.limit(research.quota.perDay)}</p>
          )}
          {ownWords && !atLimit && (
            <button
              type="button"
              className="ftx-rowbtn"
              data-explore-result="own-words"
              onClick={(event) => onOwnWords(event, typed)}
              style={{ ...rowBtnStyle, border: `1px dashed ${wash('teal', 0.5)}` }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: T.teal, overflowWrap: 'anywhere' }}>{COPY.ownWords(typed)}</span>
              <span style={S.meta}>{COPY.ownWordsNote}</span>
            </button>
          )}
        </div>
      )}
    </form>
  );
}
