import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { useLanguage } from "../contexts/language/language-provider";
import "../styles/components/DateRangePicker.css";

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Helper to format date object to YYYY-MM-DD
function formatYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to parse YYYY-MM-DD to Date object in local time
function parseYYYYMMDD(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

// Helper to format display label (e.g. "Jul 01 - Jul 25, 2026")
function formatDisplayRange(startStr: string, endStr: string): string {
  const start = parseYYYYMMDD(startStr);
  const end = parseYYYYMMDD(endStr);

  if (start && end) {
    const startMonth = SHORT_MONTH_NAMES[start.getMonth()];
    const startDay = String(start.getDate()).padStart(2, "0");
    const endMonth = SHORT_MONTH_NAMES[end.getMonth()];
    const endDay = String(end.getDate()).padStart(2, "0");

    if (start.getFullYear() === end.getFullYear()) {
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${start.getFullYear()}`;
    }
    return `${startMonth} ${startDay}, ${start.getFullYear()} – ${endMonth} ${endDay}, ${end.getFullYear()}`;
  }

  if (start) {
    const startMonth = SHORT_MONTH_NAMES[start.getMonth()];
    const startDay = String(start.getDate()).padStart(2, "0");
    return `${startMonth} ${startDay}, ${start.getFullYear()} – Select end date...`;
  }

  if (end) {
    const endMonth = SHORT_MONTH_NAMES[end.getMonth()];
    const endDay = String(end.getDate()).padStart(2, "0");
    return `Select start date... – ${endMonth} ${endDay}, ${end.getFullYear()}`;
  }

  return "";
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  placeholder,
  className = "",
}) => {
  const { t } = useLanguage();
  const defaultPlaceholder = t("invoiceManagement.dateRangePicker.placeholder") || "Select Date Range";
  const activePlaceholder = placeholder || defaultPlaceholder;
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position state for portal dropdown
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  // Draft selection state inside calendar
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isPickingEnd, setIsPickingEnd] = useState<boolean>(false);

  // Month navigation state
  const initialDate =
    parseYYYYMMDD(startDate) || parseYYYYMMDD(endDate) || new Date();
  const [viewDate, setViewDate] = useState<Date>(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );

  // Calculate viewport position for portal popover
  const updatePopoverPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      const popoverHeight = 310;

      let top = rect.bottom + 4;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;

      // Keep popover within horizontal screen boundaries
      if (left < 10) left = 10;
      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }

      // If popover overflows bottom of viewport, flip to render above trigger
      if (top + popoverHeight > window.innerHeight - 10) {
        top = Math.max(10, rect.top - popoverHeight - 4);
      }

      setPopoverPos({ top, left });
    }
  }, []);

  // Update position on scroll, resize, or open
  useEffect(() => {
    if (isOpen) {
      updatePopoverPosition();
      const handleScrollOrResize = () => updatePopoverPosition();
      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("scroll", handleScrollOrResize, true);
      return () => {
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("scroll", handleScrollOrResize, true);
      };
    }
  }, [isOpen, updatePopoverPosition]);

  // Sync props to internal state when opened or props change
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  // Handle click outside to close dropdown (handles portal element)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
        setIsPickingEnd(false);
        setHoverDate(null);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      setTempStart(startDate);
      setTempEnd(endDate);
      setIsPickingEnd(false);
      setHoverDate(null);
      const base =
        parseYYYYMMDD(startDate) || parseYYYYMMDD(endDate) || new Date();
      setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setIsOpen(!isOpen);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartChange("");
    onEndChange("");
    setTempStart("");
    setTempEnd("");
    setHoverDate(null);
    setIsPickingEnd(false);
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDayClick = (dateStr: string) => {
    if (!isPickingEnd || !tempStart) {
      // First click: set start date, wait for end date
      setTempStart(dateStr);
      setTempEnd("");
      setIsPickingEnd(true);
    } else {
      // Second click: set end date
      let finalStart = tempStart;
      let finalEnd = dateStr;

      if (finalStart > finalEnd) {
        // Swap if clicked date is before start date
        const temp = finalStart;
        finalStart = finalEnd;
        finalEnd = temp;
      }

      setTempStart(finalStart);
      setTempEnd(finalEnd);
      onStartChange(finalStart);
      onEndChange(finalEnd);
      setIsPickingEnd(false);
      setIsOpen(false);
    }
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const s = formatYYYYMMDD(firstDay);
    const e = formatYYYYMMDD(lastDay);
    onStartChange(s);
    onEndChange(e);
    setTempStart(s);
    setTempEnd(e);
    setIsOpen(false);
  };

  const handlePresetLastMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    const s = formatYYYYMMDD(firstDay);
    const e = formatYYYYMMDD(lastDay);
    onStartChange(s);
    onEndChange(e);
    setTempStart(s);
    setTempEnd(e);
    setIsOpen(false);
  };

  // Build calendar days matrix for viewDate month
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays: Array<{
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
  }> = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
    calendarDays.push({
      dateStr: formatYYYYMMDD(prevDate),
      dayNum: daysInPrevMonth - i,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const currDate = new Date(viewYear, viewMonth, day);
    calendarDays.push({
      dateStr: formatYYYYMMDD(currDate),
      dayNum: day,
      isCurrentMonth: true,
    });
  }

  // Next month leading days to complete 6 rows (42 cells total)
  const remainingCells = 42 - calendarDays.length;
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(viewYear, viewMonth + 1, day);
    calendarDays.push({
      dateStr: formatYYYYMMDD(nextDate),
      dayNum: day,
      isCurrentMonth: false,
    });
  }

  // Determine date ranges for visual styling
  const activeStart = tempStart || startDate;
  const activeEnd = tempEnd || endDate;
  const hasSelectedRange = Boolean(startDate || endDate);
  const displayLabel = formatDisplayRange(startDate, endDate);

  // Range helper for hover effect during selection
  const effectiveEnd = isPickingEnd ? hoverDate : activeEnd;
  let rangeStart = activeStart;
  let rangeEnd = effectiveEnd;
  if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
    const temp = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = temp;
  }

  return (
    <div className={`date-range-picker-container ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`date-range-picker-trigger ${
          hasSelectedRange ? "has-value" : ""
        } ${isOpen ? "active" : ""}`}
        onClick={handleToggle}
        title={displayLabel || activePlaceholder}
      >
        <CalendarIcon size={14} className="picker-icon" />
        <span className="picker-text">{displayLabel || activePlaceholder}</span>
        {hasSelectedRange ? (
          <span
            className="picker-clear-btn"
            onClick={handleClear}
            title="Clear date filter"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown size={12} className="picker-chevron" />
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="date-range-picker-popover"
            style={{
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
            }}
          >
            {/* Header Controls */}
            <div className="picker-header">
              <button
                type="button"
                className="picker-nav-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="picker-month-title">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                className="picker-nav-btn"
                onClick={handleNextMonth}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday Names Header */}
            <div className="picker-weekdays">
              {WEEKDAYS.map((day) => (
                <div key={day} className="picker-weekday">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="picker-days-grid">
              {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
                const isStart = dateStr === activeStart;
                const isEnd = dateStr === activeEnd;
                const isInRange =
                  rangeStart &&
                  rangeEnd &&
                  dateStr >= rangeStart &&
                  dateStr <= rangeEnd;
                const isHovered = isPickingEnd && dateStr === hoverDate;

                let cellClass = "picker-day";
                if (!isCurrentMonth) cellClass += " outside-month";
                if (isStart) cellClass += " range-start";
                if (isEnd) cellClass += " range-end";
                if (isInRange && !isStart && !isEnd) cellClass += " in-range";
                if (isHovered && !isStart) cellClass += " hovered";

                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={cellClass}
                    onClick={() => handleDayClick(dateStr)}
                    onMouseEnter={() => setHoverDate(dateStr)}
                    onMouseLeave={() => setHoverDate(null)}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Helper instructions & Presets Footer */}
            <div className="picker-footer">
              <div className="picker-hint">
                {!tempStart
                  ? t("invoiceManagement.dateRangePicker.hintClickStart") || "Click start date"
                  : isPickingEnd
                  ? t("invoiceManagement.dateRangePicker.hintClickEnd") || "Click end date"
                  : t("invoiceManagement.dateRangePicker.hintSelected") || "Range selected"}
              </div>
              <div className="picker-presets">
                <button
                  type="button"
                  className="picker-preset-btn"
                  onClick={handlePresetThisMonth}
                >
                  {t("invoiceManagement.dateRangePicker.thisMonth") || "This Month"}
                </button>
                <button
                  type="button"
                  className="picker-preset-btn"
                  onClick={handlePresetLastMonth}
                >
                  {t("invoiceManagement.dateRangePicker.lastMonth") || "Last Month"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DateRangePicker;
