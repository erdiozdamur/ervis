'use client';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';

type AdminErrorProps = {
  reset: () => void;
};

export default function AdminError({ reset }: AdminErrorProps) {
  return (
    <Stack gap="lg">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Yönetim isteği tamamlanamadı." />

      <StatePanel
        variant="error"
        title="Yönetim modülü yeniden denenmeli"
        description="Aynı ekranda kalarak güvenle tekrar deneyebilirsiniz."
        action={
          <Button variant="secondary" onClick={reset}>
            Tekrar dene
          </Button>
        }
      />
    </Stack>
  );
}
