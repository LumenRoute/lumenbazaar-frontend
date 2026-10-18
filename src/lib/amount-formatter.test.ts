import { describe, expect, it } from "vitest";

import { formatAtomicAmount, tryFormatAmount, type FormattableAsset } from "./amount-formatter";

describe("formatAtomicAmount", () => {
  const usdc: FormattableAsset = {
    contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
    decimals: 6,
    symbol: "USDC"
  };

  describe("valid formatting", () => {
    it("formats standard amount with decimals", () => {
      const result = formatAtomicAmount("1234567", usdc);
      expect(result.formatted).toBe("1.234567");
      expect(result.atomic).toBe("1234567");
      expect(result.symbol).toBe("USDC");
      expect(result.decimals).toBe(6);
      expect(result.contractId).toBe(usdc.contractId);
    });

    it("formats amount less than 1", () => {
      const result = formatAtomicAmount("500000", usdc);
      expect(result.formatted).toBe("0.5");
    });

    it("formats amount 1", () => {
      const result = formatAtomicAmount("1000000", usdc);
      expect(result.formatted).toBe("1");
    });

    it("trims trailing zeros", () => {
      const result = formatAtomicAmount("1100000", usdc);
      expect(result.formatted).toBe("1.1");
    });

    it("preserves all significant digits", () => {
      const result = formatAtomicAmount("1234560", usdc);
      expect(result.formatted).toBe("1.23456");
    });

    it("formats very small amounts", () => {
      const result = formatAtomicAmount("1", usdc);
      expect(result.formatted).toBe("0.000001");
    });

    it("formats very large amounts", () => {
      const result = formatAtomicAmount("9223372036854775807", usdc); // i64 max
      expect(result.formatted).toBe("9223372036.854775807");
    });
  });

  describe("zero decimals", () => {
    const whole: FormattableAsset = {
      contractId: "CB7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
      decimals: 0,
      symbol: "WHOLE"
    };

    it("formats whole number asset (0 decimals)", () => {
      const result = formatAtomicAmount("100", whole);
      expect(result.formatted).toBe("100");
    });

    it("formats 1 with 0 decimals", () => {
      const result = formatAtomicAmount("1", whole);
      expect(result.formatted).toBe("1");
    });
  });

  describe("max decimals (7)", () => {
    const maxDecimals: FormattableAsset = {
      contractId: "CC7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
      decimals: 7,
      symbol: "TINY"
    };

    it("formats with 7 decimals", () => {
      const result = formatAtomicAmount("12345678", maxDecimals);
      expect(result.formatted).toBe("1.2345678");
    });

    it("formats minimum unit with 7 decimals", () => {
      const result = formatAtomicAmount("1", maxDecimals);
      expect(result.formatted).toBe("0.0000001");
    });
  });

  describe("edge cases", () => {
    it("formats amount 1 with high decimals", () => {
      const result = formatAtomicAmount("1", usdc);
      expect(result.formatted).toBe("0.000001");
    });

    it("handles amounts with all zeros in fractional part", () => {
      const result = formatAtomicAmount("1000000", usdc);
      expect(result.formatted).toBe("1");
    });

    it("formats amount with mixed zeros", () => {
      const result = formatAtomicAmount("1001000", usdc);
      expect(result.formatted).toBe("1.001");
    });

    it("formats leading zeros in fractional part", () => {
      const result = formatAtomicAmount("10000", usdc);
      expect(result.formatted).toBe("0.01");
    });

    it("formats multiple leading zeros", () => {
      const result = formatAtomicAmount("1000", usdc);
      expect(result.formatted).toBe("0.001");
    });
  });

  describe("invalid input", () => {
    it("throws on zero atomic amount", () => {
      expect(() => formatAtomicAmount("0", usdc)).toThrow();
    });

    it("throws on negative amount", () => {
      expect(() => formatAtomicAmount("-1000000", usdc)).toThrow();
    });

    it("throws on decimal amount", () => {
      expect(() => formatAtomicAmount("1000000.5", usdc)).toThrow();
    });

    it("throws on leading zeros", () => {
      expect(() => formatAtomicAmount("01234567", usdc)).toThrow();
    });

    it("throws on empty string", () => {
      expect(() => formatAtomicAmount("", usdc)).toThrow();
    });

    it("throws on non-numeric string", () => {
      expect(() => formatAtomicAmount("abc", usdc)).toThrow();
    });

    it("throws on null string", () => {
      expect(() => formatAtomicAmount(null as any, usdc)).toThrow();
    });
  });

  describe("invalid decimals", () => {
    it("throws on negative decimals", () => {
      const invalidAsset = { ...usdc, decimals: -1 };
      expect(() => formatAtomicAmount("1000000", invalidAsset)).toThrow(
        /Invalid decimals/
      );
    });

    it("throws on decimals > 7", () => {
      const invalidAsset = { ...usdc, decimals: 8 };
      expect(() => formatAtomicAmount("1000000", invalidAsset)).toThrow(
        /Invalid decimals/
      );
    });

    it("throws on non-integer decimals", () => {
      const invalidAsset = { ...usdc, decimals: 6.5 };
      expect(() => formatAtomicAmount("1000000", invalidAsset)).toThrow(
        /Invalid decimals/
      );
    });
  });

  describe("symbol spoofing prevention", () => {
    const usdc_v1: FormattableAsset = {
      contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
      decimals: 6,
      symbol: "USDC"
    };

    const usdc_v2: FormattableAsset = {
      contractId: "CB7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
      decimals: 6,
      symbol: "USDC"
    };

    it("preserves contract ID for asset with same symbol", () => {
      const result1 = formatAtomicAmount("1000000", usdc_v1);
      const result2 = formatAtomicAmount("1000000", usdc_v2);

      expect(result1.contractId).not.toBe(result2.contractId);
      expect(result1.symbol).toBe(result2.symbol);
    });

    it("can distinguish two USDC variants by contract", () => {
      const result1 = formatAtomicAmount("1000000", usdc_v1);
      const result2 = formatAtomicAmount("1000000", usdc_v2);

      expect(result1.formatted).toBe(result2.formatted); // Same formatted amount
      expect(result1.contractId).not.toBe(result2.contractId); // But different contracts
    });
  });

  describe("BigInt safety", () => {
    it("handles i64 max value", () => {
      const maxI64 = "9223372036854775807";
      const result = formatAtomicAmount(maxI64, usdc);
      expect(result.formatted).toBeDefined();
      expect(result.atomic).toBe(maxI64);
    });

    it("handles i128 boundary value", () => {
      // i128 max: 170141183460469231731687303715884105727
      const maxI128 = "170141183460469231731687303715884105727";
      const result = formatAtomicAmount(maxI128, usdc);
      expect(result.formatted).toBeDefined();
      expect(result.atomic).toBe(maxI128);
    });

    it("never uses floating-point arithmetic", () => {
      // Amount that would lose precision in float64 (> 2^53)
      const largeAmount = "9007199254740992"; // 2^53
      const result = formatAtomicAmount(largeAmount, usdc);
      expect(result.formatted).toBe("9007199.254740992");
    });
  });
});

