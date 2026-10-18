import { ResourceComparison } from "@/components/resources/resource-comparison";
import { parseComparisonIds } from "@/services/resource-comparison";

type ComparePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;

  return <ResourceComparison resourceIds={parseComparisonIds(first(params.ids))} />;
}
