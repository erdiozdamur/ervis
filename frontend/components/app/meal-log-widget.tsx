'use client';

import { useEffect, useId, useState } from 'react';
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
  const formId = useId();
  const [submitState, setSubmitState] = useState({
    canSubmit: false,
    isPending: false,
    label: 'Öğünü kaydet',
  });

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
    description: string;
    icon: 'camera' | 'photo' | 'text' | 'microphone';
    positionClass: string;
  }> = [
    {
      method: 'camera',
      label: 'Kamera',
      description: 'Canlı çekim',
      icon: 'camera',
      positionClass: 'right-0 bottom-[4.5rem]',
    },
    {
      method: 'image',
      label: 'Fotoğraf',
      description: 'Galeriden seç',
      icon: 'photo',
      positionClass: 'right-1 bottom-[9.2rem]',
    },
    {
      method: 'text',
      label: 'Yazı',
      description: 'Hızlı metin girişi',
      icon: 'text',
      positionClass: 'right-2 bottom-[13.9rem]',
    },
    {
      method: 'audio',
      label: 'Sesli',
      description: 'Konuşarak ekle',
      icon: 'microphone',
      positionClass: 'right-3 bottom-[18.6rem]',
    },
  ];

  const methodTitle: Record<MealInputMethod, string> = {
    camera: 'Kamera',
    image: 'Fotoğraf',
    text: 'Yazı',
    audio: 'Sesli',
  };

  if (!isPortalReady) {
    return null;
  }

  return createPortal(
    <>
      {expanded && activeMethod === null ? (
        <button
          type="button"
          aria-label="Öğün ekleme menüsünü kapat"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-30 bg-slate-950/12 backdrop-blur-[1px]"
        />
      ) : null}

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
                'absolute flex w-44 items-center gap-2.5 rounded-2xl border border-white/85 bg-white/98 px-3 py-2 text-left text-slate-900 shadow-floating backdrop-blur-xl transition-all duration-200',
                item.positionClass,
                expanded ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0',
              )}
              aria-label={item.label}
              title={item.label}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <Icon name={item.icon} className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">{item.description}</span>
              </span>
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
          <div className="flex gap-3">
            <Button type="submit" form={formId} fullWidth disabled={!submitState.canSubmit}>
              {submitState.label}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setActiveMethod(null)}>
              Kapat
            </Button>
          </div>
        }
      >
        {activeMethod ? (
          <MealEntryForm
            formId={formId}
            embedded
            compact
            hideEmbeddedSubmit
            initialMethod={activeMethod}
            autoCapture={activeMethod === 'camera'}
            autoConfirmDraft
            onSubmitStateChange={setSubmitState}
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
