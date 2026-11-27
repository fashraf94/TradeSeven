// src/components/Explore/ExploreChain.jsx
//
// Explore Build 2 — THE CHAIN (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.1, §4.3; B-1, B-2, B-6,
// B-7, B-8; build prompt K-6, K-7; the look: Round 3's ex3-parts.jsx X3Chain). ONE component, three sizes:
//   hero   the subject, then one branch per connection with its name and its evidence label; the branch the hero's
//          question rests on is marked "This question"; a door is drawn under its branch;
//   card   names and marks only (the key is drawn once above the cards); a branch with a door carries "Deep story ›",
//          since the card itself opens the overview;
//   story  the connections list itself (B-6): every branch is a button that opens in place, showing what the business
//          does, the basis line, the three-part gap, its company leads and its door.
//
// HONEST BY CONSTRUCTION. Every branch hangs from the subject: the drawing never says one connection sells to the next.
// The branches are the story's connections in the story's order. Each evidence label has its own colour (teal, gold,
// grey), its own mark (filled, ringed, open) and its own line (solid, dashed, broken), so it reads without colour, and
// the label's words are on every size but the card (where they are the key's, and said to assistive tech). A door is
// drawn only for a deep story at hand (exploreView.js doorOf); a connection without one says nothing about it.

import React from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { BASIS_TONE, CAPS, S, T, wash } from './exploreStyle';
import { BASES, chainSubjectOf, countsOf, doorOf } from './exploreView';
import { Icon, Tag, Tickers } from './exploreParts';

const COPY = EXPLORE_COPY.chain;
const STORY = EXPLORE_COPY.story;
const toneOf = (basis) => T[BASIS_TONE[basis] ?? 'ink2'];
const RESET = { appearance: 'none', font: 'inherit', background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' };

/** A branch's mark: the subject's square; filled (source cited), ringed (reporter's reading), open (no source yet). */
export function Mark({ basis, size = 11 }) {
  const color = basis === 'origin' ? T.ink : toneOf(basis);
  const box = { width: size, height: size, flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  if (basis === 'origin') return <span aria-hidden="true" data-explore-mark="origin" style={{ ...box, borderRadius: 2.5, background: color }} />;
  if (basis === 'source_cited') return <span aria-hidden="true" data-explore-mark={basis} style={{ ...box, borderRadius: '50%', background: color }} />;
  if (basis === 'reporters_reading') {
    const dot = Math.max(3, size / 3.4);
    return <span aria-hidden="true" data-explore-mark={basis} style={{ ...box, borderRadius: '50%', border: `2px solid ${color}` }}><span style={{ width: dot, height: dot, borderRadius: '50%', background: color }} /></span>;
  }
  return <span aria-hidden="true" data-explore-mark="no_source_yet" style={{ ...box, borderRadius: '50%', border: `2px solid ${color}` }} />;
}

/** A branch's line: solid (source cited), dashed (reporter's reading), broken (no source yet). */
export function Segment({ basis }) {
  const color = toneOf(basis);
  const line = (style, flex = 1) => <span style={{ flex, height: 0, borderTop: `2px ${style} ${color}` }} />;
  return (
    <span aria-hidden="true" data-explore-line={basis} style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
      {basis === 'source_cited' ? line('solid') : basis === 'reporters_reading' ? line('dashed') : <>{line('solid')}<span style={{ flex: 1.8 }} />{line('solid')}</>}
    </span>
  );
}

/** The evidence label in small capitals, in its tone. */
const BasisCaps = ({ basis }) => <span style={{ ...CAPS, color: toneOf(basis) }} data-explore-basis={basis}>{STORY.basis[basis]}</span>;

/** The key: each label's line, mark and words (B-1). */
export function Legend() {
  return (
    <ul aria-label={COPY.key} data-explore-key="" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', alignItems: 'center', columnGap: 16, rowGap: 4, flexWrap: 'wrap' }}>
      {BASES.map((b) => (
        <li key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.ink2, whiteSpace: 'nowrap' }}>
          <span style={{ width: 22, display: 'flex' }}><Segment basis={b} /></span><Mark basis={b} size={10} />{STORY.basis[b]}
        </li>
      ))}
    </ul>
  );
}

