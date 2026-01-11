import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { designColors, fontMono } from '../designConstants';
import { buttonTap } from '../animationPresets';

export default function DaySelector({
  days,           // [{ dayName: 'MON', date: 13, count: 4 }, ...]
  selectedIndex,
  onSelect,
  isDesktop = false,
}) {
  const containerRef = useRef(null);
  const selectedRef = useRef(null);

  // Scroll selected day into view on mobile
  useEffect(() => {
    if (!isDesktop && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedIndex, isDesktop]);

  // Desktop: Vertical list
  if (isDesktop) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '16px',
        minWidth: '180px',
        borderRight: `1px solid ${designColors.borderDefault}`,
        backgroundColor: designColors.bgCard,
      }}>
        {days.map((day, index) => {
          const isSelected = index === selectedIndex;
          return (
            <motion.button
              key={index}
              onClick={() => onSelect(index)}
              whileHover={{ backgroundColor: designColors.bgCardInner }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: isSelected ? designColors.bgCardInner : 'transparent',
                border: 'none',
                borderLeft: isSelected ? `3px solid ${designColors.cyan}` : '3px solid transparent',
                borderRadius: '0 8px 8px 0',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: '14px',
                fontWeight: isSelected ? 'bold' : 'normal',
                color: isSelected ? designColors.textPrimary : designColors.textSecondary,
              }}>
                {day.dayName} {day.date}
              </span>
              <span style={{
                fontSize: '12px',
                fontFamily: fontMono,
                color: isSelected ? designColors.cyan : designColors.textMuted,
              }}>
                ({day.count})
              </span>
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Mobile: Horizontal scrollable tabs
  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        borderBottom: `1px solid ${designColors.borderDefault}`,
      }}
    >
      {days.map((day, index) => {
        const isSelected = index === selectedIndex;
        return (
          <motion.button
            key={index}
            ref={isSelected ? selectedRef : null}
            onClick={() => onSelect(index)}
            whileTap={buttonTap}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 16px',
              minWidth: '60px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: isSelected ? `2px solid ${designColors.cyan}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            <span style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: isSelected ? designColors.textPrimary : designColors.textMuted,
            }}>
              {day.dayName}
            </span>
            <span style={{
              fontSize: '16px',
              fontWeight: isSelected ? 'bold' : 'normal',
              color: isSelected ? designColors.textPrimary : designColors.textSecondary,
            }}>
              {day.date}
            </span>
            <span style={{
              fontSize: '11px',
              fontFamily: fontMono,
              color: isSelected ? designColors.cyan : designColors.textMuted,
            }}>
              ({day.count})
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
