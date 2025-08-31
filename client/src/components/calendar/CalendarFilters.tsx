import { useLanguage } from '../../contexts/language/language-provider';
import { CustomDropdown } from '../CustomDropdown';
import { Filter, X, Calendar as CalendarIcon } from 'lucide-react';
import './CalendarFilters.css';

interface FilterOption {
  id: string;
  name: string;
}

interface CalendarFiltersProps {
  clientOptions: FilterOption[];
  jobseekerOptions: FilterOption[];
  selectedClientId: string | null;
  selectedJobseekerId: string | null;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  onClientChange: (clientId: string | null) => void;
  onJobseekerChange: (jobseekerId: string | null) => void;
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
  onClearFilters: () => void;
}

export function CalendarFilters({
  clientOptions,
  jobseekerOptions,
  selectedClientId,
  selectedJobseekerId,
  dateRange,
  onClientChange,
  onJobseekerChange,
  onDateRangeChange,
  onClearFilters,
}: CalendarFiltersProps) {
  const { t } = useLanguage();

  const hasActiveFilters = selectedClientId || selectedJobseekerId;

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    onDateRangeChange({
      ...dateRange,
      [field]: value,
    });
  };

  const getSelectedClientName = () => {
    if (!selectedClientId) return null;
    return clientOptions.find(client => client.id === selectedClientId)?.name || null;
  };

  const getSelectedJobseekerName = () => {
    if (!selectedJobseekerId) return null;
    return jobseekerOptions.find(js => js.id === selectedJobseekerId)?.name || null;
  };

  const formatDateForInput = (dateString: string) => {
    // Convert YYYY-MM-DD to format expected by date input
    return dateString;
  };

  // const handleQuickDateRange = (range: 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth') => {
  //   const today = new Date();
  //   let startDate: Date;
  //   let endDate: Date;

  //   switch (range) {
  //     case 'thisWeek':
  //       startDate = new Date(today);
  //       startDate.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  //       endDate = new Date(startDate);
  //       endDate.setDate(startDate.getDate() + 6); // End of week (Saturday)
  //       break;
  //     case 'nextWeek':
  //       startDate = new Date(today);
  //       startDate.setDate(today.getDate() - today.getDay() + 7); // Start of next week
  //       endDate = new Date(startDate);
  //       endDate.setDate(startDate.getDate() + 6); // End of next week
  //       break;
  //     case 'thisMonth':
  //       startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  //       endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  //       break;
  //     case 'nextMonth':
  //       startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  //       endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  //       break;
  //     default:
  //       return;
  //   }

  //   onDateRangeChange({
  //     startDate: startDate.toISOString().split('T')[0],
  //     endDate: endDate.toISOString().split('T')[0],
  //   });
  // };

  return (
    <div className="calendar-filters">
      <div className="filters-header">
        <div className="filters-title">
          <Filter size={16} />
          <h3>{t('calendar.filters')}</h3>
        </div>
        
        <div className="filters-actions">
          {hasActiveFilters && (
            <button 
              className="clear-filters-btn"
              onClick={onClearFilters}
              title={t('calendar.clearFilters')}
            >
              <X size={14} />
              <span>{t('calendar.clearAll')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="filters-content expanded">
        <div className="filters-row">
          {/* Client Filter */}
          <div className="filter-group">
            <label className="filter-label">
              {t('calendar.filterByClient')}
            </label>
            <CustomDropdown
              options={[
                { id: 'all-clients', value: '', label: t('calendar.allClients') },
                ...clientOptions.map(client => ({ 
                  id: client.id,
                  value: client.id, 
                  label: client.name 
                }))
              ]}
              selectedOption={selectedClientId ? 
                clientOptions.find(c => c.id === selectedClientId) ? 
                  { id: selectedClientId, value: selectedClientId, label: clientOptions.find(c => c.id === selectedClientId)!.name } 
                  : null
                : { id: 'all-clients', value: '', label: t('calendar.allClients') }
              }
              onSelect={(option) => {
                const selectedOption = Array.isArray(option) ? option[0] : option;
                onClientChange(selectedOption.value as string || null);
              }}
              placeholder={t('calendar.selectClient')}
              className="filter-dropdown"
            />
            {selectedClientId && (
              <div className="active-filter">
                <span>{getSelectedClientName()}</span>
                <button 
                  onClick={() => onClientChange(null)}
                  className="remove-filter-btn"
                  title={t('calendar.removeFilter')}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Jobseeker Filter */}
          <div className="filter-group">
            <label className="filter-label">
              {t('calendar.filterByJobseeker')}
            </label>
            <CustomDropdown
              options={[
                { id: 'all-jobseekers', value: '', label: t('calendar.allJobseekers') },
                ...jobseekerOptions.map(jobseeker => ({ 
                  id: jobseeker.id,
                  value: jobseeker.id, 
                  label: jobseeker.name 
                }))
              ]}
              selectedOption={selectedJobseekerId ? 
                jobseekerOptions.find(js => js.id === selectedJobseekerId) ? 
                  { id: selectedJobseekerId, value: selectedJobseekerId, label: jobseekerOptions.find(js => js.id === selectedJobseekerId)!.name } 
                  : null
                : { id: 'all-jobseekers', value: '', label: t('calendar.allJobseekers') }
              }
              onSelect={(option) => {
                const selectedOption = Array.isArray(option) ? option[0] : option;
                onJobseekerChange(selectedOption.value as string || null);
              }}
              placeholder={t('calendar.selectJobseeker')}
              className="filter-dropdown"
            />
            {selectedJobseekerId && (
              <div className="active-filter">
                <span>{getSelectedJobseekerName()}</span>
                <button 
                  onClick={() => onJobseekerChange(null)}
                  className="remove-filter-btn"
                  title={t('calendar.removeFilter')}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Date Range Filters */}
          <div className="filter-group">
            <label className="filter-label">
              <CalendarIcon size={14} />
              {t('calendar.dateRange')}
            </label>
            
            <div className="date-range-inputs">
              <div className="date-input-group">
                <label htmlFor="start-date" className="sr-only">
                  {t('calendar.startDate')}
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={formatDateForInput(dateRange.startDate)}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="date-input"
                  placeholder={t('calendar.startDate')}
                />
              </div>
              
              <span className="date-separator">to</span>
              
              <div className="date-input-group">
                <label htmlFor="end-date" className="sr-only">
                  {t('calendar.endDate')}
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={formatDateForInput(dateRange.endDate)}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="date-input"
                  placeholder={t('calendar.endDate')}
                />
              </div>
            </div>

            {/* Quick Date Range Buttons */}
            {/* <div className="quick-date-buttons">
              <button 
                className="quick-date-btn"
                onClick={() => handleQuickDateRange('thisWeek')}
              >
                {t('calendar.thisWeek')}
              </button>
              <button 
                className="quick-date-btn"
                onClick={() => handleQuickDateRange('nextWeek')}
              >
                {t('calendar.nextWeek')}
              </button>
              <button 
                className="quick-date-btn"
                onClick={() => handleQuickDateRange('thisMonth')}
              >
                {t('calendar.thisMonth')}
              </button>
              <button 
                className="quick-date-btn"
                onClick={() => handleQuickDateRange('nextMonth')}
              >
                {t('calendar.nextMonth')}
              </button>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
