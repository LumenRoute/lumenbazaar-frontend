import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import { findDemoResource } from "@/fixtures/lumenbazaar";
import { apiClient, type LumenBazaarApiClient } from "@/services/api/client";
import type { Resource } from "@/services/api/schemas";
import {
  resourceDraftPublishSchema,
  resourceDraftSchema,
  type ResourceDraft
} from "@/services/resource-creation";
import { currentRuntimeMode } from "@/services/runtime-mode";

/**
 * Resource editing keeps the server version explicit. A new version is only
 * published against the exact `updatedAt` that was reviewed; a newer server
 * version raises VERSION_CONFLICT and the draft is preserved instead of being
 * silently overwritten.
 */

export type ResourceEditErrorCode =
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "VALIDATION_FAILED"
  | "BACKEND_UNAVAILABLE"
  | "UNSUPPORTED_CAPABILITY";

export class ResourceEditError extends Error {
  readonly code: ResourceEditErrorCode;
  readonly issues: Array<{ field: string; message: string }>;
  readonly serverResource: Resource | undefined;

  constructor({
    code,
    issues = [],
    message,
    serverResource
  }: {
    code: ResourceEditErrorCode;
    issues?: Array<{ field: string; message: string }>;
    message: string;
    serverResource?: Resource;
  }) {
    super(message);
    this.name = "ResourceEditError";
    this.code = code;
    this.issues = issues;
    this.serverResource = serverResource;
  }
}

export type EditableResourceSnapshot = {
  base: Resource;
  draft: ResourceDraft;
  source: "api" | "demo";
  version: string;
};

export type ResourceDiffField = {
  after: string;
  before: string;
  changed: boolean;
  field: string;
  label: string;
  /** Payment terms and endpoint changes require prominent review. */
  paymentCritical: boolean;
};

export type ResourceDiff = {
  changed: boolean;
  fields: ResourceDiffField[];
  paymentCriticalChanges: ResourceDiffField[];
};

export type ResourceEditValidation = {
  diff: ResourceDiff;
  errors: Array<{ field: string; message: string }>;
  valid: boolean;
};

type EditableField = {
  field: string;
  key: keyof ResourceDraft;
  label: string;
  paymentCritical: boolean;
};

const EDITABLE_FIELDS: EditableField[] = [
  { field: "name", key: "name", label: "Name", paymentCritical: false },
  { field: "description", key: "description", label: "Description", paymentCritical: false },
  { field: "type", key: "type", label: "Type", paymentCritical: false },
  { field: "url", key: "url", label: "Endpoint URL", paymentCritical: true },
  { field: "routeTemplate", key: "routeTemplate", label: "Route template", paymentCritical: true },
  { field: "network", key: "network", label: "Network", paymentCritical: true },
  { field: "assetCode", key: "assetCode", label: "Asset code", paymentCritical: true },
  { field: "assetIssuer", key: "assetIssuer", label: "Asset issuer", paymentCritical: true },
  { field: "amount", key: "amount", label: "Amount", paymentCritical: true },
  { field: "payTo", key: "payTo", label: "Recipient", paymentCritical: true },
  { field: "inputSchema", key: "inputSchema", label: "Input schema", paymentCritical: false },
  { field: "outputSchema", key: "outputSchema", label: "Output schema", paymentCritical: false },
  { field: "extensions", key: "extensions", label: "Extensions", paymentCritical: false }
];

export function draftFromResource(resource: Resource): ResourceDraft {
  return resourceDraftSchema.parse({
    amount: resource.amount,
    assetCode: resource.assetCode,
    assetIssuer: resource.assetIssuer,
    createdAt: resource.createdAt,
    description: resource.description,
    extensions: resource.extensions,
    inputSchema: resource.inputSchema,
    name: resource.name,
    network: resource.network,
    outputSchema: resource.outputSchema,
    payTo: resource.payTo,
    routeTemplate: resource.routeTemplate,
    status: "draft",
    type: resource.type,
    updatedAt: resource.updatedAt,
    url: resource.url
  });
}

export async function loadResourceForEdit(
  resourceId: string,
  client: Pick<LumenBazaarApiClient, "getResource"> = apiClient,
  mode: RuntimeEnvironment = currentRuntimeMode()
): Promise<EditableResourceSnapshot> {
  if (isDemoMode(mode)) {
    const resource = demoUpdatedResources.get(resourceId) ?? findDemoResource(resourceId);
    if (resource === undefined) {
      throw new ResourceEditError({
        code: "NOT_FOUND",
        message: "This resource is not available in the demo catalog."
      });
    }

    return {
      base: resource,
      draft: draftFromResource(resource),
      source: "demo",
      version: resource.updatedAt
    };
  }

  try {
    const resource = await client.getResource(resourceId);
    return {
      base: resource,
      draft: draftFromResource(resource),
      source: "api",
      version: resource.updatedAt
    };
  } catch (error) {
    throw new ResourceEditError({
      code: "BACKEND_UNAVAILABLE",
      message:
        error instanceof Error
          ? error.message
          : "The current resource version could not be loaded from the backend."
    });
  }
}

export function diffResourceDraft(base: Resource, draft: ResourceDraft): ResourceDiff {
  const baseDraft = draftFromResource(base);
  const fields = EDITABLE_FIELDS.map(({ field, key, label, paymentCritical }) => {
    const before = formatValue(baseDraft[key]);
    const after = formatValue(draft[key]);

    return {
      after,
      before,
      changed: before !== after,
      field,
      label,
      paymentCritical
    };
  });
  const changedFields = fields.filter((entry) => entry.changed);

  return {
    changed: changedFields.length > 0,
    fields,
    paymentCriticalChanges: changedFields.filter((entry) => entry.paymentCritical)
  };
}

