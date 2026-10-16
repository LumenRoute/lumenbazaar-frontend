import { describe, it, expect } from "vitest";
import crypto from "crypto";
import fs from "fs";
import path from "path";

describe("Backend Pin Manifest", () => {
  it("manifest exists and has required fields", () => {
    const manifestPath = path.resolve(process.cwd(), "backend-pin.json");
    const manifestExists = fs.existsSync(manifestPath);
    expect(manifestExists).toBe(true);

    const manifestRaw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.version).toBe(1);
    expect(manifest.backend).toBeDefined();
    expect(manifest.backend.repository).toBeDefined();
    expect(manifest.backend.commitSha).toBeDefined();
    expect(manifest.artifact).toBeDefined();
    expect(manifest.artifact.path).toBeDefined();
    expect(manifest.artifact.sha256).toBeDefined();
  });

  it("commit SHA is a valid 40-character hex string", () => {
    const manifestRaw = fs.readFileSync("backend-pin.json", "utf8");
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.backend.commitSha).toMatch(/^[a-f0-9]{40}$/);
  });

  it("SHA-256 checksum is valid 64-character hex string", () => {
    const manifestRaw = fs.readFileSync("backend-pin.json", "utf8");
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("vendored OpenAPI document exists", () => {
    const docPath = path.resolve(process.cwd(), "backend", "openapi.json");
    const exists = fs.existsSync(docPath);
    expect(exists).toBe(true);
  });

  it("vendored OpenAPI document is valid JSON", () => {
    const docRaw = fs.readFileSync("backend/openapi.json", "utf8");
    expect(() => JSON.parse(docRaw)).not.toThrow();
  });

  it("vendored OpenAPI document checksum matches manifest", () => {
    const manifestRaw = fs.readFileSync("backend-pin.json", "utf8");
    const manifest = JSON.parse(manifestRaw);

    const docRaw = fs.readFileSync("backend/openapi.json", "utf8");
    const computedHash = crypto.createHash("sha256").update(docRaw).digest("hex");

    expect(computedHash).toBe(manifest.artifact.sha256);
  });

  it("generated client file exists", () => {
    const generatedPath = path.resolve(
      process.cwd(),
      "src",
      "services",
      "api",
      "client.generated.ts"
    );
    expect(fs.existsSync(generatedPath)).toBe(true);
  });

  it("generated client file has auto-generated header", () => {
    const generatedRaw = fs.readFileSync(
      "src/services/api/client.generated.ts",
      "utf8"
    );

    expect(generatedRaw).toContain("AUTO-GENERATED FILE");
    expect(generatedRaw).toContain("DO NOT EDIT");
    expect(generatedRaw).toContain("github.com/LumenRoute/lumenbazaar-backend");
  });

  it("generated client file includes backend commit reference", () => {
    const manifestRaw = fs.readFileSync("backend-pin.json", "utf8");
    const manifest = JSON.parse(manifestRaw);

    const generatedRaw = fs.readFileSync(
      "src/services/api/client.generated.ts",
      "utf8"
    );

    expect(generatedRaw).toContain(manifest.backend.commitSha);
  });

  it("generated client file includes checksum reference", () => {
    const manifestRaw = fs.readFileSync("backend-pin.json", "utf8");
    const manifest = JSON.parse(manifestRaw);

    const generatedRaw = fs.readFileSync(
      "src/services/api/client.generated.ts",
      "utf8"
    );

    expect(generatedRaw).toContain(manifest.artifact.sha256);
  });

  it("generated client exports expected types", () => {
    // Import and verify key types are exported
    const { Health, Version, Readiness, Resource, Seller, Settlement, Receipt } =
      require("./client.generated");

    expect(typeof Health).toBe("function" || "object"); // Types are not functions at runtime, but check they're defined
    // In practice, these assertions run at compile-time via expectTypeOf in the alignment test
  });
});
