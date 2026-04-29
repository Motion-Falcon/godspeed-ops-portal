import { useFormContext } from "react-hook-form";
import { CustomDropdown, DropdownOption } from "../../../components/CustomDropdown";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionFormData } from "../positionCreateSchema";

interface NormalPositionDetailsSectionProps {
  payrateTypeOptions: DropdownOption[];
}

export function NormalPositionDetailsSection({
  payrateTypeOptions,
}: NormalPositionDetailsSectionProps) {
  const { t } = useLanguage();
  const { formState, getValues, register, setValue } =
    useFormContext<PositionFormData>();
  const errors = formState.errors;

  return (
    <div className="form-section">
      <h2>{t("positionCreate.sections.positionDetails")}</h2>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="numberOfPositions" className="form-label" data-required="*">
            {t("positionCreate.fields.numberOfPositions")}
          </label>
          <input
            type="number"
            id="numberOfPositions"
            className="form-input"
            placeholder={t("positionCreate.placeholders.numberOfPositions")}
            min="1"
            required
            {...register("numberOfPositions")}
          />
          {errors.numberOfPositions && (
            <p className="form-error">{errors.numberOfPositions.message}</p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="payrateType" className="form-label" data-required="*">
            {t("positionCreate.fields.payrateType")}
          </label>
          <input type="hidden" {...register("payrateType")} />
          <CustomDropdown
            options={payrateTypeOptions}
            selectedOption={
              payrateTypeOptions.find(
                (option) => option.value === getValues("payrateType")
              ) || null
            }
            onSelect={(option) => {
              if (Array.isArray(option)) return;
              setValue("payrateType", option.value as string, {
                shouldValidate: true,
              });
            }}
            placeholder={t("positionCreate.selectOptions.selectPayrateType")}
            searchable={true}
            clearable={true}
            onClear={() => setValue("payrateType", "", { shouldValidate: true })}
          />
          {errors.payrateType && (
            <p className="form-error">{errors.payrateType.message}</p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="regularPayRate" className="form-label" data-required="*">
            {t("positionCreate.fields.regularPayRate")}
          </label>
          <input
            type="text"
            id="regularPayRate"
            className="form-input"
            placeholder={t("positionCreate.placeholders.regularPayRate")}
            {...register("regularPayRate")}
          />
          {errors.regularPayRate && (
            <p className="form-error">{errors.regularPayRate.message}</p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="premiumPayRate" className="form-label">
            {t("positionCreate.fields.premiumPayRate")}
          </label>
          <input
            type="text"
            id="premiumPayRate"
            className="form-input"
            placeholder={t("positionCreate.placeholders.premiumPayRate")}
            {...register("premiumPayRate")}
          />
        </div>
        <div className="form-group">
          <label htmlFor="billRate" className="form-label" data-required="*">
            {t("positionCreate.fields.billRate")}
          </label>
          <input
            type="text"
            id="billRate"
            className="form-input"
            placeholder={t("positionCreate.placeholders.billRate")}
            {...register("billRate")}
          />
          <div className="form-info">
            <small>{t("positionCreate.info.billRateAutoCalc")}</small>
          </div>
          {errors.billRate && (
            <p className="form-error">{errors.billRate.message}</p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="markup" className="form-label">
            {t("positionCreate.fields.markup")}
          </label>
          <input
            type="text"
            id="markup"
            className="form-input"
            placeholder={t("positionCreate.placeholders.markup")}
            {...register("markup")}
          />
          <div className="form-info">
            <small>{t("positionCreate.info.markupAutoCalc")}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
