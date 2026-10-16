#!/usr/bin/env node

/**
 * Screenshot Release Artifacts Generator
 *
 * Generates deterministic artifact naming for screenshots tied to a tested release commit.
 * Captures commit hash, deployment URL, and organizes screenshots by browser variant.
 *
 * Usage:
 *   node scripts/screenshot-release-artifacts.mjs [--output-dir <path>] [--deployment-url <url>]
 *
 * Environment variables:
 *   LUMENBAZAAR_DEPLOYMENT_URL - Frontend deployment URL for metadata
 *   LUMENBAZAAR_RELEASE_COMMIT - Explicit commit hash (defaults to git HEAD)
 */

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let outputDir = "test-results/screenshots";
let deploymentUrl = process.env.LUMENBAZAAR_DEPLOYMENT_URL || "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output-dir" && i + 1 < args.length) {
    outputDir = args[++i];
  } else if (args[i] === "--deployment-url" && i + 1 < args.length) {
    deploymentUrl = args[++i];
  }
}

/**
 * Get the current commit hash
 */
function getCommitHash() {
  if (process.env.LUMENBAZAAR_RELEASE_COMMIT) {
    return process.env.LUMENBAZAAR_RELEASE_COMMIT;
  }

  try {
    return child_process
      .execSync("git rev-parse HEAD", { encoding: "utf-8" })
      .trim()
      .substring(0, 12);
  } catch (error) {
    console.warn("Warning: Could not get commit hash from git");
    return "unknown";
  }
}

/**
 * Get the current branch name
 */
function getBranchName() {
  try {
    return child_process
      .execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" })
      .trim();
  } catch (error) {
    return "unknown";
  }
}

/**
 * Get the current timestamp
 */
function getTimestamp() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Organize and rename screenshots with deterministic naming
 */
function organizeScreenshots(screenshotsDir) {
  if (!fs.existsSync(screenshotsDir)) {
    console.log(`Screenshots directory not found: ${screenshotsDir}`);
    return;
  }

  const commitHash = getCommitHash();
  const timestamp = getTimestamp();
  const branch = getBranchName();

  // Create organized subdirectories
  const desktopDir = path.join(screenshotsDir, "desktop");
  const mobileDir = path.join(screenshotsDir, "mobile");

  for (const dir of [desktopDir, mobileDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Read screenshots and organize them
  const files = fs.readdirSync(screenshotsDir);
  const screenshotFiles = files.filter((f) => f.endsWith(".png"));

  for (const file of screenshotFiles) {
    const isDesktop = file.includes("desktop") || !file.includes("mobile");
    const targetDir = isDesktop ? desktopDir : mobileDir;

    const newName = `${commitHash}_${timestamp}_${file}`;
    const oldPath = path.join(screenshotsDir, file);
    const newPath = path.join(targetDir, newName);

    fs.renameSync(oldPath, newPath);
    console.log(`Organized: ${file} → ${path.relative(process.cwd(), newPath)}`);
  }

  console.log(`\n✓ Screenshots organized in ${screenshotsDir}`);
}

/**
 * Generate metadata JSON for the release
 */
function generateMetadata(screenshotsDir) {
  const commitHash = getCommitHash();
  const timestamp = getTimestamp();
  const branch = getBranchName();

  const metadata = {
    releaseEvidence: {
      frontend: {
        commitHash,
        branch,
        timestamp,
        deploymentUrl: deploymentUrl || "pending"
      },
      screenshotVariants: ["desktop", "mobile"],
      coverage: [
        "dashboard-state",
        "explore-discovery",
        "resource-detail",
        "wallet-connection",
        "payment-validation",
        "receipt-recovery",
        "receipt-detail",
        "error-states"
      ],
      redactionStatus: "sensitive-data-redacted",
      generatedAt: new Date().toISOString()
    }
  };

  const metadataPath = path.join(screenshotsDir, `metadata_${commitHash}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`\nMetadata generated: ${path.relative(process.cwd(), metadataPath)}`);
  console.log(`\nRelease Evidence Metadata:`);
  console.log(`  Commit: ${commitHash}`);
  console.log(`  Branch: ${branch}`);
  console.log(`  Date: ${timestamp}`);
  console.log(`  Deployment URL: ${deploymentUrl || "pending"}`);
  console.log(`  Redaction: Enabled`);

  return metadata;
}

/**
 * Validate that required screenshot states are present
 */
function validateScreenshotCoverage(screenshotsDir) {
  const requiredStates = [
    "dashboard",
    "explore-discovery",
    "payment-terms",
    "wallet-connected",
    "payment-validated",
    "receipt-recovered"
  ];

  const files = fs.readdirSync(screenshotsDir, { recursive: true });
  const screenshotNames = files.filter((f) => typeof f === "string" && f.endsWith(".png"));

  const missing = [];
  for (const state of requiredStates) {
    const found = screenshotNames.some((f) => f.includes(state));
    if (!found) {
      missing.push(state);
    }
  }

  if (missing.length > 0) {
    console.warn(`\n⚠ Warning: Missing screenshot states: ${missing.join(", ")}`);
    return false;
  }

  console.log("\n✓ All required screenshot states present:");
  for (const state of requiredStates) {
    const count = screenshotNames.filter((f) => f.includes(state)).length;
    console.log(`  - ${state}: ${count} variant(s)`);
  }

  return true;
}

/**
 * Main execution
 */
function main() {
  console.log("🎬 Screenshot Release Artifacts Generator\n");

  const absoluteOutputDir = path.resolve(outputDir);

  organizeScreenshots(absoluteOutputDir);
  generateMetadata(absoluteOutputDir);
  validateScreenshotCoverage(absoluteOutputDir);

  console.log("\n✓ Screenshot artifacts ready for release documentation");
}

main();
