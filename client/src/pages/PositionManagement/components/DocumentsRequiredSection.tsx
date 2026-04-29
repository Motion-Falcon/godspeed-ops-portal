import { useFormContext } from "react-hook-form";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionFormData } from "../positionCreateSchema";

const documents = [
  "license",
  "driverAbstract",
  "tdgCertificate",
  "sin",
  "immigrationStatus",
  "passport",
  "cvor",
  "resume",
  "articlesOfIncorporation",
  "directDeposit",
] as const;

export function DocumentsRequiredSection() {
  const { t } = useLanguage();
  const { formState, register } = useFormContext<PositionFormData>();
  const documentErrors = formState.errors.documentsRequired;

  return (
    <div className="form-section">
      <h2>{t("positionCreate.sections.documentsRequired")}</h2>

      {[documents.slice(0, 5), documents.slice(5)].map((row, rowIndex) => (
        <div className="form-row" key={rowIndex}>
          {row.map((document) => (
            <div className="checkbox-container" key={document}>
              <input
                type="checkbox"
                id={document}
                className="form-checkbox"
                {...register(`documentsRequired.${document}`)}
              />
              <label htmlFor={document} className="checkbox-label">
                {t(`positionCreate.documents.${document}`)}
              </label>
            </div>
          ))}
        </div>
      ))}

      {(documentErrors?.root || documentErrors?.message) && (
        <p className="form-error">
          {documentErrors?.root?.message ||
            documentErrors?.message ||
            t("positionCreate.errors.documentsRequired")}
        </p>
      )}
    </div>
  );
}
