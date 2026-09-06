import { BookOpen, Bot, Code2, FileJson, LockKeyhole, ShieldCheck, Store } from "lucide-react";

export const canonicalDocsRepo = "https://github.com/LumenRoute/lumenbazaar-docs";

export const docsLinks = [
  {
    description: "Seller onboarding, domain verification, metadata, snippets, and publication.",
    href: `${canonicalDocsRepo}/tree/main/sellers`,
    icon: Store,
    label: "Seller docs"
  },
  {
    description: "Buyer inspection, payment requirements, and exact x402 request retry flow.",
    href: `${canonicalDocsRepo}/tree/main/buyers`,
    icon: LockKeyhole,
    label: "Buyer docs"
  },
  {
    description: "Agent discovery and paid tool execution through the MCP bridge.",
    href: `${canonicalDocsRepo}/tree/main/agents`,
    icon: Bot,
    label: "Agent docs"
  },
  {
    description: "Facilitator operation, health checks, queues, and conformance evidence.",
    href: `${canonicalDocsRepo}/tree/main/operators`,
    icon: ShieldCheck,
    label: "Operator docs"
  },
  {
    description: "Backend OpenAPI, payment payloads, receipts, errors, and release contracts.",
    href: `${canonicalDocsRepo}/tree/main/api`,
    icon: FileJson,
    label: "API docs"
  },
  {
    description: "Soroban capped-session contracts, deployment evidence, and network limits.",
    href: `${canonicalDocsRepo}/tree/main/contracts`,
    icon: Code2,
    label: "Contract docs"
  },
  {
    description: "Non-custodial wallet posture, payload redaction, and responsible disclosure.",
    href: `${canonicalDocsRepo}/tree/main/security`,
    icon: BookOpen,
    label: "Security docs"
  }
] as const;
