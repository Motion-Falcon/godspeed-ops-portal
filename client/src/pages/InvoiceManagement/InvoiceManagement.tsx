import { useState, useEffect } from "react";
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
} from "lucide-react";
import { getClients, ClientData, getClient } from "../../services/api/client";
import {
  getClientPositions,
  getPositionAssignments,
  AssignmentRecord,
} from "../../services/api/position";
import { PAYMENT_TERMS } from "../../constants/formOptions";
import { BackendClientData } from "../ClientManagement/ClientManagement";
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
} from "../../services/api/invoice";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  generateInvoicePDF as generatePDF,
  InvoiceData as PDFInvoiceData,
} from "../../utils/pdfGenerator.tsx";
import { Document, Page, pdfjs } from "react-pdf";
// Backend response interface with snake_case properties for invoice management
interface InvoiceBackendClientData {
  id?: string;
  company_name?: string;
  short_code?: string;
  list_name?: string;
  contact_person_name1?: string;
  contact_person_name2?: string;
  email_address1?: string;
  email_address2?: string;
  mobile1?: string;
  mobile2?: string;
  city1?: string;
  city_1?: string;
  province1?: string;
  province_1?: string;
  postal_code1?: string;
  preferred_payment_method?: string;
  pay_cycle?: string;
  terms?: string;
  currency?: string;
  created_at?: string;
  updated_at?: string;
  // Include camelCase versions as fallback
  companyName?: string;
  shortCode?: string;
  emailAddress1?: string;
  postalCode1?: string;
  preferredPaymentMethod?: string;
  [key: string]: unknown;
}

// Interface for position data
interface ClientPosition {
  id: string;
  positionCode: string;
  title: string;
  regularPayRate: string;
  billRate: string;
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimePayRate?: string;
  overtimeBillRate?: string;
  markup?: string;
}