/** The count line (B-2), counted from the connections' basis (exploreView.js countsOf). */
export function CountLine({ story }) {
  const { n, sourced, unchecked } = countsOf(story);
  return <p style={S.meta} data-explore-count="">{COPY.count(n, sourced, unchecked)}</p>;
}

/** A door (K-7): "Deep story" and the deep story's title; it opens that story. */
export function Door({ target, onOpen, focusKey }) {
  return (
    <button
      type="button"
      className="ftx-btn"
      data-explore-door={target.id}
      data-explore-focus={focusKey}
      onClick={(event) => onOpen?.(target.id, null, event)}
      style={{ ...RESET, width: '100%', minHeight: 48, padding: '8px 10px 8px 12px', borderRadius: 12, background: wash('teal', 0.06), border: `1px solid ${wash('teal', 0.4)}`, color: T.ink, display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ ...CAPS, color: T.teal }}>{COPY.deepStory}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{target.title}</span>
      </span>
      <span style={{ color: T.teal, display: 'flex' }}><Icon name="right" /></span>
    </button>
  );
}

/** The gap in three parts (Amendment B §4.3): Known (or "Nothing sourced yet."), Unknown (largest, the one accent), Where to look. */
function Gap({ c }) {
  if (!c.known && !c.unknown && !c.whereToLook) return null; // the old shape: what it has, and nothing in its place
  const row = (key, label, node, tone = T.ink3) => (
    <div className="ftx-gap-row" data-explore-gap={key}>
      <span style={{ ...CAPS, color: tone }}>{label}</span>
      {node}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-explore-gap-block="">
      {row('known', STORY.known, <span style={{ fontSize: 13.5, lineHeight: 1.45, color: c.known ? T.ink2 : T.ink3, overflowWrap: 'anywhere' }}>{c.known ?? STORY.knownBlank}</span>)}
      {c.unknown ? row('unknown', STORY.unknown, <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, color: T.ink, overflowWrap: 'anywhere' }}>{c.unknown}</span>, T.copper) : null}
      {c.whereToLook ? row('where', STORY.whereToLook, <span style={{ fontSize: 13.5, lineHeight: 1.45, color: T.ink2, overflowWrap: 'anywhere' }}>{c.whereToLook}</span>) : null}
    </div>
  );
}

/** One branch off the spine: the line and the mark carry the evidence label. */
function Branch({ basis, last, z, children, ...rest }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: `${z.bw}px ${z.m}px minmax(0, 1fr)` }} {...rest}>
      <span aria-hidden="true" style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: last ? z.pad + z.L / 2 + 1 : '100%', background: T.ink3 }} />
        <span style={{ position: 'absolute', left: 2, right: 5, top: z.pad + z.L / 2 - 1, display: 'flex' }}><Segment basis={basis} /></span>
      </span>
      <span style={{ height: z.L, marginTop: z.pad, display: 'flex', alignItems: 'center' }}><Mark basis={basis} size={z.m} /></span>
      <div style={{ padding: `${z.pad}px 0 ${z.pad}px 9px`, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </li>
  );
}

const SIZES = Object.freeze({
  card: { m: 11, L: 20, pad: 3, bw: 26, name: 12.5 },
  hero: { m: 14, L: 22, pad: 8, bw: 32, name: 15 },
  story: { m: 14, L: 44, pad: 4, bw: 28, name: 15.5 },
});

/**
 * @param {object} p
 * @param {object} p.story            the reader's story
 * @param {'hero'|'card'|'story'} p.size
 * @param {Map} p.byId                the stories at hand (a door needs its target)
 * @param {string|null} p.thisConnection  the connection id the chosen (or the hero's) question rests on
 * @param {Set<string>} p.open        story size: the branches open (by ref)
 */
