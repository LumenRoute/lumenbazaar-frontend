import { loadRuntimeConfig } from "@/config/runtime";
import { demoSellers } from "@/fixtures/lumenbazaar";
import { sellerSessionSchema, type SellerSessionRecord } from "@/services/api/schemas";

export type SellerSession = SellerSessionRecord;

export type SellerSessionStatus =
  | "idle"
  | "authenticated"
  | "unauthenticated"
  | "expired"
  | "ownership-denied"
  | "unavailable";

/**
 * Seller session states are explicit so protected actions can fail closed.
 * Expired sessions keep the last session for display but never enable mutations.
 */
export type SellerSessionState =
  | { status: "idle" }
  | { status: "authenticated"; session: SellerSession }
  | { status: "unauthenticated"; message: string }
  | { status: "expired"; message: string; session: SellerSession | null }
  | { status: "ownership-denied"; message: string }
  | { status: "unavailable"; message: string };

export type SellerSessionErrorCode =
  | "unauthenticated"
  | "expired"
  | "ownership-denied"
  | "unavailable";

export class SellerSessionError extends Error {
  readonly code: SellerSessionErrorCode;
  readonly status: number;

  constructor({
    code,
    message,
    status
  }: {
    code: SellerSessionErrorCode;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "SellerSessionError";
    this.code = code;
    this.status = status;
  }
}

export type SellerSessionClient = {
  fetchSession: () => Promise<SellerSession>;
  refreshSession: () => Promise<SellerSession>;
  signOut: () => Promise<void>;
};

/**
 * Resolves raw session data into a state. Expiry is validated locally as well
 * as by the backend, and malformed expiry timestamps fail closed.
 */
export function resolveSellerSessionState(
  session: SellerSession | null,
  now = Date.now()
): SellerSessionState {
  if (session === null) {
    return {
      message: "Sign in with an active seller session to manage resources.",
      status: "unauthenticated"
    };
  }

  const expiresAt = Date.parse(session.expiresAt);

  if (!Number.isFinite(expiresAt)) {
    return {
      message:
        "The seller session expiry could not be verified. Re-authenticate before changing resources.",
      session,
      status: "expired"
    };
  }

  if (expiresAt <= now) {
    return {
      message: "The seller session has expired. Re-authenticate to continue.",
      session,
      status: "expired"
    };
  }

  return {
    session,
    status: "authenticated"
  };
}

/**
 * Guards a seller-scoped view against cross-seller access.
 */
export function assertSellerOwnership(
  state: SellerSessionState,
  sellerId: string
): SellerSessionState {
  if (state.status !== "authenticated") return state;

  if (state.session.seller.id !== sellerId) {
    return {
      message: `This session is not authorized for seller ${sellerId}.`,
      status: "ownership-denied"
    };
  }

  return state;
}

export function canMutateSellerSession(state: SellerSessionState) {
  return state.status === "authenticated";
}

/**
 * Loads the current session, attempting one silent refresh when the session is
 * missing or expired. Any refresh failure leaves mutations disabled.
 */
export async function loadSellerSessionWithRefresh(
  client: SellerSessionClient,
  now = Date.now()
): Promise<SellerSessionState> {
  try {
    return resolveSellerSessionState(await client.fetchSession(), now);
  } catch (error) {
    if (
      error instanceof SellerSessionError &&
      (error.code === "unauthenticated" || error.code === "expired")
    ) {
      try {
        return resolveSellerSessionState(await client.refreshSession(), now);
      } catch (refreshError) {
        return sellerSessionStateFromError(refreshError);
      }
    }

    return sellerSessionStateFromError(error);
  }
}

export function sellerSessionStateFromError(error: unknown): SellerSessionState {
  if (error instanceof SellerSessionError) {
    switch (error.code) {
      case "expired":
        return {
          message: "The seller session has expired. Re-authenticate to continue.",
          session: null,
          status: "expired"
        };
      case "ownership-denied":
        return {
          message: "This seller session is not authorized for the requested seller.",
          status: "ownership-denied"
        };
      case "unauthenticated":
        return {
          message: "Sign in with an active seller session to manage resources.",
          status: "unauthenticated"
        };
      case "unavailable":
        return {
          message:
            "Seller authentication is unavailable. Protected actions are disabled until the backend session contract is reachable.",
          status: "unavailable"
        };
    }
  }

  return {
    message:
      "Seller authentication could not be verified. Protected actions are disabled until the backend is reachable.",
    status: "unavailable"
  };
}

/**
 * HTTP session client. Session material stays in the backend's HttpOnly cookie;
 * no long-lived seller credentials are written to browser storage.
 */
export function createSellerSessionClient({
  baseUrl = loadRuntimeConfig().apiBaseUrl,
  fetchImpl = (input, init) => fetch(input, init)
}: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): SellerSessionClient {
  async function request(path: string, method: "GET" | "POST") {
    let response: Response;

    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json"
        },
        method
      });
    } catch {
      throw new SellerSessionError({
        code: "unavailable",
        message: "The seller session service is unreachable.",
        status: 0
      });
    }

    if (response.ok) {
      return response;
    }

    throw await toSessionError(response, method === "POST");
  }

  return {
    async fetchSession() {
      const response = await request("/v1/seller/session", "GET");

      return parseSession(response);
    },
    async refreshSession() {
      const response = await request("/v1/seller/session/refresh", "POST");

      return parseSession(response);
    },
    async signOut() {
      await request("/v1/seller/session/logout", "POST");
    }
  };
}

