export const NETWORKS = {
  testnet: {
    name: "Testnet",
    url: "wss://s.altnet.rippletest.net:51233",
    faucet: "https://faucet.altnet.rippletest.net",
  },
  devnet: {
    name: "Devnet",
    url: "wss://s.devnet.rippletest.net:51233",
    faucet: "https://faucet.devnet.rippletest.net",
  },
} as const;

export type NetworkId = keyof typeof NETWORKS;

export const EXPLORER_URLS: Record<NetworkId, string> = {
  testnet: "https://testnet.xrpl.org",
  devnet: "https://devnet.xrpl.org",
};

export const DEFAULT_NETWORK: NetworkId = "testnet";

export function resolveNetwork(network?: string): NetworkId {
  if (network && network in NETWORKS) {
    return network as NetworkId;
  }
  return DEFAULT_NETWORK;
}
