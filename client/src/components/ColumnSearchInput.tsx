import { Search, X } from "lucide-react";
import { useLanguage } from "../contexts/language/language-provider";

interface ColumnSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function ColumnSearchInput({
  value,
  onChange,
  placeholder,
}: ColumnSearchInputProps) {
  const { t } = useLanguage();

  return (
    <div
      className="column-header-search"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Search size={12} className="column-search-icon" />
      <input
        type="text"
        className="column-search-input"
        placeholder={placeholder || t("reports.placeholders.searchColumn")}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {Boolean(value) && (
        <button
          type="button"
          className="column-search-clear"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
          title="Clear filter"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export default ColumnSearchInput;
