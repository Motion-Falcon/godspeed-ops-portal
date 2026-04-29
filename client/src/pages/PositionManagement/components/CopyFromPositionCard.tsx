import { DropdownOption, CustomDropdown } from "../../../components/CustomDropdown";
import { useLanguage } from "../../../contexts/language/language-provider";
import { PositionData } from "../../../services/api/position";
import {
  getPositionDisplayTitle,
  positionMatchingStyleDropdownSublabel,
} from "../../../utils/positionDisplay";

interface CopyFromPositionCardProps {
  copyFromClientOptions: DropdownOption[];
  copyFromClientId: string | null;
  copyFromPositionOptions: DropdownOption[];
  copyFromPositionsLoading: boolean;
  copyFromPositionLoading: boolean;
  copyFromSelectedPosition: PositionData | null;
  onClientSelect: (option: DropdownOption | DropdownOption[]) => void;
  onClientClear: () => void;
  onPositionSelect: (option: DropdownOption | DropdownOption[]) => void;
  onPositionClear: () => void;
}

export function CopyFromPositionCard({
  copyFromClientOptions,
  copyFromClientId,
  copyFromPositionOptions,
  copyFromPositionsLoading,
  copyFromPositionLoading,
  copyFromSelectedPosition,
  onClientSelect,
  onClientClear,
  onPositionSelect,
  onPositionClear,
}: CopyFromPositionCardProps) {
  const { t } = useLanguage();

  return (
    <div className="card copy-from-card">
      <h2 className="copy-from-title">
        {t("positionCreate.copyFrom.sectionTitle")}
      </h2>
      <p className="copy-from-subtitle">
        {t("positionCreate.copyFrom.sectionSubtitle")}
      </p>
      <div className="copy-from-dropdowns">
        <div className="form-group">
          <label htmlFor="copy-from-client" className="form-label">
            {t("positionCreate.copyFrom.filterByClient")}
          </label>
          <CustomDropdown
            options={copyFromClientOptions}
            selectedOption={
              copyFromClientId
                ? copyFromClientOptions.find((option) => option.id === copyFromClientId) ||
                  null
                : null
            }
            onSelect={onClientSelect}
            placeholder={t("positionCreate.copyFrom.selectClientPlaceholder")}
            searchable={true}
            clearable={true}
            onClear={onClientClear}
            emptyMessage={t("positionCreate.copyFrom.noClientsAvailable")}
          />
        </div>
        <div className="form-group">
          <label htmlFor="copy-from-position" className="form-label">
            {t("positionCreate.copyFrom.copyExistingPosition")}
          </label>
          {copyFromPositionsLoading ? (
            <div className="invoice-dropdown-skeleton">
              <div className="skeleton-dropdown-trigger">
                <div className="skeleton-icon"></div>
                <div className="skeleton-text skeleton-dropdown-text"></div>
                <div className="skeleton-icon skeleton-chevron"></div>
              </div>
            </div>
          ) : (
            <CustomDropdown
              options={copyFromPositionOptions}
              selectedOption={
                copyFromSelectedPosition
                  ? {
                      id: copyFromSelectedPosition.id || "",
                      label: `${getPositionDisplayTitle(copyFromSelectedPosition, t("positionCreate.copyFrom.notSpecified"))} - ${copyFromSelectedPosition.positionNumber || t("positionCreate.copyFrom.notSpecified")}`,
                      sublabel: positionMatchingStyleDropdownSublabel(
                        copyFromSelectedPosition,
                        t
                      ),
                      value: copyFromSelectedPosition.id || "",
                    }
                  : null
              }
              onSelect={onPositionSelect}
              placeholder={
                copyFromClientId
                  ? t("positionCreate.copyFrom.selectPositionPlaceholder")
                  : t("positionCreate.copyFrom.selectClientFirst")
              }
              searchable={true}
              clearable={true}
              disabled={!copyFromClientId}
              loading={copyFromPositionLoading}
              onClear={onPositionClear}
              emptyMessage={t("positionCreate.copyFrom.noPositionsAvailable")}
            />
          )}
        </div>
      </div>
      {copyFromSelectedPosition && (
        <div className="copy-from-selected-block">
          <h3 className="copy-from-selected-title">
            {getPositionDisplayTitle(
              copyFromSelectedPosition,
              t("positionCreate.copyFrom.notSpecified")
            )}
          </h3>
          <p className="form-hint copy-from-hint">
            {t("positionCreate.copyFrom.formFilledHint")}
          </p>
        </div>
      )}
    </div>
  );
}
