import { isDemoMode, type RuntimeEnvironment } from "@/config/runtime";
import { demoResources } from "@/fixtures/lumenbazaar";
import type { Resource } from "@/services/api/schemas";
import { currentRuntimeMode } from "@/services/runtime-mode";

/**
 * Safe resource discovery lifecycle.
 *
 * The pinned backend OpenAPI document does not expose disable/restore
 * endpoints yet, so live modes fail closed with UNSUPPORTED_CAPABILITY instead
 * of guessing at an unversioned mutation contract. Explicit demo mode uses an
 * in-session store that enforces the same rules the UI relies on: an explicit
 * confirmation, a reason, the current resource version, and server-side
 * eligibility for restore.
 */

export type ResourceLifecycleAction = "disable" | "restore";

export type ResourceLifecycleErrorCode =
  | "CONFIRMATION_REQUIRED"
  | "REASON_REQUIRED"
  | "RESOURCE_VERSION_REQUIRED"
  | "RESOURCE_CONFLICT"
  | "RESOURCE_NOT_FOUND"
  | "RESTORE_INELIGIBLE"
  | "BACKEND_UNAVAILABLE"
  | "UNSUPPORTED_CAPABILITY";

export class ResourceLifecycleError extends Error {
  readonly code: ResourceLifecycleErrorCode;
  readonly requestId: string | undefined;
  readonly retryable: boolean;

