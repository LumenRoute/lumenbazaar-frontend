import { describe, expect, it } from "vitest";

import { assetMetadataSchema, type AssetMetadata } from "@/services/api/schemas";
import {
  getNetworkConfig,
  networkLabel,
  resolveNetworkId,
  stellarNetworks,
  type NetworkId
} from "./networks";

describe("networks config", () => {
  describe("stellarNetworks", () => {
    it("includes both testnet and pubnet", () => {
      expect(Object.keys(stellarNetworks).sort()).toEqual(["stellar:pubnet", "stellar:testnet"]);
    });

    it("each network has required properties", () => {
      const networks: NetworkId[] = ["stellar:testnet", "stellar:pubnet"];

      networks.forEach((networkId) => {
        const network = stellarNetworks[networkId];
        expect(network.id).toBe(networkId);
        expect(network.label).toBeDefined();
        expect(network.passphrase).toBeDefined();
        expect(network.horizonUrl).toBeDefined();
        expect(network.rpcUrl).toBeDefined();
        expect(network.explorerUrl).toBeDefined();
        expect(network.defaultAssetCode).toBeDefined();
        expect(network.defaultAssetIssuer).toBeDefined();
        expect(Array.isArray(network.assets)).toBe(true);
      });
    });

    it("testnet has asset catalog", () => {
      const testnet = stellarNetworks["stellar:testnet"];
      expect(testnet.assets.length).toBeGreaterThan(0);
    });

    it("pubnet has asset catalog", () => {
      const pubnet = stellarNetworks["stellar:pubnet"];
      expect(pubnet.assets.length).toBeGreaterThan(0);
    });
  });

  describe("asset metadata validation", () => {
    it("validates valid asset metadata", () => {
      const validAsset: AssetMetadata = {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 6,
        issuer: "GA5ZSEJYB37ENSHJTCQ6GUQ5O6GXJYUYRTP6ESFXUW77K5STH6E3BQI6",
        symbol: "USDC"
      };

      const result = assetMetadataSchema.safeParse(validAsset);
      expect(result.success).toBe(true);
    });

    it("validates asset without issuer", () => {
      const validAsset = {
        contractId: "CB7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 7,
        symbol: "BRL"
      };

      const result = assetMetadataSchema.safeParse(validAsset);
      expect(result.success).toBe(true);
    });

    it("rejects invalid contract ID", () => {
      const invalidAsset = {
        contractId: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE", // account, not contract
        decimals: 6,
        symbol: "USDC"
      };

      const result = assetMetadataSchema.safeParse(invalidAsset);
      expect(result.success).toBe(false);
    });

    it("rejects invalid symbol", () => {
      const invalidAsset = {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 6,
        symbol: "TOOLONGCODE123456" // >12 characters
      };

      const result = assetMetadataSchema.safeParse(invalidAsset);
      expect(result.success).toBe(false);
    });

    it("rejects negative decimals", () => {
      const invalidAsset = {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: -1,
        symbol: "USDC"
      };

      const result = assetMetadataSchema.safeParse(invalidAsset);
      expect(result.success).toBe(false);
    });

    it("rejects decimals > 7", () => {
      const invalidAsset = {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 8,
        symbol: "USDC"
      };

      const result = assetMetadataSchema.safeParse(invalidAsset);
      expect(result.success).toBe(false);
    });

    it("rejects invalid issuer", () => {
      const invalidAsset = {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 6,
        issuer: "invalid-issuer",
        symbol: "USDC"
      };

      const result = assetMetadataSchema.safeParse(invalidAsset);
      expect(result.success).toBe(false);
    });

    it("accepts decimals = 0", () => {
      const asset = {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 0,
        symbol: "WHOLE"
      };

      const result = assetMetadataSchema.safeParse(asset);
      expect(result.success).toBe(true);
    });

    it("accepts decimals = 7", () => {
      const asset = {
        contractId: "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
        decimals: 7,
        symbol: "SMALL"
      };

      const result = assetMetadataSchema.safeParse(asset);
      expect(result.success).toBe(true);
    });
  });

  describe("all configured assets pass validation", () => {
    it("testnet assets are valid", () => {
      const testnet = stellarNetworks["stellar:testnet"];

      testnet.assets.forEach((asset) => {
        const result = assetMetadataSchema.safeParse(asset);
        expect(result.success).toBe(true);
      });
    });

    it("pubnet assets are valid", () => {
      const pubnet = stellarNetworks["stellar:pubnet"];

      pubnet.assets.forEach((asset) => {
        const result = assetMetadataSchema.safeParse(asset);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("getNetworkConfig", () => {
    it("returns testnet config", () => {
      const config = getNetworkConfig("stellar:testnet");
      expect(config.id).toBe("stellar:testnet");
      expect(config.assets).toBeDefined();
    });

    it("returns pubnet config", () => {
      const config = getNetworkConfig("stellar:pubnet");
      expect(config.id).toBe("stellar:pubnet");
      expect(config.assets).toBeDefined();
    });
  });

  describe("resolveNetworkId", () => {
    it("resolves the testnet passphrase", () => {
      expect(resolveNetworkId(getNetworkConfig("stellar:testnet").passphrase)).toBe(
        "stellar:testnet"
      );
    });

    it("resolves the pubnet passphrase", () => {
      expect(resolveNetworkId(getNetworkConfig("stellar:pubnet").passphrase)).toBe(
        "stellar:pubnet"
      );
    });

    it("returns undefined for a passphrase that is not configured", () => {
      expect(resolveNetworkId("Some Other Network ; January 2024")).toBeUndefined();
    });

    it("returns undefined for a missing passphrase", () => {
      expect(resolveNetworkId(undefined)).toBeUndefined();
    });

    it("returns undefined for an empty passphrase", () => {
      expect(resolveNetworkId("")).toBeUndefined();
      expect(resolveNetworkId("   ")).toBeUndefined();
    });
  });

  describe("networkLabel", () => {
    it("labels configured networks", () => {
      expect(networkLabel("stellar:testnet")).toBe(getNetworkConfig("stellar:testnet").label);
      expect(networkLabel("stellar:pubnet")).toBe(getNetworkConfig("stellar:pubnet").label);
    });

    it("labels unknown networks honestly", () => {
      expect(networkLabel(undefined)).toBe("Unknown network");
    });
  });
});
