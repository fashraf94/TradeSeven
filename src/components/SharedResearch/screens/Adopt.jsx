// src/components/SharedResearch/screens/Adopt.jsx
//
// Shared Research — THE ADOPTION PREVIEW and THE SAVED IDEA (spec §4.6, §7.2
// Adopt, §7.3; Correction C; K-7, K-8, K-9).
//
// The preview opens from the server's `adoptPreview` (read fresh when this view
// opens): its companies, each one's `fragment` and `carried` ids, its
// `previewRev`. Picking or dropping a name regenerates the draft from the picked
// fragments with no request — until the player edits it, when it is theirs. The
// client blocks Save only where it is sure (no name picked, no time frame, over
// 1,000 characters, a deselected company still named); every other check is the
// server's, and its refusal shows with its own words. `previewRev` goes back
// exactly as received; a 409 preview_stale brings the new preview — the picks
// that still exist are kept, an edited statement is kept, and the player
// confirms again.
//
// Save's honest states: saving · saved · failed (the server's line: nothing was
// created) · UNCERTAIN (no answer, or a 5xx): only "Check the record" →
// recovered, or nothing was created and Save may run again.
// Equip after a save is the two existing calls; a failed equip keeps the idea.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S, wash } from '../sharedResearchStyle';
import { adoptableOf, carriedByCompanyOf, draftOf, findingsById, strayNamesOf } from '../sharedResearchView';
import { Button, Eyebrow, Field, Finding, LinkButton, Notice, Running, Tag } from '../parts';
import { ADOPTABLE_HORIZONS, HORIZON_HELPER, HORIZON_LABELS } from '../../../constants/sharedResearch';

const STATEMENT_MAX = 1000;

