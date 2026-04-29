import { useEffect, useMemo, useState } from "react";
import { DropdownOption } from "../../../components/CustomDropdown";
import {
  EMPLOYMENT_TERMS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  PAYRATE_TYPES,
  POSITION_CATEGORIES,
} from "../../../constants/formOptions";
import { getDropdownOptionsByType } from "../../../services/api/dropdownOptions";

const toDropdownOptions = (values: readonly string[]): DropdownOption[] =>
  values.map((value) => ({
    id: value,
    value,
    label: value,
  }));

export function usePositionCreateOptions() {
  const [dynamicTitles, setDynamicTitles] = useState<string[]>([]);
  const [subcategoryPositionOptions, setSubcategoryPositionOptions] = useState<
    string[]
  >([]);

  useEffect(() => {
    getDropdownOptionsByType("position_title")
      .then((opts) => {
        setDynamicTitles(opts.map((option) => option.name));
      })
      .catch(() => {
        setDynamicTitles([]);
      });
  }, []);

  useEffect(() => {
    getDropdownOptionsByType("subcategory_position")
      .then((opts) => {
        setSubcategoryPositionOptions(opts.map((option) => option.name));
      })
      .catch(() => {
        setSubcategoryPositionOptions([]);
      });
  }, []);

  return {
    titleOptions: useMemo(() => toDropdownOptions(dynamicTitles), [dynamicTitles]),
    subcategoryPositionDropdownOptions: useMemo(
      () => toDropdownOptions(subcategoryPositionOptions),
      [subcategoryPositionOptions]
    ),
    employmentTermOptions: useMemo(
      () => toDropdownOptions(EMPLOYMENT_TERMS),
      []
    ),
    employmentTypeOptions: useMemo(
      () => toDropdownOptions(EMPLOYMENT_TYPES),
      []
    ),
    positionCategoryOptions: useMemo(
      () => toDropdownOptions(POSITION_CATEGORIES),
      []
    ),
    experienceOptions: useMemo(() => toDropdownOptions(EXPERIENCE_LEVELS), []),
    payrateTypeOptions: useMemo(() => toDropdownOptions(PAYRATE_TYPES), []),
  };
}
