export interface WalletInfo {
  address: string;
  seed: string;
  publicKey: string;
}

export interface PersistedState {
  network: "testnet" | "devnet";
  issuer: WalletInfo | null;
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
