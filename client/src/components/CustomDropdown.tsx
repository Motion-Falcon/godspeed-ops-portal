import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
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
  onSelect: (option: DropdownOption) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState<DropdownOption[]>(options);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    onSelect(option);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    }
    setSearchTerm("");
  };

  const displayValue = selectedOption ? selectedOption.label : "";

  return (
    <div className={`custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleToggle}
      >
        {icon && <span className="custom-dropdown-icon">{icon}</span>}
        
        <div className="custom-dropdown-content">
          {searchable && isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={selectedOption ? selectedOption.label : placeholder}
              className="custom-dropdown-search-input"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`custom-dropdown-text ${!displayValue ? 'placeholder' : ''}`}>
              {displayValue || placeholder}
            </span>
          )}
        </div>

        <div className="custom-dropdown-actions">
          {clearable && selectedOption && (
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
                {filteredOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`custom-dropdown-option ${
                      selectedOption?.id === option.id ? 'selected' : ''
                    }`}
                    onClick={() => handleSelect(option)}
                  >
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
                ))}
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