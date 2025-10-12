export const JOB_TITLES = [
  "310S Mechanic",
  "Account Clerk",
  "Accounting Technician",
  "Accounts Receivable Specialist",
  "Admin Assistant",
  "Admin Coordinator / Support",
  "Administrative Roles (Various)",
  "Amazon Delivery Associate",
  "Analyst (AR/AP, Reporting, QA)",
  "Assembler",
  "Auditor",
  "AV Technician",
  "AZ Driver",
  "Bartender",
  "Basketball Coach/Official",
  "BBQ Station Attendant",
  "Bilingual Customer Service Representative",
  "Billing Clerk",
  "Blaster",
  "Blender / Blending Operator",
  "Blow Mold Operator",
  "Book Department Associate",
  "Boom DZ Driver",
  "Bottle Packer",
  "Business Analyst",
  "Cabinet Maker",
  "Car Cleaner / Shuttler",
  "Car Wash Attendant",
  "Cargo Handler",
  "Chef",
  "Cherry Picker Operator",
  "Class 1/3/5 Driver",
  "Cleaner / Janitor / Housekeeper",
  "CNC Machinist / Operator",
  "Counterbalance Operator",
  "Cuber",
  "Customer Service Representative (CSR)",
  "Data Entry Clerk",
  "Daycab Driver",
  "Decking Labourer",
  "Dishwasher",
  "Dispatch Supervisor / Dispatcher",
  "Dock Worker / Coordinator / Supervisor",
  "Draftsman / Estimator",
  "Driver Coordinator / Helper",
  "DZ Driver",
  "Engineer (Admin, Project, Process)",
  "Equipment Operator (F/L, Machine, Line)",
  "Feeder / Packer",
  "Filler Operator",
  "Fitter / Welder",
  "Foreman",
  "Forklift Operator",
  "Front Desk Manager",
  "G Class Driver",
  "Garment Sorter / Hanger / Inspector",
  "Gear Cutter",
  "General Helper / Labourer",
  "GL / Driver Helper",
  "Handler",
  "Handyman / Technician",
  "Health and Safety Manager",
  "Heavy Lifter / Packer",
  "HR (Coordinator, Support, Generalist)",
  "Industrial Painter",
  "Industrial Sewer",
  "Inspector / Quality Control",
  "Inventory Clerk / Specialist / Supervisor",
  "IT Tech Support",
  "Kitchen Associate",
  "Landscape Labourer",
  "Laser Cutter",
  "Lead Hand / Team Lead",
  "Licensed Mechanic (Truck/Coach, Millwright)",
  "Loader / Unloader",
  "Logistics Coordinator / Associate",
  "Low Voltage Technician",
  "Lumper",
  "Maintenance (Technician, Helper, Millwright)",
  "Material Handler",
  "Mig / TIG Welder",
  "Office Admin / Clerk / Worker",
  "Operations Support",
  "Order Picker / Preparer",
  "Orientation Facilitator",
  "Package / Parcel Handler",
  "Palletizer",
  "Payroll Administrator",
  "Permanent Position",
  "Photographer",
  "Powder Coater Painter",
  "Press Operator",
  "Production Associate (Aftn included)",
  "PSW (Personal Support Worker)",
  "Purchasing Coordinator",
  "QA Associate",
  "Raymond Reach Operator",
  "Receiver",
  "Receptionist",
  "Reimbursements Clerk",
  "Reno Run Driver",
  "Retail Associate / Material Handler",
  "Room Attendant",
  "Runner",
  "Sales Associate / Coordinator",
  "Sanitation Worker (Light / Heavy)",
  "Sawyer",
  "Scanner",
  "Seamstress",
  "Security",
  "Server / Service Agent",
  "Shipper / Receiver",
  "Shunt Driver",
  "Skilled Labourer / Trade",
  "Sorter",
  "Stacker Operator",
  "Stamp Operator",
  "Standby Worker",
  "Straight Truck Driver",
  "Subcontractor",
  "Supervisor",
  "Table Head",
  "TBNS (To Be Named Shift)",
  "Technician",
  "Tire Installer",
  "Training Coordinator",
  "Transportation Associate",
  "Walkie Rider Operator",
  "Warehouse Associate / Manager / Supervisor",
  "Weld Operator / Welder-Fitter",
  "Yard Cleaner / Coordinator",
] as const;

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
  "Direct Deposit",
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
export type JobTitle = (typeof JOB_TITLES)[number];
export type EmploymentTerm = (typeof EMPLOYMENT_TERMS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type PositionCategory = (typeof POSITION_CATEGORIES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type LicenseType = (typeof LICENSE_TYPES)[number];
export type PayrateType = (typeof PAYRATE_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];
export type PayCycle = (typeof PAY_CYCLES)[number];

export const LIST_NAMES = [
  "AA",
  "AB",
  "CANHIRE BRAMPTON",
  "CANHIRE LONDON",
  "KITCHENER",
  "PRONTO PRO",
  "SA",
  "SB",
  "SCARBOROUGH",
] as const;

export const USER_ROLES = [
  "admin",
  "recruiter",
  "manager",
  "accountant",
] as const;

export const STAFF_MEMBERS = [
  "Mansha Malik",
  "Amandeep Kaur",
  "Sumanpreet Kaur",
  "Mandeep Kaur",
  "Rishi Dhaliwal",
  "Yashpal Kaur",
  "Morgan Drouin",
  "Ajay",
  "Rahul Singh Rawat",
  "Vinayak",
  "Kirandeep Kaur",
  "Komal",
  "Vani Sreeram",
  "Hiral",
  "Rahul Sharma",
  "Samuel Jacob",
  "Sharmili",
  "Rajneet Kaur",
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
export type StaffMember = (typeof STAFF_MEMBERS)[number];
export type CanadianProvince = (typeof CANADIAN_PROVINCES)[number];