// Interface for assigned jobseeker data
interface AssignedJobseeker {
  id?: string;
  positionCandidateAssignmentsId?: string;
  candidateId: string;
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
  rate: string;
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

// Combined supplier and PO options
const COMBINED_OPTIONS = [
  {
    id: "supplier-no",
    type: "supplier",
    value: "Supplier No",
    label: "Supplier No",
  },
  { id: "po-no", type: "po", value: "PO No", label: "PO No" },
];

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export function InvoiceManagement() {
  const { user } = useAuth();
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

  // State for additional information
  const [messageOnInvoice, setMessageOnInvoice] = useState<string>(
    "We appreciate your business and look forward to helping you again soon."
  );
  const [termsOnInvoice, setTermsOnInvoice] = useState<string>(
    "Interest is payable at 24% annually after the agreed terms."
  );

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
  const [emailSent, setEmailSent] = useState(false);
  // Add state for pdfBlobUrl
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  // Add state for showInvoiceSuccessModal and emailToSend
  const [showInvoiceSuccessModal, setShowInvoiceSuccessModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<InvoiceData | null>(
    null
  );
  const [emailToSend, setEmailToSend] = useState<string>("");
  const [emailUpdateMessage, setEmailUpdateMessage] = useState<string>("");

  // Add PDF preview state for modal
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);

  // Add state for sending invoice
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [sendInvoiceMessage, setSendInvoiceMessage] = useState<string>("");

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
      // Set terms from client data and calculate due date
      const clientTerms = selectedClient.terms || "Net 30";
      setSelectedTerms(clientTerms);

      // Calculate due date based on terms
      if (invoiceDate) {
        calculateDueDate(invoiceDate, clientTerms);
      }
    }
  }, [selectedClient, invoiceDate]);

  // Update due date when terms change
  useEffect(() => {
    if (invoiceDate && selectedTerms) {
      calculateDueDate(invoiceDate, selectedTerms);
    }
  }, [selectedTerms, invoiceDate]);

  useEffect(() => {
    if (showInvoiceSuccessModal && createdInvoice) {
      const emailToSet = createdInvoice.invoice_sent_to ||
        createdInvoice.client?.emailAddress1 ||
        selectedClient?.emailAddress1 ||
        "";
      console.log("Setting emailToSend:", {
        invoice_sent_to: createdInvoice.invoice_sent_to,
        client_email: createdInvoice.client?.emailAddress1,
        selected_client_email: selectedClient?.emailAddress1,
        final_email: emailToSet
      });
      setEmailToSend(emailToSet);
    }
  }, [showInvoiceSuccessModal, createdInvoice, selectedClient?.emailAddress1]);

  const fetchClients = async () => {
    try {
      setClientLoading(true);
      const response = await getClients({ limit: 100000000 }); // Get all clients
      const convertedClients: ClientData[] = (
        response.clients as BackendClientData[]
      ).map(
        (client: BackendClientData): ClientData => ({
          ...client,
          // Convert backend snake_case to frontend camelCase if needed
          companyName: (client.company_name || client.companyName) as string,
          shortCode: (client.short_code || client.shortCode) as string,
          emailAddress1: (client.email_address_1 ||
            client.emailAddress1) as string,
          city1: (client.city_1 || client.city1) as string | undefined,
          province1: (client.province_1 || client.province1) as
            | string
            | undefined,
          postalCode1: (client.postal_code_1 || client.postalCode1) as
            | string
            | undefined,
          preferredPaymentMethod: (client.preferred_payment_method ||
            client.preferredPaymentMethod) as string | undefined,
          terms: (client.terms || "Net 30") as string,
          currency: (client.currency || "CAD") as string,
        })
      );
      setClients(convertedClients);
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
          regularPayRate: pos.regularPayRate!,
          billRate: pos.billRate!,
          overtimeEnabled: pos.overtimeEnabled,
          overtimeHours: pos.overtimeHours,
          overtimePayRate: pos.overtimePayRate,
          overtimeBillRate: pos.overtimeBillRate,
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

  // Line item management functions
  const addLineItem = () => {
    const newLineItem: InvoiceLineItem = {
      id: Date.now().toString(),
      position: null,
      jobseeker: null,
      description: "",
      hours: "",
      rate: "",
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
    label: client.companyName || "Unknown Client",
    sublabel: client.shortCode || "",
    value: client,
  }));

  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id,
    label: position.title || "Unknown Position",
    sublabel: position.positionCode || "",
    value: position,
  }));

  const getJobseekerOptions = (positionId: string): DropdownOption[] => {
    const jobseekers = assignedJobseekersByPosition[positionId] || [];
    return jobseekers.map((jobseeker) => ({
      id: jobseeker.candidateId,
      label: `${jobseeker.firstName} ${jobseeker.lastName}`.trim() || "Unknown",
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

  const handleClientSelect = async (option: DropdownOption) => {
    const basicClient = option.value as ClientData;

    try {
      setClientLoading(true);

      // Fetch detailed client information from the backend
      const detailedClientResponse = await getClient(basicClient.id!);

      // Cast to InvoiceBackendClientData to handle snake_case properties from backend
      const detailedClient =
        detailedClientResponse as unknown as InvoiceBackendClientData;

      // Convert backend snake_case to frontend camelCase and ensure all required fields
      const processedClient: ClientData = {
        ...detailedClient,
        // Ensure camelCase fields are properly mapped
        companyName:
          detailedClient.company_name || detailedClient.companyName || "",
        shortCode: detailedClient.short_code || detailedClient.shortCode || "",
        emailAddress1:
          detailedClient.email_address1 || detailedClient.emailAddress1 || "",
        city1: detailedClient.city1 || detailedClient.city_1 || "",
        province1: detailedClient.province1 || detailedClient.province_1 || "",
        postalCode1:
          detailedClient.postal_code1 || detailedClient.postalCode1 || "",
        preferredPaymentMethod:
          detailedClient.preferred_payment_method ||
          detailedClient.preferredPaymentMethod ||
          "",
        terms: detailedClient.terms || "Net 30",
        currency: detailedClient.currency || "CAD",
      };

      setSelectedClient(processedClient);

      // Auto-select terms from client data if available
      if (processedClient.terms) {
        setSelectedTerms(processedClient.terms);
      }

      // Generate invoice number when client is selected
      generateAndSetInvoiceNumber();
    } catch (error) {
      console.error("Error fetching detailed client data:", error);
      // Fallback to basic client data if detailed fetch fails
      setSelectedClient(basicClient);
      generateAndSetInvoiceNumber();
      setGenerationError(
        "Warning: Could not fetch complete client details. Some information may be missing."
      );
    } finally {
      setClientLoading(false);
    }
  };

  const handleTermsSelect = (option: DropdownOption) => {
    const terms = option.value as string;
    setSelectedTerms(terms);
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

  const handlePositionSelect = (lineItemId: string, option: DropdownOption) => {
    const position = option.value as ClientPosition;
    updateLineItem(lineItemId, {
      position,
      jobseeker: null, // Reset jobseeker when position changes
      rate: position.billRate, // Auto-fill rate from position
    });

    // Fetch jobseekers for this position if not already fetched
    if (!assignedJobseekersByPosition[position.id]) {
      fetchPositionAssignments(position.id);
    }
  };

  const handleJobseekerSelect = (
    lineItemId: string,
    option: DropdownOption
  ) => {
    const jobseeker = option.value as AssignedJobseeker;
    updateLineItem(lineItemId, { jobseeker });
  };

  const handleSalesTaxSelect = (lineItemId: string, option: DropdownOption) => {
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
    option: DropdownOption
  ) => {
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
      const rate = parseFloat(item.rate) || 0;
      const lineSubtotal = hours * rate;

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

  // Generate invoice function
  const generateInvoice = async () => {
    console.log("=== DEBUG: generateInvoice called ===");
    console.log("selectedClient:", selectedClient);
    console.log("lineItems:", lineItems);
    console.log("lineItems.length:", lineItems.length);
    console.log("invoiceNumber:", invoiceNumber);

    if (!selectedClient || lineItems.length === 0) {
      console.log("=== DEBUG: Early return - no client or no line items ===");
      setGenerationError(
        "Please select a client and add line items before generating invoice"
      );
      return;
    }

    if (!invoiceNumber) {
      setGenerationError("Please generate an invoice number first");
      return;
    }

    // Check if at least one line item has hours > 0
    const hasValidLineItems = lineItems.some(
      (item) => parseFloat(item.hours) > 0 && parseFloat(item.rate) > 0
    );
    lineItems.forEach((item, index) => {
      console.log(`Item ${index}:`, {
        hours: item.hours,
        rate: item.rate,
        hoursFloat: parseFloat(item.hours),
        rateFloat: parseFloat(item.rate),
        valid: parseFloat(item.hours) > 0 && parseFloat(item.rate) > 0,
      });
    });

    if (!hasValidLineItems) {
      setGenerationError(
        "At least one line item must have hours and rate greater than 0"
      );
      return;
    }

    // Validate required client fields
    if (
      !selectedClient.id ||
      !selectedClient.companyName ||
      !selectedClient.shortCode ||
      !selectedClient.emailAddress1
    ) {
      setGenerationError(
        "Selected client is missing required information (ID, company name, short code, or email)"
      );
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
        "One or more attachments failed to upload. Please remove or re-upload them before generating the invoice."
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

      // Create invoice data for API
      const invoiceApiData = {
        client: {
          id: selectedClient.id,
          companyName: selectedClient.companyName,
          shortCode: selectedClient.shortCode,
          emailAddress1: selectedClient.emailAddress1,
          city1: selectedClient.city1,
          province1: selectedClient.province1,
          postalCode1: selectedClient.postalCode1,
        },
        invoiceNumber: invoiceNumber,
        invoiceDate: invoiceDate,
        dueDate: dueDate,
        status: "draft" as const,
        currency: selectedClient.currency || "CAD",
        timesheets: lineItemTotals.map((item) => ({
          id: item.id,
          invoiceNumber: invoiceNumber,
          weekStartDate: invoiceDate, // Using invoice date as reference
          weekEndDate: dueDate, // Using due date as reference
          totalRegularHours: parseFloat(item.hours) || 0,
          totalOvertimeHours: 0, // Line items don't have overtime
          regularBillRate: parseFloat(item.rate) || 0,
          overtimeBillRate: 0,
          totalClientBill: item.lineTotal,
          jobseekerProfile: item.jobseeker
            ? {
                firstName: item.jobseeker.firstName,
                lastName: item.jobseeker.lastName,
                email: item.jobseeker.email,
                jobseekerUserId: item.jobseeker.id,
                jobseekerProfileId: item.jobseeker.candidateId,
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
              }
            : {
                title: item.description || "Custom Line Item",
                positionCode: "CUSTOM",
              },
        })),
        attachments: uploadedAttachments,
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
        emailSent: emailSent,
        emailSentDate: emailSent ? new Date().toISOString() : undefined,
      };

      // Log the data being sent to API
      console.log("=== INVOICE DATA BEING SENT TO API ===");
      console.log("Invoice API Data:", JSON.stringify(invoiceApiData, null, 2));
      console.log("=== END API DATA ===");

      // Call the API to create the invoice
      const result = await createInvoiceFromFrontendData(invoiceApiData);
      const pdfInvoiceId = result.invoice.id || "";
      const pdfInvoiceNumber = result.invoice.invoiceNumber || "";

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
          rate: parseFloat(item.rate) || 0,
          taxType: item.salesTax,
          amount: (parseFloat(item.hours) || 0) * (parseFloat(item.rate) || 0),
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
      });

      // Also update all document-related fields using the main updateInvoice route
      try {
        await updateInvoice(pdfInvoiceId, {
          documentGenerated: true,
          documentPath: pdfUploadData.path || "",
          documentFileName: pdfFileName,
          documentFileSize: pdfBlob.size,
          documentMimeType: "application/pdf",
          documentGeneratedAt: new Date().toISOString(),
        });
      } catch (err) {
        setGenerationError(
          "Invoice PDF uploaded, but failed to update all document fields."
        );
        return;
      }

      // Only use the new message for PDF upload success
      const message = `Invoice ${pdfInvoiceNumber} created and PDF uploaded successfully for ${selectedClient.companyName}.`;
      setGenerationMessage(message);

      // Set created invoice and email states after successful invoice creation/upload
      setCreatedInvoice(result.invoice);
      const emailToSet = result.invoice.invoice_sent_to ||
        result.invoice.client?.emailAddress1 ||
        selectedClient?.emailAddress1 ||
        "";
      console.log("Setting emailToSend in generateInvoice:", {
        invoice_sent_to: result.invoice.invoice_sent_to,
        client_email: result.invoice.client?.emailAddress1,
        selected_client_email: selectedClient?.emailAddress1,
        final_email: emailToSet
      });
      setEmailToSend(emailToSet);
      setShowInvoiceSuccessModal(true);
    } catch (error) {
      console.error("Error creating invoice:", error);
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Failed to create invoice. Please try again."
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
      setSendInvoiceMessage("Missing invoice ID or email address");
      return;
    }

    setIsSendingInvoice(true);
    setSendInvoiceMessage("");
    
    try {
      console.log("=== SENDING INVOICE TO CLIENT ===");
      console.log("Invoice ID:", createdInvoice.id);
      console.log("Email to send:", emailToSend);
      
      // Update the invoice record with email-related fields
      const updateData = {
        emailSent: true,
        emailSentDate: new Date().toISOString(),
        invoice_sent_to: emailToSend
      };
      
      console.log("Update data:", updateData);
      
      // Make API call to update the invoice
      const response = await updateInvoice(createdInvoice.id, updateData);
      
      console.log("Update response:", response);
      
      if (response.success) {
        // Update the local state with the updated invoice
        setCreatedInvoice(response.invoice);
        setSendInvoiceMessage(`Invoice sent successfully to ${emailToSend}`);
      
        console.log("Invoice updated successfully with email info");
      } else {
        throw new Error(response.message || "Failed to update invoice");
      }
    } catch (err) {
      console.error("Error sending invoice:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send invoice. Please try again.";
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

  return (
    <div className="invoice-page-container">
      <AppHeader
        title="Invoice Management"
        hideHamburgerMenu={false}
        statusMessage={generationMessage || generationError}
      />

      <div className="invoice-content-container">
        {/* Client and Payment Terms Selection */}
        <div className="invoice-selection-bar">
          <div className="selection-section">
            <label className="selection-label">
              <Building size={16} />
              Client
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
                placeholder="Search and select client..."
                loading={false}
                icon={<Building size={16} />}
                emptyMessage="No clients found"
              />
            )}
          </div>

          <div className="selection-section">
            <label className="selection-label">
              <FileText size={16} />
              Payment Terms
            </label>
            <CustomDropdown
              options={termsOptions}
              selectedOption={selectedTermsOption}
              onSelect={handleTermsSelect}
              placeholder={
                selectedClient
                  ? "Select payment terms..."
                  : "Please select a client first"
              }
              disabled={!selectedClient}
              loading={false}
              icon={<FileText size={16} />}
              emptyMessage="No payment terms available"
            />
          </div>

          <div className="selection-section">
            <label
              className="selection-label"
              htmlFor="invoice-date-input"
              onClick={handleInvoiceDateClick}
            >
              <Calendar size={16} />
              Invoice Date
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
              Due Date
            </label>
            <input
              id="due-date-input"
              type="date"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="invoice-date-input"
              title="Due date can be manually adjusted if needed"
            />
          </div>
        </div>

        {/* No Clients State */}
        {!clientLoading && clients.length === 0 && (
          <div className="invoice-card empty-state-card">
            <div className="invoice-empty-state">
              <Building size={48} />
              <h3>No Clients Available</h3>
              <p>No clients found for invoice creation.</p>
            </div>
          </div>
        )}

        {/* Invoice Details Section - Similar to Timesheet Unified Header */}
        {selectedClient && (
          <div className="timesheet-unified-header">
            <div className="timesheet-header-sections">
              <div className="timesheet-section timesheet-client-section">
                <h4 className="timesheet-section-title">Client Information</h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      Company Name:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.companyName}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Short Code:</span>
                    <span className="timesheet-detail-value">
                      {selectedClient.shortCode || "N/A"}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      Primary Email:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.emailAddress1}
                    </span>
                  </div>
                </div>
              </div>

              <div className="timesheet-section timesheet-payment-section">
                <h4 className="timesheet-section-title">Payment Details</h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Currency:</span>
                    <span className="timesheet-detail-value">
                      {selectedClient.currency || "CAD"}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      Payment Terms:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedTerms || "Not selected"}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      Payment Method:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.preferredPaymentMethod || "Not specified"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="timesheet-section timesheet-dates-section">
                <h4 className="timesheet-section-title">Invoice & Dates</h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      Invoice Number:
                    </span>
                    <span className="timesheet-detail-value">
                      {invoiceNumberLoading ? (
                        <span className="invoice-number-loading">
                          <Loader2
                            size={14}
                            className="timesheet-loading-spinner"
                          />
                          Generating...
                        </span>
                      ) : invoiceNumber ? (
                        <strong>{invoiceNumber}</strong>
                      ) : (
                        "Not generated"
                      )}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      Invoice Date:
                    </span>
                    <span className="timesheet-detail-value">
                      {invoiceDate
                        ? new Date(invoiceDate).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Not set"}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Due Date:</span>
                    <span className="timesheet-detail-value">
                      {dueDate
                        ? new Date(dueDate).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Not calculated"}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Pay Cycle:</span>
                    <span className="timesheet-detail-value">
                      {selectedClient.payCycle || "Not specified"}
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
              <h3>No Positions Available</h3>
              <p>No positions found for this client.</p>
            </div>
          </div>
        )}

        {selectedClient && !positionLoading && positions.length > 0 && (
          <>
            {/* Line Items Section */}
            <div className="invoice-line-items-container">
              <div className="invoice-line-items-header">
                <h3>Invoice Line Items</h3>
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
                            Position
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
                            placeholder="Select position..."
                            loading={false}
                            icon={<FileText size={16} />}
                            emptyMessage="No positions found"
                          />
                        </div>

                        <div className="selection-section jobseeker-selection">
                          <label className="selection-label">
                            <User size={16} />
                            Job Seeker
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
                                  ? "Select jobseeker..."
                                  : "Please select a position first"
                              }
                              disabled={!lineItem.position}
                              loading={false}
                              icon={<User size={16} />}
                              emptyMessage={
                                lineItem.position
                                  ? "No assigned jobseekers found"
                                  : "Please select a position first"
                              }
                            />
                          )}
                        </div>

                        <div className="selection-section description-selection">
                          <label className="selection-label">
                            <FileText size={16} />
                            Description (Optional)
                          </label>
                          <input
                            type="text"
                            value={lineItem.description}
                            onChange={(e) =>
                              updateLineItem(lineItem.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder="Enter description..."
                            className="invoice-text-input"
                          />
                        </div>

                        <div className="selection-section hours-selection">
                          <label className="selection-label">
                            <FileText size={16} />
                            Hours
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
                            Rate
                          </label>
                          <input
                            type="number"
                            value={lineItem.rate}
                            onChange={(e) =>
                              updateLineItem(lineItem.id, {
                                rate: e.target.value,
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
                            Sales Tax
                          </label>
                          <CustomDropdown
                            options={salesTaxOptions}
                            selectedOption={salesTaxOptions.find(
                              (opt) => opt.value === lineItem.salesTax
                            )}
                            onSelect={(option) =>
                              handleSalesTaxSelect(lineItem.id, option)
                            }
                            placeholder="Select tax..."
                            loading={false}
                            icon={<DollarSign size={16} />}
                            emptyMessage="No sales tax options available"
                          />
                        </div>

                        {/* Action buttons section */}
                        <div className="selection-section line-item-actions">
                          <label className="selection-label">Actions</label>
                          <div className="line-item-buttons">
                            <button
                              className="button secondary"
                              onClick={addLineItem}
                              title="Add new line item"
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              className="button danger"
                              onClick={() => removeLineItem(lineItem.id)}
                              title="Remove line item"
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
                  <h3>Supplier/PO Number Details</h3>
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
                              Supplier No / PO No
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
                              placeholder="Select supplier or PO number..."
                              loading={false}
                              icon={<Building size={16} />}
                              emptyMessage="No options found"
                            />
                          </div>

                          <div className="selection-section supplier-po-number-selection">
                            <label className="selection-label">
                              <FileText size={16} />
                              Supplier/PO #
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
                              placeholder="Enter supplier/PO number..."
                              className="invoice-text-input"
                            />
                          </div>

                          {/* Action buttons section */}
                          <div className="selection-section line-item-actions">
                            <label className="selection-label">Actions</label>
                            <div className="line-item-buttons">
                              <button
                                className="button secondary"
                                onClick={addSupplierPOItem}
                                title="Add new supplier/PO item"
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                className="button danger"
                                onClick={() =>
                                  removeSupplierPOItem(supplierPOItem.id)
                                }
                                title="Remove supplier/PO item"
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
                  <h3>Additional Information</h3>
                </div>

                <div className="message-terms-grid">
                  <div className="selection-section message-section">
                    <label className="selection-label">
                      <FileText size={16} />
                      Message on Invoice
                    </label>
                    <textarea
                      className="invoice-textarea"
                      placeholder="Enter message to appear on invoice..."
                      rows={6}
                      value={messageOnInvoice}
                      onChange={(e) => setMessageOnInvoice(e.target.value)}
                    />
                  </div>

                  <div className="selection-section terms-section">
                    <label className="selection-label">
                      <FileText size={16} />
                      Terms
                    </label>
                    <textarea
                      className="invoice-textarea"
                      placeholder="Enter additional terms and conditions..."
                      rows={6}
                      value={termsOnInvoice}
                      onChange={(e) => setTermsOnInvoice(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Invoice Calculations Container */}
            <div className="timesheet-invoice-container">
              <div className="timesheet-invoice-table">
                <div className="timesheet-invoice-table-header">
                  <div className="timesheet-col-description">Description</div>
                  <div className="timesheet-col-hours">Hours</div>
                  <div className="timesheet-col-rate">Rate</div>
                  <div className="timesheet-col-tax">Tax</div>
                  <div className="timesheet-col-amount">Amount</div>
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
                            {item.position?.title || "No Position Selected"}
                          </div>
                          <div className="timesheet-item-subtitle">
                            {item.jobseeker
                              ? `${item.jobseeker.firstName} ${item.jobseeker.lastName}`.trim()
                              : "No Jobseeker Selected"}
                            {item.description && ` - ${item.description}`}
                          </div>
                        </div>
                        <div className="timesheet-col-hours">
                          {item.hours || "0"}
                        </div>
                        <div className="timesheet-col-rate">
                          ${item.rate || "0.00"}
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
                            Total Hours:
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
                          <div className="timesheet-total-label">Subtotal:</div>
                          <div className="timesheet-total-value">
                            ${subtotal.toFixed(2)}
                          </div>
                        </div>
                        {totalHST > 0 && (
                          <div className="timesheet-total-line">
                            <div className="timesheet-total-label">
                              Total HST:
                            </div>
                            <div className="timesheet-total-value">
                              ${totalHST.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {totalGST > 0 && (
                          <div className="timesheet-total-line">
                            <div className="timesheet-total-label">
                              Total GST:
                            </div>
                            <div className="timesheet-total-value">
                              ${totalGST.toFixed(2)}
                            </div>
                          </div>
                        )}
                        {totalQST > 0 && (
                          <div className="timesheet-total-line">
                            <div className="timesheet-total-label">
                              Total QST:
                            </div>
                            <div className="timesheet-total-value">
                              ${totalQST.toFixed(2)}
                            </div>
                          </div>
                        )}
                        <div className="timesheet-total-line">
                          <div className="timesheet-total-label">
                            Total Tax:
                          </div>
                          <div className="timesheet-total-value">
                            ${totalTax.toFixed(2)}
                          </div>
                        </div>
                        <div className="timesheet-total-line timesheet-grand-total">
                          <div className="timesheet-total-label">
                            Grand Total:
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
            />

            {/* Generate Invoice Section */}
            <div className="timesheet-action-section">
              <div className="timesheet-email-option">
                <label className="timesheet-checkbox-label">
                  <input
                    type="checkbox"
                    checked={emailSent}
                    onChange={(e) => setEmailSent(e.target.checked)}
                    className="timesheet-checkbox"
                  />
                  <span className="timesheet-checkbox-text">
                    Send invoice via email
                  </span>
                </label>
              </div>

              <button
                className={`button ${
                  isGeneratingInvoice ||
                  !selectedClient ||
                  !invoiceNumber ||
                  lineItems.length === 0 ||
                  !lineItems.some(
                    (item) =>
                      parseFloat(item.hours) > 0 && parseFloat(item.rate) > 0
                  )
                    ? "disabled"
                    : ""
                }`}
                onClick={() => {
                  generateInvoice();
                }}
                disabled={
                  isGeneratingInvoice ||
                  !selectedClient ||
                  !invoiceNumber ||
                  lineItems.length === 0 ||
                  !lineItems.some(
                    (item) =>
                      parseFloat(item.hours) > 0 && parseFloat(item.rate) > 0
                  )
                }
              >
                {isGeneratingInvoice ? (
                  <>
                    <Loader2 size={16} className="timesheet-loading-spinner" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Generate Invoice
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
                  loading={<div>Loading PDF...</div>}
                  error={<div>Failed to load PDF.</div>}
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
                    Previous
                  </button>
                  <span>
                    Page {pdfPageNumber} of {pdfNumPages}
                  </span>
                  <button
                    onClick={goToNextPage}
                    disabled={pdfPageNumber >= pdfNumPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Info Right Side */}
            <div className="invoice-success-modal-info-panel">
              <h2>Invoice Created Successfully!</h2>
              <button
                className="button"
                style={{ alignSelf: "center", width: "fit-content" }}
                onClick={handleDownloadInvoice}
                disabled={!pdfBlobUrl}
              >
                <Download /> Download Invoice
              </button>
              <div className="invoice-success-modal-details">
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    Invoice Number:
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    #{createdInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    Client:
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    {createdInvoice.client?.companyName ||
                      selectedClient?.companyName ||
                      "N/A"}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    Date:
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    {createdInvoice.invoiceDate}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    Total:
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    ${createdInvoice.grandTotal}
                  </span>
                </div>
              </div>

              <div className="invoice-success-modal-email-section">
                <label>
                  Send to Email:
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
                  disabled={isSendingInvoice || !emailToSend || !emailToSend.trim()}
                >
                  {isSendingInvoice ? "Sending..." : "Send Invoice to Client"}
                </button>
                {/* Wrap both messages in a fragment to avoid adjacent JSX errors */}
                <>
                  {sendInvoiceMessage && (
                    <div className="invoice-success-modal-message">
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
