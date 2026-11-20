# Saved discovery searches

Repeat buyers can name the current Explore query and return to it later. Saved searches are
browser-local preference data: they stay on this device and are never synced to a server or
included in telemetry. The Explore page shows that disclosure next to the controls.

## Behavior

- **Save current search** stores what the Search button would run right now: the typed query,
  the selected filters and sort, and any asset or price drafts. The pagination cursor is never
  stored, so a saved search always reopens on the first page.
- **Apply** navigates to the canonical `/explore?...` URL for the saved state through the
  existing discovery flow. The URL contains only the standard
  [discovery parameters](./discovery-url-state.md); no saved-search id is added.
- **Rename** changes only the name. The id and saved state are preserved.
- **Delete** asks for confirmation inline and removes only that record. It does not trigger a
  new catalog request.
- The list is ordered newest first. The empty state reads **No saved searches yet.**
- All controls are native buttons with visible text. Name inputs are labelled, validation errors
  are announced and linked with `aria-describedby`, `Escape` cancels a form, and focus returns to
  a sensible control after save, rename, cancel, or delete.

## Storage contract

| Item          | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Storage       | `localStorage` in the current browser profile          |
| Key           | `lumenbazaar.frontend.discovery-searches.v1`           |
| Max searches  | 20 (saving a 21st is refused; nothing is evicted)      |
| Max name      | 60 characters after trimming; empty names are rejected |
| Record fields | `id`, `name`, `createdAt`, `state` (strict, no extras) |
| `state`       | Canonical discovery state without `cursor` (see below) |

`state` is validated by `pagelessDiscoveryStateSchema` in `src/services/discovery-params.ts`.
It shares the URL parser's bounds and additionally requires the value to already be in the
canonical form `parseDiscoveryState` produces, so a saved search and a copied Explore link can
never be interpreted differently. Before saving, state is normalized with the same rules as the
URL (for example a malformed price draft is dropped, exactly as a link would drop it).

Wallet data, seller-session state, payment authorization, telemetry context, and arbitrary URL
parameters are never stored.

## Malformed data policy

The whole stored payload is validated at once. Missing data, invalid JSON, a non-array value,
more than 20 records, duplicate ids, or any record with wrong types, extra fields, invalid enums,
oversized or untrimmed strings, contradictory prices, or a stored cursor makes the loader return
an empty list. Partially valid payloads are not salvaged, so malformed values never reach the
discovery query and Explore keeps working.

## Clearing local data

**Settings > Local data on this device > Clear local data** asks for confirmation and then
removes these keys only (`frontendLocalDataStorageKeys` in `src/services/settings.ts`):

- `lumenbazaar.frontend.discovery-searches.v1` (all saved searches)
- `lumenbazaar.frontend.discovery-density.v1`
- `lumenbazaar.frontend.settings.v1`

It does not touch wallet preferences, payment or receipt records, seller drafts, bookmarks and
recently viewed resources, saved transaction views, shared table column preferences, or
accessibility settings, and nothing is deleted on a server. The existing **Reset** button still
resets only the frontend settings.

## Coverage

- `src/services/discovery-saved-searches.test.ts` covers CRUD, bounds, name rules, cursor
  removal, normalization, the malformed-data policy, scoped clearing, and the live snapshot.
- `src/services/discovery-saved-searches.server.test.ts` covers server rendering without
  `window`.
- `src/services/discovery-params.test.ts` covers canonicalization and schema alignment with URLs.
- `src/components/explore/explore-search.test.tsx` covers the privacy note, save with drafts,
  validation errors, apply, rename, delete, focus, and the absence of API or telemetry calls.
- `src/services/settings.test.ts` and `src/components/settings/settings-panel.test.tsx` cover
  the scoped clear helper, confirmation, status message, and untouched unrelated keys.
- `tests/e2e/saved-discovery-searches.spec.ts` runs on the desktop and mobile Playwright projects
  for layout, reload persistence, clearing from Settings, and keyboard-only operation.
