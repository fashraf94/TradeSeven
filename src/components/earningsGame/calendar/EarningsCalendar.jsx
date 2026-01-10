import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { designColors } from '../designConstants';
import { EarningsHeader } from '../shared';
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
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: designColors.textSecondary }}>Loading earnings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
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

  // Desktop layout
  if (isDesktop) {
    return (
      <div style={{
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
      }}>
        <EarningsHeader
          title="EARNINGSGAME"
          onBack={onBack}
        />

        <TournamentBanner
          week={tournament.week}
          lockDeadline={tournament.lockDeadline}
          picksCount={predictions.length}
          totalSpent={predictions.reduce((sum, p) => sum + p.price, 0)}
          onViewPortfolio={onViewPortfolio}
        />

        <div style={{ display: 'flex' }}>
          {/* Left: Day selector (vertical) */}
          <DaySelector
            days={dayGroups.map(d => ({
              dayName: d.dayName,
              date: d.date,
              count: d.events.length
            }))}
            selectedIndex={selectedDayIndex}
            onSelect={setSelectedDayIndex}
            isDesktop={true}
          />

          {/* Right: Company cards grid */}
          <div style={{ flex: 1, padding: '20px' }}>
            <h2 style={{
              fontSize: '14px',
              color: designColors.textSecondary,
              marginBottom: '16px',
            }}>
              {formatDayHeader()} · {dayEvents.length} companies
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '12px',
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
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
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
      <div style={{ padding: '16px 16px 8px' }}>
        <span style={{
          fontSize: '13px',
          color: designColors.textSecondary,
        }}>
          {formatDayHeader()} · {dayEvents.length} companies
        </span>
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
                isPicked={isPicked(event.id)}
                onAdd={() => onOpenArchitect(event)}
                onView={() => onOpenArchitect(event)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px',
        backgroundColor: designColors.bgPrimary,
        borderTop: `1px solid ${designColors.borderDefault}`,
      }}>
        <motion.button
          onClick={onViewPortfolio}
          whileTap={{ scale: 0.98 }}
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
