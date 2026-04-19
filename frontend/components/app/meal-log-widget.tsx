'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { MealInputMethod } from '@/lib/meals/intake';
import { MealEntryForm } from '@/components/meal-entry/meal-entry-form';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, buttonStyles } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';

const FALLBACK_DOCK_OFFSET = 108;

function resolveDockOffset() {
  const navElement = document.querySelector<HTMLElement>('[data-mobile-bottom-nav]');

  if (!navElement) {
    return FALLBACK_DOCK_OFFSET;
  }

  const navHeight = Math.round(navElement.getBoundingClientRect().height);
  return Math.max(FALLBACK_DOCK_OFFSET, navHeight + 16);
}

export function MealLogWidget() {
  const router = useRouter();
  const [isPortalReady, setIsPortalReady] = useState(false);
  const [dockOffset, setDockOffset] = useState(FALLBACK_DOCK_OFFSET);
  const [expanded, setExpanded] = useState(false);
  const [activeMethod, setActiveMethod] = useState<MealInputMethod | null>(null);

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isPortalReady) {
      return;
    }

    let frameId = 0;

    const updateOffset = () => {
      const nextOffset = resolveDockOffset();
      setDockOffset((current) => (Math.abs(current - nextOffset) >= 2 ? nextOffset : current));
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateOffset);
    };

    const navElement = document.querySelector<HTMLElement>('[data-mobile-bottom-nav]');
    const supportsResizeObserver = typeof window !== 'undefined' && 'ResizeObserver' in window;
    const observer = navElement && supportsResizeObserver ? new ResizeObserver(scheduleUpdate) : null;

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    if (observer && navElement) {
      observer.observe(navElement);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleUpdate);
      observer?.disconnect();
    };
  }, [isPortalReady]);

  const blossoms: Array<{
    method: MealInputMethod;
    label: string;
    icon: 'camera' | 'photo' | 'text' | 'microphone';
    positionClass: string;
  }> = [
    { method: 'camera', label: 'Kamera', icon: 'camera', positionClass: '-left-1 -top-16' },
    { method: 'image', label: 'Fotoğraf yükle', icon: 'photo', positionClass: '-left-14 -top-12' },
    { method: 'text', label: 'Yazı', icon: 'text', positionClass: '-left-16 -top-1' },
    { method: 'audio', label: 'Ses', icon: 'microphone', positionClass: '-left-12 top-10' },
  ];

  const methodTitle: Record<MealInputMethod, string> = {
    camera: 'Kamera',
    image: 'Fotoğraf yükle',
    text: 'Yazı',
    audio: 'Ses',
  };

  if (!isPortalReady) {
    return null;
  }

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed right-4 z-40 sm:right-6"
        style={{
          bottom: `calc(env(safe-area-inset-bottom) + ${dockOffset}px)`,
        }}
      >
        <div className="relative pointer-events-auto">
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
            aria-label="Öğün ekleme menüsü"
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
    </>,
    document.body,
  );
}
