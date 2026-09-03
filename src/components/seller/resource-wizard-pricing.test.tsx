import { describe, it, expect } from "vitest";
import { validateStellarAddress } from "./resource-wizard-pricing";

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
    expect(validateStellarAddress("GBUQWP3BOUZX34ULNQG23RQ6F4BVXEGS34T4023MPM2QUA3S7VNUKAPJ")).toBe(
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
    expect(validateStellarAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE!")).toBe(
      false
    );
    expect(validateStellarAddress("GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQ0")).toBe(
      false
    );
  });

  it("rejects empty string", () => {
    expect(validateStellarAddress("")).toBe(false);
  });
});
