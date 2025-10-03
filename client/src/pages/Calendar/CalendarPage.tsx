import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import { CalendarView } from "../../components/calendar/CalendarView";
import { DayViewPanel } from "../../components/calendar/DayViewPanel";
// import { CalendarFilters } from "../../components/calendar/CalendarFilters";
import { SummaryWidgets } from "../../components/calendar/SummaryWidgets";
import { 
  getCalendarEvents, 
  CalendarEvent,
  // getUniqueClientsFromEvents,
  // getUniqueJobseekersFromEvents
} from "../../services/api/calendar";
import "./CalendarPage.css";

export function CalendarPage() {
  const { t } = useLanguage();
  
  // State management
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewedDate, setViewedDate] = useState<Date>(new Date()); // Track currently viewed month
  
  // Filter state - COMMENTED OUT
  // const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  // const [selectedJobseekerId, setSelectedJobseekerId] = useState<string | null>(null);
  // const [dateRange, setDateRange] = useState(() => {
  //   // Default to current month
  //   const now = new Date();
  //   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  //   const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  //   
  //   return {
  //     startDate: startOfMonth.toISOString().split('T')[0],
  //     endDate: endOfMonth.toISOString().split('T')[0]
  //   };
  // });

  // Derived data for filters - COMMENTED OUT
  // const clientOptions = getUniqueClientsFromEvents(events);
  // const jobseekerOptions = getUniqueJobseekersFromEvents(events);

  // Fetch calendar data for the viewed month
  const fetchCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the month range for the currently viewed date
      const startOfMonth = new Date(viewedDate.getFullYear(), viewedDate.getMonth(), 1);
      const endOfMonth = new Date(viewedDate.getFullYear(), viewedDate.getMonth() + 1, 0);
      
      const response = await getCalendarEvents({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0]
      });
      
      setEvents(response.events);
    } catch (err) {
      console.error('Failed to fetch calendar data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [viewedDate]); // Refetch when viewed date changes

  // Load data on mount and when filters change
  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Event handlers
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    console.log('Selected event:', event);
    // Could open a modal or navigate to event details
  }, []);

  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; slots: Date[] }) => {
    setSelectedDate(slotInfo.start);
  }, []);

  const handleNavigate = useCallback((newDate: Date) => {
    setViewedDate(newDate);
  }, []);

  // Filter handlers - COMMENTED OUT
  // const handleClearFilters = useCallback(() => {
  //   setSelectedClientId(null);
  //   setSelectedJobseekerId(null);
  // }, []);

  const handleRefresh = useCallback(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  if (error) {
    return (
      <div className="calendar-page">
        <AppHeader title={t("navigation.calendar")} />
        <div className="calendar-content">
          <div className="calendar-error">
            <h3>{t('calendar.errorTitle')}</h3>
            <p>{error}</p>
            <button onClick={handleRefresh} className="retry-button">
              {t('calendar.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <AppHeader title={t("navigation.calendar")} />
      <div className="calendar-content">
        <div className="calendar-layout">
          {/* Calendar Filters - COMMENTED OUT */}
          {/* <div className="calendar-filters-section">
            <CalendarFilters
              clientOptions={clientOptions}
              jobseekerOptions={jobseekerOptions}
              selectedClientId={selectedClientId}
              selectedJobseekerId={selectedJobseekerId}
              dateRange={dateRange}
              onClientChange={setSelectedClientId}
              onJobseekerChange={setSelectedJobseekerId}
              onDateRangeChange={setDateRange}
              onClearFilters={handleClearFilters}
            />
          </div> */}
          <div className="calendar-summary-section">
            <SummaryWidgets />
          </div>
          <div className="calendar-main-content">
            <CalendarView
              events={events}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              onNavigate={handleNavigate}
              loading={loading}
              selectedDate={selectedDate}
            />
            
            <DayViewPanel
              selectedDate={selectedDate}
              events={events}
              onEventSelect={handleSelectEvent}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}