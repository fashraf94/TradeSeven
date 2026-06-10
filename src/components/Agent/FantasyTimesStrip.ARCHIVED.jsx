import React from 'react';

const FantasyTimesStrip = ({ stories, tokens, isDesktop, isMobile, onTileClick }) => {
  if (!stories?.length) return null;

  const gridColumns = isDesktop ? 'repeat(4, 1fr)' : isMobile ? undefined : 'repeat(2, 1fr)';
  const isClickable = typeof onTileClick === 'function';

  return (
    <>
      {isMobile && (
        <style>{`.ft-strip-scroll::-webkit-scrollbar { display: none; }`}</style>
      )}
      <div
        className={isMobile ? 'ft-strip-scroll' : undefined}
        style={isMobile ? {
          display: 'flex',
          overflowX: 'auto',
          gap: '10px',
          padding: '0 4px 4px 4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
        } : {
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: '12px',
        }}
      >
        {stories.map((story, i) => (
          <div
            key={story.id || i}
            onClick={isClickable ? () => onTileClick(story) : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTileClick(story);
              }
            } : undefined}
            style={{
              background: tokens.bgCard,
              borderRadius: '12px',
              border: `1px solid ${tokens.borderDefault}`,
              borderLeft: `3px solid ${story.color}`,
              padding: '12px',
              boxShadow: tokens.obsidianShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              cursor: isClickable ? 'pointer' : 'default',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              ...(isMobile ? { minWidth: '240px', maxWidth: '240px', scrollSnapAlign: 'start' } : {}),
            }}
          >
            {/* Reporter row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: `${story.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: '700', color: story.color,
              }}>
                {story.reporter.charAt(0)}
              </div>
              <span style={{ fontSize: '11px', color: tokens.textFaint, fontWeight: '500' }}>
                {story.reporter}
              </span>
              {story.beat && (
                <span style={{
                  fontSize: '9px', color: tokens.textFaintest, fontWeight: '600',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  · {story.beat}
                </span>
              )}
            </div>
            {/* Headline */}
            <div style={{
              fontSize: '13px', fontWeight: '500', color: tokens.textPrimary, lineHeight: '1.35',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {story.headline}
            </div>
            {/* Timestamp */}
            <span style={{ fontSize: '10px', color: tokens.textFaint, marginTop: 'auto' }}>
              {story.time}
            </span>
          </div>
        ))}
      </div>
    </>
  );
};

export default FantasyTimesStrip;
