import { z } from "zod";

import { networkIdSchema } from "@/config/networks";
import {
  jsonObjectSchema,
  resourceTypeSchema,
  type CreateResourceInput,
  type ResourceType
} from "@/services/api/schemas";

// Route template validation for both HTTP and MCP
export function validateRouteTemplate(template: string, type: ResourceType): boolean {
  if (type === "http") {
    // HTTP route templates: /path/{param}/{param}
    // Must start with /, can contain alphanumeric, hyphens, underscores
    // Parameters in curly braces
    return /^\/[a-zA-Z0-9\-_/{}]*$/.test(template);
  } else if (type === "mcp") {
    // MCP route templates: mcp://server-name/tool-name
    // Format: mcp://<server>/<tool>
    return /^mcp:\/\/[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_]+$/.test(template);
  }
  return false;
}

export function routeTemplateError(template: string, type: ResourceType): string | null {
  if (!template) {
    return "Route template is required";
  }

  if (type === "http") {
    if (!template.startsWith("/")) {
      return "HTTP route must start with /";
    }
    if (!/^\/[a-zA-Z0-9\-_/{}]*$/.test(template)) {
      return "HTTP route can only contain alphanumeric, hyphens, underscores, slashes, and parameters in {curly braces}";
    }
  } else if (type === "mcp") {
    if (!template.startsWith("mcp://")) {
      return "MCP route must start with mcp://";
    }
    if (!/^mcp:\/\/[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_]+$/.test(template)) {
      return "MCP route format: mcp://server-name/tool-name";
    }
  }

  return null;
}

// Draft state stored in localStorage - more lenient than final resource schema
export const resourceDraftSchema = z.object({
  // Basic info (Phase 16) - can be empty during creation
  name: z.string().max(120),
  description: z.string().max(1000),
  type: resourceTypeSchema,
  url: z.string(),
  routeTemplate: z.string(),

  // Pricing (Phase 17)
  network: networkIdSchema.optional(),
  assetCode: z.string().optional(),
  assetIssuer: z.string().optional(),
  amount: z.string().optional(),
  payTo: z.string().optional(),

  // Metadata (Phase 18)
  inputSchema: jsonObjectSchema.optional(),
  outputSchema: jsonObjectSchema.optional(),
  extensions: jsonObjectSchema.optional(),

  // Internal tracking
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.literal("draft").default("draft")
});

export type ResourceDraft = z.infer<typeof resourceDraftSchema>;

/** Version stamped on exported draft files. Unknown versions are rejected. */
export const RESOURCE_DRAFT_EXPORT_VERSION = 1;

/** Upper bound for an imported draft file, measured in UTF-8 bytes. */
export const MAX_RESOURCE_DRAFT_IMPORT_BYTES = 64 * 1024;

/**
 * Fields that may leave or enter the browser in a draft file. The allowlist is
 * explicit so session data, wallet secrets, and future schema additions are
 * never exported by accident.
 */
const EXPORTABLE_DRAFT_FIELDS = [
  "name",
  "description",
  "type",
  "url",
  "routeTemplate",
  "network",
  "assetCode",
  "assetIssuer",
  "amount",
  "payTo",
  "inputSchema",
  "outputSchema",
  "extensions",
  "createdAt",
  "updatedAt",
  "status"
] as const satisfies ReadonlyArray<keyof ResourceDraft>;

export type ResourceDraftExport = {
  version: typeof RESOURCE_DRAFT_EXPORT_VERSION;
  exportedAt: string;
  draft: ResourceDraft;
};

export type ResourceDraftImportErrorCode =
  | "INVALID_JSON"
  | "OVERSIZED"
  | "UNSUPPORTED_VERSION"
  | "INVALID_DRAFT";

export class ResourceDraftImportError extends Error {
  readonly code: ResourceDraftImportErrorCode;

  constructor(code: ResourceDraftImportErrorCode, message: string) {
    super(message);
    this.name = "ResourceDraftImportError";
    this.code = code;
  }
}

/**
 * Serializes a draft as schema-validated JSON containing only non-secret draft
 * metadata.
 *
 * @throws ZodError if the draft does not satisfy the draft schema
 */