export default function ExploreChain({ story, size = 'card', byId, thisConnection = null, open = null, onToggle, onOpenStory, onOpenCompany }) {
  const z = SIZES[size];
  const subject = chainSubjectOf(story);
  const branches = story.connections;
  return (
    <div data-explore-chain={size} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2, minWidth: 0 }} data-explore-chain-subject="">
        <Mark basis="origin" size={z.m} />
        {subject ? <span style={{ fontSize: size === 'card' ? 12.5 : 14, fontWeight: 700, lineHeight: 1.3, color: T.ink, overflowWrap: 'anywhere' }}>{subject}</span> : null}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginLeft: z.m / 2 - 1 }}>
        {branches.map((c, i) => {
          const door = doorOf(c, byId, story.id);
          const mine = Boolean(thisConnection) && c.id === thisConnection;
          const last = i === branches.length - 1;
          const common = { basis: c.basis, last, z, 'data-explore-branch': c.ref, 'data-explore-connection': c.basis };
          if (size === 'card') {
            return (
              <Branch key={c.ref} {...common}>
                <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 8, flexWrap: 'wrap', minHeight: z.L }}>
                  <span style={{ fontSize: z.name, fontWeight: 600, lineHeight: `${z.L}px`, color: T.ink, overflowWrap: 'anywhere' }}>{c.who}</span>
                  <span className="ftx-sr">{STORY.basis[c.basis]}</span>
                  {door ? <span style={{ ...CAPS, color: T.teal }} data-explore-door-mark={door.id}>{COPY.cardDoor}</span> : null}
                </div>
              </Branch>
            );
          }
          if (size === 'hero') {
            return (
              <Branch key={c.ref} {...common}>
                <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 10, rowGap: 2, flexWrap: 'wrap', minHeight: z.L }}>
                  <span style={{ fontSize: z.name, fontWeight: 700, lineHeight: `${z.L}px`, color: T.ink, overflowWrap: 'anywhere' }}>{c.who}</span>
                  <BasisCaps basis={c.basis} />
                  {mine ? <span data-explore-this-question=""><Tag tone="teal">{COPY.thisQuestion}</Tag></span> : null}
                </div>
                {door ? <div style={{ padding: '4px 0 8px' }}><Door target={door} onOpen={onOpenStory} focusKey={`door:${c.ref}`} /></div> : null}
              </Branch>
            );
          }
          // the story's connections list: each branch opens in place (B-6)
          const isOpen = Boolean(open?.has(c.ref));
          const detailId = `ftx-branch-${story.id}-${c.ref}`;
          return (
            <Branch key={c.ref} {...common} data-explore-open={isOpen ? 'true' : 'false'}>
              <button
                type="button"
                className="ftx-btn"
                aria-expanded={isOpen}
                aria-controls={isOpen ? detailId : undefined}
                data-explore-branch-toggle={c.ref}
                data-explore-focus={`branch:${c.ref}`}
                onClick={() => onToggle?.(c.ref)}
                style={{ ...RESET, minHeight: 44, width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: z.name, fontWeight: 700, lineHeight: 1.3, color: T.ink, overflowWrap: 'anywhere' }}>{c.who}</span>
                  <span style={{ display: 'flex', alignItems: 'center', columnGap: 8, rowGap: 2, flexWrap: 'wrap' }}>
                    <BasisCaps basis={c.basis} />
                    {mine ? <span data-explore-this-question=""><Tag tone="teal">{COPY.thisQuestion}</Tag></span> : null}
                    {door ? <span style={{ ...CAPS, color: T.teal }} data-explore-door-mark={door.id}>{COPY.deepStory}</span> : null}
                  </span>
                </span>
                <span aria-hidden="true" style={{ color: T.ink2, width: 28, display: 'flex', justifyContent: 'center', transform: isOpen ? 'rotate(180deg)' : 'none' }}><Icon name="down" /></span>
              </button>
              {isOpen ? (
                <div id={detailId} data-explore-branch-detail={c.ref} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0 12px', minWidth: 0 }}>
                  {c.what ? <p style={{ ...S.body, fontSize: 14 }}>{c.what}</p> : null}
                  {c.basisLine ? <p style={S.meta}>{c.basisLine}</p> : null}
                  <Gap c={c} />
                  {c.leads.length > 0 ? (
                    <div style={S.section} data-explore-leads="">
                      <span style={S.eyebrow}>{STORY.leadsTitle}</span>
                      <Tickers list={c.leads} onOpen={onOpenCompany} keyPrefix={`lead:${c.ref}`} />
                    </div>
                  ) : null}
                  {door ? <Door target={door} onOpen={onOpenStory} focusKey={`door:${c.ref}`} /> : null}
                </div>
              ) : null}
            </Branch>
          );
        })}
      </ul>
    </div>
  );
}
