import { DocumentationIndexEntry, getDocumentationIndex } from "./docs-index";

/**
 * Result of a documentation search query with ranking information.
 */
export interface SearchResult {
  /** The matched documentation entry */
  entry: DocumentationIndexEntry;
  /** Relevance score between 0 and 1 (higher is better) */
  score: number;
  /** Reason for the match (for debugging and UX clarity) */
  matchType: "label" | "description" | "keyword";
}

/**
 * Performs a full-text search across the documentation index.
 *
 * Search algorithm:
 * 1. Exact label match (score: 1.0) - highest priority
 * 2. Label contains query (score: 0.9)
 * 3. Keyword exact match (score: 0.8)
 * 4. Description contains query (score: 0.7)
 * 5. Searchable content contains query (score: 0.6)
 *
 * @param query - The search term (case-insensitive)
 * @param limit - Maximum number of results to return (default: 10)
 * @returns Array of SearchResult objects sorted by relevance
 */
export function searchDocumentation(query: string, limit: number = 10): SearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    // Return all entries in category order if query is empty
    const index = getDocumentationIndex();
    return index.entries.map((entry) => ({
      entry,
      score: 0,
      matchType: "label",
    }));
  }

  const index = getDocumentationIndex();
  const results: SearchResult[] = [];
  const resultMap = new Map<string, SearchResult>();

  // Process each entry and track the best match score
  for (const entry of index.entries) {
    let bestScore = 0;
    let bestMatchType: SearchResult["matchType"] = "label";

    // Check exact label match (highest priority)
    if (entry.label.toLowerCase() === normalizedQuery) {
      bestScore = 1.0;
      bestMatchType = "label";
    }
    // Check if label contains query
    else if (entry.label.toLowerCase().includes(normalizedQuery)) {
      bestScore = 0.9;
      bestMatchType = "label";
    }
    // Check for keyword exact match
    else if (entry.keywords.some((kw) => kw.toLowerCase() === normalizedQuery)) {
      bestScore = 0.8;
      bestMatchType = "keyword";
    }
    // Check if description contains query
    else if (entry.description.toLowerCase().includes(normalizedQuery)) {
      bestScore = 0.7;
      bestMatchType = "description";
    }
    // Check if searchable content contains query
    else if (entry.searchableContent.includes(normalizedQuery)) {
      bestScore = 0.6;
      bestMatchType = "keyword";
    }

    // Only include results with a score > 0
    if (bestScore > 0) {
      resultMap.set(entry.id, {
        entry,
        score: bestScore,
        matchType: bestMatchType,
      });
    }
  }

  // Convert to array and sort by score (descending) then by label (ascending) for stability
  const sortedResults = Array.from(resultMap.values()).sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // Higher scores first
    }
    return a.entry.label.localeCompare(b.entry.label); // Stable ordering by label
  });

  return sortedResults.slice(0, limit);
}

/**
 * Gets suggestions for a partial query.
 * Used for autocomplete/search-as-you-type interfaces.
 *
 * @param query - Partial search term
 * @param limit - Maximum number of suggestions (default: 5)
 * @returns Array of matching entry labels
 */
export function getSearchSuggestions(query: string, limit: number = 5): string[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    // Return all labels if query is empty
    const index = getDocumentationIndex();
    return index.entries.map((e) => e.label).slice(0, limit);
  }

  const index = getDocumentationIndex();
  const suggestions = new Set<string>();

  // Add matching labels
  for (const entry of index.entries) {
    if (
      entry.label.toLowerCase().includes(normalizedQuery) &&
      suggestions.size < limit
    ) {
      suggestions.add(entry.label);
    }
  }

  // Add matching keywords if we need more suggestions
  if (suggestions.size < limit) {
    for (const entry of index.entries) {
      for (const keyword of entry.keywords) {
        if (keyword.toLowerCase().includes(normalizedQuery)) {
          suggestions.add(keyword);
          if (suggestions.size >= limit) {
            break;
          }
        }
      }
      if (suggestions.size >= limit) {
        break;
      }
    }
  }

  return Array.from(suggestions).slice(0, limit);
}

/**
 * Validates that all documentation links in the index are accessible.
 * Performs HEAD or GET requests to verify targets.
 *
 * @returns Promise resolving to array of broken links (empty if all valid)
 */
export async function validateDocumentationLinks(): Promise<
  Array<{ url: string; error: string }>
> {
  const index = getDocumentationIndex();
  const brokenLinks: Array<{ url: string; error: string }> = [];

  for (const entry of index.entries) {
    try {
      const response = await fetch(entry.href, { method: "HEAD" });

      // Try GET if HEAD is not supported
      if (response.status === 405) {
        const getResponse = await fetch(entry.href, { method: "GET" });
        if (!getResponse.ok) {
          brokenLinks.push({
            url: entry.href,
            error: `GET returned ${getResponse.status} ${getResponse.statusText}`,
          });
        }
      } else if (!response.ok) {
        brokenLinks.push({
          url: entry.href,
          error: `${response.status} ${response.statusText}`,
        });
      }
    } catch (error) {
      brokenLinks.push({
        url: entry.href,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return brokenLinks;
}
