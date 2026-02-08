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
import { CreateDomainForm } from "../components/compliance/create-domain-form";
import { DomainsList } from "../components/compliance/domains-list";

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

  // Shared refresh key for recipient credentials (triggered by issue/accept/delete)
  const [recipientRefreshKey, setRecipientRefreshKey] = useState(0);

  function handleCredentialChange() {
    refreshIssued();
    setRecipientRefreshKey((k) => k + 1);
  }

  if (!hydrated) return <LoadingScreen />;

  const genError = credIssuerGen.error || domainOwnerGen.error;

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

      {/* Credentials Section */}
      {state.credentialIssuer && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Credentials</h2>
          <div className="mt-4 space-y-4">
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
              network={state.network}
              refreshKey={recipientRefreshKey}
            />
          </div>
        </section>
      )}

      {/* Domains Section */}
      {state.domainOwner && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Permissioned Domains</h2>
          <div className="mt-4 space-y-4">
            <CreateDomainForm
              domainOwner={state.domainOwner}
              defaultCredentialIssuer={state.credentialIssuer?.address}
              network={state.network}
              onCreated={refreshDomains}
            />
            <DomainsList
              domains={domains}
              loading={loadingDomains}
              domainOwner={state.domainOwner}
              network={state.network}
              onDeleted={refreshDomains}
            />
          </div>
        </section>
      )}
    </div>
  );
}
