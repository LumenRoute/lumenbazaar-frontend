import { PageHeader } from "./page-header";
import { EmptyState } from "../ui/surfaces";

type PlaceholderPageProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function PlaceholderPage({
  description,
  emptyDescription,
  emptyTitle,
  title
}: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </>
  );
}
