import { useFormContext } from "react-hook-form";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionFormData } from "../positionCreateSchema";

export function NotesTasksSection() {
  const { t } = useLanguage();
  const { formState, register } = useFormContext<PositionFormData>();
  const errors = formState.errors;

  return (
    <>
      <div className="form-section">
        <h2>{t("positionCreate.sections.notes")}</h2>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="notes" className="form-label" data-required="*">
              {t("positionCreate.fields.notes")}
            </label>
            <textarea
              id="notes"
              className="form-textarea"
              placeholder={t("positionCreate.placeholders.notes")}
              rows={4}
              {...register("notes")}
            />
            {errors.notes && (
              <p className="form-error">{errors.notes.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>{t("positionCreate.sections.tasks")}</h2>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="assignedTo" className="form-label">
              {t("positionCreate.fields.assignedTo")}
            </label>
            <input
              type="text"
              id="assignedTo"
              className="form-input"
              placeholder={t("positionCreate.placeholders.assignedTo")}
              {...register("assignedTo")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="projCompDate" className="form-label">
              {t("positionCreate.fields.projCompDate")}
            </label>
            <div className="date-picker-container">
              <input
                type="date"
                id="projCompDate"
                className="form-input"
                {...register("projCompDate")}
                onClick={(event) => event.currentTarget.showPicker()}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="taskTime" className="form-label">
              {t("positionCreate.fields.taskTime")}
            </label>
            <input
              type="text"
              id="taskTime"
              className="form-input"
              placeholder={t("positionCreate.placeholders.taskTime")}
              {...register("taskTime")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
