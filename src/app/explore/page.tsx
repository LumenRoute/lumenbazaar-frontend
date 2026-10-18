import { PageHeader } from "@/components/layout/page-header";
import { ExploreSearch } from "@/components/explore/explore-search";
import { parseDiscoveryState, serializeDiscoveryState } from "@/services/discovery-params";

type ExplorePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const initialState = parseDiscoveryState(params);

  return (
    <>
      <PageHeader
        title="Explore"
        description="Search paid HTTP APIs and MCP tools indexed by the Bazaar discovery layer."
      />
      <ExploreSearch initialState={initialState} key={serializeDiscoveryState(initialState)} />
    </>
  );
}
