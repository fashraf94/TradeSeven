// src/components/PracticeField/IdeaBookScreen.jsx
//
// Practice Field build B3 — THE IDEA BOOK SCREEN (design of record docs/design/practice-field/IDEA_BOOK_ROUND_2.html, its
// ib2-parts.jsx and ib2-screens.jsx; rulings B3-1 to B3-7). Read only: the player never acts here. Taps open detail and
// nothing else — no buy, sell, add, trim or approve anywhere.
//
// It DRAWS the view the server built (api/_utils/practiceField/bookView.js): every figure, label and plain-words reason
// arrives as a display string; the screen picks a colour from `dir` and, at 320 px, an amount's `short` form (the fit
// rule: $10,000 or more without cents). It does no money arithmetic (B3-1), and it renders every agent's and player's
// words as text, never as markup.
//
//   Positions  the book line, the tab bar, the strip (one line per desk; a tap opens Desks at that desk), the positions
//              table grouped by idea — Symbol · Mark · P/L Open · P/L Day (desktop adds "To its line") — the cash row and
//              the timestamp. A name or an idea header opens in place (phone) or in the side panel (desktop); one open at
//              a time.
//   Desks      each desk's note, its call on each idea, and the drafts it passed on with why.
//   History    finished ideas; a tap opens the five-column result (B3-3).
// Layout by the page's own width: 'p320' under 360 px, 'p390' under 900 px, 'desk' from there (the mock-up's three modes).

import React, { useEffect, useRef, useState } from 'react';
import { IB, HAIR, mono, signColor, BOOK_TEXT, RESET, IB_CSS } from './ideaBookStyle';
import { Eyebrow, Icon, DeskMark, Quote, Chip, CallWord, BookSays, LineGauge } from './IdeaBookParts';
import { IDEA_BOOK_COPY, layoutOfWidth } from './ideaBookCopy';

const MODE = {
  p320: { cols: 'minmax(0,1fr) 56px 70px 70px', fs: 11.5, pad: 4 },
  p390: { cols: 'minmax(0,1fr) 68px 88px 88px', fs: 12.5, pad: 6 },
  desk: { cols: 'minmax(0,1fr) 96px 210px 120px 120px', fs: 13, pad: 10 },
};
const LEDGER_COLS = '46px repeat(3, minmax(0,1fr))';
const amountOf = (a, sm) => (a ? (sm ? a.short : a.text) : null);

// ── THE BOOK LINE ────────────────────────────────────────────────────────────────────────────────────────────────────

