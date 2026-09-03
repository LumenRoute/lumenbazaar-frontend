import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000
      }
    }
  });
}

export const queryKeys = {
  conformance: ["conformance"] as const,
  dashboard: ["dashboard"] as const,
  health: ["health"] as const,
  networks: ["networks"] as const,
  resources: (filters: Record<string, unknown>) => ["resources", filters] as const,
  search: (filters: Record<string, unknown>) => ["search", filters] as const,
  sellers: ["sellers"] as const,
  supported: ["supported"] as const
};
