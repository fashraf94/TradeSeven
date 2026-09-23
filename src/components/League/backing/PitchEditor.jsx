// src/components/League/backing/PitchEditor.jsx
//
// Backing Beta PR 4 — THE SCOUTING LINE'S SHARED EDITOR (design brief rev2 §2,
// rev3 §3; ported from the frozen design's `backing-strip.jsx` ProfilePitch and
// `backing-card.jsx` PitchLine). One sentence in the player's own words, edited
// in two homes that edit the SAME line:
//   · "card" mode — inline on the player's own team card (WRITE / EDIT beside
//     the quote);
//   · "profile" mode — the framed editor in the agent/profile area
//     (ScoutingLine.jsx, the home that owns the subscription).
// Pure over its props: `pitch` is useMyPitch's return ({ text, save, saving,
// error }); every save goes through POST /api/team/pitch inside that hook, and
// nothing here touches a service, a hook or Firebase — so the team card that
// mounts it stays a projection-only render (TeamCard.test.jsx pins that).

import React, { useEffect, useState } from 'react';
import { PITCH_MAX_LEN } from '../../../constants/teamPitch';
import { LTOKENS, LX, alpha, MONO } from '../leagueTokens';
import { Mono } from '../LeagueParts';
import { CARD, PROFILE, refusalMessage } from './backingCopy';

const textareaStyle = (accent) => ({
  all: 'unset', boxSizing: 'border-box', width: '100%', minHeight: 54, padding: '8px 10px', borderRadius: 9,
  fontSize: 13.5, lineHeight: 1.45, color: LTOKENS.ink, background: alpha(LTOKENS.bg, 0.6),
  border: `1px solid ${alpha(accent, 0.5)}`, whiteSpace: 'pre-wrap', display: 'block',
});

const linkButton = (accent) => ({ all: 'unset', cursor: 'pointer', fontFamily: MONO, fontSize: 10, color: accent, letterSpacing: '0.08em', flexShrink: 0 });

export default function PitchEditor({ pitch, accent = LX.energy, mode = 'card' }) {
  const current = typeof pitch?.text === 'string' ? pitch.text : '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [localError, setLocalError] = useState(null);

  // A save elsewhere (the other home) lands while this one is idle.
  useEffect(() => { if (!editing) setDraft(current); }, [current, editing]);

  const commit = async () => {
    const next = draft.trim();
    if (next.length > PITCH_MAX_LEN) { setLocalError(CARD.pitch.tooLong(PITCH_MAX_LEN)); return; }
    setLocalError(null);
    const ok = await pitch.save(next);
    if (ok) setEditing(false);
  };
  const cancel = () => { setDraft(current); setLocalError(null); setEditing(false); };
  // The server's refusal, as a sentence: a length refusal names the limit,
  // an account refusal names the account, anything else is the plain failure.
  const shownError = localError
    || (pitch?.error === 'too_long' ? CARD.pitch.tooLong(PITCH_MAX_LEN)
      : pitch?.error === 'account_required' || pitch?.error === 'network' ? refusalMessage(pitch.error)
        : pitch?.error ? CARD.pitch.failed : null);

  if (editing) {
    return (
      <div data-backing="pitch-editor" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <textarea
          autoFocus
          value={draft}
          maxLength={PITCH_MAX_LEN}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={CARD.pitch.placeholder}
          aria-label={PROFILE.eyebrow}
          style={textareaStyle(accent)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="lg-tap" onClick={commit} disabled={pitch?.saving} style={{ all: 'unset', cursor: 'pointer', padding: '5px 10px', borderRadius: 7, background: accent, color: LTOKENS.bg, fontSize: 11.5, fontWeight: 700, opacity: pitch?.saving ? 0.7 : 1 }}>
            {pitch?.saving ? CARD.pitch.saving : CARD.pitch.save}
          </button>
          <button type="button" className="lg-tap" onClick={cancel} style={{ all: 'unset', cursor: 'pointer', padding: '5px 8px', fontSize: 11.5, color: LTOKENS.ink3 }}>{CARD.pitch.cancel}</button>
          <Mono style={{ marginLeft: 'auto', fontSize: 9.5, color: LTOKENS.ink3 }}>{CARD.pitch.counter(draft.length, PITCH_MAX_LEN)}</Mono>
        </div>
        {shownError && (
          <div role="alert" style={{ fontSize: 11.5, color: LX.neg, lineHeight: 1.4 }}>{shownError}</div>
        )}
      </div>
    );
  }

  if (!current) {
    return (
      <div data-backing="pitch-empty" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: mode === 'profile' ? 14 : 12.5, color: LTOKENS.ink3, fontStyle: 'italic', lineHeight: 1.45 }}>
          {mode === 'profile' ? PROFILE.empty : CARD.pitch.noneYours}
        </span>
        <button type="button" className="lg-tap" onClick={() => setEditing(true)} style={linkButton(accent)}>{CARD.pitch.write}</button>
      </div>
    );
  }

  return (
    <div data-backing="pitch" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: mode === 'profile' ? 14 : 13.5, color: LTOKENS.ink, lineHeight: 1.45, flex: 1 }}>{CARD.pitch.quote(current)}</span>
      <button type="button" className="lg-tap" onClick={() => setEditing(true)} style={{ ...linkButton(accent), paddingTop: 2 }}>{CARD.pitch.edit}</button>
    </div>
  );
}
