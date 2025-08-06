import { useFormContext } from "react-hook-form";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import { PAYRATE_TYPES, PAYMENT_METHODS } from "../../constants/formOptions";
import { CompensationFormData } from "./profileSchemas";

interface CompensationFormProps {
  currentStep: number;
  allFields: string[];
}

export function CompensationForm({ allFields }: CompensationFormProps) {
  const { register, watch, formState, trigger } =
    useFormContext<CompensationFormData>();
  const { errors: allErrors } = formState;
  const { isJobSeeker } = useAuth();
  const { t } = useLanguage();

  // Function to check if we should show an error for a specific field
  const shouldShowError = (fieldName: string) => {
    return (
      allFields.includes(fieldName) &&
      allErrors[fieldName as keyof typeof allErrors]
    );
  };

  const [showOvertimeFields, setShowOvertimeFields] = useState(false);

  // Watch overtime toggle to show/hide overtime fields
  const overtimeEnabled = watch("overtimeEnabled");

  // Update state when overtimeEnabled changes
  useEffect(() => {
    if (overtimeEnabled !== showOvertimeFields) {
      setShowOvertimeFields(overtimeEnabled);

      // If overtime was just enabled, trigger validation after a short delay
      // to allow the UI to update first
      if (overtimeEnabled) {
        setTimeout(() => {
          trigger(["overtimeHours", "overtimeBillRate", "overtimePayRate"]);
        }, 100);
      }
    }
  }, [overtimeEnabled, showOvertimeFields, trigger]);

  return (
    <div className="form-step-container">
      <h2>{t('profileCreate.compensation.sectionTitle')}</h2>
      <p className="form-description">
        {t('profileCreate.compensation.sectionDescription')}
        {isJobSeeker && (
          <span className="text-info">
            {" "}
            As a jobseeker, bill rate and pay rate fields are optional.
          </span>
        )}
      </p>
      <div className="form-row">
        <div className="form-group">
          <label
            htmlFor="payrateType"
            className="form-label"
            data-required={isJobSeeker ? "" : "*"}
          >
            {t('profileCreate.compensation.payrateType')}
          </label>
          <select
            id="payrateType"
            className="form-input"
            {...register("payrateType")}
          >
            {PAYRATE_TYPES.slice(0, 3).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {shouldShowError("payrateType") && (
            <p className="error-message">{allErrors.payrateType?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label
            htmlFor="billRate"
            className="form-label"
            data-required={isJobSeeker ? "" : "*"}
          >
            {t('profileCreate.compensation.billRate')}
          </label>
          <input
            id="billRate"
            type="number"
            min="0"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            {...register("billRate")}
          />
          {shouldShowError("billRate") && (
            <p className="error-message">{allErrors.billRate?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label
            htmlFor="payRate"
            className="form-label"
            data-required={isJobSeeker ? "" : "*"}
          >
            {t('profileCreate.compensation.payRate')}
          </label>
          <input
            id="payRate"
            type="number"
            min="0"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            {...register("payRate")}
          />
          {shouldShowError("payRate") && (
            <p className="error-message">{allErrors.payRate?.message}</p>
          )}
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label
            htmlFor="paymentMethod"
            className="form-label"
            data-required={isJobSeeker ? "" : "*"}
          >
            {t('profileCreate.compensation.paymentMethod')}
          </label>
          <select
            id="paymentMethod"
            className="form-input"
            {...register("paymentMethod")}
          >
            <option value="">Select Payment Method</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          {shouldShowError("paymentMethod") && (
            <p className="error-message">{allErrors.paymentMethod?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="hstGst" className="form-label">
            {t('profileCreate.compensation.hstGst')}
          </label>
          <select id="hstGst" className="form-input" {...register("hstGst")}>
            <option value="">None</option>
            <option value="5">5%</option>
            <option value="13">13%</option>
            <option value="15">15%</option>
          </select>
          {shouldShowError("hstGst") && (
            <p className="error-message">{allErrors.hstGst?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="cashDeduction" className="form-label">
            {t('profileCreate.compensation.cashDeduction')}
          </label>
          <select
            id="cashDeduction"
            className="form-input"
            {...register("cashDeduction")}
          >
            <option value="0">0%</option>
            <option value="1">1%</option>
            <option value="2">2%</option>
            <option value="3">3%</option>
            <option value="4">4%</option>
            <option value="5">5%</option>
          </select>
          {shouldShowError("cashDeduction") && (
            <p className="error-message">{allErrors.cashDeduction?.message}</p>
          )}
        </div>
      </div>

      <div className="form-section">
        <h3>Overtime Settings</h3>

        <div className="container-form">
          <input
            id="overtimeEnabled"
            type="checkbox"
            className="toggle-form"
            {...register("overtimeEnabled")}
          />
          <label htmlFor="overtimeEnabled" className="label-form">
            {t('profileCreate.compensation.overtimeEnabled')}
          </label>
          {shouldShowError("overtimeEnabled") && (
            <p className="error-message">
              {allErrors.overtimeEnabled?.message}
            </p>
          )}
        </div>

        {showOvertimeFields && (
          <div className="overtime-fields">
            <div className="form-row">
              <div className="form-group">
                <label
                  htmlFor="overtimeHours"
                  className="form-label"
                  data-required="*"
                >
                  {t('profileCreate.compensation.overtimeHours')}
                </label>
                <input
                  id="overtimeHours"
                  type="text"
                  className="form-input"
                  placeholder="e.g., After 40 hours/week"
                  {...register("overtimeHours")}
                />
                {shouldShowError("overtimeHours") && (
                  <p className="error-message">
                    {allErrors.overtimeHours?.message}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label
                  htmlFor="overtimeBillRate"
                  className="form-label"
                  data-required="*"
                >
                  {t('profileCreate.compensation.overtimeBillRate')}
                </label>
                <input
                  id="overtimeBillRate"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  {...register("overtimeBillRate")}
                />
                {shouldShowError("overtimeBillRate") && (
                  <p className="error-message">
                    {allErrors.overtimeBillRate?.message}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label
                  htmlFor="overtimePayRate"
                  className="form-label"
                  data-required="*"
                >
                  {t('profileCreate.compensation.overtimePayRate')}
                </label>
                <input
                  id="overtimePayRate"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  {...register("overtimePayRate")}
                />
                {shouldShowError("overtimePayRate") && (
                  <p className="error-message">
                    {allErrors.overtimePayRate?.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
