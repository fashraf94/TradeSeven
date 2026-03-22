import React from 'react';
import { GraduationCap } from 'lucide-react';

export default function AcademyEmptyState({ categoryLabel, onViewAll }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
      gap: '12px',
    }}>
      <GraduationCap size={48} color="#94a3b8" />
      <div style={{
        fontSize: '18px',
        fontWeight: 600,
        color: '#8b949e',
      }}>
        No videos yet
      </div>
      <div style={{
        fontSize: '14px',
        color: '#6e7681',
      }}>
        Videos for {categoryLabel} are coming soon.
      </div>
      <button
        onClick={onViewAll}
        style={{
          marginTop: '8px',
          padding: '8px 20px',
          borderRadius: '20px',
          border: '1px solid #00d9ff',
          background: 'transparent',
          color: '#00d9ff',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,217,255,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        View All
      </button>
    </div>
  );
}
