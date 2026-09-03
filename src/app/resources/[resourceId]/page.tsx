import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default async function ResourceDetailPage({
  params
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await params;

  return (
    <PlaceholderPage
      title="Resource detail"
      description={`Inspect payment terms, schemas, endpoint routing, and public settlement history for ${resourceId}.`}
      emptyTitle="Resource details are being prepared"
      emptyDescription="This route will render exact x402 requirements and schema examples once the resource viewer is added."
    />
  );
}
