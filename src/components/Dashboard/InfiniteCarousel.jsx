// /src/components/Dashboard/InfiniteCarousel.jsx
// Extracted from GameModeCarousels.jsx for reuse across dashboard sections
// Provides infinite/endless horizontal carousel with seamless looping

import React, { useRef, useEffect, useCallback } from 'react';

const carouselContainerStyle = {
  display: 'flex',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  gap: '12px',
  padding: '0 16px 16px 16px',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  WebkitOverflowScrolling: 'touch',
};

export default function InfiniteCarousel({ items, renderCard, gap = 12, padding = '0 16px 16px 16px' }) {
  const carouselRef = useRef(null);
  const isScrollingRef = useRef(false);

  // Duplicate items 3x for seamless infinite loop
  const triplicatedItems = [...items, ...items, ...items];

  // Initialize scroll position to middle set
  useEffect(() => {
    if (carouselRef.current) {
      const container = carouselRef.current;
      requestAnimationFrame(() => {
        const singleSetWidth = container.scrollWidth / 3;
        container.scrollLeft = singleSetWidth;
      });
    }
  }, [items.length]);

  // Handle scroll for infinite loop effect
  const handleScroll = useCallback((e) => {
    if (isScrollingRef.current) return;

    const container = e.target;
    const singleSetWidth = container.scrollWidth / 3;
    const scrollLeft = container.scrollLeft;
    const threshold = 50;

    if (scrollLeft >= singleSetWidth * 2 - threshold) {
      isScrollingRef.current = true;
      container.scrollLeft = singleSetWidth + (scrollLeft - singleSetWidth * 2);
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    } else if (scrollLeft <= threshold) {
      isScrollingRef.current = true;
      container.scrollLeft = singleSetWidth + scrollLeft;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
  }, []);

  return (
    <div
      ref={carouselRef}
      onScroll={handleScroll}
      className="carousel-scroll"
      style={{ ...carouselContainerStyle, gap: `${gap}px`, padding }}
    >
      {triplicatedItems.map((item, index) => renderCard(item, index))}
    </div>
  );
}
