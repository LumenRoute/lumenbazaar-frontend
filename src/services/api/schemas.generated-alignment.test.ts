import { describe, it } from "vitest";
import { expectTypeOf } from "vitest";

import { healthSchema, versionSchema, readinessSchema, supportedSchema, sellerSchema, resourceSchema, paymentVerificationSchema, settlementSchema, receiptSchema, conformanceRunSchema, searchResultSchema } from "./schemas";
import type * as Generated from "./client.generated";

describe("Schema Generated Type Alignment", () => {
  it("healthSchema output aligns with generated Health type", () => {
    expectTypeOf<ReturnType<typeof healthSchema.parse>>().toMatchTypeOf<Generated.Health>();
  });

  it("versionSchema output aligns with generated Version type", () => {
    expectTypeOf<ReturnType<typeof versionSchema.parse>>().toMatchTypeOf<Generated.Version>();
  });

  it("readinessSchema output aligns with generated Readiness type", () => {
    expectTypeOf<ReturnType<typeof readinessSchema.parse>>().toMatchTypeOf<Generated.Readiness>();
  });

  it("supportedSchema output aligns with generated SupportedPaymentSchemes type", () => {
    expectTypeOf<ReturnType<typeof supportedSchema.parse>>().toMatchTypeOf<Generated.SupportedPaymentSchemes>();
  });

  it("sellerSchema output aligns with generated Seller type", () => {
    expectTypeOf<ReturnType<typeof sellerSchema.parse>>().toMatchTypeOf<Generated.Seller>();
  });

  it("resourceSchema output aligns with generated Resource type", () => {
    expectTypeOf<ReturnType<typeof resourceSchema.parse>>().toMatchTypeOf<Generated.Resource>();
  });

  it("paymentVerificationSchema output aligns with generated PaymentVerification type", () => {
    expectTypeOf<ReturnType<typeof paymentVerificationSchema.parse>>().toMatchTypeOf<Generated.PaymentVerification>();
  });

  it("settlementSchema output aligns with generated Settlement type", () => {
    expectTypeOf<ReturnType<typeof settlementSchema.parse>>().toMatchTypeOf<Generated.Settlement>();
  });

  it("receiptSchema output aligns with generated Receipt type", () => {
    expectTypeOf<ReturnType<typeof receiptSchema.parse>>().toMatchTypeOf<Generated.Receipt>();
  });

  it("conformanceRunSchema output aligns with generated ConformanceRun type", () => {
    expectTypeOf<ReturnType<typeof conformanceRunSchema.parse>>().toMatchTypeOf<Generated.ConformanceRun>();
  });

  it("searchResultSchema output aligns with generated SearchResult type", () => {
    expectTypeOf<ReturnType<typeof searchResultSchema.parse>>().toMatchTypeOf<Generated.SearchResult>();
  });
});
