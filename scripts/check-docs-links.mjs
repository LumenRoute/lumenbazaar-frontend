#!/usr/bin/env node

/**
 * Deployed documentation link smoke check.
 *
 * Verifies every route rendered by the frontend resolves on the public docs
 * deployment. It fails on non-200 responses, redirects that change the path
 * (a common "redirected to /404" failure), redirects off the docs origin, and
 * soft-404 pages that return HTTP 200.
 *
 * Usage:
 *   node scripts/check-docs-links.mjs
 *   NEXT_PUBLIC_LUMENBAZAAR_DOCS_URL=https://docs.example.com node scripts/check-docs-links.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DOCS_ORIGIN = "https://lumenbazaar-docs.vercel.app";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveOrigin(value) {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_DOCS_ORIGIN;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : DEFAULT_DOCS_ORIGIN;
  } catch {
    return DEFAULT_DOCS_ORIGIN;
  }
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

const origin = resolveOrigin(process.env.NEXT_PUBLIC_LUMENBAZAAR_DOCS_URL);
const routes = JSON.parse(readFileSync(join(root, "src/services/docs-links.routes.json"), "utf8"));

let failed = false;

for (const [name, route] of Object.entries(routes)) {
  const requestedUrl = `${origin}${route.startsWith("/") ? route : `/${route}`}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(requestedUrl, {
      redirect: "follow",
      headers: { "user-agent": "lumenbazaar-docs-link-check" },
      signal: controller.signal
    });
    clearTimeout(timer);
    const body = await response.text();
    const finalUrl = new URL(response.url);
    const requested = new URL(requestedUrl);
    const errors = [];

    if (response.status !== 200) errors.push(`HTTP ${response.status}`);
    if (finalUrl.origin !== requested.origin)
      errors.push(`redirected off-origin to ${finalUrl.origin}`);
    if (normalizePath(finalUrl.pathname) !== normalizePath(requested.pathname)) {
      errors.push(`redirected to missing page ${finalUrl.pathname}`);
    }
    if (/(?:<title>[^<]*\b404\b|page not found|404 - )/i.test(body)) {
      errors.push("response body looks like a not-found page");
    }

    if (errors.length > 0) {
      failed = true;
      console.error(`FAIL ${name} (${requestedUrl}): ${errors.join("; ")}`);
    } else {
      console.log(`ok   ${name.padEnd(10)} ${requestedUrl}`);
    }
  } catch (error) {
    failed = true;
    console.error(
      `FAIL ${name} (${requestedUrl}): ${error instanceof Error ? error.message : error}`
    );
  }
}

if (failed) {
  console.error("\nDocs link smoke check failed.");
  process.exitCode = 1;
} else {
  console.log(`\nAll ${Object.keys(routes).length} documentation links resolved on ${origin}.`);
}
