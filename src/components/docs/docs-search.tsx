"use client";

import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { SearchResult, searchDocumentation } from "@/services/docs-search";
import { clsx } from "clsx";

interface DocsSearchProps {
  /** Callback when a search result is selected */
  onResultSelect?: (result: SearchResult) => void;
}

/**
 * Interactive documentation search component.
 * Provides real-time search with ranking and mobile-responsive display.
 */
export function DocsSearch({ onResultSelect }: DocsSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Update results when query changes
  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchDocumentation(query, 10);
      setResults(searchResults);
      setSelectedIndex(-1);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setQuery("");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        resultsContainerRef.current &&
        !resultsContainerRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    onResultSelect?.(result);
    // Open link in new tab
    window.open(result.entry.href, "_blank", "noopener,noreferrer");
    setQuery("");
    setIsOpen(false);
  };

  const handleClearSearch = () => {
    setQuery("");
    searchInputRef.current?.focus();
  };

  const getMatchTypeBadgeColor = (
    matchType: SearchResult["matchType"]
  ): "neutral" | "teal" => {
    switch (matchType) {
      case "label":
        return "teal";
      case "keyword":
        return "neutral";
      case "description":
        return "neutral";
    }
  };

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={searchInputRef}
          aria-label="Search documentation"
          className={clsx(
            "w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm",
            "placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-300",
            "transition-colors duration-200"
          )}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          placeholder="Search seller, buyer, agent, operator, API, contract, security..."
          type="text"
          value={query}
        />
        {query && (
          <button
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onClick={handleClearSearch}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={resultsContainerRef}
          className="absolute top-full z-50 mt-2 w-full"
          role="listbox"
        >
          <Card>
            <CardBody className="max-h-96 space-y-2 overflow-y-auto p-2">
              {results.map((result, index) => (
                <button
                  key={result.entry.id}
                  aria-label={`${result.entry.label}: ${result.entry.description}`}
                  aria-selected={index === selectedIndex}
                  className={clsx(
                    "w-full rounded-md border border-transparent p-3 text-left transition-colors",
                    "hover:border-teal-300 hover:bg-teal-50/40",
                    index === selectedIndex && "border-teal-300 bg-teal-50/60"
                  )}
                  onClick={() => handleSelectResult(result)}
                  role="option"
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-950">{result.entry.label}</h3>
                        <Badge
                          className="shrink-0"
                          tone={getMatchTypeBadgeColor(result.matchType)}
                        >
                          {Math.round(result.score * 100)}%
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-600">
                        {result.entry.description}
                      </p>
                      {result.entry.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.entry.keywords.slice(0, 2).map((kw) => (
                            <span
                              className="inline-block rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
                              key={kw}
                            >
                              {kw}
                            </span>
                          ))}
                          {result.entry.keywords.length > 2 && (
                            <span className="inline-block rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              +{result.entry.keywords.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ExternalLink
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-slate-400"
                    />
                  </div>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {/* No Results Message */}
      {isOpen && query && results.length === 0 && (
        <div
          className="absolute top-full z-50 mt-2 w-full rounded-lg border border-slate-200 bg-white p-4"
          role="status"
        >
          <p className="text-sm text-slate-600">
            No documentation found for "{query}". Try searching by category, topic, or keyword.
          </p>
        </div>
      )}
    </div>
  );
}
