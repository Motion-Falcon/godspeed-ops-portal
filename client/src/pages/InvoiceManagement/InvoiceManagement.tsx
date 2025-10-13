import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import {
  Building,
  Calendar,
  DollarSign,
  FileText,
  User,
  Plus,
  Minus,
  Loader2,
  Download,
  CheckCircle,
  Eye,
  ClipboardList,
} from "lucide-react";
import { getClients, ClientData, getClient } from "../../services/api/client";
import {
  getClientPositions,
  getPositionAssignments,
  AssignmentRecord,
} from "../../services/api/position";
import { PAYMENT_TERMS } from "../../constants/formOptions";
import {
  InvoiceAttachments,
  AttachmentFile,
} from "../../components/InvoiceAttachments";
import "../../styles/pages/InvoiceManagement.css";
import "../../styles/components/InvoiceAttachments.css";
import {
  createInvoiceFromFrontendData,
  InvoiceData,
  generateInvoiceNumber,
  updateInvoiceDocument,
  updateInvoice,
  getInvoice,
  sendInvoiceEmail,
  getTimesheetsByClientAndDateRange,
  TimesheetFromAPI,
} from "../../services/api/invoice";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import { supabase } from "../../lib/supabaseClient";
import {
  generateInvoicePDF as generatePDF,
  InvoiceData as PDFInvoiceData,
} from "../../utils/pdfGenerator.tsx";
import { Document, Page, pdfjs } from "react-pdf";

// Interface for position data
interface ClientPosition {
  id: string;
  positionCode: string;
  positionNumber: string;
  title: string;
  regularPayRate: string;
  billRate: string;
  markup?: string;
}

// Interface for assigned jobseeker data
interface AssignedJobseeker {
  id?: string;
  positionCandidateAssignmentsId?: string;
  candidateId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  status: string;
  startDate: string;
  endDate?: string;
}

// Interface for invoice line items
interface InvoiceLineItem {
  id: string;
  position: ClientPosition | null;
  jobseeker: AssignedJobseeker | null;
  description: string;
  hours: string;
  regularBillRate: string;
  regularPayRate: string;
  salesTax: string;
}

// Interface for supplier/PO items
interface SupplierPOItem {
  id: string;
  selectedOption: string; // Combined supplier/PO selection
  supplierPoNumber: string;
}

// Sales tax options
const SALES_TAX_OPTIONS = [
  "5.00% [AB]",
  "5.00% [BC]",
  "13.00% [ON]",
  "14.975% [QC]",
  "0.00% [ZERO RATED]",
  "5.00% [QC]",
];

// Combined supplier and PO options - will be generated inside component with translation

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface TimesheetData {
  id: string;
  totalRegularHours: number;
  regularBillRate: number;
  regularPayRate: number;
  jobseekerProfile?: {
    firstName: string;
    lastName: string;
    email: string;
    jobseekerUserId?: string;
    jobseekerProfileId?: string;
    employeeId: string;
  };
  position?: {
    title: string;
    positionCode: string;
    positionId: string;
    positionNumber: string;
    positionCandidateAssignmentsId?: string;
  };
  description?: string;
  salesTax?: string;
}

