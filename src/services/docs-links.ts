import {
  BookOpen,
  Bot,
  Code2,
  FileJson,
  LockKeyhole,
  ShieldCheck,
  Store,
  Terminal
} from "lucide-react";

import docsRoutes from "./docs-links.routes.json";

/**
 * Canonical, deployed documentation routes.
 *
 * These are the Docusaurus routes in LumenRoute/lumenbazaar-docs. Keep this
 * JSON in sync with the docs site: it is the single source used by the UI, the
 * unit tests, and `scripts/check-docs-links.mjs`.
 */
export { docsRoutes };

export const canonicalDocsRepo = "https://github.com/LumenRoute/lumenbazaar-docs";

/**
 * Public docs deployment. Override with NEXT_PUBLIC_LUMENBAZAAR_DOCS_URL when
 * the docs site moves (for example a custom domain or preview deployment).
 */
export const DEFAULT_DOCS_ORIGIN = "https://lumenbazaar-docs.vercel.app";

/**
 * Resolve the configured docs origin, dropping any path/query/hash. Non-http(s)
 * or malformed values fall back to the canonical deployment rather than
 * producing broken links.
 */
export function resolveDocsOrigin(value?: string): string {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_DOCS_ORIGIN;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_DOCS_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_DOCS_ORIGIN;
  }
}

export const docsOrigin = resolveDocsOrigin(process.env.NEXT_PUBLIC_LUMENBAZAAR_DOCS_URL);

function docsHref(path: string): string {
  return `${docsOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface DocsLinkProbe {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  body?: string;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Validate a fetched docs link. Returns an empty array when healthy, otherwise
 * human-readable failure reasons.
 *
 * A redirect is only acceptable when it preserves the requested path (for
 * example a trailing-slash normalisation). Redirects to a different path or a
 * 404 page are rejected so the smoke check catches "soft 404" deployments.
 */
export function validateDocsLinkProbe(probe: DocsLinkProbe): string[] {
  const errors: string[] = [];
  const requested = new URL(probe.requestedUrl);
  const final = new URL(probe.finalUrl);

  if (probe.status !== 200) {
    errors.push(`expected HTTP 200, received ${probe.status}`);
  }
  if (final.origin !== requested.origin) {
    errors.push(`redirected off the docs origin to ${final.origin}`);
  }
  if (normalizePathname(final.pathname) !== normalizePathname(requested.pathname)) {
    errors.push(`redirected from ${requested.pathname} to missing page ${final.pathname}`);
  }
  if (probe.body && /(?:<title>[^<]*\b404\b|page not found|404 - )/i.test(probe.body)) {
    errors.push("response body looks like a not-found page");
  }

  return errors;
}

export const docsLinks = [
  {
    description: "Seller onboarding, domain verification, metadata, snippets, and publication.",
    href: docsHref(docsRoutes.seller),
    icon: Store,
    label: "Seller docs"
  },
  {
    description: "Buyer inspection, payment requirements, and exact x402 request retry flow.",
    href: docsHref(docsRoutes.buyer),
    icon: LockKeyhole,
    label: "Buyer docs"
  },
  {
    description: "Agent discovery and paid tool execution through the MCP bridge.",
    href: docsHref(docsRoutes.agent),
    icon: Bot,
    label: "Agent docs"
  },
  {
    description: "MCP tools, schemas, transport requirements, and paid tool invocation.",
    href: docsHref(docsRoutes.mcp),
    icon: Terminal,
    label: "MCP docs"
  },
  {
    description: "Facilitator operation, health checks, queues, and conformance evidence.",
    href: docsHref(docsRoutes.operator),
    icon: ShieldCheck,
    label: "Operator docs"
  },
  {
    description: "Backend OpenAPI, payment payloads, receipts, errors, and release contracts.",
    href: docsHref(docsRoutes.api),
    icon: FileJson,
    label: "API docs"
  },
  {
    description: "Soroban capped-session contracts, deployment evidence, and network limits.",
    href: docsHref(docsRoutes.contracts),
    icon: Code2,
    label: "Contract docs"
  },
  {
    description: "Non-custodial wallet posture, payload redaction, and responsible disclosure.",
    href: docsHref(docsRoutes.security),
    icon: BookOpen,
    label: "Security docs"
  }
] as const;
