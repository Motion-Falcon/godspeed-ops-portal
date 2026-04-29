import { FieldArrayWithId, useFormContext } from "react-hook-form";
import { CustomDropdown, DropdownOption } from "../../../components/CustomDropdown";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionFormData } from "../positionCreateSchema";

interface SubcategoryPositionDetailsSectionProps {
  fields: FieldArrayWithId<
    PositionFormData,
    "subcategoryPositionDetails",
    "id"
  >[];
  payrateTypeOptions: DropdownOption[];
}

export function SubcategoryPositionDetailsSection({
  fields,
  payrateTypeOptions,
}: SubcategoryPositionDetailsSectionProps) {
  const { t } = useLanguage();
  const { formState, getValues, register, setValue, watch } =
    useFormContext<PositionFormData>();

  return (
    <div className="form-section">
      <h2>{t("positionCreate.sections.positionDetails")}</h2>
      {fields.map((field, index) => {
        const rowLabel =
          watch(`subcategoryPositionDetails.${index}.subcategoryPosition`) || "";
        const detailErrors = formState.errors.subcategoryPositionDetails?.[
          index
        ] as Record<string, { message?: string }> | undefined;
        return (
          <div
            key={field.id}
            className="subcategory-position-detail-block"
            style={{ marginBottom: "1.75rem" }}
          >
            <h3
              className="section-title"
              style={{ fontSize: "1rem", marginBottom: "0.75rem" }}
            >
              {t("positionCreate.subcategory.detailHeading", {
                label: rowLabel,
              })}
            </h3>
            <input
              type="hidden"
              {...register(
                `subcategoryPositionDetails.${index}.subcategoryPosition`
              )}
            />
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" data-required="*">
                  {t("positionCreate.fields.numberOfPositions")}
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  {...register(
                    `subcategoryPositionDetails.${index}.numberOfPositions`,
                    { valueAsNumber: true }
                  )}
                />
                {detailErrors?.numberOfPositions?.message && (
                  <p className="form-error">
                    {detailErrors.numberOfPositions.message}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" data-required="*">
                  {t("positionCreate.fields.payrateType")}
                </label>
                <input
                  type="hidden"
                  {...register(
                    `subcategoryPositionDetails.${index}.payrateType`
                  )}
                />
                <CustomDropdown
                  options={payrateTypeOptions}
                  selectedOption={
                    payrateTypeOptions.find(
                      (option) =>
                        option.value ===
                        getValues(
                          `subcategoryPositionDetails.${index}.payrateType`
                        )
                    ) || null
                  }
                  onSelect={(option) => {
                    if (Array.isArray(option)) return;
                    setValue(
                      `subcategoryPositionDetails.${index}.payrateType`,
                      option.value as string,
                      { shouldValidate: true }
                    );
                  }}
                  placeholder={t(
                    "positionCreate.selectOptions.selectPayrateType"
                  )}
                  searchable={true}
                  clearable={true}
                  onClear={() =>
                    setValue(
                      `subcategoryPositionDetails.${index}.payrateType`,
                      "",
                      { shouldValidate: true }
                    )
                  }
                />
                {detailErrors?.payrateType?.message && (
                  <p className="form-error">{detailErrors.payrateType.message}</p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" data-required="*">
                  {t("positionCreate.fields.regularPayRate")}
                </label>
                <input
                  type="text"
                  className="form-input"
                  {...register(
                    `subcategoryPositionDetails.${index}.regularPayRate`
                  )}
                />
                {detailErrors?.regularPayRate?.message && (
                  <p className="form-error">
                    {detailErrors.regularPayRate.message}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t("positionCreate.fields.premiumPayRate")}
                </label>
                <input
                  type="text"
                  className="form-input"
                  {...register(
                    `subcategoryPositionDetails.${index}.premiumPayRate`
                  )}
                />
              </div>
              <div className="form-group">
                <label className="form-label" data-required="*">
                  {t("positionCreate.fields.billRate")}
                </label>
                <input
                  type="text"
                  className="form-input"
                  {...register(`subcategoryPositionDetails.${index}.billRate`)}
                />
                <div className="form-info">
                  <small>{t("positionCreate.info.billRateAutoCalc")}</small>
                </div>
                {detailErrors?.billRate?.message && (
                  <p className="form-error">{detailErrors.billRate.message}</p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t("positionCreate.fields.markup")}
                </label>
                <input
                  type="text"
                  className="form-input"
                  {...register(`subcategoryPositionDetails.${index}.markup`)}
                />
                <div className="form-info">
                  <small>{t("positionCreate.info.markupAutoCalc")}</small>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {formState.errors.subcategoryPositionDetails &&
        typeof formState.errors.subcategoryPositionDetails.message ===
          "string" && (
          <p className="form-error">
            {formState.errors.subcategoryPositionDetails.message as string}
          </p>
        )}
    </div>
  );
}
