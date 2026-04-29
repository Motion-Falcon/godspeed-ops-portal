import { useFormContext } from "react-hook-form";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionFormData } from "../positionCreateSchema";

export function OvertimeSection() {
  const { t } = useLanguage();
  const { formState, register, watch } = useFormContext<PositionFormData>();
  const errors = formState.errors;

  return (
    <div className="form-section">
      <h2>{t("positionCreate.sections.overtime")}</h2>

      <div className="form-row">
        <div className="container-form">
          <input
            type="checkbox"
            id="overtimeEnabled"
            className="toggle-form"
            {...register("overtimeEnabled")}
          />
          <label htmlFor="overtimeEnabled" className="label-form">
            {t("positionCreate.fields.overtimeEnabled")}
          </label>
        </div>
      </div>

      {watch("overtimeEnabled") && (
        <div className="overtime-fields">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="overtimeHours" className="form-label">
                {t("positionCreate.fields.overtimeHours")}
              </label>
              <input
                type="text"
                id="overtimeHours"
                className="form-input"
                placeholder={t("positionCreate.placeholders.overtimeHours")}
                {...register("overtimeHours")}
              />
              {errors.overtimeHours && (
                <p className="form-error">{errors.overtimeHours.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="overtimeBillRate" className="form-label">
                {t("positionCreate.fields.overtimeBillRate")}
              </label>
              <input
                type="text"
                id="overtimeBillRate"
                className="form-input"
                placeholder={t("positionCreate.placeholders.overtimeBillRate")}
                {...register("overtimeBillRate")}
              />
              {errors.overtimeBillRate && (
                <p className="form-error">{errors.overtimeBillRate.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="overtimePayRate" className="form-label">
                {t("positionCreate.fields.overtimePayRate")}
              </label>
              <input
                type="text"
                id="overtimePayRate"
                className="form-input"
                placeholder={t("positionCreate.placeholders.overtimePayRate")}
                {...register("overtimePayRate")}
              />
              {errors.overtimePayRate && (
                <p className="form-error">{errors.overtimePayRate.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {errors.overtimeEnabled && (
        <p className="form-error">{errors.overtimeEnabled.message}</p>
      )}
    </div>
  );
}
