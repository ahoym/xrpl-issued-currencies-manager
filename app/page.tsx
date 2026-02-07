'use client';

import { useState } from 'react';
import { useAppState } from '@/lib/hooks/use-app-state';
import { NetworkSelector } from './components/network-selector';
import { SecurityWarning } from './components/security-warning';
import { IssuerSetup } from './components/issuer-setup';
import { RecipientWallets } from './components/recipient-wallets';

export default function Home() {
  const {
    state,
    hydrated,
    setNetwork,
    setIssuer,
    addCurrency,
    removeCurrency,
    addRecipient,
    importState,
    clearAll,
  } = useAppState();

  const [refreshKey, setRefreshKey] = useState(0);
  const [showJson, setShowJson] = useState(false);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">XRPL Issued Currencies Manager</h1>
        <NetworkSelector network={state.network} onChange={setNetwork} />
      </div>

      <div className="mt-6 space-y-6">
        <IssuerSetup
          issuer={state.issuer}
          network={state.network}
          currencies={state.currencies}
          refreshKey={refreshKey}
          onGenerate={setIssuer}
          onAddCurrency={addCurrency}
          onRemoveCurrency={removeCurrency}
        />

        <RecipientWallets
          recipients={state.recipients}
          issuer={state.issuer}
          currencies={state.currencies}
          network={state.network}
          disabled={!state.issuer || state.currencies.length === 0}
          refreshKey={refreshKey}
          onGenerate={addRecipient}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      <div className="mt-8">
        <SecurityWarning />
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="flex gap-3">
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const parsed = JSON.parse(reader.result as string);
                    if (
                      !parsed ||
                      typeof parsed.network !== 'string' ||
                      !Array.isArray(parsed.currencies) ||
                      !Array.isArray(parsed.recipients) ||
                      !('issuer' in parsed)
                    ) {
                      alert(
                        'Invalid file: missing required fields (network, issuer, currencies, recipients).',
                      );
                      return;
                    }
                    if (state.issuer || state.recipients.length > 0) {
                      if (
                        !window.confirm(
                          'This will replace all current data. Continue?',
                        )
                      )
                        return;
                    }
                    importState(parsed);
                  } catch {
                    alert('Failed to parse JSON file.');
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Import JSON
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(state, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `xrpl-wallets-${state.network}-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!state.issuer && state.recipients.length === 0}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Export as JSON
          </button>
          <button
            onClick={() => setShowJson((v) => !v)}
            disabled={!state.issuer && state.recipients.length === 0}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {showJson ? 'Hide JSON' : 'View JSON'}
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Clear all stored wallets and data? This cannot be undone.',
                )
              ) {
                clearAll();
              }
            }}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
          >
            Clear All Data
          </button>
        </div>
        {showJson && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-zinc-50 p-4 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {JSON.stringify(state, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