export function BookLine({ line, layout }) {
  const wide = layout === 'desk';
  const sm = layout === 'p320';
  const t = line.today;
  const value = <div data-ib="value" style={{ ...mono(wide ? 40 : sm ? 26 : 30, IB.ink, 700), letterSpacing: '-0.03em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{line.value}</div>;
  const today = t ? (
    <div data-ib="today" style={{ textAlign: wide ? 'left' : 'right', paddingBottom: wide ? 5 : 2 }}>
      {t.waiting
        ? <div style={{ fontSize: 12, color: IB.ink2 }}>{t.waiting}</div>
        : <><div style={{ ...mono(wide ? 16 : 13, signColor(t.dir), 700), whiteSpace: 'nowrap' }}>{t.text}</div><div style={{ ...mono(wide ? 12 : 10.5, signColor(t.dir)), marginTop: 2, whiteSpace: 'nowrap' }}>{t.pct} today</div></>}
    </div>
  ) : null;
  const stats = [
    line.first ? [line.first.label, line.first.value, line.first.kind === 'since' ? signColor(line.first.dir) : IB.ink] : null,
    [line.spy.label, line.spy.value, IB.ink2],
    ['Cash', line.cash, IB.ink],
  ].filter(Boolean);
  const status = line.paused || line.windingDown ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <CallWord kind={line.paused ? 'Paused' : 'Winding down'} solid />
      <span style={{ fontSize: 12, color: IB.ink }}>{line.statusLine}</span>
    </div>
  ) : null;
  const print = <div style={{ marginTop: wide ? 10 : 6, fontSize: 11, color: IB.ink3, lineHeight: 1.35, textWrap: 'pretty' }}>{line.smallPrint}</div>;
  if (wide) {
    return (
      <section aria-label="Book line" data-ib="book-line">
        {status}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          {value}{today}
          <div style={{ display: 'flex', gap: 40, marginLeft: 'auto', paddingBottom: 5 }}>
            {stats.map(([l, v, c]) => <div key={l}><div style={{ ...mono(9.5, IB.ink3, 600), letterSpacing: '.1em', textTransform: 'uppercase' }}>{l}</div><div style={{ ...mono(15, c, 600), marginTop: 4 }}>{v}</div></div>)}
          </div>
        </div>
        {print}
      </section>
    );
  }
  return (
    <section aria-label="Book line" data-ib="book-line" style={{ padding: '0 4px' }}>
      {status}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>{value}{today}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: sm ? 8 : 14, rowGap: 2, marginTop: 8 }}>
        {stats.map(([l, v, c]) => (
          <span key={l} style={{ display: 'inline-flex', gap: sm ? 4 : 5, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
            <span style={mono(sm ? 9.5 : 10, IB.ink3, 600)}>{l}</span><span style={mono(sm ? 10.5 : 11, c, 600)}>{v}</span>
          </span>
        ))}
      </div>
      {print}
    </section>
  );
}

// ── THE TAB BAR (built to take more tabs: an array; the bar scrolls if labels ever outgrow it) ──────────────────────────

export function Tabs({ tab, setTab, layout, tabs = IDEA_BOOK_COPY.tabs }) {
  const sm = layout === 'p320';
  return (
    <div role="tablist" aria-label="Idea book" className="ib-scroll" style={{ display: 'flex', gap: sm ? 8 : 20, padding: '0 4px', borderBottom: HAIR, overflowX: 'auto' }}>
      {tabs.map(([k, l]) => (
        <button
          key={k} type="button" role="tab" id={`ib-tab-${k}`} aria-selected={tab === k} aria-controls={`ib-panel-${k}`}
          className="ib-tap" onClick={() => setTab(k)}
          style={{ ...RESET, position: 'relative', minHeight: 44, padding: '0 2px', flexShrink: 0, whiteSpace: 'nowrap', boxShadow: tab === k ? `inset 0 -2px 0 ${IB.ink}` : 'none' }}
        >
          <span style={{ fontSize: sm ? 13 : 14, fontWeight: 600, color: tab === k ? IB.ink : IB.ink2 }}>{l}</span>
        </button>
      ))}
    </div>
  );
}

// ── THE STRIP ────────────────────────────────────────────────────────────────────────────────────────────────────────

export function Strip({ items, onDesk }) {
  if (!items || items.length === 0) return null;
  return (
    <div aria-label={IDEA_BOOK_COPY.since} data-ib="strip">
      {items.map((it, i) => (
        <button
          key={it.desk} type="button" className="ib-tap ib-row" onClick={() => onDesk(it.desk)}
          aria-label={`${it.deskName} · ${it.text}. Open Desks`}
          style={{ ...RESET, display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: 4, borderTop: i ? HAIR : 'none' }}
        >
          <DeskMark desk={it.desk} size={24} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.35, color: IB.ink2, textWrap: 'pretty' }}>
            <span style={{ color: IB.ink, fontWeight: 600 }}>{it.deskName}</span> · {it.text}
          </span>
          <span style={{ color: IB.ink3 }}><Icon name="chevR" size={14} /></span>
        </button>
      ))}
    </div>
  );
}

// ── THE OPEN PANELS ──────────────────────────────────────────────────────────────────────────────────────────────────

function Ledger({ names, children }) {
  const head = { ...mono(9.5, IB.ink3, 600), letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'right' };
  return (
    <div style={{ borderRadius: 10, background: IB.bg, border: HAIR, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: LEDGER_COLS, padding: '8px 10px 6px' }}>
        {IDEA_BOOK_COPY.ledgerHeads.map((h, i) => <span key={h} style={{ ...head, textAlign: i ? 'right' : 'left' }}>{h}</span>)}
      </div>
      {names.map((n) => {
        const sold = n.state === 'sold_line' || n.state === 'sold';
        const num = { ...mono(12, sold ? IB.ink3 : IB.ink), textAlign: 'right' };
        const near = n.distance?.near === true;
        return (
          <div key={n.symbol} style={{ padding: '7px 10px 8px', borderTop: HAIR }}>
            <div style={{ display: 'grid', gridTemplateColumns: LEDGER_COLS, alignItems: 'baseline' }}>
              <span style={mono(12.5, sold ? IB.ink3 : IB.ink, 700)}>{n.symbol}</span>
              <span style={num}>{n.entry ?? '—'}</span>
              <span style={num}>{n.mark ?? '—'}</span>
              <span style={num}>{n.line ?? '—'}</span>
            </div>
            {sold || n.state === 'bought_today' || n.state === 'line_hit' ? <div style={{ ...mono(11, IB.ink2), marginTop: 4, lineHeight: 1.4 }}>{n.text}</div> : null}
            {n.state === 'waiting' ? <div style={{ fontSize: 12, color: IB.ink2, marginTop: 4 }}>{n.text}</div> : null}
            {n.distance && n.state !== 'waiting' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <LineGauge gauge={n.distance.gauge} near={near} />
                <span style={{ ...mono(11, near ? IB.ink : IB.ink2, near ? 700 : 500), whiteSpace: 'nowrap' }}>{n.distance.text}</span>
              </div>
            ) : null}
            {n.shares && (n.state === 'held' || n.state === 'line_hit') ? (
              <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                <span style={mono(10.5, IB.ink3)}>{IDEA_BOOK_COPY.shares} <span style={{ color: IB.ink2 }}>{n.shares}</span></span>
                <span style={mono(10.5, IB.ink3)}>{IDEA_BOOK_COPY.positionValue} <span style={{ color: IB.ink2 }}>{n.positionValue}</span></span>
              </div>
            ) : null}
          </div>
        );
      })}
      {children}
    </div>
  );
}

