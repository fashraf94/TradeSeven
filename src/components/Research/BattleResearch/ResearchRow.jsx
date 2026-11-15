// src/components/Research/BattleResearch/ResearchRow.jsx
//
// Battle Research Slice 1 — A ROW and THE REFERENCE LINE (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §7; the prototype's BrRankRow /
// BrRefRow). A row is ONE tap target that opens the research modal:
//   line 1  the position (#1), the company name and the ticker (mono), the group
//           tags, the eligibility pill (and a neutral "was #3" when it moved)
//   line 2  (mono, small) the rank and its time, today's move and its time or its
//           state words, the rung estimate, the sector
//   line 3  on the weakest question only: at most two neutral difference chips
// The reference line is dashed, never numbered. Every string is the engine's
// (explain.js rowFactsOf / referenceOf) — this file formats nothing (BUILD_RULES §9).
// Tokens only (sheetTheme); every label sizes an inner <span> (hazard 48).

import React from 'react';
import { ST, MONO, tint } from '../Sheet/sheetTheme.js';
import { BR_COPY } from './battleResearchCopy.js';

const PILL_TONE = { ok: ST.green, locked: ST.amber, no: ST.ink3 };

export const rowButton = Object.freeze({
  background: 'transparent', border: 'none', margin: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer',
});

function Tag({ children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 999, border: `1px solid ${ST.hair}`, color: ST.ink2, whiteSpace: 'nowrap' }}><span style={{ fontSize: 10.5, fontWeight: 600 }}>{children}</span></span>;
}

function Pill({ elig }) {
  if (!elig) return null;
  const c = PILL_TONE[elig.tone] ?? ST.ink3;
  return (
    <span data-br-elig={elig.tone} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, background: tint(c, 12), border: `1px solid ${tint(c, 45)}`, color: c, maxWidth: '100%' }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{elig.text}</span>
    </span>
  );
}

/**
 * @param {object} p
 * @param {object} p.facts      explain.rowFactsOf(...)
 * @param {number|null} p.position  the place within the result (null for a name outside the placed list)
 * @param {number|null} p.was   the position before this step on the same result ("was #3"), or null
 * @param {string|null} p.note  a left-out row's own words (removed by / not assessed / not ranked)
 * @param {boolean} [p.lead]    the first placed row
 * @param {() => void} p.onOpen
 */
export function ResearchRow({ facts, position = null, was = null, note = null, lead = false, onOpen }) {
  const second = [facts.sectorRank, facts.rank, facts.move, facts.rung, facts.sector].filter(Boolean);
  const label = `${position ? `${BR_COPY.position(position)} ` : ''}${facts.name ? `${facts.name}, ` : ''}${facts.symbol}. Open research.`;
  return (
    <li style={{ listStyle: 'none' }}>
      <button
        type="button"
        data-br-row={facts.symbol}
        aria-label={label}
        onClick={onOpen}
        style={{
          ...rowButton, width: '100%', boxSizing: 'border-box', minHeight: 44, display: 'grid',
          gridTemplateColumns: position ? '34px minmax(0, 1fr)' : 'minmax(0, 1fr)', columnGap: 8, rowGap: 4, alignItems: 'start',
          padding: '11px 12px', borderRadius: 12, border: `1px ${note ? 'dashed' : 'solid'} ${ST.hair}`, background: note ? 'transparent' : ST.surface,
        }}
      >
        {position ? (
          <span style={{ fontFamily: MONO, fontWeight: 700, color: lead ? ST.teal : ST.ink2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: 18 }}>{BR_COPY.position(position)}</span>
          </span>
        ) : null}
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
            {facts.name ? <span style={{ fontSize: 15, fontWeight: 700, color: ST.ink, minWidth: 0, overflowWrap: 'anywhere' }}>{facts.name}</span> : null}
            <span style={{ fontFamily: MONO, fontWeight: 600, color: facts.name ? ST.ink3 : ST.ink }}><span style={{ fontSize: facts.name ? 11.5 : 15 }}>{facts.symbol}</span></span>
            {was ? <span data-br-was={was} style={{ fontFamily: MONO, color: ST.ink3, whiteSpace: 'nowrap' }}><span style={{ fontSize: 10.5 }}>{BR_COPY.was(was)}</span></span> : null}
          </span>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {facts.groups.map((g) => <Tag key={g}>{g}</Tag>)}
            <Pill elig={facts.eligibility} />
          </span>
          {second.length ? (
            <span data-br-row-facts style={{ fontFamily: MONO, color: ST.ink2, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
              <span style={{ fontSize: 11 }}>{second.join(' · ')}</span>
            </span>
          ) : null}
          {note ? <span data-br-row-note style={{ color: ST.ink2, lineHeight: 1.4 }}><span style={{ fontSize: 12 }}>{note}</span></span> : null}
          {facts.diffs.length && !note ? (
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {facts.diffs.map((d) => (
                <span key={d} data-br-diff style={{ padding: '1px 7px', borderRadius: 6, background: tint(ST.ink, 6), color: ST.ink2 }}><span style={{ fontSize: 10.5 }}>{d}</span></span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** The incumbent as a dashed reference line (never numbered), and the hairline label above it when it sits inside the list. */
export function ReferenceLine({ reference, onOpen }) {
  if (!reference) return null;
  return (
    <li style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }} data-br-reference={reference.symbol}>
      {reference.above ? (
        <span data-br-above style={{ display: 'flex', alignItems: 'center', gap: 8, color: ST.ink3 }}>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: ST.hair }} />
          <span style={{ fontSize: 10.5, whiteSpace: 'normal', textAlign: 'center' }}>{reference.above}</span>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: ST.hair }} />
        </span>
      ) : null}
      <button
        type="button"
        data-br-row={reference.symbol}
        onClick={onOpen}
        style={{ ...rowButton, width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '9px 12px', borderRadius: 10, border: `1px dashed ${tint(ST.amber, 55)}`, color: ST.ink2 }}
      >
        <span style={{ fontSize: 12.5, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{reference.text}</span>
      </button>
      {reference.noReading ? <span style={{ color: ST.ink3 }}><span style={{ fontSize: 11.5 }}>{reference.noReading}</span></span> : null}
    </li>
  );
}
