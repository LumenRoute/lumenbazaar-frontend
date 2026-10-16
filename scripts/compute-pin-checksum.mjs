#!/usr/bin/env node
/**
 * Compute the SHA-256 checksum of the vendored OpenAPI document.
 * 
 * Usage:
 *   node scripts/compute-pin-checksum.mjs [output-format]
 * 
 * Outputs the checksum in the specified format:
 *   - hex (default): hexadecimal string
 *   - json: JSON format for pasting into backend-pin.json
 *   - bash: bash export statement
 */

import crypto from "crypto";
import fs from "fs";

const format = process.argv[2] || "hex";

try {
  const doc = fs.readFileSync("backend/openapi.json", "utf8");
  const hash = crypto.createHash("sha256").update(doc).digest("hex");

  switch (format) {
    case "hex":
      console.log(hash);
      break;
    case "json":
      console.log(
        JSON.stringify(
          { "artifact.sha256": hash },
          null,
          2
        )
      );
      break;
    case "bash":
      console.log(`export BACKEND_PIN_SHA256="${hash}"`);
      break;
    default:
      console.error(`Unknown format: ${format}`);
      console.error("Use: hex, json, or bash");
      process.exit(1);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