function Words({ g }) {
  const c = g.call;
  return (
    <>
      {g.thesis ? (
        <div>
          <Quote size={13.5} cap={`${g.thesis.deskName}${g.thesis.date ? ` · ${g.thesis.date}` : ''}`}>{g.thesis.text}</Quote>
          <div style={{ marginTop: 8, paddingLeft: 13 }}><Chip>{g.source}</Chip></div>
        </div>
      ) : null}
      {g.state !== 'entering' && c ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 22 }}>
            <Eyebrow>{IDEA_BOOK_COPY.todaysCall}</Eyebrow>{c.kind ? <CallWord kind={c.kind} /> : null}
          </div>
          {c.failed ? <div style={{ ...BOOK_TEXT, fontSize: 13 }}>{c.text}</div> : <Quote size={13.5} cap={IDEA_BOOK_COPY.afterClose(c.deskName, c.date)}>{c.text}</Quote>}
          {g.selling ? <BookSays>{`${g.selling.rest[0].toUpperCase()}${g.selling.rest.slice(1)}.`}</BookSays> : null}
        </div>
      ) : null}
    </>
  );
}

const panelStyle = (rail) => ({ background: IB.surface, border: rail ? HAIR : 'none', borderRadius: rail ? 14 : '0 0 12px 12px', padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' });

export function NamePanel({ g, n, rail = false }) {
  return (
    <div role="region" aria-label={`${n.symbol} detail`} style={panelStyle(rail)}>
      {g.state === 'entering' ? <BookSays>{`${n.text}.`}</BookSays> : (
        <Ledger names={[n]}>
          {n.waitingReason ? <div style={{ padding: '8px 10px', borderTop: HAIR, ...BOOK_TEXT, color: IB.ink3 }}>{n.waitingReason}</div> : null}
        </Ledger>
      )}
      <Words g={g} />
    </div>
  );
}

export function IdeaPanel({ g, rail = false }) {
  const gap = g.gap;
  return (
    <div role="region" aria-label={`${g.slotName} idea detail`} style={panelStyle(rail)}>
      {g.state === 'entering' ? (
        <>
          <div style={{ ...mono(12.5, IB.ink, 700), letterSpacing: '.02em' }}>{g.namesText}</div>
          <BookSays>{`${g.names[0]?.text ?? ''}.`}</BookSays>
        </>
      ) : (
        <>
          {Number.isInteger(g.day) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: IB.hair2, overflow: 'hidden' }}><div style={{ width: `${Math.min(1, g.progress) * 100}%`, height: '100%', background: IB.ink2 }} /></div>
              <span style={{ ...mono(11.5, IB.ink2), whiteSpace: 'nowrap' }}>{g.line} · {g.sessionsLeftText}</span>
            </div>
          ) : <div style={mono(11.5, IB.ink2)}>{g.line}</div>}
          <Ledger names={g.names}>
            <div style={{ padding: '9px 10px 10px', borderTop: HAIR }}>
              <Eyebrow style={{ fontSize: 9.5, letterSpacing: '.14em' }}>{IDEA_BOOK_COPY.gap}</Eyebrow>
              {!gap ? <div style={{ fontSize: 13, color: IB.ink2, marginTop: 5 }}>—</div>
                : gap.waiting ? <><div style={{ fontSize: 14, fontWeight: 600, color: IB.ink2, marginTop: 5 }}>{IDEA_BOOK_COPY.waitingData}</div><div style={{ ...BOOK_TEXT, color: IB.ink3, marginTop: 2 }}>{gap.waiting}</div></>
                : gap.notMeasurable ? <div style={{ fontSize: 14, fontWeight: 600, color: IB.ink2, marginTop: 5 }}>{gap.notMeasurable}</div>
                : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, marginTop: 4 }}>
                      <span style={mono(16, signColor(gap.dir), 700)}>{gap.text} <span style={{ fontSize: 12.5, fontWeight: 600 }}>({gap.pct})</span></span>
                      <span style={{ fontSize: 12.5, color: IB.ink2 }}>vs {gap.vs}</span>
                    </div>
                    {gap.spy ? <div style={{ ...mono(11, IB.ink3), marginTop: 3 }}>{gap.spy.text} {IDEA_BOOK_COPY.vsSpy}</div> : null}
                  </>
                )}
            </div>
          </Ledger>
        </>
      )}
      <Words g={g} />
    </div>
  );
}

