import { useFormContext } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';

// Will define this schema in ProfileCreate.tsx
const compensationSchema = z.object({
  payrateType: z.enum(['Hourly', 'Daily', 'Monthly']),
  billRate: z.string().min(1, { message: 'Bill rate is required' }),
  payRate: z.string().min(1, { message: 'Pay rate is required' }),
  paymentMethod: z.string().min(1, { message: 'Payment method is required' }),
  hstGst: z.string().optional(),
  cashDeduction: z.string().optional(),
  overtimeEnabled: z.boolean().default(false),
  overtimeHours: z.string().optional(),
  overtimeBillRate: z.string().optional(),
  overtimePayRate: z.string().optional(),
});

type CompensationFormData = z.infer<typeof compensationSchema>;

interface CompensationFormProps {
  currentStep: number;
  allFields: string[];
}

export function CompensationForm({ allFields }: CompensationFormProps) {
  const { register, watch, formState } = useFormContext<CompensationFormData>();
  const { errors: allErrors } = formState;
  
  // Function to check if we should show an error for a specific field
  const shouldShowError = (fieldName: string) => {
    return allFields.includes(fieldName) && allErrors[fieldName as keyof typeof allErrors];
  };
  
  const [showOvertimeFields, setShowOvertimeFields] = useState(false);
  
  // Watch overtime toggle to show/hide overtime fields
  const overtimeEnabled = watch('overtimeEnabled');

  // Update state when overtimeEnabled changes
  if (overtimeEnabled !== showOvertimeFields) {
    setShowOvertimeFields(overtimeEnabled);
  }

  return (
    <div className="form-step-container">
      <h2>Compensation Details</h2>
      <p className="form-description">
        Please provide your compensation information. Fields marked with * are required.
      </p>

      <div className="form-group">
        <label htmlFor="payrateType" className="form-label" data-required="*">Payrate Type</label>
        <select 
          id="payrateType"
          className="form-input"
          {...register('payrateType')}
        >
          <option value="Hourly">Hourly</option>
          <option value="Daily">Daily</option>
          <option value="Monthly">Monthly</option>
        </select>
        {shouldShowError('payrateType') && (
          <p className="error-message">{allErrors.payrateType?.message}</p>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="billRate" className="form-label" data-required="*">Bill Rate ($)</label>
          <input
            id="billRate"
            type="number"
            min="0"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            {...register('billRate')}
          />
          {shouldShowError('billRate') && (
            <p className="error-message">{allErrors.billRate?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="payRate" className="form-label" data-required="*">Pay Rate ($)</label>
          <input
            id="payRate"
            type="number"
            min="0"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            {...register('payRate')}
          />
          {shouldShowError('payRate') && (
            <p className="error-message">{allErrors.payRate?.message}</p>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="paymentMethod" className="form-label" data-required="*">Payment Method</label>
        <select
          id="paymentMethod"
          className="form-input"
          {...register('paymentMethod')}
        >
          <option value="">Select Payment Method</option>
          <option value="Cash">Cash</option>
          <option value="Corporation-Cheque">Corporation - Cheque</option>
          <option value="Corporation-Direct Deposit">Corporation - Direct Deposit</option>
          <option value="e-Transfer">e-Transfer</option>
          <option value="Direct Deposit">Direct Deposit</option>
          <option value="Cheque">Cheque</option>
        </select>
        {shouldShowError('paymentMethod') && (
          <p className="error-message">{allErrors.paymentMethod?.message}</p>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="hstGst" className="form-label">HST/GST (%)</label>
          <select
            id="hstGst"
            className="form-input"
            {...register('hstGst')}
          >
            <option value="">None</option>
            <option value="5">5%</option>
            <option value="13">13%</option>
            <option value="15">15%</option>
          </select>
          {shouldShowError('hstGst') && (
            <p className="error-message">{allErrors.hstGst?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="cashDeduction" className="form-label">Cash Deduction (%)</label>
          <select
            id="cashDeduction"
            className="form-input"
            {...register('cashDeduction')}
          >
            <option value="0">0%</option>
            <option value="1">1%</option>
            <option value="2">2%</option>
            <option value="3">3%</option>
            <option value="4">4%</option>
            <option value="5">5%</option>
          </select>
          {shouldShowError('cashDeduction') && (
            <p className="error-message">{allErrors.cashDeduction?.message}</p>
          )}
        </div>
      </div>

      <div className="form-section">
        <h3>Overtime Settings</h3>
        
        <div className="form-group checkbox-container">
          <input
            id="overtimeEnabled"
            type="checkbox"
            className="form-checkbox"
            {...register('overtimeEnabled')}
          />
          <label htmlFor="overtimeEnabled" className="checkbox-label">
            Enable overtime rates
          </label>
          {shouldShowError('overtimeEnabled') && (
            <p className="error-message">{allErrors.overtimeEnabled?.message}</p>
          )}
        </div>

        {showOvertimeFields && (
          <div className="overtime-fields">
            <div className="form-group">
              <label htmlFor="overtimeHours" className="form-label">Overtime Hours</label>
              <input
                id="overtimeHours"
                type="text"
                className="form-input"
                placeholder="e.g., After 40 hours/week"
                {...register('overtimeHours')}
              />
              {shouldShowError('overtimeHours') && (
                <p className="error-message">{allErrors.overtimeHours?.message}</p>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="overtimeBillRate" className="form-label">Overtime Bill Rate ($)</label>
                <input
                  id="overtimeBillRate"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  {...register('overtimeBillRate')}
                />
                {shouldShowError('overtimeBillRate') && (
                  <p className="error-message">{allErrors.overtimeBillRate?.message}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="overtimePayRate" className="form-label">Overtime Pay Rate ($)</label>
                <input
                  id="overtimePayRate"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  {...register('overtimePayRate')}
                />
                {shouldShowError('overtimePayRate') && (
                  <p className="error-message">{allErrors.overtimePayRate?.message}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 