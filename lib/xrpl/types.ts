export interface AccountCredentials {
  address: string;
  seed: string;
  publicKey: string;
}

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
  issuerAddress: string;
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
