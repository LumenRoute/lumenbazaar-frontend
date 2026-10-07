import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const policy = JSON.parse(readFileSync("security/audit-exceptions.json", "utf8"));
const expiresAt = new Date(`${policy.expiresAt}T23:59:59.999Z`);
if (!Number.isFinite(expiresAt.getTime()) || expiresAt < new Date()) {
  throw new Error(`Production audit exceptions expired on ${policy.expiresAt}.`);
}

const pnpmEntry = process.env.npm_execpath;
if (pnpmEntry === undefined) throw new Error("Run this policy through pnpm audit:prod.");
const executable = pnpmEntry.toLowerCase().endsWith(".exe") ? pnpmEntry : process.execPath;
const args = executable === process.execPath ? [pnpmEntry] : [];
const audit = spawnSync(executable, [...args, "audit", "--prod", "--json"], {
  encoding: "utf8",
  shell: false
});
if (audit.error) throw audit.error;

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  throw new Error(`pnpm audit did not return JSON: ${audit.stderr.trim()}`);
}

const actual = new Map(
  Object.values(report.advisories ?? {}).map((advisory) => [Number(advisory.id), advisory])
);
const allowed = new Map(policy.advisories.map((advisory) => [Number(advisory.id), advisory]));

for (const advisory of actual.values()) {
  if (advisory.severity === "critical" || advisory.severity === "high") {
    throw new Error(
      `Unreviewed ${advisory.severity} production advisory ${advisory.id} in ${advisory.module_name}.`
    );
  }
  const exception = allowed.get(Number(advisory.id));
  if (exception === undefined) {
    throw new Error(`Production advisory ${advisory.id} is not in the reviewed exception policy.`);
  }
  if (exception.module !== advisory.module_name || exception.severity !== advisory.severity) {
    throw new Error(`Production advisory ${advisory.id} no longer matches its reviewed exception.`);
  }
}

for (const advisory of allowed.values()) {
  if (!actual.has(Number(advisory.id))) {
    throw new Error(`Audit exception ${advisory.id} is stale and must be removed.`);
  }
}

console.log(
  `Production audit passed with ${actual.size} reviewed low/moderate advisories; exceptions expire ${policy.expiresAt}.`
);
