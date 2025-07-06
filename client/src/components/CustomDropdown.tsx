import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, CheckCircle } from 'lucide-react';
import '../styles/components/CustomDropdown.css';

export interface DropdownOption {
  id: string;
  label: string;
  sublabel?: string;
  value: unknown;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  selectedOption?: DropdownOption | null;
  onSelect: (option: DropdownOption | DropdownOption[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  multiSelect?: boolean;
  selectedOptions?: DropdownOption[];
  showSelectAll?: boolean;
  maxVisibleTagsOverride?: number;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  selectedOption,
  onSelect,
  placeholder = "Select an option...",
  searchable = true,
  disabled = false,
  loading = false,
  emptyMessage = "No options found",
  className = "",
  icon,
  clearable = false,
  onClear,
  multiSelect = false,
  selectedOptions = [],
  showSelectAll = false,
  maxVisibleTagsOverride,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState<DropdownOption[]>(options);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  // Estimate average tag width (px)
  const AVG_TAG_WIDTH = 100;
  // How many tags can fit in the trigger?
  const [maxVisibleTags, setMaxVisibleTags] = useState<number>(2);

  // Filter options based on search term
  useEffect(() => {
    if (!searchable || searchTerm.trim() === "") {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter((option) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          option.label.toLowerCase().includes(searchLower) ||
          (option.sublabel && option.sublabel.toLowerCase().includes(searchLower))
        );
      });
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options, searchable]);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (multiSelect && triggerRef.current) {
      if (typeof maxVisibleTagsOverride === 'number') {
        setMaxVisibleTags(maxVisibleTagsOverride);
      } else {
        const triggerWidth = triggerRef.current.offsetWidth;
        // Subtract some space for the +more tag and padding
        const available = triggerWidth - 60;
        const count = Math.max(1, Math.floor(available / AVG_TAG_WIDTH));
        setMaxVisibleTags(count);
      }
    }
  }, [multiSelect, options.length, selectedOptions.length, maxVisibleTagsOverride]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen && searchable) {
      // Focus search input when opening
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleSelect = (option: DropdownOption) => {
    if (multiSelect) {
      // Toggle selection
      const alreadySelected = selectedOptions.some((o) => o.id === option.id);
      let newSelected: DropdownOption[];
      if (alreadySelected) {
        newSelected = selectedOptions.filter((o) => o.id !== option.id);
      } else {
        newSelected = [...selectedOptions, option];
      }
      onSelect(newSelected);
      // Keep dropdown open for multi-select
      setSearchTerm("");
    } else {
      onSelect(option);
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    }
    setSearchTerm("");
  };

  const displayValue = multiSelect
    ? selectedOptions.map((opt) => opt.label).join(", ")
    : selectedOption
    ? selectedOption.label
    : "";

  // Select All logic
  const allSelected =
    multiSelect && options.length > 0 && selectedOptions.length === options.length;
  const handleSelectAll = () => {
    if (allSelected) {
      onSelect([]);
    } else {
      onSelect(options);
    }
  };

  return (
    <div className={`custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleToggle}
        ref={multiSelect ? triggerRef : undefined}
      >
        {icon && <span className="custom-dropdown-icon">{icon}</span>}
        <div className="custom-dropdown-content">
          {multiSelect ? (
            <div className="custom-dropdown-tags-container">
              {selectedOptions.length > 0 ? (
                <>
                  {selectedOptions.slice(0, maxVisibleTags).map((option) => (
                    <span key={option.id} className="custom-dropdown-tag">
                      {option.label}
                    </span>
                  ))}
                  {selectedOptions.length > maxVisibleTags && (
                    <span className="custom-dropdown-tag custom-dropdown-tag-more">
                      +{selectedOptions.length - maxVisibleTags} more
                    </span>
                  )}
                </>
              ) : (
                <span className="custom-dropdown-text placeholder">{placeholder}</span>
              )}
            </div>
          ) : (
            <span className={`custom-dropdown-text ${!displayValue ? 'placeholder' : ''}`}>
              {displayValue || placeholder}
            </span>
          )}
        </div>
        <div className="custom-dropdown-actions">
          {clearable && ((multiSelect && selectedOptions.length > 0) || (!multiSelect && selectedOption)) && (
            <button
              type="button"
              className="custom-dropdown-clear"
              onClick={handleClear}
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown 
            size={16} 
            className={`custom-dropdown-chevron ${isOpen ? 'rotated' : ''}`} 
          />
        </div>
      </div>
      {isOpen && (
        <div className="custom-dropdown-menu">
          {loading ? (
            <div className="custom-dropdown-loading">
              <div className="custom-dropdown-spinner"></div>
              Loading...
            </div>
          ) : filteredOptions.length > 0 ? (
            <>
              {searchable && (
                <div className="custom-dropdown-search-container">
                  <Search size={14} className="custom-dropdown-search-icon" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search options..."
                    className="custom-dropdown-search"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <div className="custom-dropdown-options">
                {/* Select All Option */}
                {multiSelect && showSelectAll && (
                  <div
                    className={`custom-dropdown-option${allSelected ? ' selected' : ''}`}
                    onClick={handleSelectAll}
                    style={{ fontWeight: 600 }}
                  >
                    <div className="custom-dropdown-option-content">
                      <div className="custom-dropdown-option-label">
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </div>
                    </div>
                    {allSelected && <span className="custom-dropdown-option-check">✔</span>}
                  </div>
                )}
                {filteredOptions.map((option) => {
                  const isSelected = multiSelect
                    ? selectedOptions.some((o) => o.id === option.id)
                    : selectedOption?.id === option.id;
                  return (
                    <div
                      key={option.id}
                      className={`custom-dropdown-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(option)}
                    >
                      {multiSelect && (
                        <CheckCircle size={18} className={`custom-dropdown-check-circle${isSelected ? ' checked' : ''}`} />
                      )}
                      <div className="custom-dropdown-option-content">
                        <div className="custom-dropdown-option-label">
                          {option.label}
                        </div>
                        {option.sublabel && (
                          <div className="custom-dropdown-option-sublabel">
                            {option.sublabel}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="custom-dropdown-empty">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 