describe("tryFormatAmount", () => {
  const testnetUsdcContractId =
    "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
  const testnetBrlContractId =
    "CBQYB6MKFOPG7BWBT5H3KK43L2CQFWW5J2VJPWMVSWWFDMLZTFGZW7FY";

  describe("valid formatting", () => {
    it("formats known testnet USDC asset", () => {
      const result = tryFormatAmount(
        "1234567",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      expect(result).not.toBeNull();
      expect(result?.formatted).toBe("1.234567");
      expect(result?.symbol).toBe("USDC");
      expect(result?.decimals).toBe(6);
    });

    it("formats known testnet BRL asset", () => {
      const result = tryFormatAmount(
        "12345678",
        testnetBrlContractId,
        "stellar:testnet"
      );

      expect(result).not.toBeNull();
      expect(result?.formatted).toBe("1.2345678");
      expect(result?.symbol).toBe("BRL");
      expect(result?.decimals).toBe(7);
    });
  });

  describe("fallback behavior", () => {
    it("returns null for unknown contract ID", () => {
      const unknownContractId =
        "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS";
      const result = tryFormatAmount(
        "1234567",
        unknownContractId,
        "stellar:testnet"
      );

      expect(result).toBeNull();
    });

    it("returns null for invalid atomic amount", () => {
      const result = tryFormatAmount(
        "0",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      expect(result).toBeNull();
    });

    it("returns null for negative amount", () => {
      const result = tryFormatAmount(
        "-1000000",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      expect(result).toBeNull();
    });

    it("returns null for amount with leading zeros", () => {
      const result = tryFormatAmount(
        "01234567",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      expect(result).toBeNull();
    });

    it("returns null for malformed amount", () => {
      const result = tryFormatAmount(
        "123.456",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      expect(result).toBeNull();
    });
  });

  describe("network-specific assets", () => {
    it("does not cross networks", () => {
      // Testnet USDC contract
      const testnetResult = tryFormatAmount(
        "1000000",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      // Same contract ID on pubnet should return null (not configured)
      const pubnetResult = tryFormatAmount(
        "1000000",
        testnetUsdcContractId,
        "stellar:pubnet"
      );

      expect(testnetResult).not.toBeNull();
      expect(pubnetResult).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("formats amount 1 (minimum atomic unit)", () => {
      const result = tryFormatAmount(
        "1",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      expect(result).not.toBeNull();
      expect(result?.formatted).toBe("0.000001");
    });

    it("formats very large amounts", () => {
      const result = tryFormatAmount(
        "9223372036854775807",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      expect(result).not.toBeNull();
      expect(result?.formatted).toBe("9223372036.854775807");
    });
  });

  describe("type safety", () => {
    it("returns FormattedAmount | null", () => {
      const result = tryFormatAmount(
        "1000000",
        testnetUsdcContractId,
        "stellar:testnet"
      );

      if (result !== null) {
        // TypeScript should allow these accesses
        const _: string = result.formatted;
        const __: string = result.atomic;
        const ___: string = result.symbol;
        const ____: number = result.decimals;
      }
    });
  });
});
