'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MealInputMethod } from '@/lib/meals/intake';
import { MealEntryForm } from '@/components/meal-entry/meal-entry-form';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, buttonStyles } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';

const methods: Array<{ value: MealInputMethod; label: string; icon: 'camera' | 'photo' | 'text' | 'microphone' }> = [
  { value: 'camera', label: 'Kamera', icon: 'camera' },
  { value: 'image', label: 'Yükle', icon: 'photo' },
  { value: 'text', label: 'Yazı', icon: 'text' },
  { value: 'audio', label: 'Ses', icon: 'microphone' },
];

export function MealLogWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<MealInputMethod>('camera');

  return (
    <>
      <div className="pointer-events-none fixed bottom-28 right-4 z-30 sm:right-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonStyles({
            className: 'pointer-events-auto h-14 w-14 rounded-full p-0 shadow-floating',
          })}
          aria-label="Öğün ekle"
        >
          <Icon name="plus" className="h-6 w-6" />
        </button>
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Öğün ekle"
        description="Yöntem seç ve panelden kaydet."
        footer={
          <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
            Kapat
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {methods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMethod(item.value)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold',
                method === item.value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-800',
              )}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <MealEntryForm
          embedded
          initialMethod={method}
          autoConfirmDraft
          onCompleted={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </BottomSheet>
    </>
  );
}
