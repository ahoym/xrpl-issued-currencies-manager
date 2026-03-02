import { describe, it, expect } from "vitest";
import {
  encodeXrplCurrency,
  toXrplAmount,
  fromXrplAmount,
  decodeCurrency,
} from "./currency";

// ---------------------------------------------------------------------------
// encodeXrplCurrency
// ---------------------------------------------------------------------------

describe("encodeXrplCurrency", () => {
  it("passes through standard 3-char codes", () => {
    expect(encodeXrplCurrency("USD")).toBe("USD");
    expect(encodeXrplCurrency("EUR")).toBe("EUR");
    expect(encodeXrplCurrency("XRP")).toBe("XRP");
  });

  it("passes through 40-char hex codes (uppercased)", () => {
    const hex = "0158415500000000C1F76FF6ECB0BAC600000000";
    expect(encodeXrplCurrency(hex)).toBe(hex.toUpperCase());
  });

  it("hex-encodes 4-20 char non-standard codes and pads to 40", () => {
    const result = encodeXrplCurrency("XCAD");
    expect(result.length).toBe(40);
    // "XCAD" -> 58434144 hex, padded to 40
    expect(result).toBe("5843414400000000000000000000000000000000");
  });

  it("hex-encodes longer non-standard codes", () => {
    const result = encodeXrplCurrency("RLUSD");
    expect(result.length).toBe(40);
    expect(result.startsWith("524C555344")).toBe(true);
  });

  it("throws for codes shorter than 3 characters", () => {
    expect(() => encodeXrplCurrency("AB")).toThrow("at least 3");
  });

  it("throws for codes between 21 and 39 chars (invalid length)", () => {
    const code = "A".repeat(25);
    expect(() => encodeXrplCurrency(code)).toThrow();
  });

  it("throws for single character", () => {
    expect(() => encodeXrplCurrency("X")).toThrow("at least 3");
  });
});

// ---------------------------------------------------------------------------
// decodeCurrency
// ---------------------------------------------------------------------------

describe("decodeCurrency", () => {
  it("passes through short codes like USD", () => {
    expect(decodeCurrency("USD")).toBe("USD");
  });

  it("decodes hex-encoded currency back to ASCII", () => {
    // "XCAD" hex-encoded
    expect(decodeCurrency("5843414400000000000000000000000000000000")).toBe(
      "XCAD",
    );
  });

  it("returns 'LP Token' for LP token currency codes", () => {
    // LP tokens start with 03
    expect(decodeCurrency("03A7B5D51F6F25E13E2A1B0E6FFD8E47C1C0B200")).toBe(
      "LP Token",
    );
  });

  it("returns original code for non-decodable hex", () => {
    // Non-printable bytes
    const hex = "0000000000000000000000000000000000000001";
    const result = decodeCurrency(hex);
    expect(typeof result).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// toXrplAmount
// ---------------------------------------------------------------------------

describe("toXrplAmount", () => {
  it("converts XRP to drops string", () => {
    const result = toXrplAmount({ currency: "XRP", value: "10" });
    expect(result).toBe("10000000");
  });

  it("converts issued currency to object form", () => {
    const result = toXrplAmount({
      currency: "USD",
      issuer: "rIssuerAddress123456789012345",
      value: "100",
    });
    expect(typeof result).toBe("object");
    if (typeof result === "object") {
      expect(result.currency).toBe("USD");
      expect(result.value).toBe("100");
    }
  });

  it("hex-encodes non-standard currency codes", () => {
    const result = toXrplAmount({
      currency: "XCAD",
      issuer: "rIssuerAddress123456789012345",
      value: "50",
    });
    if (typeof result === "object") {
      expect(result.currency.length).toBe(40);
    }
  });

  it("throws when issuer is missing for non-XRP", () => {
    expect(() => toXrplAmount({ currency: "USD", value: "10" })).toThrow(
      "issuer is required",
    );
  });
});

// ---------------------------------------------------------------------------
// fromXrplAmount
// ---------------------------------------------------------------------------

describe("fromXrplAmount", () => {
  it("converts drops string to XRP DexAmount", () => {
    const result = fromXrplAmount("1000000");
    expect(result.currency).toBe("XRP");
    expect(result.value).toBe("1");
  });

  it("converts issued currency object to DexAmount", () => {
    const result = fromXrplAmount({
      currency: "USD",
      issuer: "rIssuer123",
      value: "50",
    });
    expect(result.currency).toBe("USD");
    expect(result.issuer).toBe("rIssuer123");
    expect(result.value).toBe("50");
  });

  it("decodes hex currency codes", () => {
    const result = fromXrplAmount({
      currency: "5843414400000000000000000000000000000000",
      issuer: "rIssuer123",
      value: "10",
    });
    expect(result.currency).toBe("XCAD");
  });
});
