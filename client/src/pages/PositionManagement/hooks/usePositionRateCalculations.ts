import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { PositionFormData } from "../positionCreateSchema";

export function usePositionRateCalculations(
  methods: UseFormReturn<PositionFormData>
) {
  useEffect(() => {
    let isCalculating = false;

    const subscription = methods.watch((value, { name, type }) => {
      if (isCalculating || type !== "change") return;
      if (value.isSubcategoryForm) return;

      const payRate = parseFloat(value.regularPayRate || "0");
      const markup = value.markup ? parseFloat(value.markup) : null;
      const billRate = value.billRate ? parseFloat(value.billRate) : null;

      isCalculating = true;

      try {
        if (
          name === "markup" &&
          payRate > 0 &&
          markup !== null &&
          !isNaN(markup)
        ) {
          const calculatedBillRate = payRate * (1 + markup / 100);
          methods.setValue("billRate", calculatedBillRate.toFixed(2), {
            shouldValidate: true,
          });
        } else if (
          name === "billRate" &&
          payRate > 0 &&
          billRate !== null &&
          !isNaN(billRate) &&
          billRate > 0
        ) {
          const calculatedMarkup = ((billRate - payRate) / payRate) * 100;
          methods.setValue("markup", calculatedMarkup.toFixed(2), {
            shouldValidate: false,
          });
        } else if (name === "regularPayRate" && payRate > 0) {
          if (markup !== null && !isNaN(markup)) {
            const calculatedBillRate = payRate * (1 + markup / 100);
            methods.setValue("billRate", calculatedBillRate.toFixed(2), {
              shouldValidate: true,
            });
          } else if (billRate !== null && !isNaN(billRate) && billRate > 0) {
            const calculatedMarkup = ((billRate - payRate) / payRate) * 100;
            methods.setValue("markup", calculatedMarkup.toFixed(2), {
              shouldValidate: false,
            });
          }
        }
      } finally {
        isCalculating = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [methods]);

  useEffect(() => {
    let isCalculating = false;
    const subscription = methods.watch((value, { name, type }) => {
      if (isCalculating || type !== "change") return;
      if (!value.isSubcategoryForm) return;
      const match = name?.match(
        /^subcategoryPositionDetails\.(\d+)\.(markup|billRate|regularPayRate)$/
      );
      if (!match) return;
      const idx = Number(match[1]);
      const field = match[2];
      const rows = value.subcategoryPositionDetails || [];
      const row = rows[idx];
      if (!row) return;
      const payRate = parseFloat(row.regularPayRate || "0");
      const markup = row.markup ? parseFloat(row.markup) : null;
      const billRate = row.billRate ? parseFloat(row.billRate) : null;

      isCalculating = true;
      try {
        const basePath = `subcategoryPositionDetails.${idx}` as const;
        if (
          field === "markup" &&
          payRate > 0 &&
          markup !== null &&
          !isNaN(markup)
        ) {
          const calculatedBillRate = payRate * (1 + markup / 100);
          methods.setValue(`${basePath}.billRate`, calculatedBillRate.toFixed(2), {
            shouldValidate: true,
          });
        } else if (
          field === "billRate" &&
          payRate > 0 &&
          billRate !== null &&
          !isNaN(billRate) &&
          billRate > 0
        ) {
          const calculatedMarkup = ((billRate - payRate) / payRate) * 100;
          methods.setValue(`${basePath}.markup`, calculatedMarkup.toFixed(2), {
            shouldValidate: false,
          });
        } else if (field === "regularPayRate" && payRate > 0) {
          if (markup !== null && !isNaN(markup)) {
            const calculatedBillRate = payRate * (1 + markup / 100);
            methods.setValue(`${basePath}.billRate`, calculatedBillRate.toFixed(2), {
              shouldValidate: true,
            });
          } else if (billRate !== null && !isNaN(billRate) && billRate > 0) {
            const calculatedMarkup = ((billRate - payRate) / payRate) * 100;
            methods.setValue(`${basePath}.markup`, calculatedMarkup.toFixed(2), {
              shouldValidate: false,
            });
          }
        }
      } finally {
        isCalculating = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [methods]);
}
