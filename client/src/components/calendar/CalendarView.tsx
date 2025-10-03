import { useState, useCallback, useEffect } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import moment from 'moment';
import { CalendarEvent } from '../../services/api/calendar';
import { useLanguage } from '../../contexts/language/language-provider';
import './CalendarView.css';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

// Extended event type for react-big-calendar
interface CalendarEventWithDates extends Omit<CalendarEvent, 'start' | 'end'> {
  start: Date;
  end: Date;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot: (slotInfo: { start: Date; end: Date; slots: Date[] }) => void;
  onNavigate?: (date: Date) => void;
  loading: boolean;
  selectedDate?: Date | null;
}

export function CalendarView({ 
  events, 
  onSelectEvent, 
  onSelectSlot, 
  onNavigate,
  loading,
  selectedDate 
}: CalendarViewProps) {
  const { t } = useLanguage();
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  // Transform events for react-big-calendar (convert string dates to Date objects)
  const calendarEvents: CalendarEventWithDates[] = events.map(event => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
  }));

  // Handle view changes
  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
  }, []);

  // Handle date navigation
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
    onNavigate?.(newDate);
  }, [onNavigate]);

  // Handle event selection and convert back to CalendarEvent format
  const handleEventSelect = useCallback((calendarEvent: CalendarEventWithDates) => {
    // Convert back to original CalendarEvent format
    const originalEvent: CalendarEvent = {
      ...calendarEvent,
      start: calendarEvent.start.toISOString().split('T')[0], // Convert Date back to string
      end: calendarEvent.end.toISOString().split('T')[0],
    };
    onSelectEvent(originalEvent);
  }, [onSelectEvent]);

  // Custom event style function
  const eventStyleGetter = useCallback((event: CalendarEventWithDates) => {
    let backgroundColor = 'linear-gradient(135deg, #2563eb, #3b82f6)'; // Default blue gradient
    let borderLeftColor = 'rgba(255, 255, 255, 0.3)';
    let boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';

    // Color code based on event type
    if (event.jobseekerId) {
      // Assigned position - blue gradient
      backgroundColor = 'linear-gradient(135deg, #2563eb, #3b82f6)';
      borderLeftColor = 'rgba(255, 255, 255, 0.3)';
      boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';
    } else {
      // Open position - orange gradient
      backgroundColor = 'linear-gradient(135deg, #ea580c, #f97316)';
      borderLeftColor = 'rgba(255, 255, 255, 0.3)';
      boxShadow = '0 1px 3px rgba(234, 88, 12, 0.2)';
    }

    return {
      style: {
        background: backgroundColor,
        borderLeft: `3px solid ${borderLeftColor}`,
        borderRadius: '6px',
        color: 'white',
        fontSize: '12px',
        fontWeight: '500',
        padding: '4px 8px',
        margin: '2px 0',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        boxShadow,
        transition: 'all 0.2s ease',
      }
    };
  }, []);

  // Custom day prop getter for selected date styling
  const dayPropGetter = useCallback((date: Date) => {
    if (!selectedDate) return {};
    
    // Check if this date matches the selected date
    const isSelected = selectedDate.toDateString() === date.toDateString();
    
    if (isSelected) {
      return {
        className: 'selected-date'
      };
    }
    
    return {};
  }, [selectedDate]);

  // Use useEffect to add selected-date class to date cells after render
  useEffect(() => {
    if (!selectedDate) return;
    
    // Remove previous selected-date classes
    const prevSelected = document.querySelectorAll('.rbc-date-cell.selected-date');
    prevSelected.forEach(el => el.classList.remove('selected-date'));
    
    // Find and add selected-date class to the matching date cell
    const allDateCells = document.querySelectorAll('.rbc-date-cell .rbc-button-link');
    
    allDateCells.forEach(cell => {
      const dateText = cell.textContent?.trim();
      if (dateText && selectedDate) {
        const cellDate = new Date(selectedDate);
        cellDate.setDate(parseInt(dateText));
        
        // Check if this cell represents the selected date
        if (cellDate.getDate() === selectedDate.getDate() && 
            cellDate.getMonth() === selectedDate.getMonth() && 
            cellDate.getFullYear() === selectedDate.getFullYear()) {
          const dateCell = cell.closest('.rbc-date-cell');
          if (dateCell) {
            dateCell.classList.add('selected-date');
          }
        }
      }
    });
  }, [selectedDate, view, date]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="calendar-view calendar-skeleton-loading">
        <div className="calendar-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-toolbar">
            <div className="skeleton-btn-group skeleton-nav-buttons"></div>
            <div className="skeleton-toolbar-label"></div>
            <div className="skeleton-btn-group skeleton-view-buttons"></div>
          </div>
          <div className="skeleton-calendar-container">
            <div className="skeleton-month-header">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <div key={i} className="skeleton-header-cell">{day}</div>
              ))}
            </div>
            <div className="skeleton-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="skeleton-cell"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <h2 className="calendar-title">{t('calendar.title')}</h2>
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color assigned"></div>
            <span>{t('calendar.assignedPositions')}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color open"></div>
            <span>{t('calendar.openPositions')}</span>
          </div>
        </div>
      </div>

      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%', minHeight: 600 }}
          view={view}
          date={date}
          onView={handleViewChange}
          onNavigate={handleNavigate}
          onSelectEvent={handleEventSelect}
          onSelectSlot={onSelectSlot}
          selectable
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayPropGetter}
          popup={false}
          showMultiDayTimes={true}
          step={60}
          views={['month', 'week', 'day', 'agenda']}
          components={{
            month: {
              event: ({ event }: { event: CalendarEventWithDates }) => (
                <div className="custom-month-event">
                  <span>{event.title}</span>
                </div>
              )
            }
          }}
          messages={{
            next: t('calendar.next'),
            previous: t('calendar.previous'),
            today: t('calendar.today'),
            month: t('calendar.month'),
            week: t('calendar.week'),
            day: t('calendar.day'),
            agenda: t('calendar.agenda'),
            date: t('calendar.date'),
            time: t('calendar.time'),
            event: t('calendar.event'),
            allDay: t('calendar.allDay'),
            noEventsInRange: t('calendar.noEventsInRange'),
            showMore: (total: number) => t('calendar.showMore', { count: total }),
          }}
        />
      </div>
    </div>
  );
}
