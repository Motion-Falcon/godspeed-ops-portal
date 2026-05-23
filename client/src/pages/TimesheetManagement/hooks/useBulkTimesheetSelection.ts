import { useCallback, useEffect, useMemo, useState } from "react";
import { getClients, type ClientData } from "../../../services/api/client";
import {
  getClientPositions,
  getPositionAssignments,
  type AssignmentRecord,
  type PositionData,
} from "../../../services/api/position";
import { generateWeekOptions } from "../functions/weekUtils";
import { mapPositionsFromApiResponse } from "../functions/mapClientPositions";
import type { ClientPosition } from "../types";

export function useBulkTimesheetSelection() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  const [positions, setPositions] = useState<PositionData[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(
    null
  );
  const [positionLoading, setPositionLoading] = useState(false);

  const [weekOptions, setWeekOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState("");

  const [assignedJobseekers, setAssignedJobseekers] = useState<
    AssignmentRecord[]
  >([]);

  const clientPosition: ClientPosition | null = useMemo(() => {
    if (!selectedPosition?.id) return null;
    const mapped = mapPositionsFromApiResponse([selectedPosition]);
    return mapped[0] ?? null;
  }, [selectedPosition]);

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
    setPositionLoading(true);
    try {
      const response = await getClientPositions(clientId, {
        limit: 1000000,
        showAllSiblings: "true",
      });
      setPositions(response.positions);
    } catch {
      setPositions([]);
    } finally {
      setPositionLoading(false);
    }
  }, []);

  const fetchAssignedJobseekers = useCallback(async (positionId: string) => {
    try {
      const response = await getPositionAssignments(positionId);
      setAssignedJobseekers(response.assignments || []);
    } catch {
      setAssignedJobseekers([]);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
    setWeekOptions(generateWeekOptions());
  }, [fetchClients]);

  useEffect(() => {
    if (selectedClient?.id) {
      setPositionLoading(true);
      void fetchClientPositions(selectedClient.id);
      setSelectedPosition(null);
      setPositions([]);
      setAssignedJobseekers([]);
    }
  }, [selectedClient, fetchClientPositions]);

  useEffect(() => {
    if (selectedPosition?.id) {
      void fetchAssignedJobseekers(selectedPosition.id);
    } else {
      setAssignedJobseekers([]);
    }
  }, [selectedPosition, fetchAssignedJobseekers]);

  const resetSelection = useCallback(() => {
    setSelectedClient(null);
    setSelectedPosition(null);
    setSelectedWeekStart("");
    setAssignedJobseekers([]);
    setPositions([]);
  }, []);

  return {
    clients,
    selectedClient,
    setSelectedClient,
    clientLoading,
    positions,
    selectedPosition,
    setSelectedPosition,
    positionLoading,
    clientPosition,
    weekOptions,
    selectedWeekStart,
    setSelectedWeekStart,
    assignedJobseekers,
    resetSelection,
  };
}
