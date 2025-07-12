import { Globe } from "lucide-react";
import { useLanguage } from "../contexts/language/language-provider";
import { CustomDropdown, DropdownOption } from "./CustomDropdown";
import "../styles/components/language-toggle.css";

const LANGUAGE_OPTIONS: DropdownOption[] = [
  { id: "en", label: "English", value: "en" },
  { id: "fr", label: "Français", value: "fr" },
];

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const selectedOption = LANGUAGE_OPTIONS.find((opt) => opt.id === language);

  return (
    <div className="language-toggle-wrapper">
      <CustomDropdown
        options={LANGUAGE_OPTIONS}
        selectedOption={selectedOption}
        onSelect={(option) => {
          if (!Array.isArray(option)) setLanguage(option.id as "en" | "fr");
        }}
        placeholder="Language"
        searchable={false}
        className="language-toggle-dropdown"
        icon={<Globe size={16} />}
      />
    </div>
  );
} 