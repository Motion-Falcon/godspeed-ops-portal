export const EMPLOYMENT_TERMS = ["Permanent", "Contract", "Temporary"] as const;

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Casual"] as const;

export const POSITION_CATEGORIES = [
  "Driver",
  "Warehouse",
  "Forklifter",
  "Office",
  "Management",
  "Sales",
  "Technician",
  "Other",
] as const;

export const EXPERIENCE_LEVELS = [
  "0-6 Months",
  "6-12 Months",
  "1-2 Years",
  "2-3 Years",
  "3-4 Years",
  "4-5 Years",
  "5+ Years",
] as const;

export const LICENSE_TYPES = [
  "None",
  "Forklifter",
  "G",
  "GZ",
  "DZ",
  "AZ",
  "Walk-in Operator",
  "Raymond Reach",
  "Crown Reach",
  "Auditor",
  "GL",
  "Clerk",
] as const;

export const PAYRATE_TYPES = [
  "Hourly",
  "Daily",
  "Monthly",
  "Salary",
  "Commission",
] as const;

export const PAYMENT_METHODS = [
  "Cash",
  "Corporation-Cheque",
  "Corporation-Direct Deposit",
  "e-Transfer",
  "SIN-Direct Deposit",
  "SIN and cash",
  "SIN and e-Transfer",
  "Cheque",
] as const;

export const PAYMENT_TERMS = [
  "Due on Receipt",
  "Net 15",
  "Net 22",
  "Net 30",
  "Net 45",
  "Net 60",
  "Net 65",
  "Net 90",
] as const;

export const PAY_CYCLES = [
  "1 Week Hold - Weekly Pay",
  "1 Week Hold - Biweekly Pay",
  "2 Week Hold - Weekly Pay",
  "2 Week Hold - Biweekly Pay",
] as const;

// Additional filter options that are used in various components
export const FILTER_OPTIONS = {
  employmentTypes: [
    { value: "all", label: "All Types" },
    { value: "Full-Time", label: "Full-Time" },
    { value: "Part-Time", label: "Part-Time" },
    { value: "Contract", label: "Contract" },
  ],
  positionCategories: [
    { value: "all", label: "All Categories" },
    { value: "Admin", label: "Admin" },
    { value: "AZ", label: "AZ Driver" },
    { value: "DZ", label: "DZ Driver" },
    { value: "General Labour", label: "General Labour" },
    { value: "Warehouse", label: "Warehouse" },
  ],
} as const;

// Type exports for TypeScript support
export type EmploymentTerm = (typeof EMPLOYMENT_TERMS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type PositionCategory = (typeof POSITION_CATEGORIES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type LicenseType = (typeof LICENSE_TYPES)[number];
export type PayrateType = (typeof PAYRATE_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];
export type PayCycle = (typeof PAY_CYCLES)[number];

export const USER_ROLES = [
  "admin",
  "recruiter",
  "bookkeeper",
  "recruiter_manager",
  "accountant_manager",
  "sales",
  "recruiter_director",
] as const;

export const CANADIAN_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YK", name: "Yukon" },
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type CanadianProvince = (typeof CANADIAN_PROVINCES)[number];
