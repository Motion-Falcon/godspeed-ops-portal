import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { DropdownOption } from "../../../components/CustomDropdown";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import { getClients, type ClientData } from "../../../services/api/client";
import { getClientPositions } from "../../../services/api/position";
import { getJobseekerProfiles } from "../../../services/api/jobseeker";
import { generateWeekOptions } from "../functions/weekUtils";
import { mapPositionsFromApiResponse } from "../functions/mapClientPositions";
import type { ClientPosition } from "../types";

export function useBulkJobseekerTimesheetSelection() {
  const location = useLocation();
  const urlParamsApplied = useRef(false);

  const urlParams = useRef((() => {
    const params = new URLSearchParams(location.search);
    return {
      profileId: params.get("profileId") ?? "",
      clientId: params.get("clientId") ?? "",
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
  const [positionLoading, setPositionLoading] = useState(false);

  const [weekOptions, setWeekOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>("");

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

  useEffect(() => {
    void fetchJobseekers();
    setWeekOptions(generateWeekOptions());
  }, [fetchJobseekers]);

  useEffect(() => {
    const { profileId, weekStart } = urlParams.current;
    if (!profileId || urlParamsApplied.current || jobseekers.length === 0) return;
    const match = jobseekers.find((js) => js.id === profileId);
    if (match) {
      setSelectedJobseeker(match);
      if (weekStart) setSelectedWeekStart(weekStart);
    }
  }, [jobseekers]);

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

  useEffect(() => {
    const { clientId } = urlParams.current;
    if (!clientId || urlParamsApplied.current || clients.length === 0) return;
    const match = clients.find((c) => c.id === clientId);
    if (match) {
      setSelectedClient(match);
      urlParamsApplied.current = true;
    }
  }, [clients]);

  useEffect(() => {
    if (selectedJobseeker) {
      void fetchClients();
      setSelectedClient(null);
      setPositions([]);
    }
  }, [selectedJobseeker, fetchClients]);

  const fetchClientPositions = useCallback(async (clientId: string) => {
    try {
      setPositionLoading(true);
      const response = await getClientPositions(clientId, {
        limit: 10000000,
        showAllSiblings: "true",
      });
      setPositions(mapPositionsFromApiResponse(response.positions));
    } catch {
      setPositions([]);
    } finally {
      setPositionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClient?.id) {
      void fetchClientPositions(selectedClient.id);
    } else {
      setPositions([]);
    }
  }, [selectedClient, fetchClientPositions]);

  const jobseekerOptions: DropdownOption[] = useMemo(
    () =>
      jobseekers
        .filter((profile) => !profile.isInactive)
        .map((profile) => {
          const extras = profile as JobSeekerProfile & { employeeId?: string };
          return {
            id: profile.id,
            label: profile.name || profile.email || "Unknown",
            sublabel: [profile.email, extras.employeeId, profile.phoneNumber]
              .filter(Boolean)
              .join(" — "),
            value: profile,
          };
        })
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
        ),
    [jobseekers]
  );

  const clientOptions: DropdownOption[] = useMemo(
    () =>
      clients
        .filter((client) => !client.isInactive)
        .map((client) => ({
          id: client.id!,
          label: client.companyName || "Unknown Client",
          sublabel: client.shortCode || "",
          value: client,
        })),
    [clients]
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

  const selectedWeekOption = selectedWeekStart
    ? weekDropdownOptions.find((opt) => opt.value === selectedWeekStart)
    : null;

  const resetSelection = useCallback(() => {
    setSelectedJobseeker(null);
    setSelectedClient(null);
    setSelectedWeekStart("");
    setPositions([]);
    setClients([]);
  }, []);

  return {
    jobseekers,
    selectedJobseeker,
    setSelectedJobseeker,
    jobseekerLoading,
    clients,
    selectedClient,
    setSelectedClient,
    clientLoading,
    /** All positions for the selected client (no assignment filter). */
    assignablePositions: positions,
    positionLoading,
    weekOptions,
    selectedWeekStart,
    setSelectedWeekStart,
    jobseekerOptions,
    clientOptions,
    weekDropdownOptions,
    selectedJobseekerOption,
    selectedClientOption,
    selectedWeekOption,
    resetSelection,
  };
}