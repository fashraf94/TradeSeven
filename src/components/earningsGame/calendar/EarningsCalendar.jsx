import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { designColors, fontMono } from '../designConstants';
import { screenContainer, fixedBottomContainer, flexCenter } from '../styleUtils';
import { buttonTap, cardTap } from '../animationPresets';
import { EarningsHeader, CountdownTimer } from '../shared';
import TournamentBanner from './TournamentBanner';
import DaySelector from './DaySelector';
import CompanyCard from './CompanyCard';

export default function EarningsCalendar({
  events,
  predictions,
  tournament,
  loading,
  error,
  onBack,
  onOpenArchitect,
  onViewPortfolio,
  isDesktop = false,
}) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Group events by day of week
  const dayGroups = useMemo(() => {
    const groups = {};
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    events.forEach(event => {
      const date = new Date(event.reportDate);
      const dayKey = date.toDateString();
      if (!groups[dayKey]) {
        groups[dayKey] = {
          dayName: dayNames[date.getDay()],
          date: date.getDate(),
          fullDate: date,
          events: [],
        };
      }
      groups[dayKey].events.push(event);
    });

    // Convert to array and sort by date
    return Object.values(groups)
      .sort((a, b) => a.fullDate - b.fullDate)
      .slice(0, 5); // Only show 5 days max
  }, [events]);

  // Get events for selected day
  const selectedDay = dayGroups[selectedDayIndex];
  const dayEvents = selectedDay?.events || [];

  // Check if an event is already picked
  const isPicked = (eventId) => predictions.some(p => p.eventId === eventId);

  // Check if we have any live Polymarket odds
  const hasAnyLiveOdds = useMemo(() => {
    return events.some(e => e.hasPolymarketOdds === true);
  }, [events]);

  // Get the data source for display - count how many have historical vs sector defaults
  const dataSourceInfo = useMemo(() => {
    if (events.length === 0) return null;
    const firstEvent = events[0];
    const source = firstEvent?.dataSource || 'unknown';

    // Market-Informed Engine v1 - our calculated odds
    if (source === 'market_informed_v1') {
      // Count how many events have historical data
      const historicalCount = events.filter(e =>
        e.oddsSource === 'historical' || e.oddsSource === 'cached_historical'
      ).length;

      if (historicalCount >= events.length * 0.5) {
        // Majority have historical data
        return {
          label: `CALCULATED (${historicalCount})`,
          color: designColors.cyan,
          icon: '📊',
          tooltip: `${historicalCount} stocks with historical beat rates`
        };
      } else if (historicalCount > 0) {
        // Some have historical data
        return {
          label: `MIXED (${historicalCount} hist)`,
          color: designColors.green,
          icon: '📈',
          tooltip: `${historicalCount} stocks with historical data, rest using sector averages`
        };
      }
      // All using sector defaults
      return {
        label: 'SECTOR AVG',
        color: designColors.gold,
        icon: '~',
        tooltip: 'Using sector-based average beat rates'
      };
    }

    // Legacy: Polymarket live data
    if (source === 'hybrid_eodhd_polymarket' || source === 'polymarket_live') {
      return { label: 'LIVE ODDS', color: designColors.cyan, icon: '📊' };
    }

    // Legacy: Default 70% odds
    if (source === 'eodhd_default_odds' || source === 'eodhd_only') {
      return { label: 'EST. ODDS', color: designColors.gold, icon: '~' };
    }

    // Test/fallback data
    if (source === 'test_fallback') {
      return { label: 'TEST DATA', color: designColors.red, icon: '⚠️' };
    }

    return { label: 'ODDS', color: designColors.textMuted, icon: '' };
  }, [events]);

  // Format selected day header
  const formatDayHeader = () => {
    if (!selectedDay) return '';
    const date = selectedDay.fullDate;
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options).toUpperCase();
  };

  if (loading) {
    return (
      <div style={{
        ...screenContainer,
        ...flexCenter,
      }}>
        <span style={{ color: designColors.textSecondary }}>Loading earnings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        ...screenContainer,
        padding: '16px',
      }}>
        <EarningsHeader title="EARNINGSGAME" onBack={onBack} />
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: designColors.red,
        }}>
          {error}
        </div>
      </div>
    );
  }

  // Calculate total spent for display
  const totalSpent = predictions.reduce((sum, p) => sum + (p.price || 0), 0);

  // Get week date range for sidebar
  const getWeekRange = () => {
    if (dayGroups.length === 0) return '';
    const firstDay = dayGroups[0]?.fullDate;
    const lastDay = dayGroups[dayGroups.length - 1]?.fullDate;
    if (!firstDay || !lastDay) return '';
    const month = firstDay.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return `${month} ${firstDay.getDate()}-${lastDay.getDate()}`;
  };

  // Desktop layout - Enhanced 3-column design
  if (isDesktop) {
    return (
      <div style={{
        ...screenContainer,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header with inline tournament info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: `1px solid ${designColors.borderDefault}`,
          backgroundColor: designColors.bgCard,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <motion.button
              onClick={onBack}
              whileTap={buttonTap}
              style={{
                background: 'none',
                border: 'none',
                color: designColors.textSecondary,
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ←
            </motion.button>
            <span style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: designColors.textPrimary,
            }}>
              EARNINGSGAME
            </span>
          </div>

          {/* Inline tournament info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🏆</span>
              <span style={{
                fontWeight: 'bold',
                color: designColors.textPrimary,
              }}>
                WEEK {tournament.week}
              </span>
            </div>

            <CountdownTimer deadline={tournament.lockDeadline} size="small" />

            <span style={{
              color: designColors.textSecondary,
              fontSize: '13px',
            }}>
              {predictions.length} picks · <span style={{ fontFamily: fontMono }}>${totalSpent.toLocaleString()}</span>
            </span>

            <motion.button
              onClick={onViewPortfolio}
              whileHover={{ scale: 1.02 }}
              whileTap={cardTap}
              style={{
                padding: '8px 20px',
                backgroundColor: designColors.cyan,
                border: 'none',
                borderRadius: '6px',
                color: designColors.bgPrimary,
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              VIEW PORTFOLIO
            </motion.button>
          </div>
        </div>

        {/* Main content: Sidebar + Grid */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Left sidebar: Day selector */}
          <div style={{
            width: '200px',
            borderRight: `1px solid ${designColors.borderDefault}`,
            backgroundColor: designColors.bgCard,
            padding: '16px 0',
          }}>
            <div style={{
              padding: '0 16px 16px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: designColors.textMuted,
              letterSpacing: '1px',
            }}>
              WEEK OF {getWeekRange()}
            </div>

            {dayGroups.map((day, index) => (
              <motion.button
                key={index}
                onClick={() => setSelectedDayIndex(index)}
                whileHover={{ backgroundColor: designColors.bgCardInner }}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: index === selectedDayIndex ? designColors.bgCardInner : 'transparent',
                  border: 'none',
                  borderLeft: index === selectedDayIndex
                    ? `3px solid ${designColors.cyan}`
                    : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  color: index === selectedDayIndex
                    ? designColors.textPrimary
                    : designColors.textSecondary,
                  fontWeight: index === selectedDayIndex ? 'bold' : 'normal',
                  fontSize: '13px',
                }}>
                  {day.dayName} {day.date}
                </span>
                <span style={{
                  fontFamily: fontMono,
                  fontSize: '12px',
                  color: index === selectedDayIndex
                    ? designColors.cyan
                    : designColors.textMuted,
                }}>
                  {day.events.length}
                </span>
              </motion.button>
            ))}
          </div>

          {/* Right content: Company cards grid */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <span style={{
                fontSize: '14px',
                color: designColors.textSecondary,
              }}>
                {formatDayHeader()} · {dayEvents.length} companies
              </span>
              {dataSourceInfo && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: `${dataSourceInfo.color}15`,
                  color: dataSourceInfo.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={dataSourceInfo.label === 'EST. ODDS'
                  ? 'Historical average odds (no live Polymarket data)'
                  : dataSourceInfo.label === 'LIVE ODDS'
                  ? 'Real-time odds from Polymarket prediction markets'
                  : ''}
                >
                  {dataSourceInfo.icon} {dataSourceInfo.label}
                </span>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '16px',
            }}>
              {dayEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <CompanyCard
                    symbol={event.symbol}
                    companyName={event.companyName}
                    reportTime={event.reportTime || 'AMC'}
                    beatOdds={event.yesOdds}
                    hasLiveOdds={event.hasPolymarketOdds === true || event.hasCalculatedOdds === true}
                    isPicked={isPicked(event.id)}
                    onAdd={() => onOpenArchitect(event)}
                    onView={() => onOpenArchitect(event)}
                    isDesktop={true}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        ...screenContainer,
        paddingBottom: '80px', // Space for bottom CTA
      }}
    >
      <EarningsHeader title="EARNINGSGAME" onBack={onBack} />

      <TournamentBanner
        week={tournament.week}
        lockDeadline={tournament.lockDeadline}
        picksCount={predictions.length}
        totalSpent={predictions.reduce((sum, p) => sum + p.price, 0)}
        onViewPortfolio={onViewPortfolio}
      />

      <DaySelector
        days={dayGroups.map(d => ({
          dayName: d.dayName,
          date: d.date,
          count: d.events.length
        }))}
        selectedIndex={selectedDayIndex}
        onSelect={setSelectedDayIndex}
        isDesktop={false}
      />

      {/* Day header */}
      <div style={{
        padding: '16px 16px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: '13px',
          color: designColors.textSecondary,
        }}>
          {formatDayHeader()} · {dayEvents.length} companies
        </span>
        {dataSourceInfo && (
          <span style={{
            fontSize: '9px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: `${dataSourceInfo.color}15`,
            color: dataSourceInfo.color,
          }}>
            {dataSourceInfo.icon} {dataSourceInfo.label}
          </span>
        )}
      </div>

      {/* Company cards - 2 column grid on mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        padding: '0 16px',
      }}>
        <AnimatePresence>
          {dayEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <CompanyCard
                symbol={event.symbol}
                companyName={event.companyName}
                reportTime={event.reportTime || 'AMC'}
                beatOdds={event.yesOdds}
                hasLiveOdds={event.hasPolymarketOdds === true || event.hasCalculatedOdds === true}
                isPicked={isPicked(event.id)}
                onAdd={() => onOpenArchitect(event)}
                onView={() => onOpenArchitect(event)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div style={fixedBottomContainer}>
        <motion.button
          onClick={onViewPortfolio}
          whileTap={cardTap}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: designColors.bgCard,
            border: `1px solid ${designColors.cyan}`,
            borderRadius: '10px',
            color: designColors.cyan,
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          📋 VIEW PORTFOLIO ({predictions.length})
        </motion.button>
      </div>
    </motion.div>
  );
}
