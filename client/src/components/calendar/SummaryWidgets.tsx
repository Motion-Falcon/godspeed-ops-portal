import { useState, useEffect } from 'react';
import { 
  EnhancedCalendarSummary, 
  getCalendarSummary, 
  getCalendarSummaryForToday,
  getCalendarSummaryForWeek,
  getCalendarSummaryForMonth 
} from '../../services/api/calendar';
import { useLanguage } from '../../contexts/language/language-provider';
import { Users, Briefcase, CheckCircle, Clock, Calendar } from 'lucide-react';
import './SummaryWidgets.css';

type QuickFilterType = 'today' | 'week' | 'month' | 'custom';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface SummaryWidgetsProps {
  clientId?: string;
  jobseekerId?: string;
  initialDateRange?: DateRange;
}

export function SummaryWidgets({ clientId, jobseekerId, initialDateRange }: SummaryWidgetsProps) {
  const { t } = useLanguage();
  
  // State management
  const [summary, setSummary] = useState<EnhancedCalendarSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<QuickFilterType>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange>(
    initialDateRange || {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  );


  // Helper functions
  const formatDateRange = () => {
    if (!summary?.dateRange) return t('calendar.loading');
    
    const start = new Date(summary.dateRange.startDate);
    const end = new Date(summary.dateRange.endDate);
    
    // If same date, show only one date
    if (summary.dateRange.startDate === summary.dateRange.endDate) {
      return start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    
    const startStr = start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
    
    const endStr = end.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${startStr} - ${endStr}`;
  };

  const calculateCompletionRate = () => {
    if (!summary || summary.totalPositions === 0) return 0;
    return summary.fillRate;
  };

  // Data fetching function
  const fetchSummary = async (filterType: QuickFilterType, dateRange?: DateRange) => {
    try {
      setLoading(true);
      setError(null);
      
      let summaryData: EnhancedCalendarSummary;
      
      switch (filterType) {
        case 'today':
          summaryData = await getCalendarSummaryForToday(clientId, jobseekerId);
          break;
        case 'week':
          summaryData = await getCalendarSummaryForWeek(new Date(), clientId, jobseekerId);
          break;
        case 'month':
          summaryData = await getCalendarSummaryForMonth(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            clientId,
            jobseekerId
          );
          break;
        case 'custom':
          if (!dateRange) throw new Error('Date range required for custom filter');
          summaryData = await getCalendarSummary({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            clientId,
            jobseekerId
          });
          break;
        default:
          throw new Error('Invalid filter type');
      }
      
      setSummary(summaryData);
    } catch (err) {
      console.error('Error fetching calendar summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch summary');
    } finally {
      setLoading(false);
    }
  };

  // Handle quick filter changes
  const handleQuickFilter = (filterType: QuickFilterType) => {
    setActiveFilter(filterType);
    fetchSummary(filterType);
  };

  // Handle custom date range application
  const handleApplyDateRange = () => {
    setActiveFilter('custom');
    fetchSummary('custom', customDateRange);
  };

  // Effect to load initial data
  useEffect(() => {
    if (initialDateRange) {
      setActiveFilter('custom');
      fetchSummary('custom', initialDateRange);
    } else {
      fetchSummary('month');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, jobseekerId]);

  // Update custom date range when initialDateRange changes
  useEffect(() => {
    if (initialDateRange) {
      setCustomDateRange(initialDateRange);
    }
  }, [initialDateRange]);

  // Error state
  if (error) {
    return (
      <div className="summary-widgets">
        <div className="summary-header">
          <h3 className="summary-title">{t('calendar.summaryOverview')}</h3>
          <div className="summary-error">
            <span>{error}</span>
            <button 
              className="retry-button"
              onClick={() => fetchSummary(activeFilter, activeFilter === 'custom' ? customDateRange : undefined)}
            >
              {t('calendar.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="summary-widgets">
        <div className="summary-header">
          <div className="header-left">
            <div className="summary-title-skeleton"></div>
            <div className="summary-date-skeleton"></div>
          </div>
          <div className="header-right">
            <div className="filter-skeleton"></div>
          </div>
        </div>
        <div className="widgets-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="widget-skeleton">
              <div className="widget-icon-skeleton"></div>
              <div className="widget-content-skeleton">
                <div className="widget-label-skeleton"></div>
                <div className="widget-value-skeleton"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="summary-widgets">
      <div className="summary-header">
        <div className="header-left">
          <h3 className="summary-title">{t('calendar.summaryOverview')}</h3>
        </div>
        
        <div className="header-right">
          <div className="filter-controls">
            {/* Quick Filter Buttons */}
            <div className="filter-buttons">
              <button
                className={`filter-button ${activeFilter === 'today' ? 'active' : ''}`}
                onClick={() => handleQuickFilter('today')}
              >
                {t('calendar.today')}
              </button>
              <button
                className={`filter-button ${activeFilter === 'week' ? 'active' : ''}`}
                onClick={() => handleQuickFilter('week')}
              >
                {t('calendar.thisWeekLabel')}
              </button>
              <button
                className={`filter-button ${activeFilter === 'month' ? 'active' : ''}`}
                onClick={() => handleQuickFilter('month')}
              >
                {t('calendar.thisMonthLabel')}
              </button>
            </div>
            
            {/* Inline Date Range Inputs */}
            <div className="date-range-inputs">
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="date-input"
                title={t('calendar.from')}
              />
              <span className="date-separator">-</span>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="date-input"
                title={t('calendar.to')}
              />
              <button
                className="apply-date-button"
                onClick={handleApplyDateRange}
              >
                <Calendar size={14} />
                {t('calendar.apply')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="widgets-grid">
        {/* Total Positions Widget */}
        <div className="summary-widget">
          <div className="widget-icon positions">
            <Briefcase size={20} />
          </div>
          <div className="widget-content">
            <span className="widget-label">{t('calendar.totalPositions')}</span>
            <span className="widget-value">{summary.totalPositions}</span>
          </div>
        </div>

        {/* Total Filled Positions Widget */}
        <div className="summary-widget">
          <div className="widget-icon assignments">
            <CheckCircle size={20} />
          </div>
          <div className="widget-content">
            <span className="widget-label">{t('calendar.totalFilledPositions')}</span>
            <span className="widget-value">{summary.activeAssignments}</span>
          </div>
        </div>

        {/* Total Available Positions Widget */}
        <div className="summary-widget">
          <div className="widget-icon jobseekers">
            <Users size={20} />
          </div>
          <div className="widget-content">
            <span className="widget-label">{t('calendar.totalAvailablePositions')}</span>
            <span className="widget-value">{summary.availablePositions}</span>
          </div>
        </div>

        {/* Completion Rate Widget */}
        <div className="summary-widget">
          <div className="widget-icon completion">
            <Clock size={20} />
          </div>
          <div className="widget-content completion-widget">
            <div className="widget-content-row">
              <span className="widget-label">{t('calendar.completionRate')}</span>
              <span className="widget-value">{calculateCompletionRate()}%</span>
            </div>
            <div className="progress-bar summary-progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${calculateCompletionRate()}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="summary-insights">
        <div className="insight-item">
          <span className="insight-label">{t('calendar.openPositions')}:</span>
          <span className="insight-value">{summary.availablePositions}</span>
        </div>
        
        <div className="insight-item">
          <span className="insight-label">{t('calendar.fillRate')}:</span>
          <span className="insight-value">{summary.fillRate}%</span>
        </div>
        
        <div className="insight-item">
          <span className="insight-label">{t('calendar.summaryPeriod')}:</span>
          <span className="insight-value">{formatDateRange()}</span>
        </div>
      </div>

      {/* Status Breakdown */}
      {/* {summary.statusBreakdown && (
        <div className="status-breakdown">
          <h4 className="breakdown-title">{t('calendar.statusBreakdown')}</h4>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">{t('calendar.active')}:</span>
              <span className="status-value">{summary.statusBreakdown.active}</span>
            </div>
            <div className="status-item">
              <span className="status-label">{t('calendar.upcoming')}:</span>
              <span className="status-value">{summary.statusBreakdown.upcoming}</span>
            </div>
            <div className="status-item">
              <span className="status-label">{t('calendar.completed')}:</span>
              <span className="status-value">{summary.statusBreakdown.completed}</span>
            </div>
            <div className="status-item">
              <span className="status-label">{t('calendar.cancelled')}:</span>
              <span className="status-value">{summary.statusBreakdown.cancelled}</span>
            </div>
          </div>
        </div>
      )} */}

      {/* Status Indicators */}
      {/* <div className="status-indicators">
        <div className={`status-indicator ${summary.totalPositions > 0 ? 'active' : 'inactive'}`}>
          <div className="status-dot"></div>
          <span>{t('calendar.positionsAvailable')}</span>
        </div>
        
        <div className={`status-indicator ${summary.activeAssignments > 0 ? 'active' : 'inactive'}`}>
          <div className="status-dot"></div>
          <span>{t('calendar.assignmentsActive')}</span>
        </div>
        
        <div className={`status-indicator ${summary.totalJobseekers > 0 ? 'active' : 'inactive'}`}>
          <div className="status-dot"></div>
          <span>{t('calendar.jobseekersEngaged')}</span>
        </div>
      </div> */}
    </div>
  );
}
