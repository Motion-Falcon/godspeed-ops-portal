import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getTimesheets,
  type TimesheetListItem,
  type TimesheetListFilters,
  type PaginatedTimesheetsResponse,
  sendTimesheetEmails,
} from "../../../services/api/timesheet";
import type { TimesheetPaginationMeta } from "../../../services/types/timesheet";

const DEFAULT_META: TimesheetPaginationMeta = {
  page: 1,
  limit: 25,
  total: 0,
  totalFiltered: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

export interface TimesheetsListT {
  (key: string, options?: Record<string, string | number>): string;
}

export interface UseTimesheetsListResult {
  timesheets: TimesheetListItem[];
  loading: boolean;
  error: string | null;
  message: string | null;

  pagination: TimesheetPaginationMeta;

  invoiceNumberFilter: string;
  setInvoiceNumberFilter: Dispatch<SetStateAction<string>>;
  clientFilter: string;
  setClientFilter: Dispatch<SetStateAction<string>>;
  positionFilter: string;
  setPositionFilter: Dispatch<SetStateAction<string>>;
  jobseekerFilter: string;
  setJobseekerFilter: Dispatch<SetStateAction<string>>;
  billingEmailFilter: string;
  setBillingEmailFilter: Dispatch<SetStateAction<string>>;
  dateRangeStart: string;
  setDateRangeStart: Dispatch<SetStateAction<string>>;
  dateRangeEnd: string;
  setDateRangeEnd: Dispatch<SetStateAction<string>>;
  emailSentFilter: string;
  setEmailSentFilter: Dispatch<SetStateAction<string>>;

  sendingJobseekerEmail: Record<string, boolean>;

  timesheetToDelete: TimesheetListItem | null;
  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
  deleteError: string | null;

  handlePageChange: (newPage: number) => void;
  handleLimitChange: (newLimit: number) => void;
  handlePreviousPage: () => void;
  handleNextPage: () => void;
  handleCancelDelete: () => void;
  handleConfirmDelete: () => Promise<void>;
  sendEmailToJobseeker: (timesheetId: string, jobseekerName: string) => Promise<void>;
  handleEditTimesheet: (timesheet: TimesheetListItem) => void;
}

export function useTimesheetsList(t: TimesheetsListT): UseTimesheetsListResult {
  const navigate = useNavigate();
  const location = useLocation();

  /** Skip resetting page once after URL parses so bookmarked page+filters work. */
  const skipFirstFilterDerivedPageReset = useRef(true);

  const [timesheets, setTimesheets] = useState<TimesheetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [jobseekerFilter, setJobseekerFilter] = useState("");
  const [billingEmailFilter, setBillingEmailFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [emailSentFilter, setEmailSentFilter] = useState("");

  const [pagination, setPagination] =
    useState<TimesheetPaginationMeta>(DEFAULT_META);

  const [initializedFromLocation, setInitializedFromLocation] = useState(false);

  const [timesheetToDelete, setTimesheetToDelete] =
    useState<TimesheetListItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [sendingJobseekerEmail, setSendingJobseekerEmail] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("searchTerm") || "");
    setInvoiceNumberFilter(params.get("invoiceNumber") || "");
    setClientFilter(params.get("client") || "");
    setPositionFilter(params.get("position") || "");
    setJobseekerFilter(params.get("jobseeker") || "");
    setBillingEmailFilter(params.get("billingEmail") || "");
    setDateRangeStart(params.get("dateRangeStart") || "");
    setDateRangeEnd(params.get("dateRangeEnd") || "");
    setEmailSentFilter(params.get("emailSent") || "");

    const pageParam = params.get("page");
    const limitParam = params.get("limit");
    if (pageParam || limitParam) {
      setPagination((prev) => ({
        ...prev,
        page: pageParam ? Math.max(1, parseInt(pageParam, 10)) : prev.page,
        limit: limitParam ? Math.max(1, parseInt(limitParam, 10)) : prev.limit,
      }));
    }
    skipFirstFilterDerivedPageReset.current = true;
    setInitializedFromLocation(true);
  }, [location.search]);

  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  }, []);

  const handlePreviousPage = useCallback(() => {
    setPagination((prev) => {
      if (!prev.hasPrevPage) return prev;
      return { ...prev, page: prev.page - 1 };
    });
  }, []);

  const handleNextPage = useCallback(() => {
    setPagination((prev) => {
      if (!prev.hasNextPage) return prev;
      return { ...prev, page: prev.page + 1 };
    });
  }, []);

  useEffect(() => {
    if (!initializedFromLocation) return;
    if (skipFirstFilterDerivedPageReset.current) {
      skipFirstFilterDerivedPageReset.current = false;
      return;
    }
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [
    searchTerm,
    jobseekerFilter,
    clientFilter,
    invoiceNumberFilter,
    positionFilter,
    billingEmailFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
    initializedFromLocation,
  ]);

  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: TimesheetListFilters = {
        page: pagination.page,
        limit: pagination.limit,
        searchTerm,
        jobseekerFilter,
        clientFilter,
        positionFilter,
        invoiceNumberFilter,
        billingEmailFilter,
        dateRangeStart,
        dateRangeEnd,
        emailSentFilter,
        excludeBulk: true,
      };
      const response: PaginatedTimesheetsResponse = await getTimesheets(params);
      setTimesheets(response.timesheets);
      setPagination(response.pagination);
    } catch {
      setError(t("bulkTimesheetManagement.messages.failedToFetch"));
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    jobseekerFilter,
    clientFilter,
    invoiceNumberFilter,
    positionFilter,
    billingEmailFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
    t,
  ]);

  useEffect(() => {
    if (!initializedFromLocation) return;
    const timeoutId = window.setTimeout(() => {
      void fetchTimesheets();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchTimesheets, initializedFromLocation]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
    setTimesheetToDelete(null);
    setDeleteError(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    // Placeholder until delete API wired — modal kept for parity with prior UI shell
  }, []);

  const sendEmailToJobseeker = useCallback(
    async (timesheetId: string, jobseekerName: string) => {
      const key = timesheetId;
      setSendingJobseekerEmail((prev) => ({ ...prev, [key]: true }));
      setError(null);
      try {
        const response = await sendTimesheetEmails(timesheetId);
        setMessage(
          response.message ||
            t("bulkTimesheetManagement.messages.emailSentTo", {
              name: jobseekerName,
            })
        );
        window.setTimeout(() => setMessage(null), 4000);

        setTimesheets((prevTimesheets) =>
          prevTimesheets.map((ts) =>
            ts.id === timesheetId ? { ...ts, email_sent: true } : ts
          )
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("bulkTimesheetManagement.messages.failedToSendEmail", {
                name: jobseekerName,
              })
        );
        window.setTimeout(() => setError(null), 4000);
      } finally {
        setSendingJobseekerEmail((prev) => ({ ...prev, [key]: false }));
      }
    },
    [t]
  );

  const handleEditTimesheet = useCallback(
    (timesheet: TimesheetListItem) => {
      const profileId = timesheet.jobseeker_profiles?.id ?? "";
      const clientId = timesheet.positions?.client ?? "";
      const positionId = timesheet.positions?.id ?? "";
      const weekStart = timesheet.week_start_date ?? "";

      const params = new URLSearchParams();
      if (profileId) params.set("profileId", profileId);
      if (clientId) params.set("clientId", clientId);
      if (positionId) params.set("positionId", positionId);
      if (weekStart) params.set("weekStart", weekStart);

      navigate(`/timesheet-management?${params.toString()}`);
    },
    [navigate]
  );

  return {
    timesheets,
    loading,
    error,
    message,
    pagination,

    invoiceNumberFilter,
    setInvoiceNumberFilter,
    clientFilter,
    setClientFilter,
    positionFilter,
    setPositionFilter,
    jobseekerFilter,
    setJobseekerFilter,
    billingEmailFilter,
    setBillingEmailFilter,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    emailSentFilter,
    setEmailSentFilter,

    sendingJobseekerEmail,

    timesheetToDelete,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    deleteError,

    handlePageChange,
    handleLimitChange,
    handlePreviousPage,
    handleNextPage,
    handleCancelDelete,
    handleConfirmDelete,
    sendEmailToJobseeker,
    handleEditTimesheet,
  };
}