export function validateResourceEdit(base: Resource, draft: ResourceDraft): ResourceEditValidation {
  const parsed = resourceDraftPublishSchema.safeParse(draft);
  const errors: Array<{ field: string; message: string }> = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        field: issue.path.join(".") || "general",
        message: issue.message
      });
    }
  }

  for (const field of ["network", "assetCode", "assetIssuer", "amount", "payTo"] as const) {
    if ((draft[field] ?? "").trim().length === 0) {
      errors.push({ field, message: `${field} is required to publish a payable version.` });
    }
  }

  const diff = diffResourceDraft(base, draft);

  return {
    diff,
    errors,
    valid: errors.length === 0
  };
}

export type ResourceEditPort = {
  updateResource(input: {
    draft: ResourceDraft;
    expectedUpdatedAt: string;
    overwriteServerVersion: boolean;
    resourceId: string;
  }): Promise<Resource>;
};

export type SaveResourceEditInput = {
  base: Resource;
  draft: ResourceDraft;
  /** Explicit resolution after a version conflict. Never implied. */
  overwriteServerVersion?: boolean;
  port?: ResourceEditPort;
  mode?: RuntimeEnvironment;
};

export type SaveResourceEditResult = {
  changed: boolean;
  resource: Resource;
  source: "api" | "demo";
};

export async function saveResourceEdit({
  base,
  draft,
  mode = currentRuntimeMode(),
  overwriteServerVersion = false,
  port
}: SaveResourceEditInput): Promise<SaveResourceEditResult> {
  const validation = validateResourceEdit(base, draft);
  if (!validation.valid) {
    throw new ResourceEditError({
      code: "VALIDATION_FAILED",
      issues: validation.errors,
      message: "Fix the highlighted fields before publishing a new version."
    });
  }

  if (!validation.diff.changed) {
    return { changed: false, resource: base, source: isDemoMode(mode) ? "demo" : "api" };
  }

  const resolvedPort = port ?? createResourceEditPort(mode);

  try {
    const resource = await resolvedPort.updateResource({
      draft,
      expectedUpdatedAt: base.updatedAt,
      overwriteServerVersion,
      resourceId: base.id
    });

    return { changed: true, resource, source: isDemoMode(mode) ? "demo" : "api" };
  } catch (error) {
    if (error instanceof ResourceEditError) throw error;
    throw new ResourceEditError({
      code: "BACKEND_UNAVAILABLE",
      message: error instanceof Error ? error.message : "The new version could not be saved."
    });
  }
}

export function createResourceEditPort(mode: RuntimeEnvironment): ResourceEditPort {
  return isDemoMode(mode) ? demoResourceEditPort : unsupportedResourceEditPort;
}

const demoUpdatedResources = new Map<string, Resource>();

export const demoResourceEditPort: ResourceEditPort = {
  async updateResource({ draft, expectedUpdatedAt, overwriteServerVersion, resourceId }) {
    const current = demoUpdatedResources.get(resourceId) ?? findDemoResource(resourceId);
    if (current === undefined) {
      throw new ResourceEditError({
        code: "NOT_FOUND",
        message: "The demo resource no longer exists."
      });
    }
    if (!overwriteServerVersion && current.updatedAt !== expectedUpdatedAt) {
      throw new ResourceEditError({
        code: "VERSION_CONFLICT",
        message:
          "A newer version of this resource exists. Review the server version before publishing.",
        serverResource: current
      });
    }

    const updated: Resource = {
      ...current,
      amount: draft.amount ?? current.amount,
      assetCode: draft.assetCode ?? current.assetCode,
      assetIssuer: draft.assetIssuer ?? current.assetIssuer,
      description: draft.description,
      extensions: draft.extensions ?? current.extensions,
      inputSchema: draft.inputSchema ?? current.inputSchema,
      name: draft.name,
      network: draft.network ?? current.network,
      outputSchema: draft.outputSchema ?? current.outputSchema,
      payTo: draft.payTo ?? current.payTo,
      routeTemplate: draft.routeTemplate,
      type: draft.type,
      updatedAt: new Date(Date.parse(current.updatedAt) + 1_000).toISOString(),
      url: draft.url
    };
    demoUpdatedResources.set(resourceId, updated);

    return updated;
  }
};

export const unsupportedResourceEditPort: ResourceEditPort = {
  updateResource: async () =>
    Promise.reject(
      new ResourceEditError({
        code: "UNSUPPORTED_CAPABILITY",
        message:
          "The configured backend does not expose a resource update endpoint yet. Your draft was preserved and no version was published."
      })
    )
};

const EDIT_DRAFT_PREFIX = "lumenbazaar_resource_edit_draft:";

export function saveEditDraft(resourceId: string, draft: ResourceDraft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${EDIT_DRAFT_PREFIX}${resourceId}`, JSON.stringify(draft));
}

export function loadEditDraft(resourceId: string): ResourceDraft | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(`${EDIT_DRAFT_PREFIX}${resourceId}`);
  if (value === null) return null;

  try {
    const parsed = resourceDraftSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Invalid drafts are discarded below.
  }
  localStorage.removeItem(`${EDIT_DRAFT_PREFIX}${resourceId}`);

  return null;
}

export function clearEditDraft(resourceId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${EDIT_DRAFT_PREFIX}${resourceId}`);
}

export function resetDemoResourceEditStore() {
  demoUpdatedResources.clear();
}

function formatValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;

  return JSON.stringify(value, null, 2);
}
