'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MealInputMethod } from '@/lib/meals/intake';
import { MealEntryForm } from '@/components/meal-entry/meal-entry-form';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, buttonStyles } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';

export function MealLogWidget() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [activeMethod, setActiveMethod] = useState<MealInputMethod | null>(null);

  const blossoms: Array<{
    method: MealInputMethod;
    label: string;
    icon: 'camera' | 'photo' | 'text' | 'microphone';
    positionClass: string;
  }> = [
    { method: 'camera', label: 'Kamera', icon: 'camera', positionClass: '-left-1 -top-16' },
    { method: 'image', label: 'Yükle', icon: 'photo', positionClass: '-left-14 -top-12' },
    { method: 'text', label: 'Yazı', icon: 'text', positionClass: '-left-16 -top-1' },
    { method: 'audio', label: 'Ses', icon: 'microphone', positionClass: '-left-12 top-10' },
  ];

  const methodTitle: Record<MealInputMethod, string> = {
    camera: 'Kamera ile ekle',
    image: 'Fotoğraf yükleyerek ekle',
    text: 'Yazarak ekle',
    audio: 'Ses ile ekle',
  };

  return (
    <>
      <div className="sticky bottom-24 z-30 ml-auto w-fit">
        <div className="relative">
          {blossoms.map((item) => (
            <button
              key={item.method}
              type="button"
              onClick={() => {
                setExpanded(false);
                setActiveMethod(item.method);
              }}
              className={cn(
                'absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/90 bg-white text-slate-900 shadow-floating transition-all duration-200',
                item.positionClass,
                expanded ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0',
              )}
              aria-label={item.label}
              title={item.label}
            >
              <Icon name={item.icon} className="h-5 w-5" />
            </button>
          ))}

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className={buttonStyles({
              className: cn(
                'h-14 w-14 rounded-full p-0 shadow-floating transition-transform',
                expanded ? 'rotate-45' : '',
              ),
            })}
            aria-label="Öğün ekle"
          >
            <Icon name="plus" className="h-6 w-6" />
          </button>
        </div>
      </div>

      <BottomSheet
        open={activeMethod !== null}
        onClose={() => setActiveMethod(null)}
        title={activeMethod ? methodTitle[activeMethod] : 'Öğün ekle'}
        footer={
          <Button variant="secondary" fullWidth onClick={() => setActiveMethod(null)}>
            Kapat
          </Button>
        }
      >
        {activeMethod ? (
          <MealEntryForm
            embedded
            compact
            initialMethod={activeMethod}
            autoCapture={activeMethod === 'camera'}
            autoConfirmDraft
            onCompleted={() => {
              setActiveMethod(null);
              router.refresh();
            }}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}
