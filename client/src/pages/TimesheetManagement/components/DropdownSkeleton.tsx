/** Shared dropdown loading skeleton for Timesheet flows. */
export function DropdownSkeleton() {
  return (
    <div className="invoice-dropdown-skeleton">
      <div className="skeleton-dropdown-trigger">
        <div className="skeleton-icon"></div>
        <div className="skeleton-text skeleton-dropdown-text"></div>
        <div className="skeleton-icon skeleton-chevron"></div>
      </div>
    </div>
  );
}
