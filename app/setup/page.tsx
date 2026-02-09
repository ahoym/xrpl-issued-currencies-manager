'use client';

import { useState, useEffect } from 'react';
import { useAppState } from '@/lib/hooks/use-app-state';
import { useIssuerCurrencies } from '@/lib/hooks/use-issuer-currencies';
import { LoadingScreen } from '../components/loading-screen';
import { SecurityWarning } from './components/security-warning';
import { IssuerSetup } from './components/issuer-setup';
import { RecipientWallets } from './components/recipient-wallets';
import demoState from '@/examples/setup-state-testnet-2026-02-08.json';

export default function Home() {
  const {
    state,
    hydrated,
    setIssuer,
    addCurrency,
    removeCurrency,
    addRecipient,
    importState,
    clearAll,
  } = useAppState();

  const [refreshKey, setRefreshKey] = useState(0);
  const [showJson, setShowJson] = useState(false);

  const { onLedgerCurrencies } = useIssuerCurrencies(
    state.issuer?.address,
    state.network,
    refreshKey,
  );

  // Auto-merge on-ledger currencies into local state
  useEffect(() => {
    for (const code of onLedgerCurrencies) {
      if (!state.currencies.includes(code)) {
        addCurrency(code);
      }
    }
  }, [onLedgerCurrencies]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleImport() {
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

          const isWallet = (w: unknown): boolean =>
            !!w && typeof w === 'object' &&
            typeof (w as Record<string, unknown>).address === 'string' &&
            typeof (w as Record<string, unknown>).seed === 'string' &&
            typeof (w as Record<string, unknown>).publicKey === 'string';

          if (
            !parsed ||
            (parsed.network !== 'testnet' && parsed.network !== 'devnet') ||
            !Array.isArray(parsed.currencies) ||
            !parsed.currencies.every((c: unknown) => typeof c === 'string') ||
            !Array.isArray(parsed.recipients) ||
            !parsed.recipients.every(isWallet) ||
            !('issuer' in parsed) ||
            (parsed.issuer !== null && !isWallet(parsed.issuer))
          ) {
            alert(
              'Invalid file: network must be testnet or devnet, and wallet objects must have address, seed, and publicKey string fields.',
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
  }

  function handleLoadDemo() {
    if (state.issuer || state.recipients.length > 0) {
      if (!window.confirm('This will replace all current data. Continue?')) return;
    }
    importState(demoState as Parameters<typeof importState>[0]);
  }

  function handleExport() {
    const exportState = {
      ...state,
      currencies: state.currencies.filter((c) => onLedgerCurrencies.has(c)),
    };
    const blob = new Blob([JSON.stringify(exportState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xrpl-wallets-${state.network}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">XRPL Issued Currencies Manager</h1>

      <div className="mt-6 space-y-6">
        <IssuerSetup
          issuer={state.issuer}
          currencies={state.currencies}
          onLedgerCurrencies={onLedgerCurrencies}
          refreshKey={refreshKey}
          onGenerate={setIssuer}
          onAddCurrency={addCurrency}
          onRemoveCurrency={removeCurrency}
        />

        <RecipientWallets
          recipients={state.recipients}
          issuer={state.issuer}
          currencies={state.currencies}
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
            onClick={handleLoadDemo}
            className="rounded-md border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950"
          >
            Load Demo
          </button>
          <button
            onClick={handleImport}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Import JSON
          </button>
          <button
            onClick={handleExport}
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
            {JSON.stringify(
              {
                ...state,
                currencies: state.currencies.filter((c) => onLedgerCurrencies.has(c)),
              },
              null,
              2,
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
