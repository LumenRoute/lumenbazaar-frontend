"use client";

import { BookmarkPlus, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ResourceSort } from "@/services/catalog";
import type { DiscoveryState } from "@/services/discovery-params";
import {
  MAX_SAVED_DISCOVERY_SEARCHES,
  MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH,
  deleteDiscoverySearch,
  getSavedDiscoverySearchesSnapshot,
  getServerSavedDiscoverySearchesSnapshot,
  renameDiscoverySearch,
  saveDiscoverySearch,
  subscribeSavedDiscoverySearches,
  type SavedDiscoverySearch
} from "@/services/discovery-saved-searches";

type SavedDiscoverySearchesProps = {
  /** The effective search the user sees, including unsubmitted drafts. */
  currentState: DiscoveryState;
  onApply: (state: DiscoveryState) => void;
};

type Mode =
  | { kind: "idle" }
  | { kind: "saving" }
  | { id: string; kind: "renaming" }
  | { id: string; kind: "confirming-delete" };

const sortLabels: Record<ResourceSort, string> = {
  "price-asc": "price low to high",
  "price-desc": "price high to low",
  recent: "recently updated",
  relevance: "relevance"
};

/**
 * A short, human-readable description of a saved discovery state.
 */
export function summarizeDiscoveryState(state: DiscoveryState): string {
  const parts = [state.q.length > 0 ? `"${state.q}"` : "All resources"];

  if (state.network) parts.push(state.network);
  if (state.type) parts.push(state.type === "http" ? "HTTP" : "MCP");
  if (state.extension)
    parts.push(state.extension === "bazaar" ? "Bazaar extension" : "MCP extension");
  if (state.sellerVerification === "verified") parts.push("Verified sellers");
  if (state.sellerVerification === "unverified") parts.push("Unverified sellers");
  if (state.asset) parts.push(`Asset ${state.asset}`);
  if (state.minPrice && state.maxPrice) parts.push(`Price ${state.minPrice} to ${state.maxPrice}`);
  else if (state.minPrice) parts.push(`Price from ${state.minPrice}`);
  else if (state.maxPrice) parts.push(`Price up to ${state.maxPrice}`);
  if (state.sort !== "relevance") parts.push(`Sorted by ${sortLabels[state.sort]}`);

  return parts.join(" · ");
}

