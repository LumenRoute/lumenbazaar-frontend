import { PageHeader } from "@/components/layout/page-header";
import { ResourceDetailPage as ResourceDetailClientPage } from "@/components/resources/resource-detail-page";

export default async function ResourceDetailRoute({
  params
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await params;

  return (
    <>
      <PageHeader
        title="Resource detail"
        description={`Inspect payment terms, schemas, endpoint routing, and public settlement history for ${resourceId}.`}
      />
      <ResourceDetailClientPage resourceId={resourceId} />
    </>
  );
}
