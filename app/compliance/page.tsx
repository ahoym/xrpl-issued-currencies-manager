"use client";

import { useState } from "react";
import { useAppState } from "@/lib/hooks/use-app-state";
import { useWalletGeneration } from "@/lib/hooks/use-wallet-generation";
import { useAccountCredentials } from "@/lib/hooks/use-account-credentials";
import { useAccountDomains } from "@/lib/hooks/use-account-domains";
import { LoadingScreen } from "../components/loading-screen";
import { WalletSetupCard } from "../components/wallet-setup-card";
import { IssueCredentialForm } from "../components/compliance/issue-credential-form";
import { IssuedCredentialsTable } from "../components/compliance/issued-credentials-table";
import { RecipientCredentials } from "../components/compliance/recipient-credentials";
import { CreateDomainForm, type EditingDomain } from "../components/compliance/create-domain-form";
import { DomainsList } from "../components/compliance/domains-list";

type Tab = "credentials" | "domains";

export default function CompliancePage() {
  const { state, hydrated, setCredentialIssuer, setDomainOwner } = useAppState();

  const credIssuerGen = useWalletGeneration();
  const domainOwnerGen = useWalletGeneration();

  const {
    credentials: issuedCredentials,
    loading: loadingIssued,
    refresh: refreshIssued,
  } = useAccountCredentials(
    state.credentialIssuer?.address,
    state.network,
    "issuer",
  );

  const {
    domains,
    loading: loadingDomains,
    refresh: refreshDomains,
  } = useAccountDomains(state.domainOwner?.address, state.network);

  const [activeTab, setActiveTab] = useState<Tab>("credentials");
  const [editingDomain, setEditingDomain] = useState<EditingDomain | null>(null);

  function handleCredentialChange() {
    refreshIssued();
  }

  if (!hydrated) return <LoadingScreen />;

  const genError = credIssuerGen.error || domainOwnerGen.error;

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Compliance</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Manage credentials (XLS-70) and permissioned domains (XLS-80).
      </p>

      {/* Wallet Setup */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <WalletSetupCard
          title="Credential Issuer"
          wallet={state.credentialIssuer}
          loading={credIssuerGen.loading}
          onGenerate={() =>
            credIssuerGen.generate(state.network, setCredentialIssuer)
          }
        />
        <WalletSetupCard
          title="Domain Owner"
          wallet={state.domainOwner}
          loading={domainOwnerGen.loading}
          onGenerate={() =>
            domainOwnerGen.generate(state.network, setDomainOwner)
          }
        />
      </div>

      {genError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{genError}</p>
      )}

      {/* Tabs */}
      <div className="mt-8 flex border-b border-zinc-200 dark:border-zinc-800">
        <button className={tabClass("credentials")} onClick={() => setActiveTab("credentials")}>
          Credentials
        </button>
        <button className={tabClass("domains")} onClick={() => setActiveTab("domains")}>
          Domains
        </button>
      </div>

      {/* Credentials Tab */}
      {activeTab === "credentials" && (
        <div className="mt-4 space-y-4">
          {state.credentialIssuer ? (
            <>
              <IssueCredentialForm
                credentialIssuer={state.credentialIssuer}
                recipients={state.recipients}
                network={state.network}
                onIssued={handleCredentialChange}
              />
              <IssuedCredentialsTable
                credentials={issuedCredentials}
                loading={loadingIssued}
                issuerSeed={state.credentialIssuer.seed}
                network={state.network}
                onDeleted={handleCredentialChange}
              />
              <RecipientCredentials
                recipients={state.recipients}
                issuedCredentials={issuedCredentials}
                network={state.network}
                onChanged={handleCredentialChange}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Generate a Credential Issuer wallet above to get started.
            </p>
          )}
        </div>
      )}

      {/* Domains Tab */}
      {activeTab === "domains" && (
        <div className="mt-4 space-y-4">
          {state.domainOwner ? (
            <>
              <DomainsList
                domains={domains}
                loading={loadingDomains}
                domainOwner={state.domainOwner}
                network={state.network}
                onDeleted={refreshDomains}
                onEdit={(d) => setEditingDomain({ domainID: d.domainID, acceptedCredentials: d.acceptedCredentials })}
              />
              <CreateDomainForm
                domainOwner={state.domainOwner}
                defaultCredentialIssuer={state.credentialIssuer?.address}
                network={state.network}
                editingDomain={editingDomain}
                onSaved={refreshDomains}
                onCancelEdit={() => setEditingDomain(null)}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Generate a Domain Owner wallet above to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
