import { useFormContext } from "react-hook-form";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionFormData } from "../positionCreateSchema";

export function AddressDetailsSection() {
  const { t } = useLanguage();
  const { formState, register } = useFormContext<PositionFormData>();
  const errors = formState.errors;

  return (
    <div className="form-section">
      <h2>{t("positionCreate.sections.addressDetails")}</h2>

      <div className="form-info" data-required="*">
        <small>{t("positionCreate.info.addressAutoFill")}</small>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="streetAddress" className="form-label" data-required="*">
            {t("positionCreate.fields.streetAddress")}
          </label>
          <input
            type="text"
            id="streetAddress"
            className="form-input auto-populated"
            placeholder={t("positionCreate.placeholders.streetAddress")}
            {...register("streetAddress")}
          />
          {errors.streetAddress && (
            <p className="form-error">{errors.streetAddress.message}</p>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="city" className="form-label" data-required="*">
            {t("positionCreate.fields.city")}
          </label>
          <input
            type="text"
            id="city"
            className="form-input auto-populated"
            placeholder={t("positionCreate.placeholders.city")}
            {...register("city")}
          />
          {errors.city && <p className="form-error">{errors.city.message}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="province" className="form-label" data-required="*">
            {t("positionCreate.fields.province")}
          </label>
          <input
            type="text"
            id="province"
            className="form-input auto-populated"
            placeholder={t("positionCreate.placeholders.province")}
            {...register("province")}
          />
          {errors.province && (
            <p className="form-error">{errors.province.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="postalCode" className="form-label" data-required="*">
            {t("positionCreate.fields.postalCode")}
          </label>
          <input
            type="text"
            id="postalCode"
            className="form-input auto-populated"
            placeholder={t("positionCreate.placeholders.postalCode")}
            {...register("postalCode")}
          />
          {errors.postalCode && (
            <p className="form-error">{errors.postalCode.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
