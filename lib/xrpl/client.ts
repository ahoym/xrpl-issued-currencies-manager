import { Client } from "xrpl";
import { NETWORKS, resolveNetwork } from "./networks";

let currentClient: Client | null = null;
let currentNetwork: string | null = null;

export async function getClient(network?: string): Promise<Client> {
  const networkId = resolveNetwork(network);
  const url = NETWORKS[networkId].url;

  if (currentClient && currentNetwork === networkId) {
    if (currentClient.isConnected()) {
      return currentClient;
    }
    // Connection dropped — reconnect
    try {
      await currentClient.connect();
      return currentClient;
    } catch (err) {
      console.warn("XRPL client reconnect failed:", err);
    }
  }

  // Different network or no client — close old one if it exists
  if (currentClient) {
    try {
      await currentClient.disconnect();
    } catch (err) {
      console.warn("XRPL client disconnect failed:", err);
    }
  }

  currentClient = new Client(url);
  currentNetwork = networkId;
  await currentClient.connect();
  return currentClient;
}