// ── THE POSITIONS TABLE ──────────────────────────────────────────────────────────────────────────────────────────────

export function PosTable({ view, layout, open, setOpen, inline = true }) {
  const M = MODE[layout];
  const sm = layout === 'p320';
  const desk = layout === 'desk';
  const num = { ...mono(M.fs), textAlign: 'right', whiteSpace: 'nowrap' };
  const span = { gridColumn: '2 / -1', textAlign: 'right', fontSize: sm ? 11 : 11.5, lineHeight: 1.25, textWrap: 'balance' };
  const tog = (k) => setOpen(open === k ? null : k);
  const heads = desk ? IDEA_BOOK_COPY.headsDesk : IDEA_BOOK_COPY.heads;
  return (
    <section aria-label="Positions" data-ib="positions">
      <div style={{ display: 'grid', gridTemplateColumns: M.cols, columnGap: 6, alignItems: 'center', height: 22, padding: `0 ${M.pad}px` }}>
        {heads.map((h, i) => <span key={h} style={{ ...mono(9.5, IB.ink3, 600), letterSpacing: '.03em', whiteSpace: 'nowrap', textAlign: i === 0 || (desk && i === 2) ? 'left' : 'right', paddingLeft: desk && i === 2 ? 14 : 0 }}>{h}</span>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {view.groups.map((g) => {
          if (g.state === 'open') {
            return (
              <div key={g.slot} data-ib-group={g.slot} data-ib-state="open" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '4px 6px', boxSizing: 'border-box', borderRadius: 10, border: `1px dashed ${IB.hair2}` }}>
                <DeskMark desk={g.desk} deskName={g.deskName} size={24} dim />
                <span style={{ fontSize: sm ? 12 : 12.5, color: IB.ink2, lineHeight: 1.3, textWrap: 'pretty' }}>{g.text}</span>
              </div>
            );
          }
          const live = g.state !== 'entering';
          const io = open === g.slot;
          const gap = g.gap;
          return (
            <div key={g.slot} data-ib-group={g.slot} data-ib-state={g.state} style={{ borderRadius: 12, boxShadow: io ? `0 0 0 1px ${IB.hair2}` : 'none' }}>
              <button
                type="button" className="ib-tap" aria-expanded={io} onClick={() => tog(g.slot)}
                aria-label={`${g.slotName} idea, ${g.deskName}, ${g.line}${gap?.text ? `, gap ${gap.text} versus ${gap.vs}` : ''}${g.selling ? `, ${IDEA_BOOK_COPY.sellsLabel(g.selling.word, g.selling.rest)}` : ''}`}
                style={{ ...RESET, display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto 14px', columnGap: 8, alignItems: 'center', width: '100%', minHeight: 44, padding: '4px 6px', borderRadius: 10, background: IB.surface }}
              >
                <DeskMark desk={g.desk} deskName={g.deskName} size={24} />
                <span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: IB.ink }}>{g.slotName}</span>
                  <span style={{ display: 'block', ...mono(10.5, IB.ink2), marginTop: 2 }}>{g.line}</span>
                </span>
                <span style={{ textAlign: 'right', maxWidth: sm ? 112 : 200 }}>
                  {!live || !gap ? null
                    : gap.waiting ? <span style={{ fontSize: 11.5, color: IB.ink2 }}>{IDEA_BOOK_COPY.waitingData}</span>
                    : gap.notMeasurable ? <span style={{ fontSize: 11.5, color: IB.ink2 }}>{gap.notMeasurable}</span>
                    : <><span style={{ display: 'block', ...mono(12, signColor(gap.dir), 700), whiteSpace: 'nowrap' }}>{amountOf(gap, sm)}</span><span style={{ display: 'block', ...mono(10, IB.ink3), marginTop: 2, lineHeight: 1.25 }}>vs {gap.vs}</span></>}
                </span>
                <span style={{ color: IB.ink3 }}><Icon name={io ? 'chevD' : 'chevR'} size={14} /></span>
                {g.selling ? <span style={{ gridColumn: '2 / -1', fontSize: 12, color: IB.ink2, lineHeight: 1.35, margin: '3px 0 2px', textWrap: 'pretty' }}><span style={{ color: IB.ink, fontWeight: 700 }}>{g.selling.word}</span> · {g.selling.rest}</span> : null}
              </button>
              {g.names.map((n) => {
                const k = `${g.slot}/${n.symbol}`;
                const o = open === k;
                const near = n.distance?.near === true && n.state === 'held';
                const sold = n.state === 'sold_line' || n.state === 'sold';
                const spans = sold || n.state === 'entering' || n.state === 'bought_today' || n.state === 'line_hit';
                return (
                  <React.Fragment key={n.symbol}>
                    <button
                      type="button" className="ib-tap ib-row" aria-expanded={o} onClick={() => tog(k)}
                      aria-label={`${n.symbol}${n.isNew ? ', new' : ''}${n.mark ? `, mark ${n.mark}` : ''}${n.plOpen ? `, P/L open ${n.plOpen.text}` : ''}${n.plDay ? `, P/L day ${n.plDay.text}` : ''}${n.text ? `, ${n.text}` : ''}${near ? `, ${n.distance.text} from its line` : ''}`}
                      data-ib-name={n.symbol} data-ib-name-state={n.state}
                      style={{ ...RESET, display: 'grid', gridTemplateColumns: M.cols, columnGap: 6, alignItems: 'center', width: '100%', minHeight: 44, padding: `3px ${M.pad}px`, borderTop: HAIR, background: o ? IB.surface : near ? IB.raised : 'transparent', boxShadow: near ? `inset 0 0 0 1px ${IB.hair2}` : 'none', borderRadius: near ? 8 : 0 }}
                    >
                      <span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={mono(M.fs + 0.5, sold ? IB.ink3 : IB.ink, 700)}>{n.symbol}</span>
                          {n.isNew ? <span data-ib="new" style={{ ...mono(8.5, IB.ink, 700), letterSpacing: '.08em', padding: '1px 3px', borderRadius: 4, border: `1px solid ${IB.ink}`, lineHeight: 1.2 }}>NEW</span> : null}
                        </span>
                        {near && !desk ? <span style={{ display: 'block', ...mono(9.5, IB.ink, 700), marginTop: 2, whiteSpace: 'nowrap' }}>{n.distance.text}</span> : null}
                      </span>
                      {spans ? <span style={{ ...span, color: sold ? IB.ink3 : IB.ink2 }}>{n.text}</span> : (
                        <>
                          <span style={num}>{n.state === 'waiting' ? '—' : n.mark}</span>
                          {desk ? (n.state === 'waiting' || !n.distance ? <span style={{ ...num, color: IB.ink3 }}>—</span> : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14 }}>
                              <LineGauge gauge={n.distance.gauge} near={near} />
                              <span style={{ ...mono(11, near ? IB.ink : IB.ink2, near ? 700 : 500), whiteSpace: 'nowrap' }}>{n.distance.text}</span>
                            </span>
                          )) : null}
                          {n.state === 'waiting'
                            ? <span style={{ gridColumn: desk ? '4 / -1' : '3 / -1', textAlign: 'right', fontSize: sm ? 11 : 11.5, color: IB.ink2 }}>{n.text}</span>
                            : <><span style={{ ...num, color: signColor(n.plOpen?.dir) }}>{amountOf(n.plOpen, sm) ?? '—'}</span><span style={{ ...num, color: signColor(n.plDay?.dir) }}>{amountOf(n.plDay, sm) ?? '—'}</span></>}
                        </>
                      )}
                    </button>
                    {o && inline ? <div style={{ marginBottom: 4 }}><NamePanel g={g} n={n} /></div> : null}
                  </React.Fragment>
                );
              })}
              {io && inline ? <div style={{ borderTop: HAIR }}><IdeaPanel g={g} /></div> : null}
            </div>
          );
        })}
      </div>
      <div data-ib="cash" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 36, padding: `0 ${M.pad}px`, marginTop: 6, borderTop: `1px solid ${IB.hair2}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: IB.ink }}>{IDEA_BOOK_COPY.cash}</span><span style={mono(M.fs, IB.ink, 600)}>{view.cash}</span>
      </div>
      {view.asOf ? <div data-ib="stamp" style={{ padding: `4px ${M.pad}px 0`, fontSize: 11, color: IB.ink3, lineHeight: 1.4 }}>{view.asOf.text}</div> : null}
    </section>
  );
}

// ── DESKS ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function DeskSection({ d, first }) {
  const notes = d.note;
  return (
    <section aria-label={d.deskName} data-ib-desk={d.desk} style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: first ? 0 : 20, borderTop: first ? 'none' : HAIR }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DeskMark desk={d.desk} deskName={d.deskName} size={56} />
        <div><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2, color: IB.ink }}>{d.deskName}</div><div style={{ fontSize: 12, color: IB.ink3, marginTop: 3 }}>{d.lane}</div></div>
      </div>
      {notes ? (notes.failed ? <div style={{ ...BOOK_TEXT, fontSize: 13.5 }}>{notes.text}</div> : <Quote cap={IDEA_BOOK_COPY.writtenAfter(notes.date)}>{notes.text}</Quote>) : null}
      <div>
        <Eyebrow>{IDEA_BOOK_COPY.itsCalls}</Eyebrow>
        {d.calls.map((c) => (
          <div key={c.slot} style={{ padding: '10px 0', borderBottom: HAIR, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: IB.ink }}>{c.slotName}</span>
              {c.namesText ? <span style={{ ...mono(12, IB.ink2), flex: 1, minWidth: 0 }}>{c.namesText}</span> : null}
              {c.call?.kind ? <CallWord kind={c.call.kind} /> : null}
            </div>
            {c.state === 'open' ? <div style={{ ...BOOK_TEXT, fontSize: 13 }}>{c.text}</div>
              : c.state === 'entering' ? <BookSays>{`${c.text}.`}</BookSays>
              : c.call ? (c.call.failed ? <div style={{ ...BOOK_TEXT, fontSize: 13 }}>{c.call.text}</div> : (
                <>
                  <Quote size={13} cap={IDEA_BOOK_COPY.afterClose(c.call.deskName, c.call.date)}>{c.call.text}</Quote>
                  {c.selling ? <BookSays>{`${c.selling.rest[0].toUpperCase()}${c.selling.rest.slice(1)}.`}</BookSays> : null}
                </>
              )) : null}
          </div>
        ))}
      </div>
      {d.passed ? (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px 10px', marginBottom: 10 }}>
            <Eyebrow>{IDEA_BOOK_COPY.passedOn}</Eyebrow><span style={mono(10.5, IB.ink2)}>{d.passed.tally}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.passed.drafts.map((c, i) => (
              <div key={i} data-ib-draft={c.outcome} style={{ borderRadius: 12, background: IB.surface, border: HAIR, padding: '10px 12px 11px' }}>
                <div style={{ ...mono(12.5, IB.ink, 700), letterSpacing: '.02em', marginBottom: 7 }}>{c.names}</div>
                {c.thesis ? <Quote size={13} cap={IDEA_BOOK_COPY.draft(c.date)}>{c.thesis}</Quote> : null}
                <div style={{ fontSize: 12.5, color: IB.ink2, marginTop: 7, paddingLeft: 13, lineHeight: 1.4, textWrap: 'pretty' }}>
                  <span style={{ color: IB.ink, fontWeight: 700 }}>{c.outcome}</span>{c.why ? `: ${c.why}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DesksTab({ view, focus }) {
  const order = focus === 'shadow' ? ['shadow', 'archetype'] : ['archetype', 'shadow'];
  const desks = order.map((k) => view.desks.find((d) => d.desk === k)).filter(Boolean);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '14px 4px 0' }}>{desks.map((d, i) => <DeskSection key={d.desk} d={d} first={!i} />)}</div>;
}

