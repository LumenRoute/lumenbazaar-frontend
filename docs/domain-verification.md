# Domain verification

Sellers prove control of a domain with either a `.well-known/lumenbazaar` file or a DNS TXT
record at `_lumenbazaar.<domain>`.

## Challenges

`src/services/domain-verification.ts` tracks every issued challenge with:

- `issuedAt` — when this client received the challenge
- `expiresAt` — `issuedAt + 10 minutes` (the pinned backend does not return an expiry)

Expired challenges are rejected locally before any request is sent. An expired challenge is
never accepted as evidence.

## Bounded polling

Verification polling repeats the verification check with exponential backoff
(1 s → 8 s, four checks, 30 s budget) and stops on:

- success
- challenge expiry
- a terminal backend failure
- the configured retry/time budget
- navigation or unmount (the component aborts its `AbortSignal`)

The pinned backend exposes no read-only verification status endpoint, so each poll repeats
the same evidence submission. No new challenge is requested during a poll, so a stale proof
cannot silently rotate the challenge token.

## Failure codes

| Code                             | Meaning                                        | Retryable                 |
| -------------------------------- | ---------------------------------------------- | ------------------------- |
| `SELLER_DOMAIN_UNVERIFIED`       | Well-known file missing or has the wrong value | No, fix the file          |
| `DOMAIN_DNS_PROPAGATION_PENDING` | TXT record is not visible yet                  | Yes, same challenge       |
| `DOMAIN_CHALLENGE_EXPIRED`       | Challenge lifetime elapsed                     | No, request a replacement |
| `SELLER_NOT_FOUND`               | Unknown seller identifier                      | No                        |

## Replacement challenges

**Replacement challenge** aborts any in-flight check, clears the previous challenge token,
evidence, attempts, and failure state, and displays the new expiry. Stale evidence from the
previous challenge is never carried forward.

## Verification secrets

Challenge tokens and evidence are rendered only in the seller's own UI. They are not sent to
analytics or telemetry.
