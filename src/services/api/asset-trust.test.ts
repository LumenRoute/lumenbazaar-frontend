import { describe, it, expect } from "vitest";
import { classifyAssetTrust, assetTrustLabel } from "./asset-trust";
import type { AssetTrustStatus } from "./asset-trust";

describe("Asset Trust Classification", () => {
  describe("classifyAssetTrust", () => {
    describe("trusted assets", () => {
      it("classifies testnet USDC as trusted", () => {
        const status = classifyAssetTrust(
          "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
          "stellar:testnet"
        );

        expect(status.type).toBe("trusted");
        if (status.type === "trusted") {
          expect(status.registryEntry.symbol).toBe("USDC");
          expect(status.registryEntry.decimals).toBe(6);
        }
      });

      it("classifies testnet BRL as trusted", () => {
        const status = classifyAssetTrust(
          "CBQYB6MKFOPG7BWBT5H3KK43L2CQFWW5J2VJPWMVSWWFDMLZTFGZW7FY",
          "stellar:testnet"
        );

        expect(status.type).toBe("trusted");
        if (status.type === "trusted") {
          expect(status.registryEntry.symbol).toBe("BRL");
          expect(status.registryEntry.decimals).toBe(7);
        }
      });

      it("classifies pubnet USDC as trusted", () => {
        const status = classifyAssetTrust(
          "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
          "stellar:pubnet"
        );

        expect(status.type).toBe("trusted");
        if (status.type === "trusted") {
          expect(status.registryEntry.symbol).toBe("USDC");
        }
      });
    });

    describe("unknown assets", () => {
      it("classifies unknown contract as unknown", () => {
        const status = classifyAssetTrust(
          "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
          "stellar:testnet"
        );

        expect(status.type).toBe("unknown");
        expect((status as Extract<AssetTrustStatus, { type: "unknown" }>).reason).toBe(
          "not_in_registry"
        );
      });

      it("classifies testnet contract against pubnet registry as unknown", () => {
        const testnetUsdc = "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
        const status = classifyAssetTrust(testnetUsdc, "stellar:pubnet");

        expect(status.type).toBe("unknown");
      });

      it("classifies pubnet contract against testnet registry as unknown", () => {
        const pubnetUsdc = "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR";
        const status = classifyAssetTrust(pubnetUsdc, "stellar:testnet");

        expect(status.type).toBe("unknown");
      });
    });

    describe("lookalike-symbol assets", () => {
      it("classifies lookalike USDC (different contract) as unknown despite matching symbol", () => {
        // Valid contract ID but not in registry, matching symbol to testnet USDC
        const lookalike = "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ1";
        const status = classifyAssetTrust(lookalike, "stellar:testnet");

        expect(status.type).toBe("unknown");
        expect((status as Extract<AssetTrustStatus, { type: "unknown" }>).reason).toBe(
          "not_in_registry"
        );
      });
    });

    describe("malformed assets", () => {
      it("classifies invalid contract ID as malformed", () => {
        const status = classifyAssetTrust("INVALID_CONTRACT_ID", "stellar:testnet");

        expect(status.type).toBe("malformed");
        expect(
          (status as Extract<AssetTrustStatus, { type: "malformed" }>).reason
        ).toBe("invalid_contract_id");
      });

      it("classifies non-C-prefixed ID as malformed", () => {
        const status = classifyAssetTrust(
          "GA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
          "stellar:testnet"
        );

        expect(status.type).toBe("malformed");
      });

      it("classifies too-short C-prefixed ID as malformed", () => {
        const status = classifyAssetTrust("CSHORT", "stellar:testnet");

        expect(status.type).toBe("malformed");
      });

      it("classifies empty string as malformed", () => {
        const status = classifyAssetTrust("", "stellar:testnet");

        expect(status.type).toBe("malformed");
      });
    });

    describe("case sensitivity", () => {
      it("matches contract IDs case-sensitively (uppercase in registry)", () => {
        // Testnet USDC is stored as uppercase
        const uppercase = "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE";
        const lowercase = "cbzxn7pirzgnmhgaiqw7qejww36l5cvvnryanmdw2g3qof2vcr4dqsqe";

        const statusUpper = classifyAssetTrust(uppercase, "stellar:testnet");
        const statusLower = classifyAssetTrust(lowercase, "stellar:testnet");

        // Uppercase should match
        expect(statusUpper.type).toBe("trusted");
        // Lowercase should NOT match (case-sensitive lookup)
        expect(statusLower.type).toBe("malformed"); // Invalid due to lowercase base32
      });
    });

    describe("network separation", () => {
      it("keeps testnet and pubnet registries separate", () => {
        const testnetStatus = classifyAssetTrust(
          "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
          "stellar:testnet"
        );
        const pubnetStatus = classifyAssetTrust(
          "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
          "stellar:pubnet"
        );

        expect(testnetStatus.type).toBe("trusted");
        expect(pubnetStatus.type).toBe("unknown");
      });
    });
  });

  describe("assetTrustLabel", () => {
    it("generates label for trusted asset", () => {
      const status: AssetTrustStatus = {
        type: "trusted",
        registryEntry: {
          contractId: "CBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
          symbol: "USDC",
          decimals: 6
        }
      };

      const label = assetTrustLabel(status);
      expect(label).toContain("Trusted");
      expect(label).toContain("USDC");
    });

    it("generates label for unknown asset", () => {
      const status: AssetTrustStatus = { type: "unknown", reason: "not_in_registry" };
      const label = assetTrustLabel(status);
      expect(label).toContain("Unknown");
      expect(label).toContain("not in trusted registry");
    });

    it("generates label for malformed asset", () => {
      const status: AssetTrustStatus = { type: "malformed", reason: "invalid_contract_id" };
      const label = assetTrustLabel(status);
      expect(label).toContain("Invalid");
      expect(label).toContain("contract");
    });

    it("generates label for network-mismatched asset", () => {
      const status: AssetTrustStatus = { type: "network_mismatched", expected: "stellar:testnet" };
      const label = assetTrustLabel(status);
      expect(label).toContain("Network");
      expect(label).toContain("stellar:testnet");
    });
  });
});