export function SavedDiscoverySearches({ currentState, onApply }: SavedDiscoverySearchesProps) {
  const searches = useSyncExternalStore(
    subscribeSavedDiscoverySearches,
    getSavedDiscoverySearchesSnapshot,
    getServerSavedDiscoverySearchesSnapshot
  );
  const baseId = useId();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState("");
  const pendingFocusId = useRef<string | null>(null);

  const ids = {
    error: `${baseId}-name-error`,
    heading: `${baseId}-heading`,
    hint: `${baseId}-name-hint`,
    input: `${baseId}-name`,
    privacy: `${baseId}-privacy`,
    saveButton: `${baseId}-save`,
    item: (action: "apply" | "rename" | "delete" | "keep", id: string) =>
      `${baseId}-${action}-${id}`
  };

  // Move focus once the element for the new mode has rendered.
  useEffect(() => {
    if (pendingFocusId.current === null) return;

    const target = document.getElementById(pendingFocusId.current);
    if (target) {
      target.focus();
      pendingFocusId.current = null;
    }
  });

  function focusAfterRender(id: string) {
    pendingFocusId.current = id;
  }

  function enterMode(next: Mode, draft = "") {
    setMode(next);
    setNameDraft(draft);
    setError(undefined);
    setStatus("");
  }

  function startSave() {
    enterMode({ kind: "saving" }, currentState.q.slice(0, MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH));
    focusAfterRender(ids.input);
  }

  function startRename(search: SavedDiscoverySearch) {
    enterMode({ id: search.id, kind: "renaming" }, search.name);
    focusAfterRender(ids.input);
  }

  function startDelete(search: SavedDiscoverySearch) {
    enterMode({ id: search.id, kind: "confirming-delete" });
    focusAfterRender(ids.item("keep", search.id));
  }

  function cancel() {
    const returnFocusTo =
      mode.kind === "renaming"
        ? ids.item("rename", mode.id)
        : mode.kind === "confirming-delete"
          ? ids.item("delete", mode.id)
          : ids.saveButton;

    enterMode({ kind: "idle" });
    focusAfterRender(returnFocusTo);
  }

  function submitSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const saved = saveDiscoverySearch(nameDraft, currentState);
      enterMode({ kind: "idle" });
      setStatus(`Search "${saved.name}" saved on this device.`);
      focusAfterRender(ids.saveButton);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This search could not be saved.");
      focusAfterRender(ids.input);
    }
  }

  function submitRename(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();

    try {
      const renamed = renameDiscoverySearch(id, nameDraft).find((search) => search.id === id);
      enterMode({ kind: "idle" });
      setStatus(`Saved search renamed to "${renamed?.name ?? nameDraft.trim()}".`);
      focusAfterRender(ids.item("rename", id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This search could not be renamed.");
      focusAfterRender(ids.input);
    }
  }

  function confirmDelete(search: SavedDiscoverySearch) {
    deleteDiscoverySearch(search.id);
    enterMode({ kind: "idle" });
    setStatus(`Saved search "${search.name}" deleted from this device.`);
    focusAfterRender(ids.saveButton);
  }

  function cancelOnEscape(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  function nameField(label: string) {
    return (
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <label className="font-medium text-slate-700" htmlFor={ids.input}>
          {label}
        </label>
        <input
          aria-describedby={error ? `${ids.error} ${ids.hint}` : ids.hint}
          aria-invalid={error ? true : undefined}
          className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950 focus:border-teal-700 focus:ring-2 focus:ring-teal-100 focus:outline-none aria-[invalid=true]:border-red-700"
          id={ids.input}
          maxLength={MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH}
          onChange={(event) => {
            setNameDraft(event.target.value);
            setError(undefined);
          }}
          value={nameDraft}
        />
        <p className="text-xs text-slate-500" id={ids.hint}>
          Up to {MAX_SAVED_DISCOVERY_SEARCH_NAME_LENGTH} characters.
        </p>
        {error ? (
          <p className="text-sm font-medium text-red-700" id={ids.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const isSaving = mode.kind === "saving";

  return (
    <Card>
      <section aria-labelledby={ids.heading}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950" id={ids.heading}>
              Saved searches
            </h2>
            <p className="mt-1 flex gap-2 text-sm text-slate-600" id={ids.privacy}>
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              <span>
                Saved searches stay on this device and are never synced. Names and filters are not
                sent to LumenBazaar servers or telemetry. Clear them anytime in{" "}
                <Link className="font-medium text-teal-700 underline" href="/settings">
                  Settings
                </Link>
                .
              </span>
            </p>
          </div>
          {isSaving ? null : (
            <Button
              aria-describedby={ids.privacy}
              className="shrink-0"
              id={ids.saveButton}
              onClick={startSave}
              type="button"
              variant="secondary"
            >
              <BookmarkPlus aria-hidden="true" className="h-4 w-4" />
              Save current search
            </Button>
          )}
        </CardHeader>

        <CardBody className="space-y-3">
          {isSaving ? (
            <form
              aria-label="Save current search"
              className="flex flex-col gap-3 sm:flex-row sm:items-start"
              noValidate
              onKeyDown={cancelOnEscape}
              onSubmit={submitSave}
            >
              {nameField("Search name")}
              <div className="flex gap-2 sm:pt-6">
                <Button type="submit">Save search</Button>
                <Button onClick={cancel} type="button" variant="secondary">
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {isSaving ? (
            <p className="text-xs text-slate-500">
              Saves {summarizeDiscoveryState(currentState)}. Saved searches always reopen on the
              first page of results.
            </p>
          ) : null}

          <p className="text-sm text-slate-700" role="status">
            {status}
          </p>

          {searches.length === 0 ? (
            <p className="text-sm text-slate-600">No saved searches yet.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {searches.length} of {MAX_SAVED_DISCOVERY_SEARCHES} saved, newest first.
              </p>
              <ul aria-labelledby={ids.heading} className="divide-y divide-slate-200">
                {searches.map((search) => (
                  <li className="py-3" key={search.id}>
                    {mode.kind === "renaming" && mode.id === search.id ? (
                      <form
                        aria-label={`Rename saved search ${search.name}`}
                        className="flex flex-col gap-3 sm:flex-row sm:items-start"
                        noValidate
                        onKeyDown={cancelOnEscape}
                        onSubmit={(event) => submitRename(event, search.id)}
                      >
                        {nameField(`New name for ${search.name}`)}
                        <div className="flex gap-2 sm:pt-6">
                          <Button type="submit">Save name</Button>
                          <Button onClick={cancel} type="button" variant="secondary">
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium break-words text-slate-950">
                            {search.name}
                          </p>
                          <p className="mt-0.5 text-xs break-words text-slate-600">
                            {summarizeDiscoveryState(search.state)}
                          </p>
                        </div>

                        {mode.kind === "confirming-delete" && mode.id === search.id ? (
                          <div
                            aria-label={`Confirm deleting ${search.name}`}
                            className="flex flex-col gap-2 sm:items-end"
                            onKeyDown={cancelOnEscape}
                            role="group"
                          >
                            <p className="text-sm text-slate-700">Delete it from this device?</p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => confirmDelete(search)}
                                type="button"
                                variant="danger"
                              >
                                Delete search
                              </Button>
                              <Button
                                id={ids.item("keep", search.id)}
                                onClick={cancel}
                                type="button"
                                variant="secondary"
                              >
                                Keep
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              aria-label={`Apply saved search ${search.name}`}
                              id={ids.item("apply", search.id)}
                              onClick={() => onApply(search.state)}
                              type="button"
                            >
                              Apply
                            </Button>
                            <Button
                              aria-label={`Rename saved search ${search.name}`}
                              id={ids.item("rename", search.id)}
                              onClick={() => startRename(search)}
                              type="button"
                              variant="secondary"
                            >
                              Rename
                            </Button>
                            <Button
                              aria-label={`Delete saved search ${search.name}`}
                              id={ids.item("delete", search.id)}
                              onClick={() => startDelete(search)}
                              type="button"
                              variant="secondary"
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </section>
    </Card>
  );
}
