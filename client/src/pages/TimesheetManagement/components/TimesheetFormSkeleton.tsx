/** Loading placeholder mirrored from the loaded timesheet form layout. */
export function TimesheetFormSkeleton() {
  return (
    <div className="invoice-skeleton-container">
      <div className="timesheet-unified-header">
        <div className="timesheet-header-sections timesheet-header-sections--form">
          <div className="timesheet-section timesheet-employee-section">
            <section className="timesheet-jobseeker-info-section">
              <div className="skeleton-text timesheet-skeleton-section-title" />
              <div className="timesheet-jobseeker-info-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => (
                  <div key={index} className="timesheet-jobseeker-info-item">
                    <div className="skeleton-text timesheet-skeleton-info-label" />
                    <div className="skeleton-text timesheet-skeleton-info-value" />
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="timesheet-section timesheet-client-section">
            <div className="skeleton-text timesheet-skeleton-section-title" />
            <div className="timesheet-section-content">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="timesheet-detail-item">
                  <div className="skeleton-text timesheet-skeleton-detail-label" />
                  <div className="skeleton-text timesheet-skeleton-detail-value" />
                </div>
              ))}
            </div>
          </div>
          <div className="timesheet-section timesheet-invoice-section">
            <div className="skeleton-text timesheet-skeleton-section-title" />
            <div className="timesheet-section-content">
              {[1, 2].map((index) => (
                <div key={index} className="timesheet-detail-item">
                  <div className="skeleton-text timesheet-skeleton-detail-label" />
                  <div className="skeleton-text timesheet-skeleton-detail-value" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="timesheet-grid-container timesheet-hours-adjustments-container">
        <div className="timesheet-week-grid">
          <div className="timesheet-grid-header">
            <div
              className="skeleton-text"
              style={{ width: "100px", height: "16px" }}
            ></div>
          </div>
          <div className="timesheet-days-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => (
              <div key={index} className="timesheet-day-entry">
                <div className="timesheet-day-label">
                  <div
                    className="skeleton-text"
                    style={{
                      width: "80px",
                      height: "14px",
                      marginBottom: "4px",
                    }}
                  ></div>
                  <div
                    className="skeleton-text"
                    style={{ width: "50px", height: "12px" }}
                  ></div>
                </div>
                <div
                  className="skeleton-text"
                  style={{ width: "100%", height: "40px" }}
                ></div>
              </div>
            ))}
          </div>
        </div>

        <div className="timesheet-pay-info-section">
          <div className="timesheet-pay-info-grid">
            {[1, 2, 3].map((index) => (
              <div key={index} className="timesheet-pay-info-item">
                <div
                  className="skeleton-text"
                  style={{
                    width: "90px",
                    height: "14px",
                    marginBottom: "4px",
                  }}
                ></div>
                <div
                  className="skeleton-text"
                  style={{ width: "60px", height: "16px" }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="timesheet-invoice-container">
        <div className="timesheet-invoice-table">
          <div className="timesheet-invoice-table-header">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="timesheet-col">
                <div
                  className="skeleton-text"
                  style={{ width: "80px", height: "14px" }}
                ></div>
              </div>
            ))}
          </div>
          <div className="timesheet-invoice-table-body">
            {[1, 2].map((index) => (
              <div key={index} className="timesheet-invoice-line-item">
                {[1, 2, 3, 4].map((colIndex) => (
                  <div key={colIndex} className="timesheet-col">
                    <div
                      className="skeleton-text"
                      style={{
                        width: "90%",
                        height: "16px",
                        marginBottom: "4px",
                      }}
                    ></div>
                    <div
                      className="skeleton-text"
                      style={{ width: "70%", height: "12px" }}
                    ></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="timesheet-invoice-totals">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="timesheet-total-line">
                <div
                  className="skeleton-text"
                  style={{ width: "100px", height: "14px" }}
                ></div>
                <div
                  className="skeleton-text"
                  style={{ width: "80px", height: "14px" }}
                ></div>
              </div>
            ))}
          </div>
        </div>

        <div className="timesheet-action-section">
          <div className="timesheet-email-option">
            <div
              className="skeleton-text"
              style={{ width: "200px", height: "16px" }}
            ></div>
          </div>
          <div
            className="skeleton-text"
            style={{ width: "150px", height: "40px" }}
          ></div>
        </div>
      </div>
    </div>
  );
}
