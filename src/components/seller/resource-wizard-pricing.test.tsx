import { describe, it, expect } from "vitest";
import { validatePricingDraft, validateStellarAddress } from "./resource-wizard-pricing";
import { createEmptyDraft, updateDraft } from "@/services/resource-creation";

describe("Stellar address validation", () => {
  it("accepts valid testnet addresses", () => {
    expect(validateStellarAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(
      true
    );
    expect(validateStellarAddress("GDNQZCIXGRK7X5WJZVQVQGTU7BA3D47XAZ7VTTVXB5T5H2L5XRR7YDUA")).toBe(
      true
    );
  });

  it("accepts valid public network addresses", () => {
    expect(validateStellarAddress("GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ")).toBe(
      true
    );
  });

  it("rejects addresses that are too short", () => {
    expect(validateStellarAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMD")).toBe(false);
  });

  it("rejects addresses that are too long", () => {
    expect(
      validateStellarAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQEXXXX")
    ).toBe(false);
  });

  it("rejects addresses that don't start with G", () => {
    expect(validateStellarAddress("ABZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE")).toBe(
      false
    );
  });

  it("rejects addresses with invalid characters", () => {
    expect(
      validateStellarAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE!")
    ).toBe(false);
    expect(validateStellarAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ@")).toBe(
      false
    );
  });

  it("rejects empty string", () => {
    expect(validateStellarAddress("")).toBe(false);
  });
});

describe("resource pricing validation", () => {
  const assets = [
    {
      code: "USDC",
      decimals: 7,
      issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
    }
  ];
  const validDraft = updateDraft(createEmptyDraft(), {
    amount: "0.05",
    assetCode: "USDC",
    assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    network: "stellar:testnet",
    payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
  });

  it("accepts a supported network, asset, amount, and recipient", () => {
    expect(validatePricingDraft(validDraft, assets)).toEqual({});
  });

  it("rejects unsupported networks", () => {
    expect(
      validatePricingDraft(
        { ...validDraft, network: "stellar:devnet" as typeof validDraft.network },
        assets,
        ["stellar:testnet", "stellar:pubnet"]
      ).network
    ).toBe("Network is not supported");
  });

  it("rejects stale assets that are not supported on the selected network", () => {
    expect(
      validatePricingDraft(
        {
          ...validDraft,
          assetIssuer: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE"
        },
        assets
      ).assetCode
    ).toBe("Asset must be supported on the selected network");
  });

  it("rejects malformed and zero amounts before submission", () => {
    expect(validatePricingDraft({ ...validDraft, amount: "1abc" }, assets).amount).toContain(
      "positive decimal"
    );
    expect(validatePricingDraft({ ...validDraft, amount: "0.00000001" }, assets).amount).toContain(
      "positive decimal"
    );
    expect(validatePricingDraft({ ...validDraft, amount: "0" }, assets).amount).toBe(
      "Amount must be greater than zero"
    );
  });
});