// ── HISTORY ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function FinishedRow({ f, onOpen }) {
  return (
    <button
      type="button" className="ib-tap ib-row" onClick={onOpen} aria-haspopup="dialog" aria-label={IDEA_BOOK_COPY.openResult(f.namesText, f.ended)}
      style={{ ...RESET, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 15px', columnGap: 10, alignItems: 'center', width: '100%', minHeight: 56, padding: '10px 10px 10px 12px', borderRadius: 12, background: IB.bg, border: HAIR }}
    >
      <span>
        <span style={{ display: 'block', ...mono(13, IB.ink, 700) }}>{f.namesText}</span>
        <span style={{ display: 'block', fontSize: 12, color: IB.ink2, marginTop: 3, lineHeight: 1.35, textWrap: 'pretty' }}>{f.slotName} · {f.ended}</span>
      </span>
      <span style={{ textAlign: 'right', maxWidth: 132 }}>
        {f.notMeasurable ? <span style={{ fontSize: 12.5, fontWeight: 600, color: IB.ink2 }}>Not measurable</span> : f.gap ? (
          <><span style={{ display: 'block', ...mono(13, signColor(f.gap.dir), 700) }}>{f.gap.text}</span><span style={{ display: 'block', ...mono(10.5, IB.ink3), marginTop: 2, lineHeight: 1.35 }}>{f.gap.pct} vs {f.gap.vs}</span></>
        ) : null}
      </span>
      <span style={{ color: IB.ink3 }}><Icon name="chevR" size={15} /></span>
      {f.notMeasurable ? <span style={{ gridColumn: '1 / -1', ...BOOK_TEXT, fontSize: 12, color: IB.ink3, marginTop: 6 }}>{f.notMeasurable.reasons.join(' ')}</span> : null}
    </button>
  );
}

export function ResultSheet({ f, layout, onClose }) {
  const ref = useRef(null);
  const px = layout === 'p320' ? 12 : 16;
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    return () => { if (prev && typeof prev.focus === 'function') prev.focus(); };
  }, []);
  const onKeyDown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
  const phone = layout !== 'desk';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2, display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(var(--ft-shadow-rgb), 0.72)' }} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Finished idea result" onKeyDown={onKeyDown} style={{ position: 'relative', width: '100%', maxWidth: phone ? 'none' : 560, maxHeight: '92%', overflowY: 'auto', boxSizing: 'border-box', background: IB.bg, border: `1px solid ${IB.hair2}`, borderRadius: phone ? '22px 22px 0 0' : 20, padding: `12px ${px}px 24px`, color: IB.ink }}>
        {phone ? <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 4, background: IB.hair2, margin: '0 auto 14px' }} /> : null}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow>Finished · {f.slotLabel}</Eyebrow>
            <h2 style={{ ...mono(19, IB.ink, 700), margin: '6px 0 0', lineHeight: 1.3 }}>{f.namesText}</h2>
            <div style={{ ...BOOK_TEXT, fontSize: 13, color: IB.ink, marginTop: 4 }}>{f.ended}{f.endedOn ? ` · ${f.endedOn}` : ''}</div>
          </div>
          <button type="button" className="ib-tap" onClick={onClose} aria-label={IDEA_BOOK_COPY.close} style={{ ...RESET, width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: IB.ink2, background: IB.surface, border: HAIR, flexShrink: 0 }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {f.columns ? (
          <div data-ib="result-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', marginTop: 14, borderRadius: 12, background: IB.surface, border: HAIR, overflow: 'hidden' }}>
            {f.columns.map((c, i) => (
              <div key={c.key} style={{ padding: '9px 4px 10px', borderLeft: i ? HAIR : 'none', textAlign: 'center' }}>
                <div style={{ ...mono(9, IB.ink3, 600), letterSpacing: '.06em', textTransform: 'uppercase', lineHeight: 1.3, minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.label}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: IB.ink, marginTop: 6, lineHeight: 1.3 }}>{c.value}</div>
                {c.sub ? <div style={{ ...mono(10.5, c.dir ? signColor(c.dir) : IB.ink3), marginTop: 3, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{c.sub}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
        {f.notMeasurable ? <div style={{ ...BOOK_TEXT, marginTop: 12 }}><span style={{ color: IB.ink, fontWeight: 700 }}>Not measurable</span>: {f.notMeasurable.reasons.join(' ')}</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          {f.thesis ? <div><Eyebrow style={{ marginBottom: 10 }}>{IDEA_BOOK_COPY.idea}</Eyebrow><Quote size={13.5} cap={`${f.thesis.deskName}${f.thesis.date ? ` · ${f.thesis.date}` : ''}`}>{f.thesis.text}</Quote></div> : null}
          {f.lastCall ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><Eyebrow>{IDEA_BOOK_COPY.lastCall}</Eyebrow><CallWord kind={f.lastCall.kind} /></div>
              <Quote size={13.5} cap={IDEA_BOOK_COPY.afterClose(f.lastCall.deskName, f.lastCall.date)}>{f.lastCall.text}</Quote>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function HistoryTab({ view, onOpen }) {
  const items = view.history.items;
  return (
    <div style={{ padding: '14px 0 0' }}>
      <Eyebrow style={{ marginBottom: 10, paddingLeft: 4 }}>{IDEA_BOOK_COPY.finished}</Eyebrow>
      {items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{items.map((f, i) => <FinishedRow key={i} f={f} onOpen={() => onOpen(i)} />)}</div>
      ) : <div style={{ ...BOOK_TEXT, fontSize: 13, paddingLeft: 4 }}>{view.history.empty}</div>}
    </div>
  );
}

// ── THE PAGE ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The page's width, measured (the layer is the whole window). */
function useWidth(given) {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 390));
  useEffect(() => {
    if (given) return undefined;
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [given]);
  return given ?? w;
}

function Quiet({ children, sub }) {
  return (
    <div role="status" style={{ padding: '18px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: IB.ink }}>{children}</div>
      {sub ? <div style={{ ...BOOK_TEXT, fontSize: 13 }}>{sub}</div> : null}
    </div>
  );
}

/**
 * The page. `read` is useIdeaBook's; `width` fixes the layout (the picture sheet, the tests), else the window's.
 * `initial` sets the opening tab, open row and desk (the picture sheet's states).
 */
export default function IdeaBookScreen({ read, onClose, width = null, initial = {} }) {
  const w = useWidth(width);
  const layout = layoutOfWidth(w);
  const desk = layout === 'desk';
  const [tab, setTab] = useState(initial.tab ?? 'pos');
  const [open, setOpen] = useState(initial.open ?? null);
  const [deskFocus, setDeskFocus] = useState(initial.desk ?? null);
  const [sheet, setSheet] = useState(initial.sheet ?? null);
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const view = read?.status === 'ready' ? read.book : null;
  const onDesk = (d) => { setDeskFocus(d); setTab('desks'); };

  const header = desk ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, gap: 16 }}>
      <div>
        <button type="button" className="ib-tap" onClick={onClose} aria-label={IDEA_BOOK_COPY.back} style={{ ...RESET, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, color: IB.ink3 }}>
          <Icon name="chevL" size={14} /><span style={{ ...mono(11, IB.ink3, 600), letterSpacing: '.2em', textTransform: 'uppercase' }}>{IDEA_BOOK_COPY.breadcrumb}</span>
        </button>
        <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '6px 0 0', color: IB.ink, outline: 'none' }}>{IDEA_BOOK_COPY.title}</h1>
      </div>
      {view?.day ? <span style={{ ...mono(11, IB.ink3, 600), letterSpacing: '.2em', textTransform: 'uppercase' }}>{view.day} · {IDEA_BOOK_COPY.afterCloseWord}</span> : null}
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', height: 44 }}>
      <button type="button" className="ib-tap" onClick={onClose} aria-label={IDEA_BOOK_COPY.back} style={{ ...RESET, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: IB.ink2 }}>
        <Icon name="chevL" size={18} />
      </button>
      <h1 ref={headingRef} tabIndex={-1} style={{ flex: 1, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: IB.ink, outline: 'none' }}>{IDEA_BOOK_COPY.title}</h1>
      {view?.day ? <span style={{ ...mono(10, IB.ink3, 600), letterSpacing: '.14em', textTransform: 'uppercase', paddingRight: 4 }}>{view.day}</span> : null}
    </div>
  );

  let body;
  if (!read || read.status === 'idle' || read.status === 'loading') body = <Quiet>{IDEA_BOOK_COPY.loading}</Quiet>;
  else if (read.status === 'error' || read.status === 'off') body = <Quiet sub={IDEA_BOOK_COPY.error}>{IDEA_BOOK_COPY.title}</Quiet>;
  else if (!view) body = <Quiet sub={IDEA_BOOK_COPY.emptySub}>{IDEA_BOOK_COPY.empty}</Quiet>;
  else {
    const [sk, sym] = (open || '').split('/');
    const g = view.groups.find((x) => x.slot === sk && x.state !== 'open') ?? null;
    const n = g && sym ? g.names.find((x) => x.symbol === sym) ?? null : null;
    const panel = (k) => (
      <div role="tabpanel" id={`ib-panel-${k}`} aria-labelledby={`ib-tab-${k}`}>
        {k === 'pos' ? (desk ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 400px', gap: 28, alignItems: 'start', marginTop: 16 }}>
            <PosTable view={view} layout={layout} open={open} setOpen={setOpen} inline={false} />
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {view.strip.length > 0 ? <div><Eyebrow style={{ marginBottom: 4, paddingLeft: 4 }}>{IDEA_BOOK_COPY.since}</Eyebrow><Strip items={view.strip} onDesk={onDesk} /></div> : null}
              {g ? <div><Eyebrow style={{ marginBottom: 8, paddingLeft: 4 }}>{g.slotName} · {n ? n.symbol : g.namesText}</Eyebrow>{n ? <NamePanel g={g} n={n} rail /> : <IdeaPanel g={g} rail />}</div> : null}
            </aside>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 4 }}><Strip items={view.strip} onDesk={onDesk} /></div>
            <div style={{ marginTop: 8 }}><PosTable view={view} layout={layout} open={open} setOpen={setOpen} /></div>
          </>
        )) : k === 'desks' ? <div style={desk ? { maxWidth: 560 } : null}><DesksTab view={view} focus={deskFocus} /></div>
          : <div style={desk ? { maxWidth: 480 } : null}><HistoryTab view={view} onOpen={setSheet} /></div>}
      </div>
    );
    body = (
      <>
        <BookLine line={view.line} layout={layout} />
        <div style={{ marginTop: desk ? 14 : 6 }}><Tabs tab={tab} setTab={setTab} layout={layout} /></div>
        {panel(tab)}
        {sheet !== null && view.history.items[sheet] ? <ResultSheet f={view.history.items[sheet]} layout={layout} onClose={() => setSheet(null)} /> : null}
      </>
    );
  }

  return (
    <div className="ib-root" data-ib-layout={layout} style={{ color: IB.ink, background: IB.bg, boxSizing: 'border-box', padding: desk ? '22px 24px 28px' : '8px 12px 24px', maxWidth: desk ? 1236 : 'none', margin: '0 auto', minHeight: '100%' }}>
      <style>{IB_CSS}</style>
      {header}
      {body}
    </div>
  );
}
