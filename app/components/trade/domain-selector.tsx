"use client";

import type { DomainInfo } from "@/lib/types";

interface DomainSelectorProps {
  domainMode: "open" | "select" | "custom";
  selectedDomainID: string;
  customDomainID: string;
  availableDomains: DomainInfo[];
  activeDomainID: string | undefined;
  onDomainModeChange: (mode: "open" | "select" | "custom") => void;
  onSelectedDomainIDChange: (id: string) => void;
  onCustomDomainIDChange: (id: string) => void;
}

export function DomainSelector({
  domainMode,
  selectedDomainID,
  customDomainID,
  availableDomains,
  activeDomainID,
  onDomainModeChange,
  onSelectedDomainIDChange,
  onCustomDomainIDChange,
}: DomainSelectorProps) {
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          DEX Mode:
        </label>
        <select
          value={domainMode}
          onChange={(e) => {
            onDomainModeChange(e.target.value as "open" | "select" | "custom");
            onSelectedDomainIDChange("");
            onCustomDomainIDChange("");
          }}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="open">Open DEX</option>
          {availableDomains.length > 0 && <option value="select">Permissioned Domain</option>}
          <option value="custom">Custom Domain ID</option>
        </select>
        {domainMode === "select" && (
          <select
            value={selectedDomainID}
            onChange={(e) => onSelectedDomainIDChange(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">Select domain...</option>
            {availableDomains.map((d) => (
              <option key={d.domainID} value={d.domainID}>
                {d.domainID.slice(0, 16)}... ({d.acceptedCredentials.map((ac) => ac.credentialType).join(", ")})
              </option>
            ))}
          </select>
        )}
        {domainMode === "custom" && (
          <input
            type="text"
            value={customDomainID}
            onChange={(e) => onCustomDomainIDChange(e.target.value)}
            placeholder="Enter Domain ID (64-char hex)"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        )}
        {activeDomainID && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
            Permissioned
          </span>
        )}
      </div>
    </div>
  );
}
