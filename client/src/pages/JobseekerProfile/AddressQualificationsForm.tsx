import { useFormContext } from "react-hook-form";
import { LICENSE_TYPES, EXPERIENCE_LEVELS } from "../../constants/formOptions";
import { useLanguage } from "../../contexts/language/language-provider";
import { AddressQualificationsFormData } from "./profileSchemas";

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
  const { t } = useLanguage();

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
          <h2>{t('profileCreate.address.sectionTitle')}</h2>
          <p className="form-description">
            {t('profileCreate.address.sectionDescription')}
          </p>

          <div className="form-group">
            <label htmlFor="street" className="form-label" data-required="*">
              {t('profileCreate.address.street')}
            </label>
            <textarea
              id="street"
              className="form-input"
              placeholder={t('profileCreate.address.streetPlaceholder')}
              {...register("street")}
            />
            {shouldShowError("street") && (
              <p className="error-message">{allErrors.street?.message}</p>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city" className="form-label" data-required="*">
                {t('profileCreate.address.city')}
              </label>
              <input
                id="city"
                type="text"
                className="form-input"
                placeholder={t('profileCreate.address.cityPlaceholder')}
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
                {t('profileCreate.address.province')}
              </label>
              <input
                id="province"
                type="text"
                className="form-input"
                placeholder={t('profileCreate.address.provincePlaceholder')}
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
              {t('profileCreate.address.postalCode')}
            </label>
            <input
              id="postalCode"
              type="text"
              className="form-input"
              placeholder={t('profileCreate.address.postalCodePlaceholder')}
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
          <h2>{t('profileCreate.qualifications.sectionTitle')}</h2>
          <p className="form-description">
            {t('profileCreate.qualifications.sectionDescription')}
          </p>

          <div className="form-group">
            <label
              htmlFor="workPreference"
              className="form-label"
              data-required="*"
            >
              {t('profileCreate.qualifications.workPreference')}
            </label>
            <input
              id="workPreference"
              type="text"
              className="form-input"
              placeholder={t('profileCreate.qualifications.workPreferencePlaceholder')}
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
              {t('profileCreate.qualifications.bio')}
            </label>
            <textarea
              id="bio"
              className="form-input"
              placeholder={t('profileCreate.qualifications.bioPlaceholder')}
              minLength={100}
              {...register("bio")}
            />
            {shouldShowError("bio") && (
              <p className="error-message">{allErrors.bio?.message}</p>
            )}
            <p className="character-count">
              <small>{t('profileCreate.qualifications.bioNote')}</small>
            </p>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label
                htmlFor="licenseType"
                className="form-label"
                data-required="*"
              >
                {t('profileCreate.qualifications.licenseType')}
              </label>
              <select
                id="licenseType"
                className="form-input"
                {...register("licenseType")}
              >
                <option value="">{t('profileCreate.qualifications.licenseTypePlaceholder')}</option>
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
                {t('profileCreate.qualifications.experience')}
              </label>
              <select
                id="experience"
                className="form-input"
                {...register("experience")}
              >
                <option value="">{t('profileCreate.qualifications.experiencePlaceholder')}</option>
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
                {t('profileCreate.qualifications.manualDriving')}
              </label>
              <select
                id="manualDriving"
                className="form-input"
                {...register("manualDriving")}
              >
                <option value="NA">NA</option>
                <option value="Yes">{t('common.yes')}</option>
                <option value="No">{t('common.no')}</option>
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
                {t('profileCreate.qualifications.availability')}
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
              {t('profileCreate.qualifications.weekendAvailability')}
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