function SavedIdea({ sr, agentName, agentId, equippedListLabel, phone, onClose }) {
  const input = sr.save.input ?? {};
  const outcome = sr.save.outcome ?? {};
  const names = (sr.inv?.adoptPreview?.companies ?? sr.inv?.companies?.supported ?? []).filter((c) => (input.symbols ?? []).includes(c.symbol)).map((c) => c.name);
  const conditions = (input.activation?.length ?? 0) + (input.invalidation?.length ?? 0);
  const eq = sr.equip;
  const canEquip = typeof agentId === 'string' && agentId.length > 0 && typeof outcome.watchlistId === 'string';
  return (
    <section data-screen-label={`Idea saved · equip ${canEquip ? eq.status : 'not offered'}`} style={{ ...S.box, background: wash('pos', 0.06), border: `1px solid ${wash('pos', 0.35)}` }}>
      <div style={S.row}>
        <span aria-hidden="true" style={{ color: T.pos, fontWeight: 700 }}>✓</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{COPY.saved}</span>
      </div>
      {sr.save.status === 'recovered' && <Notice role="status" tone="teal" attrs={{ 'data-sr-recovered': '' }}>{COPY.recovered}</Notice>}
      {input.statement && <p style={S.body}>{input.statement}</p>}
      {input.horizonEnum && <p style={S.meta}>{COPY.savedLine((names.length ? names : input.symbols ?? []).join(' · '), HORIZON_LABELS[input.horizonEnum] ?? input.horizonEnum, conditions)}</p>}
      <div style={{ borderTop: `1px solid ${T.hair}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canEquip && eq.status === 'none' && (
          <>
            <p style={S.meta}>{equippedListLabel ? COPY.replaces(equippedListLabel) : COPY.noList}</p>
            <div style={S.actions}>
              <Button kind="secondary" full={phone} onClick={() => sr.equipNow({ agentId, watchlistId: outcome.watchlistId })} attrs={{ 'data-sr-equip': '' }}>{COPY.useNext}</Button>
              <Button kind="ghost" onClick={sr.declineEquip}>{COPY.notNow}</Button>
            </div>
          </>
        )}
        {canEquip && eq.status === 'declined' && <p style={S.meta}>{COPY.declined}</p>}
        {canEquip && eq.status === 'running' && <Running>{COPY.equipping}</Running>}
        {canEquip && eq.status === 'done' && <p style={{ ...S.body, display: 'flex', gap: 8, flexWrap: 'wrap' }} data-sr-equipped=""><span>{COPY.equipped}</span>{equippedListLabel && <span style={S.small}>{COPY.replaced(equippedListLabel)}</span>}</p>}
        {canEquip && eq.status === 'failed' && (
          <>
            <Notice role="alert" attrs={{ 'data-sr-equip-failed': '' }}>{COPY.equipFailed}</Notice>
            <div style={S.actions}>
              <Button kind="secondary" onClick={() => sr.equipNow({ agentId, watchlistId: outcome.watchlistId })}>{COPY.retry}</Button>
              <Button kind="ghost" onClick={sr.declineEquip}>{COPY.leaveSaved}</Button>
            </div>
          </>
        )}
        <p style={S.small} data-sr-honest="">{COPY.honest(agentName)}</p>
      </div>
      <div style={S.actions}>
        <Button kind="primary" full={phone} onClick={onClose}>{COPY.returnCC}</Button>
      </div>
    </section>
  );
}

export default function Adopt({ sr, agentName, agentId, equippedListLabel, preselect, phone, onBack, onClose }) {
  const preview = sr.inv?.adoptPreview ?? null;
  const adoptable = useMemo(() => adoptableOf(preview), [preview]);
  const [picked, setPicked] = useState(() => {
    const all = adoptableOf(preview).map((c) => c.symbol);
    return preselect && all.includes(preselect) ? [preselect] : all;
  });
  const [statement, setStatement] = useState(() => draftOf(preview, picked));
  const [edited, setEdited] = useState(false);
  const [horizon, setHorizon] = useState(null);
  const [cond, setCond] = useState({});
  const revRef = useRef(preview?.previewRev ?? null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const editedRef = useRef(edited);
  editedRef.current = edited;

  // A new preview (preview_stale, or a fresh read): keep the picks that still exist, and the player's own words.
  useEffect(() => {
    if (!preview || preview.previewRev === revRef.current) return;
    revRef.current = preview.previewRev;
    const still = adoptableOf(preview).map((c) => c.symbol);
    const kept = pickedRef.current.filter((s) => still.includes(s));
    const next = kept.length ? kept : still;
    setPicked(next);
    if (!editedRef.current) setStatement(draftOf(preview, next));
  }, [preview]);

  const saved = sr.save.status === 'saved' || sr.save.status === 'recovered';
  if (saved) return <SavedIdea sr={sr} agentName={agentName} agentId={agentId} equippedListLabel={equippedListLabel} phone={phone} onClose={onClose} />;
  if (!preview) {
    return (
      <div data-screen-label="Adopt · unavailable" style={S.col}>
        <div><LinkButton onClick={onBack}>{COPY.back}</LinkButton></div>
        {sr.pending?.kind === 'read' ? <Running>{COPY.opening}</Running> : <Notice role="status" tone="gold">{COPY.adoptBlocked}</Notice>}
      </div>
    );
  }

  const byId = findingsById(sr.inv.record);
  const toggle = (symbol) => {
    const next = picked.includes(symbol) ? picked.filter((s) => s !== symbol) : adoptable.map((c) => c.symbol).filter((s) => s === symbol || picked.includes(s));
    setPicked(next);
    if (!edited) setStatement(draftOf(preview, next)); // Correction C: the draft from the picked fragments, no request
  };
  const stray = strayNamesOf(statement, preview, picked);
  const over = statement.length > STATEMENT_MAX;
  const status = sr.save.status;
  const uncertain = status === 'uncertain' || status === 'checking';
  const busy = status === 'saving' || status === 'checking' || sr.pending !== null;
  const canSave = Boolean(statement.trim()) && !over && picked.length > 0 && horizon && stray.length === 0 && !busy && !uncertain && status !== 'closed' && !sr.waiting;
  const level = (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const conditionsOf = (key, side) => picked.map((symbol) => ({ symbol, raw: cond[symbol]?.[key] })).filter((x) => level(x.raw) !== null).map((x) => ({ symbol: x.symbol, side, level: level(x.raw), basis: 'daily_close' }));
  const submit = () => sr.adopt({
    statement: statement.trim(), horizonEnum: horizon, symbols: picked,
    activation: conditionsOf('live', 'above'), invalidation: conditionsOf('wrong', 'below'),
  });
  const carried = carriedByCompanyOf(preview, picked);
  const pickedNames = adoptable.filter((c) => picked.includes(c.symbol)).map((c) => c.name);
  const leads = sr.inv.companies?.leads ?? [];

  return (
    <div data-screen-label={`Adopt · ${status}`} style={S.col}>
      <div><LinkButton disabled={busy} onClick={onBack}>{COPY.back}</LinkButton></div>
      <p style={S.meta}>{COPY.adoptIntro}</p>

      <div style={S.box}>
        <Eyebrow as="h3">{COPY.pick}</Eyebrow>
        <p style={S.small}>{COPY.pickHelp}</p>
        <div role="group" aria-label={COPY.pick} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {preview.companies.map((c) => {
            const on = picked.includes(c.symbol);
            const open = sr.inv.companies?.supported?.find((s) => s.symbol === c.symbol)?.openQuestion ?? null;
            return (
              <label key={c.symbol} data-sr-pick={c.symbol} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10, background: T.bg, border: `1px solid ${on ? wash('teal', 0.5) : T.hair}`, cursor: c.adoptable ? 'pointer' : 'not-allowed', opacity: c.adoptable ? 1 : 0.6, minHeight: 44, boxSizing: 'border-box' }}>
                <input type="checkbox" checked={on} disabled={!c.adoptable || busy} onChange={() => toggle(c.symbol)} style={{ marginTop: 3, width: 18, height: 18 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={S.row}><span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{c.name}</span><span style={S.small}>{c.symbol}</span><Tag tone="teal" dim>{c.role}</Tag></span>
                  {open && <span style={{ display: 'block', ...S.small, color: T.copper, marginTop: 2 }}>{COPY.doubt(open.fact)}</span>}
                  {!c.adoptable && <span style={{ display: 'block', ...S.small, marginTop: 2 }}>{COPY.tooMuch}</span>}
                </span>
              </label>
            );
          })}
          {leads.map((l) => (
            <div key={`${l.symbol ?? ''}:${l.name}`} style={{ display: 'flex', gap: 10, padding: '9px 10px', borderRadius: 10, border: `1px dashed ${T.hair}`, opacity: 0.6 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{l.name}</span>
              <span style={S.small}>{COPY.leadPick}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.box}>
        <Field id="sr-statement" label={COPY.thesisLabel} help={COPY.thesisHelp}>
          <div style={{ ...S.row, marginBottom: 6 }}><Tag tone="gold">{COPY.thesisTag}</Tag><span style={S.small}>{COPY.thesisTagNote}</span></div>
          <textarea id="sr-statement" value={statement} disabled={busy} onChange={(e) => { setStatement(e.target.value); setEdited(true); }} rows={7} style={{ ...S.input, minHeight: 170, resize: 'vertical' }} />
        </Field>
        <div style={S.row}>
          <span style={{ ...S.small, color: over ? T.neg : T.ink3 }} data-sr-count="">{COPY.count(statement.length)}{over ? COPY.over : ''}</span>
          {edited && <LinkButton onClick={() => { setStatement(draftOf(preview, picked)); setEdited(false); }}>{COPY.resetDraft}</LinkButton>}
        </div>
        {stray.length > 0 && <Notice role="alert" attrs={{ 'data-sr-stray': '' }}>{COPY.stray(stray)}</Notice>}
      </div>

      <div style={S.box}>
        <Eyebrow as="h3">{COPY.timeFrame}</Eyebrow>
        <p style={S.small}>{HORIZON_HELPER}</p>
        <div role="radiogroup" aria-label={COPY.timeFrame} style={S.row}>
          {ADOPTABLE_HORIZONS.map((h) => (
            <Button key={h} kind={horizon === h ? 'primary' : 'secondary'} disabled={busy} onClick={() => setHorizon(h)} attrs={{ role: 'radio', 'aria-checked': horizon === h, 'data-sr-horizon': h }}>{HORIZON_LABELS[h]}</Button>
          ))}
        </div>
        {!horizon && <p style={S.small}>{COPY.timeFrameNone}</p>}
      </div>

      <div style={S.box}>
        <Eyebrow as="h3">{COPY.conditions}</Eyebrow>
        <p style={S.small}>{COPY.conditionsHelp}</p>
        {picked.length ? adoptable.filter((c) => picked.includes(c.symbol)).map((c) => (
          <div key={c.symbol} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[['live', COPY.liveAbove], ['wrong', COPY.wrongBelow]].map(([key, side]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 0, ...S.meta }}>
                <span style={{ whiteSpace: 'nowrap' }}>{`${c.symbol} · ${side}`}</span>
                <input inputMode="decimal" value={cond[c.symbol]?.[key] ?? ''} disabled={busy} aria-label={COPY.conditionLabel(c.name, side)}
                  onChange={(e) => setCond((v) => ({ ...v, [c.symbol]: { ...(v[c.symbol] ?? {}), [key]: e.target.value.replace(/[^0-9.]/g, '') } }))}
                  style={{ ...S.input, minHeight: 40, flex: 1, minWidth: 80 }} />
              </label>
            ))}
          </div>
        )) : <p style={S.small}>{COPY.pickFirst}</p>}
        <p style={S.small}>{COPY.noPriceNote}</p>
      </div>

      <div style={S.box} data-sr-carried="">
        <Eyebrow as="h3">{COPY.carried}</Eyebrow>
        {carried.length ? carried.map((c) => (
          <div key={c.symbol} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-sr-carried-for={c.symbol}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.ink2 }}>{c.name}</span>
            {c.carried.map((fid) => byId.get(fid)).filter(Boolean).map((f) => <Finding key={f.findingId} finding={f} />)}
          </div>
        )) : <p style={S.small}>{COPY.carriedNone}</p>}
        <p style={S.small}>{COPY.carriedNote}</p>
      </div>

      <div style={{ ...S.box, borderStyle: 'dashed' }}>
        <Eyebrow as="h3">{COPY.createsHead}</Eyebrow>
        <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 4, ...S.body, fontSize: 13.5 }}>
          <li>{pickedNames.length ? COPY.createsIdea(pickedNames.join(', ')) : COPY.createsIdeaNone}</li>
          <li>{COPY.createsEvidence}</li>
          <li>{COPY.createsClose}</li>
        </ul>
        <p style={S.small}>{COPY.honest(agentName)}</p>
      </div>

      {status === 'failed' && <Notice role="alert" attrs={{ 'data-sr-save': 'failed' }}>{sr.save.message}</Notice>}
      {status === 'stale' && <Notice role="alert" tone="gold" attrs={{ 'data-sr-save': 'stale' }}>{sr.save.message}</Notice>}
      {status === 'closed' && <Notice role="status" tone="gold" attrs={{ 'data-sr-save': 'closed' }}>{sr.save.message}</Notice>}
      {uncertain && <Notice role="alert" tone="gold" attrs={{ 'data-sr-save': 'uncertain' }}>{sr.save.checkFailed ? COPY.checkFailed : COPY.saveUncertain}</Notice>}
      {status === 'notsaved' && <Notice role="status" tone="teal" attrs={{ 'data-sr-save': 'notsaved' }}>{COPY.notSaved}</Notice>}
      <div style={S.actions}>
        {status === 'saving' && <Running>{COPY.saving}</Running>}
        {status === 'checking' && <Running>{COPY.checking}</Running>}
        {status === 'uncertain' && <Button kind="primary" full={phone} onClick={sr.checkSave} attrs={{ 'data-sr-check': '' }}>{COPY.checkRecord}</Button>}
        {!uncertain && status !== 'saving' && status !== 'closed' && (
          <Button kind="primary" full={phone} disabled={!canSave} onClick={submit} attrs={{ 'data-sr-save-button': '' }}>{status === 'failed' || status === 'notsaved' ? COPY.retry : COPY.saveIdea}</Button>
        )}
        <Button kind="ghost" disabled={busy} onClick={onBack}>{COPY.cancel}</Button>
      </div>
    </div>
  );
}
