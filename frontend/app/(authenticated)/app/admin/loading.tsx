import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { StatePanel } from '@/components/ui/state-panel';

export default function AdminLoading() {
  return (
    <Stack gap="lg">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Yönetim modülleri hazırlanıyor." />

      <StatePanel variant="loading" title="Yönetim modülleri yükleniyor" description="Tüm paneller için ortak yükleme akışı çalışıyor..." />
    </Stack>
  );
}
