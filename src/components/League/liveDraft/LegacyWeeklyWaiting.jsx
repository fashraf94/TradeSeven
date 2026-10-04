// Read-only waiting for a weekly registration made before scheduled-only entry.
// No board subscription or write: the Monday resolver preserves saved boards
// and auto-commits missing ones. There is no trustworthy draft-slot timestamp.
import React from 'react';
import { cssVar } from '../../../theme/cssTokens';

export default function LegacyWeeklyWaiting({ group }) {
  return (
    <section aria-label="Weekly Pod registration" style={{
      maxWidth: 560, margin: '0 auto', padding: '32px 20px',
      color: cssVar('text-primary'), lineHeight: 1.6,
    }}>
      <div style={{ color: cssVar('text-secondary'), fontSize: 12 }}>My game</div>
      <h1 style={{ margin: '4px 0 16px', fontSize: 26 }}>Weekly Pod</h1>
      <div style={{ background: cssVar('bg-card'), border: `1px solid ${cssVar('border-strong')}`, borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>Your registration is saved</h2>
        <p>Your existing weekly group is waiting for its automatic draft. You do not need to choose another slot or edit a draft board.</p>
        <p>Any preferences you already committed are kept. If you did not commit preferences, they will be prepared automatically when the draft runs.</p>
        <p style={{ color: cssVar('text-secondary'), marginBottom: 0 }}>
          {(group.groupMembers || []).length} players registered. Your battle will open here when it is ready.
        </p>
      </div>
    </section>
  );
}
