import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { DropdownOption } from "../../../components/CustomDropdown";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import { getClients, ClientData } from "../../../services/api/client";
import { getClientPositions } from "../../../services/api/position";
import { getJobseekerProfiles } from "../../../services/api/jobseeker";
import { generateWeekOptions } from "../functions/weekUtils";
import { getPositionDisplayTitle } from "../../../utils/positionDisplay";
import { mapPositionsFromApiResponse } from "../functions/mapClientPositions";
import type { ClientPosition } from "../types";

export function useTimesheetSelection() {
  const location = useLocation();

  // Track whether we've already bootstrapped from URL params (run once only)
  const urlParamsApplied = useRef(false);

  // Parse URL params once on mount
  const urlParams = useRef((() => {
    const params = new URLSearchParams(location.search);
    return {
      profileId: params.get("profileId") ?? "",
      clientId: params.get("clientId") ?? "",
      positionId: params.get("positionId") ?? "",
      weekStart: params.get("weekStart") ?? "",
    };
  })());
  const [jobseekers, setJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedJobseeker, setSelectedJobseeker] =
    useState<JobSeekerProfile | null>(null);
  const [jobseekerLoading, setJobseekerLoading] = useState(false);

  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  const [positions, setPositions] = useState<ClientPosition[]>([]);
  const [selectedPosition, setSelectedPosition] =
    useState<ClientPosition | null>(null);
  const [positionLoading, setPositionLoading] = useState(false);

  const [selectedWeekStart, setSelectedWeekStart] = useState<string>("");
  const [weekOptions, setWeekOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const fetchJobseekers = useCallback(async () => {
    try {
      setJobseekerLoading(true);
      const response = await getJobseekerProfiles({ limit: 100000000 });
      setJobseekers(response.profiles);
    } catch (error) {
      console.error("Error fetching jobseekers:", error);
    } finally {
      setJobseekerLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      setClientLoading(true);
      const response = await getClients({ limit: 100000000 });
      setClients(response.clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setClientLoading(false);
    }
  }, []);

  const fetchClientPositions = useCallback(async (clientId: string) => {
    try {
      setPositionLoading(true);
      const response = await getClientPositions(clientId, {
        limit: 10000000,
        showAllSiblings: "true",
      });
      setPositions(mapPositionsFromApiResponse(response.positions));
    } catch (error) {
      console.error("Error fetching client positions:", error);
      setPositions([]);
    } finally {
      setPositionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobseekers();
    setWeekOptions(generateWeekOptions());
  }, [fetchJobseekers]);

  // One-time: auto-select jobseeker from URL param after jobseekers load
  useEffect(() => {
    const { profileId, weekStart } = urlParams.current;
    if (!profileId || urlParamsApplied.current || jobseekers.length === 0) return;
    const match = jobseekers.find((js) => js.id === profileId);
    if (match) {
      setSelectedJobseeker(match);
      if (weekStart) setSelectedWeekStart(weekStart);
      // Don't mark as fully applied yet — wait for client/position auto-selection
    }
  }, [jobseekers]);

  useEffect(() => {
    if (selectedJobseeker) {
      fetchClients();
      setSelectedClient(null);
      setSelectedPosition(null);
      setPositions([]);
    }
  }, [selectedJobseeker, fetchClients]);

  useEffect(() => {
    if (selectedClient) {
      fetchClientPositions(selectedClient.id!);
      setSelectedPosition(null);
    }
  }, [selectedClient, fetchClientPositions]);

  // One-time: auto-select client from URL param after clients load
  useEffect(() => {
    const { clientId } = urlParams.current;
    if (!clientId || urlParamsApplied.current || clients.length === 0) return;
    const match = clients.find((c) => c.id === clientId);
    if (match) {
      setSelectedClient(match);
    }
  }, [clients]);

  // One-time: auto-select position from URL param after positions load
  useEffect(() => {
    const { positionId } = urlParams.current;
    if (!positionId || positions.length === 0) return;
    const match = positions.find((p) => p.id === positionId);
    if (match) {
      setSelectedPosition(match);
      urlParamsApplied.current = true; // All done — mark applied
    }
  }, [positions]);

  const jobseekerOptions: DropdownOption[] = useMemo(
    () =>
      jobseekers.map((jobseeker) => {
        const phoneNumber = (
          jobseeker as JobSeekerProfile & { phoneNumber?: string }
        ).phoneNumber;
        const employeeId = (
          jobseeker as JobSeekerProfile & { employeeId?: string }
        ).employeeId;
        return {
          id: jobseeker.id,
          label: jobseeker.name || jobseeker.email || "Unknown",
          sublabel: [jobseeker.email, phoneNumber, employeeId]
            .filter(Boolean)
            .join(" - "),
          value: jobseeker,
          isInactive: jobseeker.isInactive,
        };
      }),
    [jobseekers]
  );

  const clientOptions: DropdownOption[] = useMemo(
    () =>
      clients.map((client) => ({
        id: client.id!,
        label: client.companyName || "Unknown Client",
        sublabel: client.shortCode || "",
        value: client,
        isInactive: client.isInactive,
      })),
    [clients]
  );

  const positionOptions: DropdownOption[] = useMemo(
    () =>
      positions.map((position) => ({
        id: position.id,
        label: getPositionDisplayTitle(position),
        sublabel: `${position.positionCode} - ${position.positionNumber}`,
        value: position,
      })),
    [positions]
  );

  const weekDropdownOptions: DropdownOption[] = useMemo(
    () =>
      weekOptions.map((week) => ({
        id: week.value,
        label: week.label,
        value: week.value,
      })),
    [weekOptions]
  );

  const selectedJobseekerOption = selectedJobseeker
    ? jobseekerOptions.find((opt) => opt.id === selectedJobseeker.id)
    : null;

  const selectedClientOption = selectedClient
    ? clientOptions.find((opt) => opt.id === selectedClient.id)
    : null;

  const selectedPositionOption = selectedPosition
    ? positionOptions.find((opt) => opt.id === selectedPosition.id)
    : null;

  const selectedWeekOption = selectedWeekStart
    ? weekDropdownOptions.find((opt) => opt.value === selectedWeekStart)
    : null;

  const handleJobseekerSelect = (
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    setSelectedJobseeker(option.value as JobSeekerProfile);
    setSelectedClient(null);
    setSelectedPosition(null);
  };

  const handleClientSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    setSelectedClient(option.value as ClientData);
    setSelectedPosition(null);
  };

  const handlePositionSelect = (
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    setSelectedPosition(option.value as ClientPosition);
  };

  const handleWeekSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    setSelectedWeekStart(option.value as string);
  };

  const resetSelection = useCallback(() => {
    setSelectedJobseeker(null);
    setSelectedClient(null);
    setSelectedPosition(null);
    setSelectedWeekStart("");
  }, []);

  return {
    jobseekers,
    selectedJobseeker,
    jobseekerLoading,
    clients,
    selectedClient,
    clientLoading,
    positions,
    selectedPosition,
    positionLoading,
    selectedWeekStart,
    weekOptions,
    jobseekerOptions,
    clientOptions,
    positionOptions,
    weekDropdownOptions,
    selectedJobseekerOption,
    selectedClientOption,
    selectedPositionOption,
    selectedWeekOption,
    handleJobseekerSelect,
    handleClientSelect,
    handlePositionSelect,
    handleWeekSelect,
    resetSelection,
  };
}
