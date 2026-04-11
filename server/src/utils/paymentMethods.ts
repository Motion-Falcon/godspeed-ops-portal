/** Jobseeker profile payment_method helpers (keep in sync with client hybridPayrollSplit). */

export function profileUsesCashDeduction(
  paymentMethod: string | undefined | null
): boolean {
  if (!paymentMethod) return false;
  return (
    paymentMethod === "Cash" ||
    paymentMethod === "e-Transfer" ||
    paymentMethod === "SIN and cash" ||
    paymentMethod === "SIN and e-Transfer"
  );
}

export function isHybridPaymentMethod(
  paymentMethod: string | undefined | null
): boolean {
  return (
    paymentMethod === "SIN and cash" ||
    paymentMethod === "SIN and e-Transfer"
  );
}
