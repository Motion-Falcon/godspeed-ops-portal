import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { DropdownOption } from "../../../components/CustomDropdown";
import { getClients } from "../../../services/api/client";

export interface PositionClientOption {
  id: string;
  companyName: string;
  shortCode?: string;
  isInactive?: boolean;
}

interface UsePositionClientsArgs {
  t: (key: string) => string;
  setError: Dispatch<SetStateAction<string | null>>;
}

export function usePositionClients({ t, setError }: UsePositionClientsArgs) {
  const [clients, setClients] = useState<PositionClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setClientLoading(true);
        const response = await getClients({ limit: 1000 });

        const formattedClients = response.clients
          .map((client) => ({
            id: client.id || "",
            companyName: client.companyName || "",
            shortCode: client.shortCode || "",
            isInactive: client.isInactive,
          }))
          .filter((client) => client.id && client.companyName);

        setClients(formattedClients);
      } catch (err) {
        console.error("Error fetching clients:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : t("positionCreate.errors.failedToFetchClients");
        setError(errorMessage);
        setTimeout(() => setError(null), 3000);
      } finally {
        setClientLoading(false);
      }
    };

    fetchClients();
  }, [setError, t]);

  const clientOptions: DropdownOption[] = useMemo(
    () =>
      clients.map((client) => ({
        id: client.id,
        value: client.id,
        label: client.companyName,
        isInactive: client.isInactive,
      })),
    [clients]
  );

  const copyFromClientOptions: DropdownOption[] = useMemo(
    () =>
      clients.map((client) => ({
        id: client.id,
        value: client.id,
        label: client.companyName,
        sublabel: client.shortCode || "",
        isInactive: client.isInactive,
      })),
    [clients]
  );

  return {
    clients,
    clientLoading,
    clientOptions,
    copyFromClientOptions,
  };
}