export function InvoiceManagement() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();

  // Combined supplier and PO options with translation
  const COMBINED_OPTIONS = [
    {
      id: "supplier-no",
      type: "supplier",
      value: "Supplier No",
      label: t("invoiceManagement.supplierNo"),
    },
    {
      id: "po-no",
      type: "po",
      value: "PO No",
      label: t("invoiceManagement.poNo"),
    },
  ];

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // State for client selection
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // State for invoice number
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false);

  // State for position selection
  const [positions, setPositions] = useState<ClientPosition[]>([]);
  const [positionLoading, setPositionLoading] = useState(false);

  // State for jobseeker selection per position
  const [assignedJobseekersByPosition, setAssignedJobseekersByPosition] =
    useState<Record<string, AssignedJobseeker[]>>({});
  const [jobseekerLoadingByPosition, setJobseekerLoadingByPosition] = useState<
    Record<string, boolean>
  >({});

  // State for invoice details
  const [selectedTerms, setSelectedTerms] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  // State for date range to fetch timesheets
  const [timesheetStartDate, setTimesheetStartDate] = useState<string>("");
  const [timesheetEndDate, setTimesheetEndDate] = useState<string>("");
  const [isFetchingTimesheets, setIsFetchingTimesheets] = useState(false);
  const [timesheetFetchMessage, setTimesheetFetchMessage] =
    useState<string>("");

  // State for additional information
  const [messageOnInvoice, setMessageOnInvoice] = useState<string>(
    "We appreciate your business and look forward to helping you again soon."
  );
  const [termsOnInvoice, setTermsOnInvoice] = useState<string>(
    "Interest is payable at 24% annually after the agreed terms."
  );
  const [notes, setNotes] = useState<string>("");

  // State for line items
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // State for supplier/PO items
  const [supplierPOItems, setSupplierPOItems] = useState<SupplierPOItem[]>([]);

  // State for attachments
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  // State for invoice generation
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string>("");
  const [generationError, setGenerationError] = useState<string>("");
  // Add state for pdfBlobUrl
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  // Add state for showInvoiceSuccessModal and emailToSend
  const [showInvoiceSuccessModal, setShowInvoiceSuccessModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<InvoiceData | null>(
    null
  );
  // Add state for loaded invoice in edit/view mode
  const [loadedInvoice, setLoadedInvoice] = useState<InvoiceData | null>(null);
  const [emailToSend, setEmailToSend] = useState<string>("");
  const [emailUpdateMessage, setEmailUpdateMessage] = useState<string>("");

  // Add PDF preview state for modal
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);

  // Add state for sending invoice
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [sendInvoiceMessage, setSendInvoiceMessage] = useState<string>("");

  let sendInvoiceStatus;

  // Add after all useState hooks, before the return statement in InvoiceManagement
  const documentPath =
    createdInvoice?.documentPath || loadedInvoice?.documentPath || "";
  const documentFileName =
    createdInvoice?.documentFileName || loadedInvoice?.documentFileName || "";
  const documentFileSize =
    createdInvoice?.documentFileSize || loadedInvoice?.documentFileSize || 0;

  useEffect(() => {
    // Fetch clients on component mount
    fetchClients();

    // Set default invoice date to today (Canadian timezone)
    const today = new Date();
    // Convert to Canadian timezone and format as YYYY-MM-DD
    const canadianDateString = today.toLocaleDateString("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    setInvoiceDate(canadianDateString);

    // Initialize with one empty line item
    addLineItem();

    // Initialize with one empty supplier/PO item
    addSupplierPOItem();
  }, []);

  // Fetch positions when client is selected
  useEffect(() => {
    if (selectedClient) {
      fetchClientPositions(selectedClient.id!);
      // Reset line items when client changes
      setLineItems([]);
      addLineItem();

      // Reset supplier/PO items when client changes
      setSupplierPOItems([]);
      addSupplierPOItem();
    }
  }, [selectedClient]);

  // Update currency and terms when client is selected
  useEffect(() => {
    if (selectedClient) {
      // Only set terms from client if not in edit mode
      if (!isEditMode) {
        const clientTerms = selectedClient.terms || "Net 30";
        setSelectedTerms(clientTerms);

        // Calculate due date based on terms
        if (invoiceDate) {
          calculateDueDate(invoiceDate, clientTerms);
        }
      }
    }
  }, [selectedClient, invoiceDate, isEditMode]);

  useEffect(() => {
    if (showInvoiceSuccessModal && createdInvoice) {
      const emailToSet =
        createdInvoice.invoice_sent_to ||
        createdInvoice.client?.emailAddress1 ||
        selectedClient?.emailAddress1 ||
        "";
      console.log("Setting emailToSend:", {
        invoice_sent_to: createdInvoice.invoice_sent_to,
        client_email: createdInvoice.client?.emailAddress1,
        selected_client_email: selectedClient?.emailAddress1,
        final_email: emailToSet,
      });
      setEmailToSend(emailToSet);
    }
  }, [showInvoiceSuccessModal, createdInvoice, selectedClient?.emailAddress1]);

  const fetchClients = async () => {
    try {
      setClientLoading(true);
      const response = await getClients({ limit: 100000000 }); // Get all clients
      setClients(response.clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setClientLoading(false);
    }
  };

  const fetchClientPositions = async (clientId: string) => {
    try {
      setPositionLoading(true);
      const response = await getClientPositions(clientId, { limit: 10000000 });
      // Transform positions to match our interface
      const transformedPositions: ClientPosition[] = response.positions.map(
        (pos) => ({
          id: pos.id!,
          positionCode: pos.positionCode!,
          title: pos.title!,
          positionNumber: pos.positionNumber!,
          regularPayRate: pos.regularPayRate!,
          billRate: pos.billRate!,
          markup: pos.markup,
        })
      );
      setPositions(transformedPositions);
    } catch (error) {
      console.error("Error fetching client positions:", error);
      setPositions([]);
    } finally {
      setPositionLoading(false);
    }
  };

  const fetchPositionAssignments = async (positionId: string) => {
    try {
      setJobseekerLoadingByPosition((prev) => ({
        ...prev,
        [positionId]: true,
      }));
      const response = await getPositionAssignments(positionId);

      if (response.success && response.assignments) {
        // Transform assignments to match our interface
        const transformedJobseekers: AssignedJobseeker[] = response.assignments
          .filter((assignment) => assignment.jobseekerProfile) // Only include assignments with profile data
          .map((assignment: AssignmentRecord) => ({
            id: assignment.jobseekerProfile?.id,
            positionCandidateAssignmentsId: assignment.id,
            candidateId: assignment.candidate_id,
            firstName: assignment.jobseekerProfile?.first_name || "",
            lastName: assignment.jobseekerProfile?.last_name || "",
            email: assignment.jobseekerProfile?.email || "",
            mobile: assignment.jobseekerProfile?.mobile,
            status: assignment.status,
            startDate: assignment.start_date,
            endDate: assignment.end_date,
            employeeId: assignment.jobseekerProfile?.employee_id || "",
          }));

        setAssignedJobseekersByPosition((prev) => ({
          ...prev,
          [positionId]: transformedJobseekers,
        }));
      } else {
        setAssignedJobseekersByPosition((prev) => ({
          ...prev,
          [positionId]: [],
        }));
      }
    } catch (error) {
      console.error("Error fetching position assignments:", error);
      setAssignedJobseekersByPosition((prev) => ({
        ...prev,
        [positionId]: [],
      }));
    } finally {
      setJobseekerLoadingByPosition((prev) => ({
        ...prev,
        [positionId]: false,
      }));
    }
  };

  const calculateDueDate = (invoiceDate: string, terms: string) => {
    if (!invoiceDate || !terms) return;

    const startDate = new Date(invoiceDate);
    let dueDate = new Date(startDate);

    if (terms === "Due on Receipt") {
      // Same as invoice date
      dueDate = new Date(startDate);
    } else if (terms.startsWith("Net ")) {
      // Extract number of days from terms (e.g., "Net 15" -> 15)
      const days = parseInt(terms.replace("Net ", ""));
      if (!isNaN(days)) {
        dueDate.setDate(startDate.getDate() + days);
      }
    }

    setDueDate(dueDate.toISOString().split("T")[0]);
  };

  // Fetch and populate timesheets for the selected date range
  const fetchAndPopulateTimesheets = async () => {
    if (!selectedClient?.id) {
      setTimesheetFetchMessage(t("invoiceManagement.selectClientFirst"));
      return;
    }

    if (!timesheetStartDate || !timesheetEndDate) {
      setTimesheetFetchMessage(t("invoiceManagement.selectDateRange"));
      return;
    }

    setIsFetchingTimesheets(true);
    setTimesheetFetchMessage("");

    try {
      const response = await getTimesheetsByClientAndDateRange(
        selectedClient.id,
        timesheetStartDate,
        timesheetEndDate
      );

      if (
        !response.success ||
        !response.timesheets ||
        response.timesheets.length === 0
      ) {
        setTimesheetFetchMessage(t("invoiceManagement.noTimesheetsFound"));
        setIsFetchingTimesheets(false);
        return;
      }

      // Group timesheets by position and jobseeker to aggregate hours
      const groupedData: Record<
        string,
        {
          position: ClientPosition;
          jobseeker: AssignedJobseeker;
          totalHours: number;
          regularBillRate: number;
          regularPayRate: number;
          timesheetIds: string[];
          description: string;
        }
      > = {};

      response.timesheets.forEach((timesheet: TimesheetFromAPI) => {
        // Create a unique key for position + jobseeker combination
        const key = `${timesheet.positionId}_${timesheet.jobseekerProfileId}`;

        if (!groupedData[key]) {
          groupedData[key] = {
            position: {
              id: timesheet.position.id,
              positionCode: timesheet.position.positionCode,
              positionNumber: timesheet.position.positionNumber,
              title: timesheet.position.title,
              regularPayRate: timesheet.regularPayRate.toString(),
              billRate: timesheet.regularBillRate.toString(),
              markup: "0",
            },
            jobseeker: {
              id: timesheet.jobseekerProfileId,
              candidateId: timesheet.jobseekerUserId,
              firstName: timesheet.jobseekerProfile.firstName,
              lastName: timesheet.jobseekerProfile.lastName,
              email: timesheet.jobseekerProfile.email,
              employeeId: timesheet.jobseekerProfile.employeeId,
              status: "active",
              startDate: timesheet.weekStartDate,
              endDate: timesheet.weekEndDate,
            },
            totalHours: 0,
            regularBillRate: timesheet.regularBillRate,
            regularPayRate: timesheet.regularPayRate,
            timesheetIds: [],
            description: `Work period: ${new Date(
              timesheet.weekStartDate
            ).toLocaleDateString()} - ${new Date(
              timesheet.weekEndDate
            ).toLocaleDateString()}`,
          };
        }

        // Aggregate hours
        groupedData[key].totalHours += timesheet.totalRegularHours;
        groupedData[key].timesheetIds.push(timesheet.id);
      });

      // Convert grouped data to line items
      const newLineItems: InvoiceLineItem[] = Object.values(groupedData).map(
        (data, index) => ({
          id: `timesheet_${Date.now()}_${index}`,
          position: data.position,
          jobseeker: data.jobseeker,
          description: data.description,
          hours: data.totalHours.toString(),
          regularBillRate: data.regularBillRate.toString(),
          regularPayRate: data.regularPayRate.toString(),
          salesTax: "13.00% [ON]", // Default tax, can be changed by user
        })
      );

      // Update positions state with unique positions from timesheets
      const uniquePositions: ClientPosition[] = Array.from(
        new Set(response.timesheets.map((t) => t.position.id))
      )
        .map((positionId) => {
          const timesheet = response.timesheets.find(
            (t) => t.position.id === positionId
          );
          if (!timesheet) return null;
          return {
            id: timesheet.position.id,
            positionCode: timesheet.position.positionCode,
            positionNumber: timesheet.position.positionNumber,
            title: timesheet.position.title,
            regularPayRate: timesheet.regularPayRate.toString(),
            billRate: timesheet.regularBillRate.toString(),
            markup: "0",
          } as ClientPosition;
        })
        .filter((p): p is ClientPosition => p !== null);

      // Update positions if not already present
      setPositions((prevPositions) => {
        const existingIds = new Set(prevPositions.map((p) => p.id));
        const newPositions = uniquePositions.filter(
          (p) => p && !existingIds.has(p.id)
        );
        return [...prevPositions, ...newPositions];
      });

      // Populate jobseeker data for each position
      const jobseekersByPosition: Record<string, AssignedJobseeker[]> = {};
      response.timesheets.forEach((timesheet) => {
        if (!jobseekersByPosition[timesheet.position.id]) {
          jobseekersByPosition[timesheet.position.id] = [];
        }

        // Check if jobseeker already exists for this position
        const exists = jobseekersByPosition[timesheet.position.id].some(
          (js) => js.id === timesheet.jobseekerProfileId
        );

        if (!exists) {
          jobseekersByPosition[timesheet.position.id].push({
            id: timesheet.jobseekerProfileId,
            candidateId: timesheet.jobseekerUserId,
            firstName: timesheet.jobseekerProfile.firstName,
            lastName: timesheet.jobseekerProfile.lastName,
            email: timesheet.jobseekerProfile.email,
            employeeId: timesheet.jobseekerProfile.employeeId,
            status: "active",
            startDate: timesheet.weekStartDate,
            endDate: timesheet.weekEndDate,
          });
        }
      });

      setAssignedJobseekersByPosition((prev) => ({
        ...prev,
        ...jobseekersByPosition,
      }));

      // Replace existing line items with new ones
      setLineItems(newLineItems);

      setTimesheetFetchMessage(
        `${t("invoiceManagement.timesheetsLoaded")}: ${newLineItems.length} ${t(
          "invoiceManagement.lineItems"
        )}`
      );
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      setTimesheetFetchMessage(
        error instanceof Error
          ? error.message
          : t("invoiceManagement.fetchTimesheetsFailed")
      );
    } finally {
      setIsFetchingTimesheets(false);
    }
  };

  // Line item management functions
  const addLineItem = () => {
    const newLineItem: InvoiceLineItem = {
      id: Date.now().toString(),
      position: null,
      jobseeker: null,
      description: "",
      hours: "",
      regularBillRate: "",
      regularPayRate: "",
      salesTax: "13.00% [ON]", // Default to Ontario
    };
    setLineItems((prev) => [...prev, newLineItem]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, updates: Partial<InvoiceLineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Supplier/PO management functions
  const addSupplierPOItem = () => {
    const newSupplierPOItem: SupplierPOItem = {
      id: Date.now().toString(),
      selectedOption: "",
      supplierPoNumber: "",
    };
    setSupplierPOItems((prev) => [...prev, newSupplierPOItem]);
  };

  const removeSupplierPOItem = (id: string) => {
    if (supplierPOItems.length > 1) {
      setSupplierPOItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const updateSupplierPOItem = (
    id: string,
    updates: Partial<SupplierPOItem>
  ) => {
    setSupplierPOItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Convert data to dropdown options
  const clientOptions: DropdownOption[] = clients.map((client) => ({
    id: client.id!,
    label: client.companyName || t("invoiceManagement.unknownClient"),
    sublabel: client.shortCode || "",
    value: client,
  }));

  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id,
    label: position.title || t("invoiceManagement.unknownPosition"),
    sublabel: position.positionCode || "",
    value: position,
  }));

  const getJobseekerOptions = (positionId: string): DropdownOption[] => {
    const jobseekers = assignedJobseekersByPosition[positionId] || [];
    return jobseekers.map((jobseeker) => ({
      id: jobseeker.candidateId,
      label:
        `${jobseeker.firstName} ${jobseeker.lastName}`.trim() ||
        t("invoiceManagement.unknown"),
      sublabel: jobseeker.email,
      value: jobseeker,
    }));
  };

  const salesTaxOptions: DropdownOption[] = SALES_TAX_OPTIONS.map((tax) => ({
    id: tax,
    label: tax,
    value: tax,
  }));

  const termsOptions: DropdownOption[] = PAYMENT_TERMS.map((term) => ({
    id: term,
    label: term,
    value: term,
  }));

  const selectedClientOption = selectedClient
    ? clientOptions.find((opt) => opt.id === selectedClient.id)
    : null;

  const selectedTermsOption = selectedTerms
    ? termsOptions.find((opt) => opt.value === selectedTerms)
    : null;

  // Function to generate invoice number
  const generateAndSetInvoiceNumber = async () => {
    setInvoiceNumberLoading(true);
    try {
      const newInvoiceNumber = await generateInvoiceNumber();
      setInvoiceNumber(newInvoiceNumber);
    } catch (error) {
      setGenerationError(
        "Failed to generate invoice number. Please try again."
      );
    } finally {
      setInvoiceNumberLoading(false);
    }
  };

  const handleClientSelect = async (
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const basicClient = option.value as ClientData;
    setSelectedClient(basicClient);
    setClientLoading(true);
    setGenerationError("");

    try {
      // Fetch detailed client data using the proper API function
      const detailedClient = await getClient(basicClient.id!);

      setSelectedClient(detailedClient);

      // Auto-select terms from client data if available
      if (detailedClient.terms) {
        setSelectedTerms(detailedClient.terms);
      }

      // Only generate invoice number when not in edit mode
      if (!isEditMode) {
        generateAndSetInvoiceNumber();
      }
    } catch (error) {
      console.error("Error fetching detailed client data:", error);

      // Fallback to basic client data but ensure all required fields are present
      const fallbackClient = {
        id: basicClient.id,
        companyName: basicClient.companyName || "",
        shortCode: basicClient.shortCode || "",
        emailAddress1: basicClient.emailAddress1 || "",
        emailAddress2: basicClient.emailAddress2,
        contactPersonName1: basicClient.contactPersonName1,
        contactPersonName2: basicClient.contactPersonName2,
        mobile1: basicClient.mobile1,
        mobile2: basicClient.mobile2,
        city1: basicClient.city1,
        province1: basicClient.province1,
        postalCode1: basicClient.postalCode1,
        preferredPaymentMethod: basicClient.preferredPaymentMethod,
        payCycle: basicClient.payCycle,
        terms: basicClient.terms || "Net 30",
        currency: basicClient.currency || "CAD",
        clientManager: basicClient.clientManager,
        accountingPerson: basicClient.accountingPerson,
        salesPerson: basicClient.salesPerson,
      };

      setSelectedClient(fallbackClient);

      // Only generate invoice number when not in edit mode
      if (!isEditMode) {
        generateAndSetInvoiceNumber();
      }

      setGenerationError(
        "Warning: Could not fetch complete client details. Some information may be missing."
      );
    } finally {
      setClientLoading(false);
    }
  };

  const handleTermsSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    const terms = option.value as string;
    setSelectedTerms(terms);
    calculateDueDate(invoiceDate, terms);
  };

  const handleInvoiceDateChange = (date: string) => {
    setInvoiceDate(date);
  };

  const handleDueDateChange = (date: string) => {
    setDueDate(date);
  };

  const handleInvoiceDateClick = () => {
    const input = document.getElementById(
      "invoice-date-input"
    ) as HTMLInputElement;
    if (input) {
      input.showPicker?.();
    }
  };

  const handleDueDateClick = () => {
    const input = document.getElementById("due-date-input") as HTMLInputElement;
    if (input) {
      input.showPicker?.();
    }
  };

  const handlePositionSelect = (
    lineItemId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const position = option.value as ClientPosition;
    updateLineItem(lineItemId, {
      position,
      jobseeker: null, // Reset jobseeker when position changes
      regularBillRate: position.billRate, // Auto-fill rate from position
      regularPayRate: position.regularPayRate, // Auto-fill rate from position
    });

    // Fetch jobseekers for this position if not already fetched
    if (!assignedJobseekersByPosition[position.id]) {
      fetchPositionAssignments(position.id);
    }
  };

  const handleJobseekerSelect = (
    lineItemId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const jobseeker = option.value as AssignedJobseeker;
    updateLineItem(lineItemId, { jobseeker });
  };

  const handleSalesTaxSelect = (
    lineItemId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const salesTax = option.value as string;
    updateLineItem(lineItemId, { salesTax });
  };

  // Combined supplier/PO dropdown options
  const combinedOptions: DropdownOption[] = COMBINED_OPTIONS.map((item) => ({
    id: item.value,
    label: item.label,
    sublabel:
      item.type === "supplier" ? "Supplier Number" : "Purchase Order Number",
    value: item.value,
  }));

  // Combined option handler
  const handleCombinedOptionSelect = (
    supplierPOId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const selectedValue = option.value as string;
    updateSupplierPOItem(supplierPOId, { selectedOption: selectedValue });
  };

  const handleSupplierPONumberChange = (
    supplierPOId: string,
    value: string
  ) => {
    updateSupplierPOItem(supplierPOId, { supplierPoNumber: value });
  };

  // Helper function to determine tax types based on sales tax selection
  const getTaxInfo = (salesTax: string) => {
    // Extract province from the sales tax string (e.g., "13.00% [ON]" -> "ON")
    const provinceMatch = salesTax.match(/\[([^\]]+)\]/);
    const province = provinceMatch ? provinceMatch[1] : "";

    // Extract tax percentage
    const taxMatch = salesTax.match(/(\d+\.?\d*)%/);
    const totalTaxPercentage = taxMatch ? parseFloat(taxMatch[1]) : 0;

    // Determine tax type and breakdown
    if (province === "ON" || province === "ZERO RATED") {
      // HST for Ontario and Zero Rated
      return {
        taxType: "HST",
        hstPercentage: totalTaxPercentage,
        gstPercentage: 0,
        qstPercentage: 0,
        totalTaxPercentage,
      };
    } else if (province === "QC" && totalTaxPercentage === 14.975) {
      // GST + QST for Quebec (14.975% = 5% GST + 9.975% QST)
      return {
        taxType: "GST_QST",
        hstPercentage: 0,
        gstPercentage: 5,
        qstPercentage: 9.975,
        totalTaxPercentage,
      };
    } else {
      // GST for all other provinces (AB, BC, QC 5%)
      return {
        taxType: "GST",
        hstPercentage: 0,
        gstPercentage: totalTaxPercentage,
        qstPercentage: 0,
        totalTaxPercentage,
      };
    }
  };

  // Calculate line item totals helper function
  const calculateLineItemTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    let totalHST = 0;
    let totalGST = 0;
    let totalQST = 0;

    const lineItemTotals = lineItems.map((item) => {
      const hours = parseFloat(item.hours) || 0;
      const regularBillRate = parseFloat(item.regularBillRate) || 0;
      const lineSubtotal = hours * regularBillRate;

      const taxInfo = getTaxInfo(item.salesTax);
      const lineTax = (lineSubtotal * taxInfo.totalTaxPercentage) / 100;
      const lineHST = (lineSubtotal * taxInfo.hstPercentage) / 100;
      const lineGST = (lineSubtotal * taxInfo.gstPercentage) / 100;
      const lineQST = (lineSubtotal * taxInfo.qstPercentage) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      totalTax += lineTax;
      totalHST += lineHST;
      totalGST += lineGST;
      totalQST += lineQST;

      return {
        ...item,
        lineSubtotal,
        lineTax,
        lineHST,
        lineGST,
        lineQST,
        lineTotal,
        taxInfo,
      };
    });

    const grandTotal = subtotal + totalTax;

    return {
      lineItemTotals,
      subtotal,
      totalTax,
      totalHST,
      totalGST,
      totalQST,
      grandTotal,
    };
  };

  // Generate/Update invoice function
  const handleInvoiceSubmit = async () => {
    if (!selectedClient || lineItems.length === 0) {
      setGenerationError(t("invoiceManagement.missingClientAndLineItems"));
      return;
    }

    if (!invoiceNumber) {
      setGenerationError(t("invoiceManagement.missingInvoiceNumber"));
      return;
    }

    // Check if at least one line item has hours > 0
    const hasValidLineItems = lineItems.some(
      (item) =>
        parseFloat(item.hours) > 0 && parseFloat(item.regularBillRate) > 0
    );
    lineItems.forEach((item, index) => {
      console.log(`Item ${index}:`, {
        hours: item.hours,
        regularBillRate: item.regularBillRate,
        regularPayRate: item.regularPayRate,
        hoursFloat: parseFloat(item.hours),
        regularBillRateFloat: parseFloat(item.regularBillRate),
        regularPayRateFloat: parseFloat(item.regularPayRate),
        valid: parseFloat(item.hours) > 0 && parseFloat(item.regularBillRate),
      });
    });

    if (!hasValidLineItems) {
      setGenerationError(
        "At least one line item must have hours and rate greater than 0"
      );
      return;
    }

    const missingFields = [];
    if (!selectedClient.id) missingFields.push("ID");
    if (!selectedClient.companyName) missingFields.push("company name");
    if (!selectedClient.shortCode) missingFields.push("short code");
    if (!selectedClient.emailAddress1) missingFields.push("email");

    if (missingFields.length > 0) {
      const errorMessage = `Selected client is missing required information: ${missingFields.join(
        ", "
      )}`;
      setGenerationError(errorMessage);
      return;
    }

    // Check for attachment upload status before proceeding
    if (attachments.some((att) => att.uploadStatus === "uploading")) {
      setGenerationError(
        "Please wait for all attachments to finish uploading."
      );
      return;
    }
    if (attachments.some((att) => att.uploadStatus === "error")) {
      setGenerationError(
        "One or more attachments failed to upload. Please remove or re-upload them before " +
          (isEditMode ? "updating" : "generating") +
          " the invoice."
      );
      return;
    }
    setIsGeneratingInvoice(true);
    setGenerationMessage("");
    setGenerationError("");

    try {
      if (!user || !user.id) {
        setGenerationError("User not authenticated. Please log in again.");
        return;
      }
      // Calculate totals for the invoice
      const {
        lineItemTotals,
        subtotal,
        totalTax,
        totalHST,
        totalGST,
        totalQST,
        grandTotal,
      } = calculateLineItemTotals();

      // Upload attachments after PDF generation succeeds
      const uploadedAttachments = await uploadAttachments();

      let result;
      let pdfInvoiceId: string;
      let pdfInvoiceNumber: string;

      if (isEditMode && editingInvoiceId) {
        // Update existing invoice
        const updateData = {
          clientId: selectedClient.id!,
          invoiceDate: invoiceDate,
          dueDate: dueDate,
          status: "draft" as const,
          currency: selectedClient.currency || "CAD",
          paymentTerms: selectedTerms,
          subtotal: subtotal,
          totalTax: totalTax,
          totalHst: totalHST,
          totalGst: totalGST,
          totalQst: totalQST,
          grandTotal: grandTotal,
          totalHours: lineItems.reduce(
            (total, item) => total + (parseFloat(item.hours) || 0),
            0
          ),
          notes: notes,
          invoiceData: {
            client: {
              id: selectedClient.id!,
              companyName: selectedClient.companyName!,
              shortCode: selectedClient.shortCode!,
              emailAddress1: selectedClient.emailAddress1!,
              city1: selectedClient.city1,
              province1: selectedClient.province1,
              postalCode1: selectedClient.postalCode1,
              clientManager: selectedClient.clientManager,
              accountingPerson: selectedClient.accountingPerson,
              salesPerson: selectedClient.salesPerson,
            },
            timesheets: lineItems.map((item) => ({
              id: item.id,
              position: item.position
                ? {
                    title: item.position.title,
                    positionId: item.position.id,
                    positionCode: item.position.positionCode,
                    positionCandidateAssignmentsId:
                      item.jobseeker?.positionCandidateAssignmentsId,
                    positionNumber: item.position.positionNumber,
                  }
                : undefined,
              salesTax: item.salesTax,
              description: item.description,
              weekEndDate: dueDate,
              invoiceNumber: invoiceNumber,
              weekStartDate: invoiceDate,
              regularBillRate: parseFloat(item.regularBillRate) || 0,
              regularPayRate: parseFloat(item.regularPayRate) || 0,
              totalClientBill:
                (parseFloat(item.hours) || 0) *
                (parseFloat(item.regularBillRate) || 0),
              totalJobseekerPay:
                (parseFloat(item.hours) || 0) *
                (parseFloat(item.regularPayRate) || 0),
              jobseekerProfile: item.jobseeker
                ? {
                    email: item.jobseeker.email,
                    lastName: item.jobseeker.lastName,
                    firstName: item.jobseeker.firstName,
                    jobseekerUserId: item.jobseeker.candidateId,
                    jobseekerProfileId: item.jobseeker.id,
                    employeeId: item.jobseeker.employeeId,
                  }
                : undefined,
              totalRegularHours: parseFloat(item.hours) || 0,
            })),
            supplierPOItems: supplierPOItems,
            attachments: uploadedAttachments,
            messageOnInvoice: messageOnInvoice,
            termsOnInvoice: termsOnInvoice,
            paymentTerms: selectedTerms,
            // summary and document are intentionally omitted
          },
        };

        result = await updateInvoice(editingInvoiceId, updateData);
        pdfInvoiceId = editingInvoiceId;
        pdfInvoiceNumber = invoiceNumber;
      } else {
        // Create new invoice
        const invoiceApiData = {
          client: {
            id: selectedClient.id!,
            companyName: selectedClient.companyName!,
            shortCode: selectedClient.shortCode!,
            emailAddress1: selectedClient.emailAddress1!,
            city1: selectedClient.city1,
            province1: selectedClient.province1,
            postalCode1: selectedClient.postalCode1,
            clientManager: selectedClient.clientManager,
            accountingPerson: selectedClient.accountingPerson,
            salesPerson: selectedClient.salesPerson,
          },
          invoiceNumber: invoiceNumber,
          invoiceDate: invoiceDate,
          dueDate: dueDate,
          status: "draft" as const,
          currency: selectedClient.currency || "CAD",
          paymentTerms: selectedTerms,
          timesheets: lineItemTotals.map((item) => ({
            id: item.id,
            invoiceNumber: invoiceNumber,
            weekStartDate: invoiceDate, // Using invoice date as reference
            weekEndDate: dueDate, // Using due date as reference
            totalRegularHours: parseFloat(item.hours) || 0,
            regularBillRate: parseFloat(item.regularBillRate) || 0,
            regularPayRate: parseFloat(item.regularPayRate) || 0,
            totalClientBill:
              (parseFloat(item.hours) || 0) *
              (parseFloat(item.regularBillRate) || 0),
            totalJobseekerPay:
              (parseFloat(item.hours) || 0) *
              (parseFloat(item.regularPayRate) || 0),
            description: item.description, // Add description field
            salesTax: item.salesTax, // Add salesTax field
            jobseekerProfile: item.jobseeker
              ? {
                  firstName: item.jobseeker.firstName,
                  lastName: item.jobseeker.lastName,
                  email: item.jobseeker.email,
                  jobseekerUserId: item.jobseeker.candidateId,
                  jobseekerProfileId: item.jobseeker.id,
                  employeeId: item.jobseeker.employeeId,
                }
              : {
                  firstName: "N/A",
                  lastName: "N/A",
                  email: "N/A",
                },
            position: item.position
              ? {
                  title: item.position.title,
                  positionCode: item.position.positionCode,
                  positionId: item.position.id,
                  positionCandidateAssignmentsId:
                    item.jobseeker?.positionCandidateAssignmentsId,
                  positionNumber: item.position.positionNumber,
                }
              : {
                  title: item.description || "Custom Line Item",
                  positionCode: "CUSTOM",
                },
          })),
          attachments: uploadedAttachments,
          supplierPOItems: supplierPOItems,
          messageOnInvoice: messageOnInvoice,
          termsOnInvoice: termsOnInvoice,
          subtotal: subtotal,
          totalTax: totalTax,
          totalHst: totalHST,
          totalGst: totalGST,
          totalQst: totalQST,
          grandTotal: grandTotal,
          totalHours: lineItems.reduce(
            (total, item) => total + (parseFloat(item.hours) || 0),
            0
          ),
          notes: notes,
          emailSent: false,
          emailSentDate: undefined,
          // summary and document are intentionally omitted
        };

        // Log the data being sent to API
        console.log("=== INVOICE DATA BEING SENT TO API ===");
        console.log(
          "Invoice API Data:",
          JSON.stringify(invoiceApiData, null, 2)
        );
        console.log("=== END API DATA ===");

        // Call the API to create the invoice
        result = await createInvoiceFromFrontendData(invoiceApiData);
        pdfInvoiceId = result.invoice.id || "";
        pdfInvoiceNumber = result.invoice.invoiceNumber || "";
      }

      // Generate the PDF Blob
      const pdfData: PDFInvoiceData = {
        invoiceNumber: pdfInvoiceNumber,
        invoiceDate: invoiceDate,
        dueDate: dueDate,
        client: {
          companyName: selectedClient.companyName || "",
          address: [
            selectedClient.city1 || "",
            selectedClient.province1 || "",
            selectedClient.postalCode1 || "",
          ].filter(Boolean),
          email: selectedClient.emailAddress1,
        },
        lineItems: lineItems.map((item) => ({
          positionName: item.position?.title,
          description: item.description,
          candidate: item.jobseeker
            ? `${item.jobseeker.firstName} ${item.jobseeker.lastName}`
            : undefined,
          hours: parseFloat(item.hours) || 0,
          rate: parseFloat(item.regularBillRate) || 0,
          taxType: item.salesTax,
          amount:
            (parseFloat(item.hours) || 0) *
            (parseFloat(item.regularBillRate) || 0),
        })),
        summary: {
          subtotal: subtotal,
          totalHST: totalHST,
          totalGST: totalGST,
          totalQST: totalQST,
          totalTax: totalTax,
          grandTotal: grandTotal,
          totalHours: lineItems.reduce(
            (total, item) => total + (parseFloat(item.hours) || 0),
            0
          ),
          hstPercentage:
            lineItems.length > 0
              ? getTaxInfo(lineItems[0].salesTax).hstPercentage
              : 0,
          gstPercentage:
            lineItems.length > 0
              ? getTaxInfo(lineItems[0].salesTax).gstPercentage
              : 0,
          qstPercentage:
            lineItems.length > 0
              ? getTaxInfo(lineItems[0].salesTax).qstPercentage
              : 0,
        },
        dateRange: {
          startDate: invoiceDate,
          endDate: dueDate,
        },
        terms: selectedTerms,
        messageOnInvoice: messageOnInvoice,
        termsOnInvoice: termsOnInvoice,
      };
      const pdfBlob = await generatePDF(pdfData);
      const pdfObjectUrl = URL.createObjectURL(pdfBlob);
      setPdfBlobUrl(pdfObjectUrl);

      // Upload PDF to Supabase Storage
      const safeCompanyName = selectedClient.companyName
        ? selectedClient.companyName.replace(/\s+/g, "_")
        : "";
      const pdfFileName = `Invoice_${pdfInvoiceNumber}_${safeCompanyName}.pdf`;
      const pdfPath = `${user.id}/${pdfInvoiceNumber}/documents/${pdfFileName}`;
      const { data: pdfUploadData, error: pdfUploadError } =
        await supabase.storage.from("invoices").upload(pdfPath, pdfBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "application/pdf",
        });
      if (pdfUploadError || !pdfUploadData || !pdfUploadData.path) {
        setGenerationError("Failed to upload invoice PDF. Please try again.");
        return;
      }

      // Update invoice record with PDF metadata (document PATCH route)
      await updateInvoiceDocument(pdfInvoiceId, {
        documentPath: pdfUploadData.path || "",
        documentFileName: pdfFileName,
        documentFileSize: pdfBlob.size,
        documentGeneratedAt: new Date().toISOString(),
        documentGenerated: true,
        documentMimeType: "application/pdf",
      });

      // Only use the new message for PDF upload success
      const actionText = isEditMode ? "updated" : "created";
      const message = `Invoice ${pdfInvoiceNumber} ${actionText} and PDF uploaded successfully for ${selectedClient.companyName}.`;
      setGenerationMessage(message);

      // Set created invoice and email states after successful invoice creation/upload
      setCreatedInvoice(result.invoice);
      const emailToSet =
        result.invoice.invoice_sent_to ||
        result.invoice.client?.emailAddress1 ||
        selectedClient?.emailAddress1 ||
        "";
      console.log("Setting emailToSend in handleInvoiceSubmit:", {
        invoice_sent_to: result.invoice.invoice_sent_to,
        client_email: result.invoice.client?.emailAddress1,
        selected_client_email: selectedClient?.emailAddress1,
        final_email: emailToSet,
      });
      setEmailToSend(emailToSet);
      setShowInvoiceSuccessModal(true);
    } catch (error) {
      console.error(
        "Error " + (isEditMode ? "updating" : "creating") + " invoice:",
        error
      );
      setGenerationError(
        error instanceof Error
          ? error.message
          : isEditMode
          ? t("invoiceManagement.updateInvoiceFailed")
          : t("invoiceManagement.createInvoiceFailed")
      );
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Helper function to upload attachments
  const uploadAttachments = async () => {
    if (!attachments.length) return [];

    const updatedAttachments = [...attachments];
    const uploadedAttachments = [];

    for (const attachment of updatedAttachments) {
      if (attachment.file && !attachment.isUploaded) {
        // Set status to uploading
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachment.id
              ? { ...att, uploadStatus: "uploading" }
              : att
          )
        );
        try {
          // Create a unique filename to avoid conflicts
          const timestamp = Date.now();
          const fileExtension = attachment.file.name.split(".").pop();
          const fileNameWithoutExt = attachment.file.name.replace(
            /\.[^/.]+$/,
            ""
          );
          const uniqueFileName = `${fileNameWithoutExt}_${timestamp}.${fileExtension}`;
          const filePath = `${user?.id}/${invoiceNumber}/attachments/${uniqueFileName}`;
          // Upload to Supabase Storage with upsert enabled to handle duplicates
          const { data, error } = await supabase.storage
            .from("invoices")
            .upload(filePath, attachment.file, {
              cacheControl: "3600",
              upsert: true, // Allow overwriting existing files
            });
          if (error) {
            console.error("Error uploading file:", error);
            // Set status to error
            setAttachments((prev) =>
              prev.map((att) =>
                att.id === attachment.id
                  ? { ...att, uploadStatus: "error" }
                  : att
              )
            );
            throw new Error(
              `Failed to upload ${attachment.fileName}: ${error.message}`
            );
          }
          // Add to uploaded attachments list
          uploadedAttachments.push({
            fileName: attachment.fileName,
            fileSize: attachment.fileSize,
            fileType: attachment.fileType,
            uploadStatus: "uploaded",
            filePath: data.path,
            bucketName: "invoices",
          });
          // Update attachment state to show as uploaded
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === attachment.id
                ? {
                    ...att,
                    isUploaded: true,
                    filePath: data.path,
                    uploadStatus: "uploaded",
                  }
                : att
            )
          );
        } catch (error) {
          console.error("Error uploading attachment:", error);
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === attachment.id ? { ...att, uploadStatus: "error" } : att
            )
          );
          throw error;
        }
      } else if (attachment.isUploaded && attachment.filePath) {
        // Already uploaded, just add to list
        uploadedAttachments.push({
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          fileType: attachment.fileType,
          uploadStatus: "uploaded",
          filePath: attachment.filePath,
          bucketName: "invoices",
        });
      }
    }
    return uploadedAttachments;
  };

  // Add PDF preview state for modal
  const onPdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPdfNumPages(numPages);
    setPdfPageNumber(1);
  };
  const goToPrevPage = () => setPdfPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () =>
    setPdfPageNumber((prev) => Math.min(prev + 1, pdfNumPages || 1));
  const zoomIn = () => setPdfScale((prev) => Math.min(prev + 0.1, 2.0));
  const zoomOut = () => setPdfScale((prev) => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setPdfScale(1.0);

  // Function to send invoice to client
  async function sendInvoiceToClient() {
    if (!createdInvoice?.id || !emailToSend) {
      setSendInvoiceMessage(t("invoiceManagement.missingEmailForSend"));
      return;
    }

    setIsSendingInvoice(true);
    setSendInvoiceMessage("");

    try {
      console.log("=== SENDING INVOICE TO CLIENT ===");
      console.log("Invoice ID:", createdInvoice.id);
      console.log("Email to send:", emailToSend);

      // Call the new API to send the invoice email
      const response = await sendInvoiceEmail(createdInvoice.id, emailToSend);

      if (response.success) {
        setSendInvoiceMessage(`Invoice sent successfully to ${emailToSend}`);
        // Optionally, you could refetch the invoice or update local state
      } else {
        throw new Error(
          response.message || t("invoiceManagement.sendInvoiceFailed")
        );
      }
    } catch (err) {
      console.error("Error sending invoice:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to send invoice. Please try again.";
      setSendInvoiceMessage(errorMessage);
    } finally {
      setIsSendingInvoice(false);
    }
  }

  // Add download handler for invoice PDF
  function handleDownloadInvoice() {
    if (!pdfBlobUrl || !createdInvoice?.invoiceNumber) return;
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `Invoice_${createdInvoice.invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Fetch existing invoice data for editing
  const fetchInvoiceForEdit = async (invoiceId: string) => {
    try {
      const invoiceData = await getInvoice(invoiceId);

      // Populate form with existing data
      setInvoiceNumber(invoiceData.invoiceNumber || "");
      setInvoiceDate(invoiceData.invoiceDate);
      setDueDate(invoiceData.dueDate);
      setMessageOnInvoice(
        (invoiceData.invoiceData?.messageOnInvoice as string) || ""
      );
      setTermsOnInvoice(
        (invoiceData.invoiceData?.termsOnInvoice as string) || ""
      );
      setNotes(invoiceData.notes || "");

      // Set client data
      if (invoiceData.clientId) {
        const clientData = await getClient(invoiceData.clientId);

        setSelectedClient(clientData);

        // Prefer paymentTerms from invoiceData.invoiceData if present
        if (invoiceData.invoiceData?.paymentTerms) {
          setSelectedTerms(invoiceData.invoiceData.paymentTerms as string);
        } else {
          setSelectedTerms(clientData.terms || "Net 30");
        }

        // Fetch positions for this client
        await fetchClientPositions(invoiceData.clientId);
      }

      // Set line items from invoiceData.invoiceData.timesheets (not lineItems)
      if (
        invoiceData.invoiceData?.timesheets &&
        Array.isArray(invoiceData.invoiceData.timesheets)
      ) {
        const mappedLineItems: InvoiceLineItem[] = (
          invoiceData.invoiceData.timesheets as TimesheetData[]
        ).map((timesheet: TimesheetData) => {
          // Map position data
          const position: ClientPosition | null = timesheet.position
            ? {
                id: timesheet.position.positionId,
                positionCode: timesheet.position.positionCode,
                title: timesheet.position.title,
                regularPayRate: timesheet.regularPayRate.toString(),
                billRate: timesheet.regularBillRate.toString(),
                markup: "0",
                positionNumber: timesheet.position.positionNumber,
              }
            : null;

          // Map jobseeker data
          const jobseeker: AssignedJobseeker | null = timesheet.jobseekerProfile
            ? {
                id: timesheet.jobseekerProfile.jobseekerProfileId,
                positionCandidateAssignmentsId:
                  timesheet.position?.positionCandidateAssignmentsId,
                candidateId: timesheet.jobseekerProfile.jobseekerUserId || "",
                firstName: timesheet.jobseekerProfile.firstName,
                lastName: timesheet.jobseekerProfile.lastName,
                email: timesheet.jobseekerProfile.email,
                mobile: "",
                status: "active",
                startDate: "",
                endDate: "",
                employeeId: timesheet.jobseekerProfile.employeeId,
              }
            : null;

          return {
            id:
              timesheet.id ||
              Date.now().toString() + Math.random().toString(36).substr(2, 9),
            position: position,
            jobseeker: jobseeker,
            description: timesheet.description || "",
            hours: timesheet.totalRegularHours.toString(),
            regularBillRate: timesheet.regularBillRate.toString(),
            regularPayRate: timesheet.regularPayRate.toString(),
            salesTax: timesheet.salesTax || "13.00% [ON]",
          };
        });
        setLineItems(mappedLineItems);

        // Ensure jobseeker dropdowns are populated for each position in loaded line items
        const uniquePositionIds = [
          ...new Set(
            mappedLineItems
              .map((item) => item.position?.id)
              .filter((id): id is string => !!id)
          ),
        ];
        uniquePositionIds.forEach((positionId) => {
          if (positionId && !assignedJobseekersByPosition[positionId]) {
            fetchPositionAssignments(positionId);
          }
        });
      }

      // Set supplier PO items from invoiceData.invoiceData
      if (
        invoiceData.invoiceData?.supplierPOItems &&
        Array.isArray(invoiceData.invoiceData.supplierPOItems)
      ) {
        setSupplierPOItems(
          invoiceData.invoiceData.supplierPOItems as SupplierPOItem[]
        );
      }

      // Set attachments from invoiceData.invoiceData
      if (
        invoiceData.invoiceData?.attachments &&
        Array.isArray(invoiceData.invoiceData.attachments)
      ) {
        const attachmentFiles: AttachmentFile[] =
          invoiceData.invoiceData.attachments.map((att) => ({
            id:
              att.id ||
              Date.now().toString() + Math.random().toString(36).substr(2, 9),
            fileName: att.fileName || att.name || "Unknown file",
            fileSize: att.fileSize || att.size || 0,
            fileType: att.fileType || att.type || "application/octet-stream",
            filePath: att.filePath || att.url,
            isUploaded: true,
            uploadStatus: "uploaded" as const,
          }));
        setAttachments(attachmentFiles);
      }

      // Set loaded invoice state
      setLoadedInvoice(invoiceData);
    } catch (error) {
      console.error("Error fetching invoice for edit:", error);
      alert("Failed to load invoice data for editing");
    }
  };

  // Initialize edit mode when invoice ID is present in query params
  useEffect(() => {
    const invoiceId = searchParams.get("id");
    if (invoiceId && invoiceId.trim() !== "") {
      setIsEditMode(true);
      setEditingInvoiceId(invoiceId);
      fetchInvoiceForEdit(invoiceId);
    } else {
      setIsEditMode(false);
      setEditingInvoiceId(null);
    }
  }, [searchParams]);

  return (
    <div className="invoice-page-container">
      <AppHeader
        title={t("navigation.invoiceManagement")}
        hideHamburgerMenu={false}
        statusMessage={
          generationMessage || generationError || timesheetFetchMessage
        }
      />

      <div className="invoice-content-container">
        {/* Client and Payment Terms Selection */}
        <div className="invoice-selection-bar">
          <div className="selection-section">
            <label className="selection-label">
              <Building size={16} />
              {t("invoiceManagement.client")}
            </label>
            {clientLoading ? (
              <div className="invoice-dropdown-skeleton">
                <div className="skeleton-dropdown-trigger">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text skeleton-dropdown-text"></div>
                  <div className="skeleton-icon skeleton-chevron"></div>
                </div>
              </div>
            ) : (
              <CustomDropdown
                options={clientOptions}
                selectedOption={selectedClientOption}
                onSelect={handleClientSelect}
                placeholder={t("invoiceManagement.searchSelectClient")}
                loading={false}
                icon={<Building size={16} />}
                emptyMessage={t("invoiceManagement.noClientsFound")}
              />
            )}
          </div>

          <div className="selection-section">
            <label className="selection-label">
              <FileText size={16} />
              {t("invoiceManagement.paymentTerms")}
            </label>
            <CustomDropdown
              options={termsOptions}
              selectedOption={selectedTermsOption}
              onSelect={handleTermsSelect}
              placeholder={
                selectedClient
                  ? t("invoiceManagement.selectPaymentTerms")
                  : t("invoiceManagement.pleaseSelectClientFirst")
              }
              disabled={!selectedClient}
              loading={false}
              icon={<FileText size={16} />}
              emptyMessage={t("invoiceManagement.noPaymentTermsAvailable")}
            />
          </div>

          <div className="selection-section">
            <label
              className="selection-label"
              htmlFor="invoice-date-input"
              onClick={handleInvoiceDateClick}
            >
              <Calendar size={16} />
              {t("invoiceManagement.invoiceDate")}
            </label>
            <input
              id="invoice-date-input"
              type="date"
              value={invoiceDate}
              onChange={(e) => handleInvoiceDateChange(e.target.value)}
              className="invoice-date-input"
            />
          </div>

          <div className="selection-section">
            <label
              className="selection-label"
              htmlFor="due-date-input"
              onClick={handleDueDateClick}
            >
              <Calendar size={16} />
              {t("invoiceManagement.dueDate")}
            </label>
            <input
              id="due-date-input"
              type="date"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="invoice-date-input"
              title={t("invoiceManagement.dueDateAdjustable")}
            />
          </div>
        </div>

        {/* Timesheet Date Range Section */}
        {selectedClient && (
          <div className="invoice-selection-bar timesheet-date-range">
            <div className="selection-section">
              <label className="selection-label" htmlFor="timesheet-start-date">
                <Calendar size={16} />
                {t("invoiceManagement.timesheetStartDate")}
              </label>
              <input
                id="timesheet-start-date"
                type="date"
                value={timesheetStartDate}
                onChange={(e) => setTimesheetStartDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>

            <div className="selection-section">
              <label className="selection-label" htmlFor="timesheet-end-date">
                <Calendar size={16} />
                {t("invoiceManagement.timesheetEndDate")}
              </label>
              <input
                id="timesheet-end-date"
                type="date"
                value={timesheetEndDate}
                onChange={(e) => setTimesheetEndDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>

            <div className="selection-section">
              <label className="selection-label">&nbsp;</label>
              <button
                className={`button ${
                  isFetchingTimesheets ||
                  !timesheetStartDate ||
                  !timesheetEndDate
                    ? "disabled"
                    : ""
                }`}
                onClick={fetchAndPopulateTimesheets}
                disabled={
                  isFetchingTimesheets ||
                  !timesheetStartDate ||
                  !timesheetEndDate
                }
                style={{ width: "fit-content" }}
              >
                {isFetchingTimesheets ? (
                  <>
                    <Loader2 size={16} className="timesheet-loading-spinner" />
                    {t("invoiceManagement.fetchingTimesheets")}
                  </>
                ) : (
                  <>
                    <ClipboardList size={16} />
                    {t("invoiceManagement.loadTimesheets")}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* No Clients State */}
        {!clientLoading && clients.length === 0 && (
          <div className="invoice-card empty-state-card">
            <div className="invoice-empty-state">
              <Building size={48} />
              <h3>{t("invoiceManagement.noClientsAvailable")}</h3>
              <p>{t("invoiceManagement.noClientsForInvoice")}</p>
            </div>
          </div>
        )}

        {/* Invoice Details Section - Similar to Timesheet Unified Header */}
        {selectedClient && (
          <div className="timesheet-unified-header">
            <div className="timesheet-header-sections">
              <div className="timesheet-section timesheet-client-section">
                <h4 className="timesheet-section-title">
                  {t("invoiceManagement.clientInformation")}
                </h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.companyName")}
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.companyName}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.shortCode")}
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.shortCode || "N/A"}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.primaryEmail")}
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.emailAddress1}
                    </span>
                  </div>
                </div>
              </div>

              <div className="timesheet-section timesheet-payment-section">
                <h4 className="timesheet-section-title">
                  {t("invoiceManagement.paymentDetails")}
                </h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.currencyLabel")}
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.currency || "CAD"}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.paymentTerms")}
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedTerms || t("invoiceManagement.notSet")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.paymentMethod")}
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.preferredPaymentMethod ||
                        t("invoiceManagement.notSpecified")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="timesheet-section timesheet-dates-section">
                <h4 className="timesheet-section-title">
                  {t("invoiceManagement.invoiceAndDates")}
                </h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.invoiceNumber")}
                    </span>
                    <span className="timesheet-detail-value">
                      {invoiceNumberLoading ? (
                        <span className="invoice-number-loading">
                          <Loader2
                            size={14}
                            className="timesheet-loading-spinner"
                          />
                          {t("invoiceManagement.generatingInvoiceNumber")}
                        </span>
                      ) : invoiceNumber ? (
                        <strong>{invoiceNumber}</strong>
                      ) : (
                        t("invoiceManagement.notGenerated")
                      )}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.invoiceDate")}
                    </span>
                    <span className="timesheet-detail-value">
                      {invoiceDate
                        ? new Date(invoiceDate).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : t("invoiceManagement.notSet")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.dueDate")}
                    </span>
                    <span className="timesheet-detail-value">
                      {dueDate
                        ? new Date(dueDate).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : t("invoiceManagement.notCalculated")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("invoiceManagement.payCycle")}
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.payCycle ||
                        t("invoiceManagement.notSpecified")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Positions State */}
        {selectedClient && !positionLoading && positions.length === 0 && (
          <div className="invoice-card empty-state-card">
            <div className="invoice-empty-state">
              <FileText size={48} />
              <h3>{t("invoiceManagement.noPositionsAvailable")}</h3>
              <p>{t("invoiceManagement.noPositionsForClient")}</p>
            </div>
          </div>
        )}

        {selectedClient && !positionLoading && positions.length > 0 && (
          <>
            {/* Line Items Section */}
            <div className="invoice-line-items-container">
              <div className="invoice-line-items-header">
                <h3>{t("invoiceManagement.invoiceLineItems")}</h3>
              </div>

              <div className="invoice-line-items-list">
                {lineItems.map((lineItem) => (
                  <div key={lineItem.id} className="invoice-line-item-group">
                    <div className="invoice-line-item-fields">
                      {/* All fields in one row with add/remove buttons at the end */}
                      <div className="invoice-field-row single-row">
                        <div className="selection-section position-selection">
                          <label className="selection-label">
                            <FileText size={16} />
                            {t("invoiceManagement.position")}
                          </label>
                          <CustomDropdown
                            options={positionOptions}
                            selectedOption={
                              lineItem.position
                                ? positionOptions.find(
                                    (opt) => opt.id === lineItem.position?.id
                                  )
                                : null
                            }
                            onSelect={(option) =>
                              handlePositionSelect(lineItem.id, option)
                            }
                            placeholder={t(
                              "invoiceManagement.selectPositionPlaceholder"
                            )}
                            loading={false}
                            icon={<FileText size={16} />}
                            emptyMessage={t(
                              "invoiceManagement.noPositionsFoundMessage"
                            )}
                          />
                        </div>

                        <div className="selection-section jobseeker-selection">
                          <label className="selection-label">
                            <User size={16} />
                            {t("invoiceManagement.jobSeeker")}
                          </label>
                          {lineItem.position &&
                          jobseekerLoadingByPosition[lineItem.position.id] ? (
                            <div className="invoice-dropdown-skeleton">
                              <div className="skeleton-dropdown-trigger">
                                <div className="skeleton-icon"></div>
                                <div className="skeleton-text skeleton-dropdown-text"></div>
                                <div className="skeleton-icon skeleton-chevron"></div>
                              </div>
                            </div>
                          ) : (
                            <CustomDropdown
                              options={
                                lineItem.position
                                  ? getJobseekerOptions(lineItem.position.id)
                                  : []
                              }
                              selectedOption={
                                lineItem.jobseeker
                                  ? getJobseekerOptions(
                                      lineItem.position?.id || ""
                                    ).find(
                                      (opt) =>
                                        opt.id ===
                                        lineItem.jobseeker?.candidateId
                                    )
                                  : null
                              }
                              onSelect={(option) =>
                                handleJobseekerSelect(lineItem.id, option)
                              }
                              placeholder={
                                lineItem.position
                                  ? t(
                                      "invoiceManagement.selectJobseekerPlaceholder"
                                    )
                                  : t(
                                      "invoiceManagement.pleaseSelectPositionFirst"
                                    )
                              }
                              disabled={!lineItem.position}
                              loading={false}
                              icon={<User size={16} />}
                              emptyMessage={
                                lineItem.position
                                  ? t("invoiceManagement.noAssignedJobseekers")
                                  : t(
                                      "invoiceManagement.pleaseSelectPositionFirst"
                                    )
                              }
                            />
                          )}
                        </div>

                        <div className="selection-section description-selection">
                          <label className="selection-label">
                            <FileText size={16} />
                            {t("invoiceManagement.descriptionOptional")}
                          </label>
                          <input
                            type="text"
                            value={lineItem.description}
                            onChange={(e) =>
                              updateLineItem(lineItem.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder={t(
                              "invoiceManagement.enterDescription"
                            )}
                            className="invoice-text-input"
                          />
                        </div>

                        <div className="selection-section hours-selection">
                          <label className="selection-label">
                            <FileText size={16} />
                            {t("invoiceManagement.hours")}
                          </label>
                          <input
                            type="number"
                            value={lineItem.hours}
                            onChange={(e) =>
                              updateLineItem(lineItem.id, {
                                hours: e.target.value,
                              })
                            }
                            placeholder="0.00"
                            min="0"
                            step="0.25"
                            className="invoice-number-input"
                          />
                        </div>

                        <div className="selection-section rate-selection">
                          <label className="selection-label">
                            <DollarSign size={16} />
                            {t("invoiceManagement.rate")}
                          </label>
                          <input
                            type="number"
                            value={lineItem.regularBillRate}
                            onChange={(e) =>
                              updateLineItem(lineItem.id, {
                                regularBillRate: e.target.value,
                              })
                            }
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="invoice-number-input"
                          />
                        </div>

                        <div className="selection-section tax-selection">
                          <label className="selection-label">
                            <DollarSign size={16} />
                            {t("invoiceManagement.salesTax")}
                          </label>
                          <CustomDropdown
                            options={salesTaxOptions}
                            selectedOption={salesTaxOptions.find(
                              (opt) => opt.value === lineItem.salesTax
                            )}
                            onSelect={(option) =>
                              handleSalesTaxSelect(lineItem.id, option)
                            }
                            placeholder={t("invoiceManagement.selectTax")}
                            loading={false}
                            icon={<DollarSign size={16} />}
                            emptyMessage={t(
                              "invoiceManagement.noSalesTaxOptions"
                            )}
                          />
                        </div>

                        {/* Action buttons section */}
                        <div className="selection-section line-item-actions">
                          <label className="selection-label">
                            {t("invoiceManagement.actions")}
                          </label>
                          <div className="line-item-buttons">
                            <button
                              className="button secondary"
                              onClick={addLineItem}
                              title={t("invoiceManagement.addNewLineItem")}
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              className="button danger"
                              onClick={() => removeLineItem(lineItem.id)}
                              title={t("invoiceManagement.removeLineItem")}
                              disabled={lineItems.length === 1}
                            >
                              <Minus size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier/PO Number Details Section */}
            <div className="invoice-bottom-sections-container">
              <div className="invoice-line-items-container supplier-po-section">
                <div className="invoice-line-items-header">
                  <h3>{t("invoiceManagement.supplierPODetails")}</h3>
                </div>

                <div className="invoice-line-items-list">
                  {supplierPOItems.map((supplierPOItem) => (
                    <div
                      key={supplierPOItem.id}
                      className="invoice-line-item-group"
                    >
                      <div className="invoice-line-item-fields">
                        {/* All fields in one row with add/remove buttons at the end */}
                        <div className="invoice-field-row single-row">
                          <div className="selection-section combined-selection">
                            <label className="selection-label">
                              <Building size={16} />
                              {t("invoiceManagement.supplierNoPONo")}
                            </label>
                            <CustomDropdown
                              options={combinedOptions}
                              selectedOption={
                                supplierPOItem.selectedOption
                                  ? combinedOptions.find(
                                      (opt) =>
                                        opt.id === supplierPOItem.selectedOption
                                    )
                                  : null
                              }
                              onSelect={(option) =>
                                handleCombinedOptionSelect(
                                  supplierPOItem.id,
                                  option
                                )
                              }
                              placeholder={t(
                                "invoiceManagement.selectSupplierOrPO"
                              )}
                              loading={false}
                              icon={<Building size={16} />}
                              emptyMessage={t(
                                "invoiceManagement.noOptionsFound"
                              )}
                            />
                          </div>

                          <div className="selection-section supplier-po-number-selection">
                            <label className="selection-label">
                              <FileText size={16} />
                              {t("invoiceManagement.supplierPONumber")}
                            </label>
                            <input
                              type="text"
                              value={supplierPOItem.supplierPoNumber}
                              onChange={(e) =>
                                handleSupplierPONumberChange(
                                  supplierPOItem.id,
                                  e.target.value
                                )
                              }
                              placeholder={t(
                                "invoiceManagement.enterSupplierPONumber"
                              )}
                              className="invoice-text-input"
                            />
                          </div>

                          {/* Action buttons section */}
                          <div className="selection-section line-item-actions">
                            <label className="selection-label">
                              {t("invoiceManagement.actions")}
                            </label>
                            <div className="line-item-buttons">
                              <button
                                className="button secondary"
                                onClick={addSupplierPOItem}
                                title={t("invoiceManagement.addSupplierPOItem")}
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                className="button danger"
                                onClick={() =>
                                  removeSupplierPOItem(supplierPOItem.id)
                                }
                                title={t(
                                  "invoiceManagement.removeSupplierPOItem"
                                )}
                                disabled={supplierPOItems.length === 1}
                              >
                                <Minus size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message and Terms Section */}
              <div className="invoice-message-terms-container">
                <div className="invoice-line-items-header">
                  <h3>{t("invoiceManagement.additionalInformation")}</h3>
                </div>

                <div className="message-terms-grid">
                  <div className="selection-section message-section">
                    <label className="selection-label">
                      <FileText size={16} />
                      {t("invoiceManagement.messageOnInvoice")}
                    </label>
                    <textarea
                      className="invoice-textarea"
                      placeholder={t("invoiceManagement.enterMessageOnInvoice")}
                      rows={6}
                      value={messageOnInvoice}
                      onChange={(e) => setMessageOnInvoice(e.target.value)}
                    />
                  </div>

                  <div className="selection-section terms-section">
                    <label className="selection-label">
                      <FileText size={16} />
                      {t("invoiceManagement.terms")}
                    </label>
                    <textarea
                      className="invoice-textarea"
                      placeholder={t("invoiceManagement.enterAdditionalTerms")}
                      rows={6}
                      value={termsOnInvoice}
                      onChange={(e) => setTermsOnInvoice(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="invoice-notes-section">
              <div className="invoice-line-items-header">
                <h3>{t("invoiceManagement.additionalNotes")}</h3>
              </div>
              <textarea
                className="invoice-textarea invoice-notes-textarea"
                placeholder={t("invoiceManagement.notesPlaceholder")}
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Invoice Calculations Container */}
            <div className="timesheet-invoice-container">
              <div className="timesheet-invoice-table">
                <div className="timesheet-invoice-table-header">
                  <div className="timesheet-col-description">
                    {t("invoiceManagement.description")}
                  </div>
                  <div className="timesheet-col-hours">
                    {t("invoiceManagement.hours")}
                  </div>
                  <div className="timesheet-col-rate">
                    {t("invoiceManagement.rate")}
                  </div>
                  <div className="timesheet-col-tax">
                    {t("invoiceManagement.tax")}
                  </div>
                  <div className="timesheet-col-amount">
                    {t("invoiceManagement.amount")}
                  </div>
                </div>

                <div className="timesheet-invoice-table-body">
                  {(() => {
                    const { lineItemTotals } = calculateLineItemTotals();

                    return lineItemTotals.map((item) => (
                      <div
                        key={item.id}
                        className="timesheet-invoice-line-item"
                      >
                        <div className="timesheet-col-description">
                          <div className="timesheet-item-title">
                            {item.position?.title ||
                              t("invoiceManagement.noPositionSelected")}
                          </div>
                          <div className="timesheet-item-subtitle">
                            {item.jobseeker
                              ? `${item.jobseeker.firstName} ${item.jobseeker.lastName}`.trim()
                              : t("invoiceManagement.noJobseekerSelected")}
                            {item.description && ` - ${item.description}`}
                          </div>
                        </div>
                        <div className="timesheet-col-hours">
                          {item.hours || "0"}
                        </div>
                        <div className="timesheet-col-rate">
                          ${item.regularBillRate || "0.00"}
                        </div>
                        <div className="timesheet-col-tax">
                          {item.taxInfo.taxType === "HST" && (
                            <div className="timesheet-item-subtitle">
                              HST {item.taxInfo.hstPercentage}% on $
                              {item.lineSubtotal.toFixed(2)}:
                            </div>
                          )}

                          {item.taxInfo.taxType === "GST" && (
                            <div className="timesheet-item-subtitle">
                              GST {item.taxInfo.gstPercentage}% on $
                              {item.lineSubtotal.toFixed(2)}:
                            </div>
                          )}

                          {item.taxInfo.taxType === "GST_QST" && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: "0.25rem",
                              }}
                            >
                              <div className="timesheet-item-subtitle">
                                GST {item.taxInfo.gstPercentage}% on $
                                {item.lineSubtotal.toFixed(2)}:
                              </div>
                              <div
                                className="timesheet-item-subtitle"
                                style={{
                                  textWrap: "nowrap",
                                }}
                              >
                                QST {item.taxInfo.qstPercentage}% on $
                                {item.lineSubtotal.toFixed(2)}:
                              </div>
                            </div>
                          )}
                          {item.taxInfo.taxType !== "GST_QST" && (
                            <div className="timesheet-item-title">
                              ${item.lineTax.toFixed(2)}
                            </div>
                          )}

                          {item.taxInfo.taxType === "GST_QST" && (
                            <div>
                              <div className="timesheet-item-title">
                                ${item.lineGST.toFixed(2)}
                              </div>
                              <div className="timesheet-item-title">
                                ${item.lineQST.toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="timesheet-col-amount">
                          ${item.lineTotal.toFixed(2)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="timesheet-invoice-totals">
                  {(() => {
                    const {
                      subtotal,
                      totalTax,
                      totalHST,
                      totalGST,
                      totalQST,
                      grandTotal,
                    } = calculateLineItemTotals();

                    return (
                      <>
                        <div className="timesheet-total-line">
                          <div className="timesheet-total-label">
                            {t("invoiceManagement.totalHours")}:
                          </div>
                          <div className="timesheet-total-value">
                            {lineItems
                              .reduce(
                                (total, item) =>
                                  total + (parseFloat(item.hours) || 0),
                                0
                              )
                              .toFixed(1)}
                          </div>
                        </div>
                        <div className="timesheet-total-line timesheet-subtotal">
                          <div className="timesheet-total-label">
                            {t("invoiceManagement.subtotal")}:
                          </div>
                          <div className="timesheet-total-value">
                            ${subtotal.toFixed(2)}
                          </div>
                        </div>
                        {totalHST > 0 && (
                          <div className="timesheet-total-line">
                            <div className="timesheet-total-label">
                              {t("invoiceManagement.totalHST")}:
                            </div>
                            <div className="timesheet-total-value">
                              ${totalHST.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {totalGST > 0 && (
                          <div className="timesheet-total-line">
                            <div className="timesheet-total-label">
                              {t("invoiceManagement.totalGST")}:
                            </div>
                            <div className="timesheet-total-value">
                              ${totalGST.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {totalQST > 0 && (
                          <div className="timesheet-total-line">
                            <div className="timesheet-total-label">
                              {t("invoiceManagement.totalQST")}:
                            </div>
                            <div className="timesheet-total-value">
                              ${totalQST.toFixed(2)}
                            </div>
                          </div>
                        )}
                        <div className="timesheet-total-line">
                          <div className="timesheet-total-label">
                            {t("invoiceManagement.totalTax")}:
                          </div>
                          <div className="timesheet-total-value">
                            ${totalTax.toFixed(2)}
                          </div>
                        </div>
                        <div className="timesheet-total-line timesheet-grand-total">
                          <div className="timesheet-total-label">
                            {t("invoiceManagement.grandTotal")}:
                          </div>
                          <div className="timesheet-total-value">
                            ${grandTotal.toFixed(2)}{" "}
                            {selectedClient?.currency || "CAD"}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Invoice Attachments Section */}
            <InvoiceAttachments
              value={attachments}
              onChange={setAttachments}
              disabled={false}
              bucketName="invoices"
            />

            {/* Generated Invoice Section (view/edit mode only) */}
            {isEditMode && documentPath && documentFileName && (
              <div className="attachment-list">
                <div className="attachment-item generated-invoice-item">
                  <div className="attachment-thumbnail">
                    <div
                      className="attachment-file-placeholder"
                      onClick={async () => {
                        const { data } = await supabase.storage
                          .from("invoices")
                          .createSignedUrl(
                            documentPath.replace(/&#x2F;/g, "/"),
                            300
                          );
                        if (data?.signedUrl)
                          window.open(data.signedUrl, "_blank");
                      }}
                    >
                      <FileText size={16} />
                      <span className="attachment-file-type">
                        {documentFileName.split(".").pop()?.toUpperCase() ||
                          "PDF"}
                      </span>
                    </div>
                  </div>
                  <div className="attachment-info">
                    <div className="attachment-name" title={documentFileName}>
                      <FileText size={16} />
                      <span>{documentFileName}</span>
                    </div>
                    <div className="attachment-details">
                      <span className="attachment-size">
                        {documentFileSize
                          ? `${(documentFileSize / 1024 / 1024).toFixed(2)} MB`
                          : ""}
                      </span>
                      <div className="attachment-status uploaded">
                        <CheckCircle size={14} />
                        <span>{t("invoiceManagement.generated")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="attachment-actions">
                    <button
                      type="button"
                      className="attachment-action-btn preview"
                      onClick={async () => {
                        const { data } = await supabase.storage
                          .from("invoices")
                          .createSignedUrl(
                            documentPath.replace(/&#x2F;/g, "/"),
                            300
                          );
                        if (data?.signedUrl)
                          window.open(data.signedUrl, "_blank");
                      }}
                      title={t("invoiceManagement.preview")}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      className="attachment-action-btn download"
                      onClick={async () => {
                        const { data } = await supabase.storage
                          .from("invoices")
                          .createSignedUrl(
                            documentPath.replace(/&#x2F;/g, "/"),
                            300
                          );
                        if (data?.signedUrl) {
                          const a = document.createElement("a");
                          a.href = data.signedUrl;
                          a.download = documentFileName;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }
                      }}
                      title={t("invoiceManagement.download")}
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Invoice Section */}
            <div className="timesheet-action-section">
              <button
                className={`button ${
                  isGeneratingInvoice ||
                  !selectedClient ||
                  !invoiceNumber ||
                  lineItems.length === 0 ||
                  !lineItems.some(
                    (item) =>
                      parseFloat(item.hours) > 0 &&
                      parseFloat(item.regularBillRate) > 0
                  )
                    ? "disabled"
                    : ""
                }`}
                onClick={() => {
                  handleInvoiceSubmit();
                }}
                disabled={
                  isGeneratingInvoice ||
                  !selectedClient ||
                  !invoiceNumber ||
                  lineItems.length === 0 ||
                  !lineItems.some(
                    (item) =>
                      parseFloat(item.hours) > 0 &&
                      parseFloat(item.regularBillRate) > 0
                  )
                }
              >
                {isGeneratingInvoice ? (
                  <>
                    <Loader2 size={16} className="timesheet-loading-spinner" />
                    {isEditMode
                      ? t("invoiceManagement.updating")
                      : t("invoiceManagement.generating")}
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    {isEditMode
                      ? t("invoiceManagement.updateInvoice")
                      : t("invoiceManagement.generateInvoice")}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* Skeleton Loading for Invoice Content */}
        {selectedClient && positionLoading && (
          <div className="invoice-skeleton-container">
            {/* Line Items Skeleton */}
            <div className="invoice-line-items-container">
              <div className="invoice-line-items-header">
                <div
                  className="skeleton-text"
                  style={{ width: "150px", height: "20px" }}
                ></div>
              </div>
              <div className="invoice-line-items-list">
                <div className="invoice-line-item-group">
                  <div className="invoice-line-item-fields">
                    <div className="invoice-field-row single-row">
                      {[1, 2, 3, 4, 5, 6].map((index) => (
                        <div key={index} className="selection-section">
                          <div
                            className="skeleton-text"
                            style={{
                              width: "80px",
                              height: "14px",
                              marginBottom: "8px",
                            }}
                          ></div>
                          <div
                            className="skeleton-text"
                            style={{ width: "100%", height: "40px" }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier/PO and Message Sections Skeleton */}
            <div className="invoice-bottom-sections-container">
              <div className="invoice-line-items-container supplier-po-section">
                <div className="invoice-line-items-header">
                  <div
                    className="skeleton-text"
                    style={{ width: "200px", height: "20px" }}
                  ></div>
                </div>
                <div className="invoice-line-items-list">
                  <div className="invoice-line-item-group">
                    <div className="invoice-line-item-fields">
                      <div className="invoice-field-row single-row">
                        {[1, 2, 3].map((index) => (
                          <div key={index} className="selection-section">
                            <div
                              className="skeleton-text"
                              style={{
                                width: "80px",
                                height: "14px",
                                marginBottom: "8px",
                              }}
                            ></div>
                            <div
                              className="skeleton-text"
                              style={{ width: "100%", height: "40px" }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="invoice-message-terms-container">
                <div className="invoice-line-items-header">
                  <div
                    className="skeleton-text"
                    style={{ width: "180px", height: "20px" }}
                  ></div>
                </div>
                <div className="message-terms-grid">
                  <div className="selection-section">
                    <div
                      className="skeleton-text"
                      style={{
                        width: "120px",
                        height: "14px",
                        marginBottom: "8px",
                      }}
                    ></div>
                    <div
                      className="skeleton-text"
                      style={{ width: "100%", height: "120px" }}
                    ></div>
                  </div>
                  <div className="selection-section">
                    <div
                      className="skeleton-text"
                      style={{
                        width: "80px",
                        height: "14px",
                        marginBottom: "8px",
                      }}
                    ></div>
                    <div
                      className="skeleton-text"
                      style={{ width: "100%", height: "120px" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Calculations Skeleton */}
            <div className="timesheet-invoice-container">
              <div className="timesheet-invoice-table">
                <div className="timesheet-invoice-table-header">
                  {[1, 2, 3, 4, 5].map((index) => (
                    <div key={index} className="timesheet-col">
                      <div
                        className="skeleton-text"
                        style={{ width: "80px", height: "14px" }}
                      ></div>
                    </div>
                  ))}
                </div>
                <div className="timesheet-invoice-table-body">
                  <div className="timesheet-invoice-line-item">
                    {[1, 2, 3, 4, 5].map((index) => (
                      <div key={index} className="timesheet-col">
                        <div
                          className="skeleton-text"
                          style={{
                            width: "90%",
                            height: "16px",
                            marginBottom: "4px",
                          }}
                        ></div>
                        <div
                          className="skeleton-text"
                          style={{ width: "70%", height: "12px" }}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="timesheet-invoice-totals">
                  {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="timesheet-total-line">
                      <div
                        className="skeleton-text"
                        style={{ width: "100px", height: "14px" }}
                      ></div>
                      <div
                        className="skeleton-text"
                        style={{ width: "80px", height: "14px" }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Attachments Skeleton */}
            <div className="invoice-attachments-section">
              <div
                className="skeleton-text"
                style={{ width: "140px", height: "20px", marginBottom: "16px" }}
              ></div>
              <div
                className="skeleton-text"
                style={{ width: "100%", height: "80px" }}
              ></div>
            </div>

            {/* Generate Button Skeleton */}
            <div className="timesheet-action-section">
              <div className="timesheet-email-option">
                <div
                  className="skeleton-text"
                  style={{ width: "150px", height: "16px" }}
                ></div>
              </div>
              <div
                className="skeleton-text"
                style={{ width: "140px", height: "40px" }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Show Invoice Success Modal */}
      {showInvoiceSuccessModal && createdInvoice && (
        <div className="invoice-success-modal-overlay">
          <div className="invoice-success-modal-content">
            <button
              className="invoice-success-modal-close-btn"
              onClick={() => setShowInvoiceSuccessModal(false)}
            >
              &times;
            </button>

            {/* PDF Preview Left Side */}
            <div className="invoice-success-modal-pdf-preview">
              <div className="invoice-success-modal-pdf-controls">
                <button onClick={zoomOut}>-</button>
                <button onClick={resetZoom}>100%</button>
                <button onClick={zoomIn}>+</button>
              </div>
              <div className="invoice-success-modal-pdf-page-container">
                <Document
                  file={pdfBlobUrl || ""}
                  onLoadSuccess={onPdfLoadSuccess}
                  loading={<div>{t("invoiceManagement.loadingPDF")}</div>}
                  error={<div>{t("invoiceManagement.failedToLoadPDF")}</div>}
                >
                  <Page
                    pageNumber={pdfPageNumber}
                    width={400}
                    scale={pdfScale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
              {pdfNumPages && (
                <div className="invoice-success-modal-pdf-navigation">
                  <button onClick={goToPrevPage} disabled={pdfPageNumber <= 1}>
                    {t("invoiceManagement.previous")}
                  </button>
                  <span>
                    {t("invoiceManagement.page")} {pdfPageNumber}{" "}
                    {t("invoiceManagement.of")} {pdfNumPages}
                  </span>
                  <button
                    onClick={goToNextPage}
                    disabled={pdfPageNumber >= pdfNumPages}
                  >
                    {t("invoiceManagement.next")}
                  </button>
                </div>
              )}
            </div>

            {/* Info Right Side */}
            <div className="invoice-success-modal-info-panel">
              <h2>{t("invoiceManagement.invoiceCreatedSuccessfully")}</h2>
              <button
                className="button"
                style={{ alignSelf: "center", width: "fit-content" }}
                onClick={handleDownloadInvoice}
                disabled={!pdfBlobUrl}
              >
                <Download /> {t("invoiceManagement.downloadInvoice")}
              </button>
              <div className="invoice-success-modal-details">
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.invoiceNumberLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    #{createdInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.clientLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    {createdInvoice.client?.companyName ||
                      selectedClient?.companyName ||
                      "N/A"}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.dateLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    {createdInvoice.invoiceDate}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.totalLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    ${createdInvoice.grandTotal}
                  </span>
                </div>
              </div>

              <div className="invoice-success-modal-email-section">
                <label>
                  {t("invoiceManagement.sendToEmail")}
                  <input
                    type="email"
                    value={emailToSend}
                    onChange={(e) => {
                      setEmailToSend(e.target.value);
                      setEmailUpdateMessage("");
                    }}
                  />
                </label>
                <button
                  className="button"
                  style={{ marginTop: 16, minWidth: 180 }}
                  onClick={sendInvoiceToClient}
                  disabled={
                    isSendingInvoice || !emailToSend || !emailToSend.trim()
                  }
                >
                  {isSendingInvoice
                    ? t("invoiceManagement.sending")
                    : t("invoiceManagement.sendInvoiceToClient")}
                </button>
                {/* Wrap both messages in a fragment to avoid adjacent JSX errors */}
                <>
                  {sendInvoiceMessage && (
                    <div
                      className={`invoice-success-modal-message${
                        sendInvoiceStatus === "error" ? " error" : ""
                      }`}
                    >
                      {sendInvoiceMessage}
                    </div>
                  )}
                  {emailUpdateMessage && (
                    <div className="invoice-success-modal-message">
                      {emailUpdateMessage}
                    </div>
                  )}
                </>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
