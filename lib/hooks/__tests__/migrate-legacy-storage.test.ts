import { describe, it, expect, beforeEach } from "vitest";
import { migrateLegacyStorage } from "../use-app-state";

const OLD_KEY = "xrpl-manager-state";
const NETWORK_KEY = "xrpl-manager-network";

function networkDataKey(network: string) {
  return `xrpl-manager-state-${network}`;
}

describe("migrateLegacyStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no legacy data exists", () => {
    expect(migrateLegacyStorage()).toBeNull();
  });

  it("migrates legacy state to per-network storage", () => {
    const legacy = {
      network: "testnet",
      issuer: { address: "rIssuer", seed: "sIssuer" },
      credentialIssuer: null,
      domainOwner: null,
      currencies: ["USD", "EUR"],
      recipients: [],
    };
    localStorage.setItem(OLD_KEY, JSON.stringify(legacy));

    const result = migrateLegacyStorage();

    expect(result).toBe("testnet");
    // Old key removed
    expect(localStorage.getItem(OLD_KEY)).toBeNull();
    // Network key set
    expect(localStorage.getItem(NETWORK_KEY)).toBe("testnet");
    // Per-network data written (without the network field)
    const stored = JSON.parse(localStorage.getItem(networkDataKey("testnet"))!);
    expect(stored.issuer).toEqual({ address: "rIssuer", seed: "sIssuer" });
    expect(stored.currencies).toEqual(["USD", "EUR"]);
    expect(stored).not.toHaveProperty("network");
  });

  it("migrates devnet legacy state correctly", () => {
    const legacy = {
      network: "devnet",
      issuer: null,
      credentialIssuer: null,
      domainOwner: null,
      currencies: [],
      recipients: [],
    };
    localStorage.setItem(OLD_KEY, JSON.stringify(legacy));

    expect(migrateLegacyStorage()).toBe("devnet");
    expect(localStorage.getItem(NETWORK_KEY)).toBe("devnet");
    expect(localStorage.getItem(networkDataKey("devnet"))).toBeTruthy();
  });

  it("returns null for corrupt JSON", () => {
    localStorage.setItem(OLD_KEY, "not-json{{{");
    expect(migrateLegacyStorage()).toBeNull();
  });

  it("does nothing on second call after migration", () => {
    const legacy = {
      network: "testnet",
      issuer: null,
      credentialIssuer: null,
      domainOwner: null,
      currencies: ["XYZ"],
      recipients: [],
    };
    localStorage.setItem(OLD_KEY, JSON.stringify(legacy));

    expect(migrateLegacyStorage()).toBe("testnet");
    // Second call — old key is gone
    expect(migrateLegacyStorage()).toBeNull();
  });
});
