import { StatePanel } from '@/components/ui/state-panel';

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return <StatePanel variant="empty" title={title} description={description} />;
}
