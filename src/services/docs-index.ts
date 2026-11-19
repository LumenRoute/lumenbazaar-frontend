import { docsLinks } from "./docs-links";

/**
 * Represents a searchable documentation entry with content and metadata.
 * Built from the canonical docsLinks manifest with added search fields.
 */
export interface DocumentationIndexEntry {
  /** Unique identifier - the canonical docs repository URL */
  id: string;
  /** Display label for the documentation section */
  label: string;
  /** One-sentence description of the documentation section */
  description: string;
  /** External link to the canonical documentation */
  href: string;
  /** Documentation category (e.g., "sellers", "buyers", "operators") */
  category: string;
  /** Lucide React icon name for UI rendering */
  icon: string;
  /** Combined searchable content: label + description + keywords */
  searchableContent: string;
  /** Approved keywords for this documentation section */
  keywords: string[];
}

/**
 * Complete documentation search index with deterministic ordering.
 * Generated from docsLinks manifest at build time.
 */
export interface DocumentationIndex {
  /** Version of the index schema - increment for breaking changes */
  version: number;
  /** ISO 8601 timestamp of index generation */
  generatedAt: string;
  /** Hash of the source data for deterministic validation */
  contentHash: string;
  /** Complete list of indexed entries in stable order */
  entries: DocumentationIndexEntry[];
}

/**
 * Mapping of documentation categories to approved search keywords.
 * Extends searchability beyond title and description.
 */
const categoryKeywords: Record<string, string[]> = {
  sellers: [
    "domain verification",
    "onboarding",
    "metadata",
    "snippets",
    "publication",
    "resource",
    "profile",
    "listing",
  ],
  buyers: [
    "inspection",
    "payment requirements",
    "exact",
    "x402",
    "request retry",
    "flow",
    "purchasing",
    "discovery",
  ],
  agents: [
    "discovery",
    "paid tool",
    "execution",
    "mcp bridge",
    "model context protocol",
    "tools",
    "automation",
  ],
  operators: [
    "facilitator",
    "operation",
    "health check",
    "queue",
    "conformance",
    "evidence",
    "monitoring",
    "uptime",
  ],
  api: [
    "openapi",
    "backend",
    "payment payload",
    "receipt",
    "error",
    "release",
    "contract",
    "schema",
    "endpoint",
  ],
  contracts: [
    "soroban",
    "capped-session",
    "deployment",
    "evidence",
    "network limit",
    "smart contract",
    "blockchain",
  ],
  security: [
    "non-custodial",
    "wallet",
    "posture",
    "payload redaction",
    "responsible disclosure",
    "privacy",
    "encryption",
  ],
};

/**
 * Extracts the category from a docsLink href.
 * Example: "https://github.com/.../tree/main/sellers" -> "sellers"
 */
function extractCategory(href: string): string {
  const match = href.match(/\/tree\/main\/([^/]+)\/?$/);
  return match?.[1] ?? "unknown";
}

/**
 * Gets the Lucide React icon name for a given documentation section.
 * Maps the icon constructor to its name string.
 */
function getIconName(icon: (typeof docsLinks)[number]["icon"]): string {
  // Use the constructor name to identify the icon
  return icon.name.replace(/^([A-Z])/, (match) => match.toLowerCase());
}

/**
 * Builds a deterministic hash of the index content.
 * Changes to docsLinks will produce a different hash.
 */
function buildContentHash(entries: DocumentationIndexEntry[]): string {
  const content = entries.map((e) => `${e.id}|${e.label}|${e.description}`).join("\n");

  // Simple deterministic hash using character codes
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Generates the complete documentation search index from the docsLinks manifest.
 * This function is deterministic - same input always produces identical output.
 *
 * @returns DocumentationIndex with all entries in stable order
 */
export function buildDocumentationIndex(): DocumentationIndex {
  // Process each link from docsLinks in order (deterministic)
  const entries: DocumentationIndexEntry[] = docsLinks.map((link) => {
    const category = extractCategory(link.href);
    const keywords = categoryKeywords[category] ?? [];

    // Build searchable content: label + description + keywords
    const searchParts = [link.label, link.description, ...keywords];
    const searchableContent = searchParts.join(" ").toLowerCase();

    return {
      id: link.href,
      label: link.label,
      description: link.description,
      href: link.href,
      category,
      icon: getIconName(link.icon),
      searchableContent,
      keywords,
    };
  });

  const contentHash = buildContentHash(entries);
  const generatedAt = new Date().toISOString();

  return {
    version: 1,
    generatedAt,
    contentHash,
    entries,
  };
}

/**
 * Gets or creates the cached documentation index.
 * Should be called once at app initialization.
 */
let cachedIndex: DocumentationIndex | null = null;

export function getDocumentationIndex(): DocumentationIndex {
  if (!cachedIndex) {
    cachedIndex = buildDocumentationIndex();
  }
  return cachedIndex;
}

/**
 * Resets the cached index (mainly for testing).
 */
export function resetDocumentationIndexCache(): void {
  cachedIndex = null;
}
