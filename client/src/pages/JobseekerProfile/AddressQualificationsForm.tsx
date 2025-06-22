import { useFormContext } from "react-hook-form";
import { addressQualificationsSchema } from "./ProfileCreate";
import { z } from "zod";
import { LICENSE_TYPES, EXPERIENCE_LEVELS } from "../../constants/formOptions";

type AddressQualificationsFormData = z.infer<
  typeof addressQualificationsSchema
>;

interface AddressQualificationsFormProps {
  currentStep: number;
  allFields: string[];
}

export function AddressQualificationsForm({
  currentStep,
  allFields,
}: AddressQualificationsFormProps) {
  const { register, formState } =
    useFormContext<AddressQualificationsFormData>();
  const { errors: allErrors } = formState;

  // Function to check if we should show an error for a specific field
  const shouldShowError = (fieldName: string) => {
    return (
      allFields.includes(fieldName) &&
      allErrors[fieldName as keyof typeof allErrors]
    );
  };

  // Content changes based on current step (2 or 3)
  const isAddressStep = currentStep === 2;

  return (
    <div className="form-step-container">
      {isAddressStep ? (
        // STEP 2: ADDRESS FORM
        <>
          <h2>Address Information</h2>
          <p className="form-description">
            Please provide your current address. All fields are required.
          </p>

          <div className="form-group">
            <label htmlFor="street" className="form-label" data-required="*">
              Street Address
            </label>
            <textarea
              id="street"
              className="form-input"
              placeholder="123 Main Street"
              {...register("street")}
            />
            {shouldShowError("street") && (
              <p className="error-message">{allErrors.street?.message}</p>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city" className="form-label" data-required="*">
                City
              </label>
              <input
                id="city"
                type="text"
                className="form-input"
                placeholder="Toronto"
                {...register("city")}
              />
              {shouldShowError("city") && (
                <p className="error-message">{allErrors.city?.message}</p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="province"
                className="form-label"
                data-required="*"
              >
                Province
              </label>
              <input
                id="province"
                type="text"
                className="form-input"
                placeholder="Ontario"
                {...register("province")}
              />
              {shouldShowError("province") && (
                <p className="error-message">{allErrors.province?.message}</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label
              htmlFor="postalCode"
              className="form-label"
              data-required="*"
            >
              Postal Code
            </label>
            <input
              id="postalCode"
              type="text"
              className="form-input"
              placeholder="A1A 1A1"
              {...register("postalCode")}
            />
            {shouldShowError("postalCode") && (
              <p className="error-message">{allErrors.postalCode?.message}</p>
            )}
          </div>
        </>
      ) : (
        // STEP 3: QUALIFICATIONS FORM
        <>
          <h2>Qualifications</h2>
          <p className="form-description">
            Please provide your qualifications and work preferences. Fields
            marked with * are required.
          </p>

          <div className="form-group">
            <label
              htmlFor="workPreference"
              className="form-label"
              data-required="*"
            >
              Work Preference
            </label>
            <input
              id="workPreference"
              type="text"
              className="form-input"
              placeholder="E.g., Warehouse, Driving, Office (minimum 10 characters)"
              {...register("workPreference")}
            />
            {shouldShowError("workPreference") && (
              <p className="error-message">
                {allErrors.workPreference?.message}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="bio" className="form-label" data-required="*">
              Brief Bio
            </label>
            <textarea
              id="bio"
              className="form-input"
              placeholder="Brief professional summary (100 characters minimum)"
              minLength={100}
              {...register("bio")}
            />
            {shouldShowError("bio") && (
              <p className="error-message">{allErrors.bio?.message}</p>
            )}
            <p className="character-count">
              <small>Minimum 100 characters, maximum 500 characters</small>
            </p>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label
                htmlFor="licenseType"
                className="form-label"
                data-required="*"
              >
                License Type
              </label>
              <select
                id="licenseType"
                className="form-input"
                {...register("licenseType")}
              >
                <option value="">Select License Type</option>
                {LICENSE_TYPES.map((license) => (
                  <option key={license} value={license}>
                    {license}
                  </option>
                ))}
              </select>
              {shouldShowError("licenseType") && (
                <p className="error-message">
                  {allErrors.licenseType?.message}
                </p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="experience"
                className="form-label"
                data-required="*"
              >
                Experience
              </label>
              <select
                id="experience"
                className="form-input"
                {...register("experience")}
              >
                <option value="">Select Experience Level</option>
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {shouldShowError("experience") && (
                <p className="error-message">{allErrors.experience?.message}</p>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="manualDriving" className="form-label">
                Manual Driving?
              </label>
              <select
                id="manualDriving"
                className="form-input"
                {...register("manualDriving")}
              >
                <option value="NA">NA</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {shouldShowError("manualDriving") && (
                <p className="error-message">
                  {allErrors.manualDriving?.message}
                </p>
              )}
            </div>

            <div className="form-group">
              <label
                htmlFor="availability"
                className="form-label"
                data-required="*"
              >
                Availability
              </label>
              <select
                id="availability"
                className="form-input"
                {...register("availability")}
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
              </select>
              {shouldShowError("availability") && (
                <p className="error-message">
                  {allErrors.availability?.message}
                </p>
              )}
            </div>
          </div>

          <div className="form-group checkbox-container">
            <input
              id="weekendAvailability"
              type="checkbox"
              className="form-checkbox"
              {...register("weekendAvailability")}
            />
            <label htmlFor="weekendAvailability" className="checkbox-label">
              Available for weekend work
            </label>
            {shouldShowError("weekendAvailability") && (
              <p className="error-message">
                {allErrors.weekendAvailability?.message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
