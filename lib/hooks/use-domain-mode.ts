"use client";

import { useState } from "react";
import { useAccountDomains } from "./use-account-domains";
import type { PersistedState } from "../types";

export function useDomainMode(
  domainOwnerAddress: string | null | undefined,
  network: PersistedState["network"],
) {
  const [domainMode, setDomainMode] = useState<"open" | "select" | "custom">("open");
  const [selectedDomainID, setSelectedDomainID] = useState("");
  const [customDomainID, setCustomDomainID] = useState("");
  const { domains: availableDomains } = useAccountDomains(domainOwnerAddress, network);

  const activeDomainID =
    domainMode === "select"
      ? selectedDomainID
      : domainMode === "custom"
        ? customDomainID
        : undefined;

  return {
    domainMode,
    setDomainMode,
    selectedDomainID,
    setSelectedDomainID,
    customDomainID,
    setCustomDomainID,
    activeDomainID,
    availableDomains,
  };
}
