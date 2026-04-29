import { useFormContext } from "react-hook-form";
import { CustomDropdown, DropdownOption } from "../../../components/CustomDropdown";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionFormData } from "../positionCreateSchema";

interface EmploymentCategorizationSectionProps {
  employmentTermOptions: DropdownOption[];
  employmentTypeOptions: DropdownOption[];
  experienceOptions: DropdownOption[];
  positionCategoryOptions: DropdownOption[];
}

export function EmploymentCategorizationSection({
  employmentTermOptions,
  employmentTypeOptions,
  experienceOptions,
  positionCategoryOptions,
}: EmploymentCategorizationSectionProps) {
  const { t } = useLanguage();
  const { formState, getValues, register, setValue } =
    useFormContext<PositionFormData>();
  const errors = formState.errors;

  return (
    <div className="form-section">
      <h2>{t("positionCreate.sections.employmentCategorization")}</h2>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="employmentTerm" className="form-label" data-required="*">
            {t("positionCreate.fields.employmentTerm")}
          </label>
          <input type="hidden" {...register("employmentTerm")} />
          <CustomDropdown
            options={employmentTermOptions}
            selectedOption={
              employmentTermOptions.find(
                (option) => option.value === getValues("employmentTerm")
              ) || null
            }
            onSelect={(option) => {
              if (Array.isArray(option)) return;
              setValue("employmentTerm", option.value as string, {
                shouldValidate: true,
              });
            }}
            placeholder={t("positionCreate.selectOptions.selectEmploymentTerm")}
            searchable={true}
            clearable={true}
            onClear={() =>
              setValue("employmentTerm", "", { shouldValidate: true })
            }
          />
          {errors.employmentTerm && (
            <p className="form-error">{errors.employmentTerm.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="employmentType" className="form-label" data-required="*">
            {t("positionCreate.fields.employmentType")}
          </label>
          <input type="hidden" {...register("employmentType")} />
          <CustomDropdown
            options={employmentTypeOptions}
            selectedOption={
              employmentTypeOptions.find(
                (option) => option.value === getValues("employmentType")
              ) || null
            }
            onSelect={(option) => {
              if (Array.isArray(option)) return;
              setValue("employmentType", option.value as string, {
                shouldValidate: true,
              });
            }}
            placeholder={t("positionCreate.selectOptions.selectEmploymentType")}
            searchable={true}
            clearable={true}
            onClear={() =>
              setValue("employmentType", "", { shouldValidate: true })
            }
          />
          {errors.employmentType && (
            <p className="form-error">{errors.employmentType.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="positionCategory" className="form-label" data-required="*">
            {t("positionCreate.fields.positionCategory")}
          </label>
          <input type="hidden" {...register("positionCategory")} />
          <CustomDropdown
            options={positionCategoryOptions}
            selectedOption={
              positionCategoryOptions.find(
                (option) => option.value === getValues("positionCategory")
              ) || null
            }
            onSelect={(option) => {
              if (Array.isArray(option)) return;
              setValue("positionCategory", option.value as string, {
                shouldValidate: true,
              });
            }}
            placeholder={t("positionCreate.selectOptions.selectPositionCategory")}
            searchable={true}
            clearable={true}
            onClear={() =>
              setValue("positionCategory", "", {
                shouldValidate: true,
              })
            }
          />
          {errors.positionCategory && (
            <p className="form-error">{errors.positionCategory.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="experience" className="form-label" data-required="*">
            {t("positionCreate.fields.experience")}
          </label>
          <input type="hidden" {...register("experience")} />
          <CustomDropdown
            options={experienceOptions}
            selectedOption={
              experienceOptions.find(
                (option) => option.value === getValues("experience")
              ) || null
            }
            onSelect={(option) => {
              if (Array.isArray(option)) return;
              setValue("experience", option.value as string, {
                shouldValidate: true,
              });
            }}
            placeholder={t("positionCreate.selectOptions.selectExperienceLevel")}
            searchable={true}
            clearable={true}
            onClear={() => setValue("experience", "", { shouldValidate: true })}
          />
          {errors.experience && (
            <p className="form-error">{errors.experience.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
