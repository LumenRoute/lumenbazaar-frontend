import { z } from "zod";

import { networkIdSchema } from "@/config/networks";
import { jsonObjectSchema, resourceTypeSchema, type ResourceType } from "@/services/api/schemas";

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
const DRAFT_STORAGE_KEY = "lumenbazaar_resource_draft";

export function saveDraftToStorage(draft: ResourceDraft): void {
  if (typeof window !== "undefined") {
    const validated = resourceDraftSchema.parse(draft);
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(validated));
  }
}

export function loadDraftFromStorage(): ResourceDraft | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        return resourceDraftSchema.parse(parsed);
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
  }
  return null;
}

export function clearDraftFromStorage(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }
}
