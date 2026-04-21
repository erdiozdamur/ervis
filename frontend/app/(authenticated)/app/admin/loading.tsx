import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { StatePanel } from '@/components/ui/state-panel';

export default function AdminLoading() {
  return (
    <Stack gap="lg">
      <ScreenHeader
        eyebrow="Admin"
        title="Admin Panel"
        description="Preparing admin modules with a shared state model."
      />

      <StatePanel
        variant="loading"
        title="Admin modules are loading"
        description="All admin tabs use the same loader semantics so every panel reports progress in a predictable way."
      />
    </Stack>
  );
}