export function exportResourceDraftToJson(
  draft: ResourceDraft,
  timestamp: Date = new Date()
): string {
  const validated = resourceDraftSchema.parse(draft);
  const exported: ResourceDraftExport = {
    draft: Object.fromEntries(
      EXPORTABLE_DRAFT_FIELDS.map((field) => [field, validated[field]])
    ) as ResourceDraft,
    exportedAt: timestamp.toISOString(),
    version: RESOURCE_DRAFT_EXPORT_VERSION
  };

  return JSON.stringify(exported, null, 2);
}

/**
 * Parses and validates a draft file produced by `exportResourceDraftToJson`.
 *
 * Oversized payloads, unknown versions, and invalid values are rejected with a
 * typed error so the UI can explain exactly what went wrong. Fields outside the
 * draft schema are dropped rather than trusted.
 */
export function importResourceDraftFromJson(raw: string): ResourceDraft {
  if (new TextEncoder().encode(raw).length > MAX_RESOURCE_DRAFT_IMPORT_BYTES) {
    throw new ResourceDraftImportError(
      "OVERSIZED",
      `Draft files must be smaller than ${MAX_RESOURCE_DRAFT_IMPORT_BYTES / 1024} KB.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ResourceDraftImportError("INVALID_JSON", "The draft file is not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ResourceDraftImportError("INVALID_DRAFT", "The draft file must be a JSON object.");
  }

  const { draft, version } = parsed as { draft?: unknown; version?: unknown };

  if (version !== RESOURCE_DRAFT_EXPORT_VERSION) {
    throw new ResourceDraftImportError(
      "UNSUPPORTED_VERSION",
      `Unsupported draft file version. Expected ${RESOURCE_DRAFT_EXPORT_VERSION}.`
    );
  }

  if (typeof draft !== "object" || draft === null || Array.isArray(draft)) {
    throw new ResourceDraftImportError("INVALID_DRAFT", "The draft file does not contain a draft.");
  }

  const result = resourceDraftSchema.safeParse(draft);

  if (!result.success) {
    throw new ResourceDraftImportError(
      "INVALID_DRAFT",
      result.error.issues[0]?.message ?? "The draft file failed validation."
    );
  }

  return result.data;
}

// Schema for final validation before publishing
export const resourceDraftPublishSchema = resourceDraftSchema
  .refine((draft) => draft.name.trim().length > 0, {
    message: "Resource name is required",
    path: ["name"]
  })
  .refine((draft) => draft.description.trim().length > 0, {
    message: "Description is required",
    path: ["description"]
  })
  .refine((draft) => draft.url.trim().length > 0, { message: "URL is required", path: ["url"] })
  .refine(
    (draft) => {
      try {
        new URL(draft.url);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Must be a valid URL", path: ["url"] }
  )
  .refine((draft) => draft.routeTemplate.trim().length > 0, {
    message: "Route template is required",
    path: ["routeTemplate"]
  })
  .refine((draft) => !routeTemplateError(draft.routeTemplate, draft.type), {
    message: "Invalid route template",
    path: ["routeTemplate"]
  });

/**
 * Single normalized source for both the publish preview and the submitted
 * request. Parsing with the publish schema guarantees the preview can never
 * describe fields that would be dropped or defaulted differently at submit
 * time.
 *
 * @throws ZodError when required publish fields are missing or invalid
 */
export function buildResourcePublishPayload(
  draft: ResourceDraft,
  sellerId: string
): CreateResourceInput {
  const validated = resourceDraftPublishSchema.parse(draft);

  return {
    sellerId,
    name: validated.name.trim(),
    description: validated.description.trim(),
    type: validated.type,
    url: validated.url.trim(),
    routeTemplate: validated.routeTemplate.trim(),
    network: validated.network || "stellar:testnet",
    assetCode: validated.assetCode || "USDC",
    assetIssuer: validated.assetIssuer || "",
    amount: validated.amount || "0",
    payTo: validated.payTo || "",
    inputSchema: validated.inputSchema || { type: "object", properties: {} },
    outputSchema: validated.outputSchema || { type: "object", properties: {} },
    ...(validated.extensions === undefined ? {} : { extensions: validated.extensions })
  };
}

/** Fields included in the submitted payload shown by the publish preview. */
export const RESOURCE_PUBLISH_PUBLIC_FIELDS = [
  "sellerId",
  "name",
  "description",
  "type",
  "url",
  "routeTemplate",
  "network",
  "assetCode",
  "assetIssuer",
  "amount",
  "payTo",
  "inputSchema",
  "outputSchema",
  "extensions"
] as const satisfies ReadonlyArray<keyof CreateResourceInput>;

/** Draft-only bookkeeping that is never submitted with a publish request. */
export const RESOURCE_PUBLISH_OMITTED_FIELDS = ["createdAt", "updatedAt", "status"] as const;

export function createEmptyDraft(): ResourceDraft {
  const now = new Date().toISOString();
  return {
    name: "",
    description: "",
    type: "http",
    url: "",
    routeTemplate: "",
    createdAt: now,
    updatedAt: now,
    status: "draft"
  };
}

export function updateDraft(draft: ResourceDraft, updates: Partial<ResourceDraft>): ResourceDraft {
  return {
    ...draft,
    ...updates,
    updatedAt: new Date().toISOString()
  };
}

// localStorage helpers
export const RESOURCE_DRAFT_STORAGE_KEY = "lumenbazaar_resource_draft";
export const RESOURCE_DRAFT_STORAGE_VERSION = 1;

const DRAFT_STORAGE_KEY = RESOURCE_DRAFT_STORAGE_KEY;

export type ResourceDraftRecovery = {
  draft: ResourceDraft;
  savedAt: string;
  schemaVersion: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Persists only schema-validated, non-secret draft metadata together with the
 * timestamp and schema version needed for an explicit recovery prompt.
 */
export function saveDraftToStorage(draft: ResourceDraft, timestamp: Date = new Date()): void {
  if (typeof window === "undefined") {
    return;
  }

  const validated = resourceDraftSchema.parse(draft);
  const persisted = Object.fromEntries(
    EXPORTABLE_DRAFT_FIELDS.map((field) => [field, validated[field]])
  ) as ResourceDraft;

  localStorage.setItem(
    DRAFT_STORAGE_KEY,
    JSON.stringify({
      draft: persisted,
      savedAt: timestamp.toISOString(),
      schemaVersion: RESOURCE_DRAFT_STORAGE_VERSION
    })
  );
}

/**
 * Loads a recoverable autosave with its age and schema version. Unknown schema
 * versions and invalid records are discarded rather than trusted.
 */
export function loadDraftRecoveryFromStorage(): ResourceDraftRecovery | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = localStorage.getItem(DRAFT_STORAGE_KEY);

  if (stored === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    if (!isRecord(parsed)) {
      throw new Error("Draft record is not an object");
    }

    // Legacy records stored a bare draft; treat their updatedAt as the save time.
    if (!("schemaVersion" in parsed)) {
      const draft = resourceDraftSchema.parse(parsed);
      return { draft, savedAt: draft.updatedAt, schemaVersion: RESOURCE_DRAFT_STORAGE_VERSION };
    }

    if (parsed.schemaVersion !== RESOURCE_DRAFT_STORAGE_VERSION) {
      throw new Error("Unsupported draft schema version");
    }

    const draft = resourceDraftSchema.parse(parsed.draft);
    const savedAt =
      typeof parsed.savedAt === "string" && !Number.isNaN(Date.parse(parsed.savedAt))
        ? parsed.savedAt
        : draft.updatedAt;

    return { draft, savedAt, schemaVersion: RESOURCE_DRAFT_STORAGE_VERSION };
  } catch {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

export function loadDraftFromStorage(): ResourceDraft | null {
  return loadDraftRecoveryFromStorage()?.draft ?? null;
}

/** Human-readable age for the recovery prompt (never a precise secret-bearing timestamp). */
export function formatDraftAge(savedAt: string, now: Date = new Date()): string {
  const savedTime = Date.parse(savedAt);

  if (Number.isNaN(savedTime)) {
    return "an unknown time";
  }

  const minutes = Math.floor(Math.max(0, now.getTime() - savedTime) / 60_000);

  if (minutes < 1) {
    return "less than a minute";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function clearDraftFromStorage(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }
}
