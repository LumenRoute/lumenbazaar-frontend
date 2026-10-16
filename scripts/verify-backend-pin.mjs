#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const manifestPath = path.join(rootDir, "backend-pin.json");
const documentPath = path.join(rootDir, "backend", "openapi.json");

async function verify() {
  try {
    // Check if manifest exists
    if (!fs.existsSync(manifestPath)) {
      console.error(`❌ Manifest not found at ${manifestPath}`);
      process.exit(1);
    }

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

    // Validate manifest structure
    if (!manifest.artifact?.sha256) {
      console.error(
        "❌ Manifest missing required field: artifact.sha256"
      );
      process.exit(1);
    }

    // Read document
    const documentRaw = fs.readFileSync(documentPath, "utf8");

    // Compute hash
    const hash = crypto
      .createHash("sha256")
      .update(documentRaw)
      .digest("hex");

    // Compare
    if (hash !== manifest.artifact.sha256) {
      console.error(
        `❌ CHECKSUM MISMATCH: Expected ${manifest.artifact.sha256}, got ${hash}`
      );
      process.exit(1);
    }

    console.log("✓ OpenAPI document checksum verified.");
    process.exit(0);
  } catch (e) {
    console.error(`❌ Verification failed: ${e.message}`);
    process.exit(1);
  }
}

verify();
