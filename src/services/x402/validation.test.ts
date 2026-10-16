/**
 * x402 v2 Validation Utilities Test Suite
 *
 * Tests strict format validation for x402 v2 payment requirements covering:
 * - Stellar address formats (classic G*, muxed M*, contract C*)
 * - Soroban contract ID validation
 * - Network ID validation
 * - Amount atomic unit validation
 * - Timeout validation
 * - Asset code validation
 * - URL validation
 */

import { describe, expect, it } from "vitest";

import {
  isValidAbsoluteUrl,
  isValidAssetCode,
  isValidAtomicAmount,
  isValidNetworkId,
  isValidSorobanContractId,
  isValidStellarAccountAddress,
  isValidTimeoutSeconds
} from "./validation";

describe("isValidStellarAccountAddress", () => {
  describe("valid addresses", () => {
    it("accepts classic account addresses (G*)", () => {
      expect(isValidStellarAccountAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(true);
      expect(isValidStellarAccountAddress("GBUQWP3BOUZX34ULNQG23RQ6F4BFXWBXMODWQCDNYCD3MHALB5O6OVY")).toBe(true);
      expect(isValidStellarAccountAddress("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")).toBe(true);
    });

    it("accepts muxed account addresses (M*)", () => {
      expect(isValidStellarAccountAddress("MBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(true);
      expect(isValidStellarAccountAddress("MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")).toBe(true);
    });
  });

  describe("invalid addresses", () => {
    it("rejects contract addresses (C*)", () => {
      expect(isValidStellarAccountAddress("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS")).toBe(false);
      expect(isValidStellarAccountAddress("CASSETDEMO0000000000000000000000000000000000000000000")).toBe(false);
    });

    it("rejects addresses with wrong length", () => {
      expect(isValidStellarAccountAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ")).toBe(false); // 55 chars
      expect(isValidStellarAccountAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQEE")).toBe(false); // 57 chars
    });

    it("rejects addresses with invalid characters", () => {
      expect(isValidStellarAccountAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ0")).toBe(false); // digit 0
      expect(isValidStellarAccountAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ-")).toBe(false); // hyphen
      expect(isValidStellarAccountAddress("gbzxn7pirzgnmhgaiqw7qejww36l5cvvnryanmdw2g3qof2vcr4dqsqe")).toBe(false); // lowercase
    });

    it("rejects invalid prefixes", () => {
      expect(isValidStellarAccountAddress("ABZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(false); // A prefix
      expect(isValidStellarAccountAddress("ZBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(false); // Z prefix
    });

    it("rejects non-string values", () => {
      expect(isValidStellarAccountAddress("" as never)).toBe(false);
      expect(isValidStellarAccountAddress(null as never)).toBe(false);
      expect(isValidStellarAccountAddress(undefined as never)).toBe(false);
      expect(isValidStellarAccountAddress(123 as never)).toBe(false);
    });

    it("rejects base32 invalid characters (0, 1, 8, 9)", () => {
      // Base32 alphabet is A-Z and 2-7 (no 0, 1, 8, 9)
      const invalid = "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ0";
      expect(isValidStellarAccountAddress(invalid)).toBe(false);
    });
  });
});

describe("isValidSorobanContractId", () => {
  describe("valid contract IDs", () => {
    it("accepts Soroban contract addresses (C*)", () => {
      expect(isValidSorobanContractId("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS")).toBe(true);
      expect(isValidSorobanContractId("CASSETDEMO0000000000000000000000000000000000000000000")).toBe(true);
      expect(isValidSorobanContractId("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")).toBe(true);
    });
  });

  describe("invalid contract IDs", () => {
    it("rejects account addresses (G* or M*)", () => {
      expect(isValidSorobanContractId("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(false);
      expect(isValidSorobanContractId("MBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(false);
    });

    it("rejects IDs with wrong length", () => {
      expect(isValidSorobanContractId("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJF")).toBe(false); // 55 chars
      expect(isValidSorobanContractId("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFSS")).toBe(false); // 57 chars
    });

    it("rejects IDs with invalid characters", () => {
      expect(isValidSorobanContractId("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJF0")).toBe(false); // digit 0
      expect(isValidSorobanContractId("CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJF-")).toBe(false); // hyphen
    });

    it("rejects invalid prefixes", () => {
      expect(isValidSorobanContractId("GB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS")).toBe(false); // G prefix
      expect(isValidSorobanContractId("AB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS")).toBe(false); // A prefix
    });

    it("rejects non-string values", () => {
      expect(isValidSorobanContractId("" as never)).toBe(false);
      expect(isValidSorobanContractId(null as never)).toBe(false);
      expect(isValidSorobanContractId(undefined as never)).toBe(false);
      expect(isValidSorobanContractId(123 as never)).toBe(false);
    });

    it("rejects common format mistakes", () => {
      expect(isValidSorobanContractId("C-256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS")).toBe(false); // hyphen
      expect(isValidSorobanContractId("0xCB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS")).toBe(false); // hex prefix
    });
  });
});

describe("isValidAtomicAmount", () => {
  describe("valid amounts", () => {
    it("accepts positive integers", () => {
      expect(isValidAtomicAmount("1")).toBe(true);
      expect(isValidAtomicAmount("500000")).toBe(true);
      expect(isValidAtomicAmount("10000000000000")).toBe(true);
      expect(isValidAtomicAmount("999999999999999")).toBe(true);
    });

    it("accepts single digit amounts", () => {
      expect(isValidAtomicAmount("1")).toBe(true);
      expect(isValidAtomicAmount("9")).toBe(true);
    });

    it("accepts very large amounts", () => {
      expect(isValidAtomicAmount("99999999999999999999999999999999999")).toBe(true);
    });
  });

  describe("invalid amounts", () => {
    it("rejects zero", () => {
      expect(isValidAtomicAmount("0")).toBe(false);
    });

    it("rejects leading zeros", () => {
      expect(isValidAtomicAmount("00")).toBe(false);
      expect(isValidAtomicAmount("01")).toBe(false);
      expect(isValidAtomicAmount("000500000")).toBe(false);
      expect(isValidAtomicAmount("0500000")).toBe(false);
    });

    it("rejects negative values", () => {
      expect(isValidAtomicAmount("-1")).toBe(false);
      expect(isValidAtomicAmount("-500000")).toBe(false);
    });

    it("rejects decimals", () => {
      expect(isValidAtomicAmount("0.5")).toBe(false);
      expect(isValidAtomicAmount("500000.5")).toBe(false);
      expect(isValidAtomicAmount("500.000")).toBe(false);
    });

    it("rejects non-numeric characters", () => {
      expect(isValidAtomicAmount("500000a")).toBe(false);
      expect(isValidAtomicAmount("500,000")).toBe(false);
      expect(isValidAtomicAmount("500_000")).toBe(false);
      expect(isValidAtomicAmount("500000 ")).toBe(false);
    });

    it("rejects empty and null values", () => {
      expect(isValidAtomicAmount("")).toBe(false);
      expect(isValidAtomicAmount(null as never)).toBe(false);
      expect(isValidAtomicAmount(undefined as never)).toBe(false);
      expect(isValidAtomicAmount(123 as never)).toBe(false);
    });

    it("rejects scientific notation", () => {
      expect(isValidAtomicAmount("1e6")).toBe(false);
      expect(isValidAtomicAmount("5E5")).toBe(false);
    });
  });
});

describe("isValidNetworkId", () => {
  describe("valid networks", () => {
    it("accepts stellar:testnet", () => {
      expect(isValidNetworkId("stellar:testnet")).toBe(true);
    });

    it("accepts stellar:pubnet", () => {
      expect(isValidNetworkId("stellar:pubnet")).toBe(true);
    });
  });

  describe("invalid networks", () => {
    it("rejects other blockchains", () => {
      expect(isValidNetworkId("ethereum:mainnet")).toBe(false);
      expect(isValidNetworkId("bitcoin:mainnet")).toBe(false);
      expect(isValidNetworkId("polygon:mumbai")).toBe(false);
    });

    it("rejects Stellar typos", () => {
      expect(isValidNetworkId("stellar:test")).toBe(false);
      expect(isValidNetworkId("stellar:public")).toBe(false);
      expect(isValidNetworkId("stellar:production")).toBe(false);
      expect(isValidNetworkId("stellar:mainnet")).toBe(false);
    });

    it("rejects malformed values", () => {
      expect(isValidNetworkId("stellar")).toBe(false);
      expect(isValidNetworkId("testnet")).toBe(false);
      expect(isValidNetworkId("stellar::testnet")).toBe(false);
    });

    it("rejects empty and null values", () => {
      expect(isValidNetworkId("")).toBe(false);
      expect(isValidNetworkId(null as never)).toBe(false);
      expect(isValidNetworkId(undefined as never)).toBe(false);
      expect(isValidNetworkId(123 as never)).toBe(false);
    });

    it("rejects case variations", () => {
      expect(isValidNetworkId("Stellar:testnet")).toBe(false);
      expect(isValidNetworkId("STELLAR:TESTNET")).toBe(false);
      expect(isValidNetworkId("stellar:Testnet")).toBe(false);
    });
  });
});

describe("isValidTimeoutSeconds", () => {
  describe("valid timeouts", () => {
    it("accepts positive integers", () => {
      expect(isValidTimeoutSeconds(1)).toBe(true);
      expect(isValidTimeoutSeconds(60)).toBe(true);
      expect(isValidTimeoutSeconds(300)).toBe(true);
      expect(isValidTimeoutSeconds(3600)).toBe(true);
    });

    it("accepts edge case: 1 second", () => {
      expect(isValidTimeoutSeconds(1)).toBe(true);
    });

    it("accepts edge case: 1 week (default max)", () => {
      expect(isValidTimeoutSeconds(604_800)).toBe(true);
    });

    it("accepts custom max boundary", () => {
      expect(isValidTimeoutSeconds(1_000_000, 1_000_000)).toBe(true);
    });
  });

  describe("invalid timeouts", () => {
    it("rejects zero", () => {
      expect(isValidTimeoutSeconds(0)).toBe(false);
    });

    it("rejects negative values", () => {
      expect(isValidTimeoutSeconds(-1)).toBe(false);
      expect(isValidTimeoutSeconds(-300)).toBe(false);
    });

    it("rejects floats", () => {
      expect(isValidTimeoutSeconds(300.5)).toBe(false);
      expect(isValidTimeoutSeconds(1.1)).toBe(false);
    });

    it("rejects values exceeding default max (1 week)", () => {
      expect(isValidTimeoutSeconds(604_801)).toBe(false);
      expect(isValidTimeoutSeconds(1_000_000)).toBe(false);
    });

    it("respects custom max boundary", () => {
      expect(isValidTimeoutSeconds(301, 300)).toBe(false);
      expect(isValidTimeoutSeconds(1001, 1000)).toBe(false);
    });

    it("rejects non-number values", () => {
      expect(isValidTimeoutSeconds("300" as never)).toBe(false);
      expect(isValidTimeoutSeconds(null as never)).toBe(false);
      expect(isValidTimeoutSeconds(undefined as never)).toBe(false);
    });

    it("rejects Infinity and NaN", () => {
      expect(isValidTimeoutSeconds(Infinity)).toBe(false);
      expect(isValidTimeoutSeconds(NaN)).toBe(false);
    });
  });
});

describe("isValidAssetCode", () => {
  describe("valid asset codes", () => {
    it("accepts uppercase codes", () => {
      expect(isValidAssetCode("USDC")).toBe(true);
      expect(isValidAssetCode("EUR")).toBe(true);
      expect(isValidAssetCode("BRL")).toBe(true);
    });

    it("accepts lowercase codes", () => {
      expect(isValidAssetCode("usdc")).toBe(true);
      expect(isValidAssetCode("native")).toBe(true);
    });

    it("accepts numeric codes", () => {
      expect(isValidAssetCode("USD2")).toBe(true);
      expect(isValidAssetCode("BTC")).toBe(true);
    });

    it("accepts single character codes", () => {
      expect(isValidAssetCode("X")).toBe(true);
      expect(isValidAssetCode("Z")).toBe(true);
    });

    it("accepts 12 character codes (maximum length)", () => {
      expect(isValidAssetCode("ABCDEFGHIJKL")).toBe(true);
      expect(isValidAssetCode("123456789ABC")).toBe(true);
    });
  });

  describe("invalid asset codes", () => {
    it("rejects empty string", () => {
      expect(isValidAssetCode("")).toBe(false);
    });

    it("rejects codes longer than 12 characters", () => {
      expect(isValidAssetCode("TOOLONGCODE123")).toBe(false);
      expect(isValidAssetCode("ABCDEFGHIJKLM")).toBe(false); // 13 chars
    });

    it("rejects codes with special characters", () => {
      expect(isValidAssetCode("USD-C")).toBe(false);
      expect(isValidAssetCode("USD_C")).toBe(false);
      expect(isValidAssetCode("USD.C")).toBe(false);
      expect(isValidAssetCode("USD C")).toBe(false);
    });

    it("rejects non-alphanumeric characters", () => {
      expect(isValidAssetCode("USD@")).toBe(false);
      expect(isValidAssetCode("USD#")).toBe(false);
      expect(isValidAssetCode("USD!")).toBe(false);
    });

    it("rejects non-string values", () => {
      expect(isValidAssetCode(null as never)).toBe(false);
      expect(isValidAssetCode(undefined as never)).toBe(false);
      expect(isValidAssetCode(123 as never)).toBe(false);
    });
  });
});

describe("isValidAbsoluteUrl", () => {
  describe("valid URLs", () => {
    it("accepts HTTPS URLs", () => {
      expect(isValidAbsoluteUrl("https://api.example.com/resource")).toBe(true);
      expect(isValidAbsoluteUrl("https://api.weather.example/v1/current?city=Lagos")).toBe(true);
      expect(isValidAbsoluteUrl("https://localhost:8443/test")).toBe(true);
    });

    it("accepts HTTP URLs", () => {
      expect(isValidAbsoluteUrl("http://api.example.com/resource")).toBe(true);
      expect(isValidAbsoluteUrl("http://localhost:3000/test")).toBe(true);
    });

    it("accepts URLs with complex paths and query strings", () => {
      expect(
        isValidAbsoluteUrl(
          "https://api.example.com/v1/resource?param1=value1&param2=value2#section"
        )
      ).toBe(true);
      expect(isValidAbsoluteUrl("https://api.example.com/resource/123/detail")).toBe(true);
    });

    it("accepts URLs with ports", () => {
      expect(isValidAbsoluteUrl("https://api.example.com:8443/resource")).toBe(true);
      expect(isValidAbsoluteUrl("http://localhost:3000/test")).toBe(true);
    });

    it("accepts URLs with authentication", () => {
      expect(isValidAbsoluteUrl("https://user:pass@api.example.com/resource")).toBe(true);
    });

    it("accepts URLs with special characters in path", () => {
      expect(isValidAbsoluteUrl("https://api.example.com/resource-name_123")).toBe(true);
      expect(isValidAbsoluteUrl("https://api.example.com/resource%20name")).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("rejects relative URLs", () => {
      expect(isValidAbsoluteUrl("/resource")).toBe(false);
      expect(isValidAbsoluteUrl("../resource")).toBe(false);
      expect(isValidAbsoluteUrl("./resource")).toBe(false);
      expect(isValidAbsoluteUrl("resource")).toBe(false);
    });

    it("rejects URLs without protocol", () => {
      expect(isValidAbsoluteUrl("api.example.com/resource")).toBe(false);
      expect(isValidAbsoluteUrl("www.example.com/resource")).toBe(false);
    });

    it("rejects non-HTTP protocols", () => {
      expect(isValidAbsoluteUrl("ftp://api.example.com/resource")).toBe(false);
      expect(isValidAbsoluteUrl("file:///path/to/file")).toBe(false);
      expect(isValidAbsoluteUrl("gopher://api.example.com")).toBe(false);
    });

    it("rejects malformed URLs", () => {
      expect(isValidAbsoluteUrl("not-a-url")).toBe(false);
      expect(isValidAbsoluteUrl("http://")).toBe(false);
      expect(isValidAbsoluteUrl("https://")).toBe(false);
    });

    it("rejects empty and null values", () => {
      expect(isValidAbsoluteUrl("")).toBe(false);
      expect(isValidAbsoluteUrl(null as never)).toBe(false);
      expect(isValidAbsoluteUrl(undefined as never)).toBe(false);
      expect(isValidAbsoluteUrl(123 as never)).toBe(false);
    });

    it("rejects whitespace-only URLs", () => {
      expect(isValidAbsoluteUrl(" ")).toBe(false);
      expect(isValidAbsoluteUrl("\t")).toBe(false);
    });
  });
});
