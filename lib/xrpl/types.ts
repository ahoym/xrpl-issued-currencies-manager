export interface GenerateAccountResponse {
  address: string;
  seed: string;
  publicKey: string;
  balance: string;
}

export interface IssueCurrencyRequest {
  issuerSeed: string;
  recipientAddress: string;
  currencyCode: string;
  amount: string;
  network?: string;
}

export interface TransferRequest {
  senderSeed: string;
  recipientAddress: string;
  issuerAddress?: string;
  currencyCode: string;
  amount: string;
  network?: string;
}

export interface TrustLineRequest {
  seed: string;
  currency: string;
  issuer: string;
  limit: string;
  network?: string;
}

export interface CurrencyBalance {
  currency: string;
  value: string;
  issuer?: string;
}

export interface ApiError {
  error: string;
}

export interface DexAmount {
  currency: string;
  issuer?: string;
  value: string;
}

export type OfferFlag = "passive" | "immediateOrCancel" | "fillOrKill" | "sell" | "hybrid";

export interface CreateOfferRequest {
  seed: string;
  takerGets: DexAmount;
  takerPays: DexAmount;
  flags?: OfferFlag[];
  expiration?: number;
  offerSequence?: number;
  domainID?: string;
  network?: string;
}

export interface CancelOfferRequest {
  seed: string;
  offerSequence: number;
  network?: string;
}

export interface CreateCredentialRequest {
  seed: string;
  subject: string;
  credentialType: string;
  expiration?: number;
  uri?: string;
  network?: string;
}

export interface AcceptCredentialRequest {
  seed: string;
  issuer: string;
  credentialType: string;
  network?: string;
}

export interface DeleteCredentialRequest {
  seed: string;
  subject?: string;
  issuer?: string;
  credentialType: string;
  network?: string;
}

export interface CreateDomainRequest {
  seed: string;
  domainID?: string;
  acceptedCredentials: { issuer: string; credentialType: string }[];
  network?: string;
}

export interface DeleteDomainRequest {
  seed: string;
  domainID: string;
  network?: string;
}

export interface AmmInfoQuery {
  baseCurrency: string;
  baseIssuer?: string;
  quoteCurrency: string;
  quoteIssuer?: string;
  network?: string;
}

export interface CreateAmmRequest {
  seed: string;
  amount: DexAmount;
  amount2: DexAmount;
  tradingFee: number; // 0–1000 (0%–1%)
  network?: string;
}

export interface DepositAmmRequest {
  seed: string;
  asset: { currency: string; issuer?: string };
  asset2: { currency: string; issuer?: string };
  amount?: DexAmount;
  amount2?: DexAmount;
  lpTokenOut?: DexAmount;
  mode: "two-asset" | "single-asset" | "two-asset-if-empty";
  network?: string;
}

export interface WithdrawAmmRequest {
  seed: string;
  asset: { currency: string; issuer?: string };
  asset2: { currency: string; issuer?: string };
  amount?: DexAmount;
  amount2?: DexAmount;
  lpTokenIn?: DexAmount;
  mode: "withdraw-all" | "two-asset" | "single-asset";
  network?: string;
}
