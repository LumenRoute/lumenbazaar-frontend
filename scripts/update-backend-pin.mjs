#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const manifestPath = path.join(rootDir, "backend-pin.json");
const documentPath = path.join(rootDir, "backend", "openapi.json");
const generatedPath = path.join(rootDir, "src", "services", "api", "client.generated.ts");

async function generate() {
  try {
    console.log("📋 Generating typed API client from pinned OpenAPI...\n");

    // Check if document exists
    if (!fs.existsSync(documentPath)) {
      console.error(`❌ OpenAPI document not found at ${documentPath}`);
      process.exit(1);
    }

    // Parse manifest
    const manifestRaw = fs.readFileSync(manifestPath, "utf8");
    let manifest;
    try {
      manifest = JSON.parse(manifestRaw);
    } catch (e) {
      console.error(`❌ Failed to parse manifest: ${e.message}`);
      process.exit(1);
    }

    // Verify checksum
    const documentRaw = fs.readFileSync(documentPath, "utf8");
    const computedHash = crypto
      .createHash("sha256")
      .update(documentRaw)
      .digest("hex");

    if (computedHash !== manifest.artifact.sha256) {
      console.error(
        `❌ CHECKSUM MISMATCH: Expected ${manifest.artifact.sha256}, got ${computedHash}`
      );
      console.error("   The vendored OpenAPI document may have been modified.");
      process.exit(1);
    }
    console.log("✓ OpenAPI document checksum verified");

    // Run openapi-typescript
    console.log("⚙️  Running openapi-typescript...");
    try {
      execSync(
        `npx openapi-typescript backend/openapi.json -o src/services/api/client.generated.ts`,
        { cwd: rootDir, stdio: "inherit" }
      );
    } catch (e) {
      console.error("❌ openapi-typescript generation failed");
      process.exit(1);
    }

    // Add header comment to generated file
    const generatedContent = fs.readFileSync(generatedPath, "utf8");
    const header = `/**
 * ⚠️  AUTO-GENERATED FILE — DO NOT EDIT
 * Generated from pinned OpenAPI at backend commit:
 *   https://github.com/LumenRoute/lumenbazaar-backend/commit/${manifest.backend.commitSha}
 * Document checksum (SHA-256):
 *   ${manifest.artifact.sha256}
 * Update mechanism:
 *   pnpm run update-backend-pin
 * Generated at: ${new Date().toISOString()}
 */

`;
    const withHeader = header + generatedContent;
    fs.writeFileSync(generatedPath, withHeader, "utf8");
    console.log("✓ Added header comment to generated file");

    // Format with prettier
    console.log("🎨 Formatting with prettier...");
    try {
      execSync(`npx prettier --write src/services/api/client.generated.ts`, {
        cwd: rootDir,
        stdio: "inherit"
      });
    } catch (e) {
      console.error("❌ prettier formatting failed");
      process.exit(1);
    }

    console.log("\n✅ Client generation complete!");
    console.log(`   Generated: ${path.relative(rootDir, generatedPath)}`);
    console.log(`   Backend commit: ${manifest.backend.commitSha}`);
    console.log(`   Document checksum: ${manifest.artifact.sha256}`);
  } catch (e) {
    console.error(`❌ Generation failed: ${e.message}`);
    process.exit(1);
  }
}

generate();
