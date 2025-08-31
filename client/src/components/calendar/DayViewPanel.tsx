import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarEvent } from '../../services/api/calendar';
import { useLanguage } from '../../contexts/language/language-provider';
import { Calendar, Clock, User, Building2, Briefcase } from 'lucide-react';
import './DayViewPanel.css';

interface DayViewPanelProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  onEventSelect?: (event: CalendarEvent) => void;
  loading?: boolean;
}

export function DayViewPanel({ selectedDate, events, onEventSelect, loading = false }: DayViewPanelProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);

  // Filter events for the selected date
  useEffect(() => {
    if (!selectedDate) {
      setDayEvents([]);
      return;
    }

    // Fix timezone issue - use local date instead of UTC
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const filtered = events.filter(event => {
      // Use simple string comparison for date-only events
      // This avoids timezone conversion issues
      const eventStart = event.start.includes('T') ? 
        event.start.split('T')[0] : 
        event.start;
      const eventEnd = event.end.includes('T') ? 
        event.end.split('T')[0] : 
        event.end;
      
      // Simple string comparison for YYYY-MM-DD format
      const isInRange = dateString >= eventStart && dateString <= eventEnd;
      
      // Check if the selected date falls within the event's date range
      return isInRange;
    });
    setDayEvents(filtered);
  }, [selectedDate, events]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatEventDuration = (event: CalendarEvent) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    if (event.allDay) {
      return t('calendar.allDay');
    }

    const startTime = start.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    const endTime = end.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${startTime} - ${endTime}`;
  };

  const getEventTypeIcon = (event: CalendarEvent) => {
    if (event.jobseekerId) {
      return <User size={16} className="event-type-icon assigned" />;
    }
    return <Briefcase size={16} className="event-type-icon open" />;
  };

  const getEventTypeLabel = (event: CalendarEvent) => {
    if (event.jobseekerId) {
      return t('calendar.assignedPosition');
    }
    return t('calendar.openPosition');
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="day-view-panel day-view-skeleton-loading">
        <div className="day-view-header">
          <div className="skeleton-icon"></div>
          <div className="skeleton-title"></div>
        </div>

        <div className="skeleton-selected-date">
          <div className="skeleton-date-title"></div>
          <div className="skeleton-event-count"></div>
        </div>

        <div className="skeleton-events">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-event-item">
              <div className="skeleton-event-header">
                <div className="skeleton-event-type">
                  <div className="skeleton-event-icon"></div>
                  <div className="skeleton-event-label"></div>
                </div>
                <div className="skeleton-event-duration">
                  <div className="skeleton-duration-icon"></div>
                  <div className="skeleton-duration-text"></div>
                </div>
              </div>
              <div className="skeleton-event-content">
                <div className="skeleton-event-title"></div>
                <div className="skeleton-event-detail">
                  <div className="skeleton-detail-icon"></div>
                  <div className="skeleton-detail-text"></div>
                </div>
                <div className="skeleton-event-detail">
                  <div className="skeleton-detail-icon"></div>
                  <div className="skeleton-detail-text"></div>
                </div>
              </div>
              <div className="skeleton-event-actions">
                <div className="skeleton-action-button"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="skeleton-summary">
          <div className="skeleton-summary-title"></div>
          <div className="skeleton-summary-stats">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-stat-item">
                <div className="skeleton-stat-label"></div>
                <div className="skeleton-stat-value"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedDate) {
    return (
      <div className="day-view-panel">
        <div className="day-view-header">
          <Calendar size={20} />
          <h3>{t('calendar.dayView')}</h3>
        </div>
        <div className="day-view-empty">
          <Calendar size={48} className="empty-icon" />
          <p>{t('calendar.selectDateToView')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="day-view-panel">
      <div className="day-view-header">
        <Calendar size={20} />
        <h3>{t('calendar.dayView')}</h3>
      </div>

      <div className="selected-date">
        <h4>{formatDate(selectedDate)}</h4>
        <p className="event-count">
          {dayEvents.length === 0 
            ? t('calendar.noEvents')
            : t('calendar.eventCount', { count: dayEvents.length })
          }
        </p>
      </div>

      <div className="day-events">
        {dayEvents.length === 0 ? (
          <div className="no-events">
            <Briefcase size={32} className="no-events-icon" />
            <p>{t('calendar.noEventsToday')}</p>
          </div>
        ) : (
          <div className="events-list">
            {dayEvents.map((event) => (
              <div 
                key={event.id} 
                className={`event-item ${event.jobseekerId ? 'assigned' : 'open'}`}
                onClick={() => onEventSelect?.(event)}
              >
                <div className="event-header">
                  <div className="event-type">
                    {getEventTypeIcon(event)}
                    <span className="event-type-label">
                      {getEventTypeLabel(event)}
                    </span>
                  </div>
                  <div className="event-duration">
                    <Clock size={14} />
                    <span>{formatEventDuration(event)}</span>
                  </div>
                </div>

                <div className="event-content">
                  <h5 className="event-title">{event.positionTitle}</h5>
                  
                  {event.jobseekerName && (
                    <div className="event-detail">
                      <User size={14} />
                      <span>{event.jobseekerName}</span>
                    </div>
                  )}

                  <div className="event-detail">
                    <Building2 size={14} />
                    <span>{event.clientName}</span>
                  </div>
                </div>

                <div className="event-actions">
                  <button 
                    className="view-details-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Navigate to the position details page
                      navigate(`/position-management/view/${event.positionId}`);
                    }}
                  >
                    {t('calendar.viewDetails')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dayEvents.length > 0 && (
        <div className="day-summary">
          <h5>{t('calendar.daySummary')}</h5>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">{t('calendar.totalEvents')}:</span>
              <span className="stat-value">{dayEvents.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('calendar.uniquePositions')}:</span>
              <span className="stat-value">
                {new Set(dayEvents.map(event => event.positionId)).size}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('calendar.totalPositionCapacity')}:</span>
              <span className="stat-value">
                {(() => {
                  // Group by positionId and sum unique position capacities
                  const uniquePositions = new Map();
                  dayEvents.forEach(event => {
                    if (!uniquePositions.has(event.positionId)) {
                      uniquePositions.set(event.positionId, event.totalPositions);
                    }
                  });
                  return Array.from(uniquePositions.values()).reduce((total, capacity) => total + capacity, 0);
                })()}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('calendar.assignedJobseekers')}:</span>
              <span className="stat-value">
                {(() => {
                  // Group by positionId and sum unique position assigned counts
                  const uniquePositions = new Map();
                  dayEvents.forEach(event => {
                    if (!uniquePositions.has(event.positionId)) {
                      uniquePositions.set(event.positionId, event.assignedCount);
                    }
                  });
                  return Array.from(uniquePositions.values()).reduce((total, assigned) => total + assigned, 0);
                })()}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('calendar.availablePositions')}:</span>
              <span className="stat-value available-highlight">
                {(() => {
                  // Group by positionId and sum unique position available counts
                  const uniquePositions = new Map();
                  dayEvents.forEach(event => {
                    if (!uniquePositions.has(event.positionId)) {
                      uniquePositions.set(event.positionId, event.availablePositions);
                    }
                  });
                  return Array.from(uniquePositions.values()).reduce((total, available) => total + available, 0);
                })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