/**
 * In-memory demo session client. It exists only in explicit demo mode and is
 * intentionally never persisted to localStorage.
 */
export function createDemoSellerSession({
  now = () => Date.now(),
  sellerId = demoSellers[0]?.id ?? "seller_atlas_weather",
  sessionTtlMs = 30 * 60 * 1000
}: {
  now?: () => number;
  sellerId?: string;
  sessionTtlMs?: number;
} = {}): SellerSession {
  const seller = demoSellers.find((candidate) => candidate.id === sellerId) ?? demoSellers[0];

  if (seller === undefined) {
    throw new SellerSessionError({
      code: "unavailable",
      message: "No synthetic demo seller is configured.",
      status: 0
    });
  }

  return sellerSessionSchema.parse({
    expiresAt: new Date(now() + sessionTtlMs).toISOString(),
    issuedAt: new Date(now()).toISOString(),
    seller,
    sessionId: `synthetic-demo-session-${now()}`
  });
}

export function createDemoSellerSessionClient({
  now = () => Date.now(),
  sellerId = demoSellers[0]?.id ?? "seller_atlas_weather",
  sessionTtlMs = 30 * 60 * 1000
}: {
  now?: () => number;
  sellerId?: string;
  sessionTtlMs?: number;
} = {}): SellerSessionClient {
  let current: SellerSession | null = null;

  function issue(): SellerSession {
    current = createDemoSellerSession({ now, sellerId, sessionTtlMs });

    return current;
  }

  return {
    async fetchSession() {
      if (current === null) {
        throw new SellerSessionError({
          code: "unauthenticated",
          message: "No active demo seller session. Re-authenticate to create one.",
          status: 401
        });
      }

      const state = resolveSellerSessionState(current, now());

      if (state.status === "expired") {
        throw new SellerSessionError({
          code: "expired",
          message: state.message,
          status: 401
        });
      }

      return current;
    },
    async refreshSession() {
      return issue();
    },
    async signOut() {
      current = null;
    }
  };
}

async function parseSession(response: Response) {
  let json: unknown;

  try {
    json = await response.json();
  } catch {
    throw new SellerSessionError({
      code: "unavailable",
      message: "The backend returned an unreadable seller session.",
      status: response.status
    });
  }

  const parsed = sellerSessionSchema.safeParse(json);

  if (!parsed.success) {
    throw new SellerSessionError({
      code: "unavailable",
      message: "The backend returned an invalid seller session.",
      status: response.status
    });
  }

  return parsed.data;
}

async function toSessionError(response: Response, isRefresh: boolean) {
  const body = await readJson(response);
  const code =
    isRecord(body) && isRecord(body.error) && typeof body.error.code === "string"
      ? body.error.code
      : undefined;

  if (response.status === 401 && code === "AUTH_EXPIRED") {
    return new SellerSessionError({
      code: "expired",
      message: "The seller session has expired.",
      status: response.status
    });
  }

  if (response.status === 401) {
    return new SellerSessionError({
      code: isRefresh ? "expired" : "unauthenticated",
      message: isRefresh
        ? "The seller session could not be refreshed."
        : "No active seller session is available.",
      status: response.status
    });
  }

  if (response.status === 403) {
    return new SellerSessionError({
      code: "ownership-denied",
      message: "The seller session is not authorized for this operation.",
      status: response.status
    });
  }

  return new SellerSessionError({
    code: "unavailable",
    message:
      response.status === 404 || response.status === 501
        ? "The backend does not expose a seller session contract."
        : `Seller session request failed with HTTP ${response.status}.`,
    status: response.status
  });
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
