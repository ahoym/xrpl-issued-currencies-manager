export interface WalletInfo {
  address: string;
  seed: string;
  publicKey: string;
}

export interface PersistedState {
  network: "testnet" | "devnet";
  issuer: WalletInfo | null;
  credentialIssuer: WalletInfo | null;
  domainOwner: WalletInfo | null;
  currencies: string[];
  recipients: WalletInfo[];
}

export type NetworkData = Omit<PersistedState, "network">;

export interface TrustLine {
  account: string;
  currency: string;
  balance: string;
  limit: string;
}

export interface BalanceEntry {
  currency: string;
  value: string;
  issuer?: string;
}

export interface OrderBookAmount {
  currency: string;
  value: string;
  issuer?: string;
}

export interface OrderBookEntry {
  account: string;
  taker_gets: OrderBookAmount;
  taker_pays: OrderBookAmount;
  quality: string;
  sequence: number;
}

export interface CredentialInfo {
  issuer: string;
  subject: string;
  credentialType: string;
  accepted: boolean;
  expiration?: number;
  uri?: string;
}

export interface DomainInfo {
  domainID: string;
  owner: string;
  acceptedCredentials: { issuer: string; credentialType: string }[];
  sequence: number;
}
