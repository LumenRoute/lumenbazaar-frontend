import { NewResourceClient } from "./new-resource-client";

export default async function NewResourcePage({
  searchParams
}: {
  searchParams: Promise<{ resourceId?: string | string[] }>;
}) {
  const { resourceId } = await searchParams;
  const resolved = Array.isArray(resourceId) ? resourceId[0] : resourceId;

  return <NewResourceClient {...(resolved === undefined ? {} : { resourceId: resolved })} />;
}