  constructor({
    code,
    message,
    requestId,
    retryable = false
  }: {
    code: ResourceLifecycleErrorCode;
    message: string;
    requestId?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = "ResourceLifecycleError";
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

export type ResourceMutationRequest = {
  expectedUpdatedAt: string;
  reason: string;
  resourceId: string;
};

export type ResourceLifecyclePort = {
  disableResource(request: ResourceMutationRequest): Promise<Resource>;
  restoreResource(request: ResourceMutationRequest): Promise<Resource>;
};

export type MutateResourceInput = {
  /** Explicit user acknowledgement; never defaulted to true. */
  confirmation: boolean;
  mode?: RuntimeEnvironment;
  port?: ResourceLifecyclePort;
  reason: string;
  resource: Resource;
};

export type ResourceMutationOutcome = {
  action: ResourceLifecycleAction;
  resource: Resource;
  source: "api" | "demo";
};

/**
 * Mutates discovery state through the lifecycle port. Calls are coalesced per
 * resource + action so duplicate clicks cannot issue duplicate mutations.
 */
export function createResourceLifecycleCoordinator(
  deps: {
    createPort?: (mode: RuntimeEnvironment) => ResourceLifecyclePort;
    mode?: () => RuntimeEnvironment;
  } = {}
) {
  const active = new Map<string, Promise<ResourceMutationOutcome>>();

  function mutate(
    action: ResourceLifecycleAction,
    input: MutateResourceInput
  ): Promise<ResourceMutationOutcome> {
    const key = `${action}:${input.resource.id}`;
    const pending = active.get(key);
    if (pending !== undefined) return pending;

    const task = runMutation(action, input, deps).finally(() => active.delete(key));
    active.set(key, task);

    return task;
  }

  return {
    disable(input: MutateResourceInput) {
      return mutate("disable", input);
    },
    isPending(action: ResourceLifecycleAction, resourceId: string) {
      return active.has(`${action}:${resourceId}`);
    },
    restore(input: MutateResourceInput) {
      return mutate("restore", input);
    }
  };
}

export const resourceLifecycleCoordinator = createResourceLifecycleCoordinator();

async function runMutation(
  action: ResourceLifecycleAction,
  input: MutateResourceInput,
  deps: {
    createPort?: (mode: RuntimeEnvironment) => ResourceLifecyclePort;
    mode?: () => RuntimeEnvironment;
  }
): Promise<ResourceMutationOutcome> {
  if (input.confirmation !== true) {
    throw new ResourceLifecycleError({
      code: "CONFIRMATION_REQUIRED",
      message: "Confirm this change before it is sent to the backend."
    });
  }

  if (action === "disable" && input.reason.trim().length === 0) {
    throw new ResourceLifecycleError({
      code: "REASON_REQUIRED",
      message: "A short reason is required to disable discovery."
    });
  }

  if (input.resource.updatedAt.trim().length === 0) {
    throw new ResourceLifecycleError({
      code: "RESOURCE_VERSION_REQUIRED",
      message: "Reload the resource list to obtain the current resource version."
    });
  }

  const mode = deps.mode?.() ?? currentRuntimeMode();
  const port = input.port ?? deps.createPort?.(mode) ?? createResourceLifecyclePort(mode);
  const request: ResourceMutationRequest = {
    expectedUpdatedAt: input.resource.updatedAt,
    reason: input.reason.trim(),
    resourceId: input.resource.id
  };

  try {
    const resource =
      action === "disable"
        ? await port.disableResource(request)
        : await port.restoreResource(request);

    return { action, resource, source: isDemoMode(mode) ? "demo" : "api" };
  } catch (error) {
    throw normalizeLifecycleError(error);
  }
}

export function createResourceLifecyclePort(mode: RuntimeEnvironment): ResourceLifecyclePort {
  return isDemoMode(mode) ? demoResourceLifecyclePort : unsupportedResourceLifecyclePort;
}

export const unsupportedResourceLifecyclePort: ResourceLifecyclePort = {
  disableResource: async () =>
    Promise.reject(
      new ResourceLifecycleError({
        code: "UNSUPPORTED_CAPABILITY",
        message:
          "The configured backend does not expose a resource disable endpoint yet. No change was made."
      })
    ),
  restoreResource: async () =>
    Promise.reject(
      new ResourceLifecycleError({
        code: "UNSUPPORTED_CAPABILITY",
        message:
          "The configured backend does not expose a resource restore endpoint yet. No change was made."
      })
    )
};

/**
 * In-session demo store. It is intentionally not persisted so a reload returns
 * to the bundled fixtures, matching the explicit demo contract.
 */
const demoState = new Map<string, { eligibleToRestore: boolean; resource: Resource }>();

export const demoResourceLifecyclePort: ResourceLifecyclePort = {
  async disableResource({ expectedUpdatedAt, resourceId }) {
    ensureDemoState();
    const entry = demoState.get(resourceId);
    const resource = entry?.resource;
    if (resource === undefined) {
      throw new ResourceLifecycleError({
        code: "RESOURCE_NOT_FOUND",
        message: "The demo resource no longer exists."
      });
    }
    if (resource.updatedAt !== expectedUpdatedAt) {
      throw new ResourceLifecycleError({
        code: "RESOURCE_CONFLICT",
        message: "This resource changed since the list was loaded. Refresh before retrying.",
        retryable: true
      });
    }

    const updatedAt = new Date(Date.parse(resource.updatedAt) + 1_000).toISOString();
    const next: Resource = { ...resource, status: "inactive", updatedAt };
    demoState.set(resourceId, {
      eligibleToRestore: resource.status === "active",
      resource: next
    });

    return next;
  },
  async restoreResource({ expectedUpdatedAt, resourceId }) {
    ensureDemoState();
    const entry = demoState.get(resourceId);
    if (entry === undefined) {
      throw new ResourceLifecycleError({
        code: "RESOURCE_NOT_FOUND",
        message: "The demo resource no longer exists."
      });
    }
    const resource = entry.resource;
    if (resource === undefined) {
      throw new ResourceLifecycleError({
        code: "RESOURCE_NOT_FOUND",
        message: "The demo resource no longer exists."
      });
    }
    if (resource.updatedAt !== expectedUpdatedAt) {
      throw new ResourceLifecycleError({
        code: "RESOURCE_CONFLICT",
        message: "This resource changed since the list was loaded. Refresh before retrying.",
        retryable: true
      });
    }
    if (entry.eligibleToRestore !== true || resource.status !== "inactive") {
      throw new ResourceLifecycleError({
        code: "RESTORE_INELIGIBLE",
        message: "The backend does not consider this resource eligible for restore."
      });
    }

    const updatedAt = new Date(Date.parse(resource.updatedAt) + 1_000).toISOString();
    const next: Resource = { ...resource, status: "active", updatedAt };
    demoState.set(resourceId, { eligibleToRestore: true, resource: next });

    return next;
  }
};

export function seedDemoResourceLifecycle(resources: Resource[]) {
  demoState.clear();
  for (const resource of resources) {
    demoState.set(resource.id, { eligibleToRestore: resource.status === "active", resource });
  }
}

export function resetDemoResourceLifecycle() {
  demoState.clear();
}

function ensureDemoState() {
  if (demoState.size === 0) seedDemoResourceLifecycle(demoResources);
}

function normalizeLifecycleError(error: unknown): ResourceLifecycleError {
  if (error instanceof ResourceLifecycleError) return error;

  if (error instanceof Error) {
    return new ResourceLifecycleError({
      code: "BACKEND_UNAVAILABLE",
      message: error.message,
      retryable: true
    });
  }

  return new ResourceLifecycleError({
    code: "BACKEND_UNAVAILABLE",
    message: "The resource change could not be confirmed by the backend.",
    retryable: true
  });
}
