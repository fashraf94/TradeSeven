// /src/components/Dashboard/WeeklyChallenges/ChallengeCarousel.jsx
// Horizontal snap-scroll carousel for tarot challenge cards
// - Scroll-snap with center alignment
// - Tracks scroll progress for holographic shimmer
// - Dot indicators below cards
// - Shows ~1.5 cards on mobile for peek effect

import React, { useRef, useState, useCallback, useEffect } from 'react';
import TarotCard from './TarotCard';

export default function ChallengeCarousel({
  challenges,
  activeDailyChallenge,
  completedWeeklyChallenges,
  challengeProgress,
  onAccept,
}) {
  const scrollRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    // Normalized 0-1 scroll progress for holographic shimmer
    const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
    setScrollProgress(progress);

    // Determine active card index from scroll position
    // Each card is 160px wide + 20px gap = 180px per card
    const cardWidth = 180;
    const idx = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.min(idx, challenges.length - 1));
  }, [challenges.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToIndex = (idx) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 180;
    el.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
  };

  return (
    <div>
      {/* Scrollable card track */}
      <div
        ref={scrollRef}
        className="tarot-carousel"
        style={{
          display: 'flex',
          gap: '20px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 24px 16px',
          // Hide scrollbar - navigation via swipe + dots
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Hide webkit scrollbar */}
        <style>{`
          .tarot-carousel::-webkit-scrollbar { display: none; }
        `}</style>

        {challenges.map((challenge, index) => (
          <TarotCard
            key={challenge.id}
            challenge={challenge}
            index={index}
            activeDailyChallenge={activeDailyChallenge}
            completedWeeklyChallenges={completedWeeklyChallenges}
            challengeProgress={challengeProgress}
            onAccept={onAccept}
            scrollProgress={scrollProgress}
          />
        ))}
      </div>

      {/* Dot indicators */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 0 4px',
      }}>
        {challenges.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollToIndex(idx)}
            aria-label={`Go to challenge ${idx + 1}`}
            style={{
              width: activeIndex === idx ? '20px' : '8px',
              height: '8px',
              borderRadius: '4px',
              border: 'none',
              background: activeIndex === idx ? '#A855F7' : 'rgba(139, 148, 158, 0.3)',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
