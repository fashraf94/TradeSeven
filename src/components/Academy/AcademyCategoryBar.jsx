import React from 'react';

export default function AcademyCategoryBar({ categories, selectedCategory, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
      padding: '0 4px',
      margin: '16px 0',
    }}>
      <style>{`.academy-category-bar::-webkit-scrollbar { display: none; }`}</style>
      <div className="academy-category-bar" style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        width: '100%',
      }}>
        {categories.map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: isActive
                  ? `1px solid ${cat.color}4D`
                  : '1px solid rgba(255,255,255,0.08)',
                background: isActive
                  ? `${cat.color}26`
                  : 'rgba(255,255,255,0.06)',
                color: isActive ? cat.color : '#8b949e',
                transition: 'all 0.2s ease',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
