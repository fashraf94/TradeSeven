// /src/components/Dashboard/WeeklyChallenges/ChallengeCarousel.jsx
// Horizontal snap-scroll carousel for tarot challenge cards
// - Scroll-snap with center alignment
// - Tracks scroll progress for holographic shimmer
// - Dot indicators below cards
// - Shows ~1.3 cards on mobile for peek effect
// - Responsive card sizing for different screen widths

import React, { useRef, useState, useCallback, useEffect } from 'react';
import TarotCard from './TarotCard';

// Get responsive card dimensions based on screen width
const getCardDimensions = () => {
  if (typeof window === 'undefined') return { width: 160, height: 320, gap: 16 };
  const screenWidth = window.innerWidth;
  if (screenWidth < 390) {
    // iPhone SE, small phones - show ~1.3 cards with peek
    return { width: 145, height: 290, gap: 12 };
  } else if (screenWidth < 430) {
    // iPhone 12/13/14 - show ~1.4 cards
    return { width: 150, height: 300, gap: 14 };
  } else if (screenWidth < 768) {
    // Large phones - show ~1.6 cards
    return { width: 155, height: 310, gap: 16 };
  }
  // Desktop/tablet
  return { width: 160, height: 320, gap: 20 };
};

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
  const [cardDimensions, setCardDimensions] = useState(getCardDimensions());

  // Update card dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      setCardDimensions(getCardDimensions());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    // Normalized 0-1 scroll progress for holographic shimmer
    const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
    setScrollProgress(progress);

    // Determine active card index from scroll position
    const cardTotalWidth = cardDimensions.width + cardDimensions.gap;
    const idx = Math.round(scrollLeft / cardTotalWidth);
    setActiveIndex(Math.min(idx, challenges.length - 1));
  }, [challenges.length, cardDimensions]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToIndex = (idx) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardTotalWidth = cardDimensions.width + cardDimensions.gap;
    el.scrollTo({ left: idx * cardTotalWidth, behavior: 'smooth' });
  };

  return (
    <div style={{
      // Container with overflow visible to not clip carousel
      width: '100%',
      position: 'relative',
    }}>
      {/* Scrollable card track */}
      <div
        ref={scrollRef}
        className="tarot-carousel"
        style={{
          display: 'flex',
          gap: `${cardDimensions.gap}px`,
          // CRITICAL: Use 'scroll' for reliable mobile scrolling
          overflowX: 'scroll',
          overflowY: 'visible',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          // Padding for card spacing from edges
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingTop: '12px',
          paddingBottom: '16px',
          // Hide scrollbar - navigation via swipe + dots
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          // Ensure touch scrolling works
          touchAction: 'pan-x',
          // Prevent any pointer-events blocking
          pointerEvents: 'auto',
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
            cardWidth={cardDimensions.width}
            cardHeight={cardDimensions.height}
          />
        ))}
      </div>

      {/* Dot indicators - min 44px tap target for accessibility */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '4px',
        padding: '8px 0 4px',
      }}>
        {challenges.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollToIndex(idx)}
            aria-label={`Go to challenge ${idx + 1}`}
            style={{
              // Outer container for 44px tap target
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {/* Visual dot indicator */}
            <span style={{
              width: activeIndex === idx ? '20px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: activeIndex === idx ? '#A855F7' : 'rgba(139, 148, 158, 0.3)',
              transition: 'all 0.3s ease',
              display: 'block',
            }} />
          </button>
        ))}
      </div>
    </div>
  );
}
