# Seller authentication and session expiry

All `/seller` routes render behind `SellerSessionGate`, which resolves an explicit session state
before any mutable seller operation is enabled.

## Backend contract

The frontend consumes a cookie-based session contract. Session material stays in the backend's
HttpOnly cookie; **no long-lived seller credential is written to `localStorage` or
`sessionStorage`**.

| Endpoint                        | Method | Purpose                       |
| ------------------------------- | ------ | ----------------------------- |
| `/v1/seller/session`            | GET    | Load the current session      |
| `/v1/seller/session/refresh`    | POST   | Silent refresh / re-auth      |
| `/v1/seller/session/logout`     | POST   | End the session               |

All requests are sent with `credentials: "include"` and `cache: "no-store"`. The current backend
`backend/openapi.json` does not expose these routes yet, so live modes resolve to
`Seller authentication unavailable` and protected actions stay disabled (fail closed). Explicit
demo mode uses an in-memory synthetic session instead.

## States

| State              | Meaning                                              | UI behavior                                                        |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------ |
| `idle`             | Session not loaded yet                                | Loading state while the gate fetches the session                   |
| `authenticated`    | Valid, unexpired session                             | Page renders; mutations enabled; session bar shows expiry and sign-out |
| `unauthenticated`  | No session                                            | `Sign in required`; protected actions unavailable                   |
| `expired`          | Expiry passed (or expiry timestamp malformed)         | Page still renders so unsaved drafts survive; mutations disabled; re-authenticate action |
| `ownership-denied` | Session belongs to a different seller                 | Distinct `Access denied` state; no seller data is rendered          |
| `unavailable`      | Backend unreachable or contract unsupported           | Distinct `Seller authentication unavailable` state with retry        |

Expiry is validated locally as well as by the backend, and a timer re-resolves the session when
`expiresAt` passes, so an expired session disables mutations without discarding non-sensitive
drafts stored by the resource wizard.

## Mutations

`useSellerSession().canMutate` is the single gate for seller mutations. Resource publishing and
seller resource enable/disable actions consult it; expired, denied, or unavailable sessions cannot
mutate.

## Coverage

- `src/services/seller-session.test.ts` covers login, silent refresh, expiry, logout, malformed
  sessions, backend unavailability, and cross-seller access.
