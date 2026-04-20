'use client';

import type { Route } from 'next';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BottomActionBar } from '@/components/layout/bottom-action-bar';
import { Stack } from '@/components/layout/stack';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusPill } from '@/components/ui/status-pill';
import { Textarea } from '@/components/ui/textarea';
import { MAX_TEXT_INPUT_LENGTH, type MealInputMethod, mealInputMethodOptions } from '@/lib/meals/intake';
import { cn } from '@/lib/utils/cn';
import type { MealDraftCreateResult, MealIntakeFieldErrors } from '@/types/meal-intake';

type SelectedImageAsset = {
  id: string;
  file: File;
  previewUrl: string;
  source: 'upload' | 'camera';
};

type SelectedAudioAsset = {
  id: string;
  file: File;
  previewUrl: string;
  source: 'upload' | 'recording';
};

function createClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.round(Math.random() * 100_000)}`;
}

function formatFileSizeLabel(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDurationLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type MealEntryFormProps = {
  initialMethod?: MealInputMethod;
  autoCapture?: boolean;
  embedded?: boolean;
  compact?: boolean;
  autoConfirmDraft?: boolean;
  onCompleted?: () => void;
};

export function MealEntryForm({
  initialMethod = 'camera',
  autoCapture = false,
  embedded = false,
  compact = false,
  autoConfirmDraft = false,
  onCompleted,
}: MealEntryFormProps) {
  const router = useRouter();
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureRef = useRef<HTMLInputElement | null>(null);
  const audioUploadRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureModeRef = useRef<'append' | 'replace'>('append');
  const autoCaptureTriggeredRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<MealInputMethod>(initialMethod);
  const [description, setDescription] = useState('');
  const [imageAssets, setImageAssets] = useState<SelectedImageAsset[]>([]);
  const [audioAssets, setAudioAssets] = useState<SelectedAudioAsset[]>([]);
  const [supportsRecording, setSupportsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording'>('idle');
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MealIntakeFieldErrors>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSupportsRecording(typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia);

    return () => {
      for (const objectUrl of objectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }

      if (recorderRef.current?.state !== 'inactive') {
        recorderRef.current?.stop();
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (recordingState !== 'recording' || !recordingStartedAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setRecordingElapsedSeconds(Math.max(0, Math.round((Date.now() - recordingStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [recordingStartedAt, recordingState]);

  function registerObjectUrl(url: string) {
    objectUrlsRef.current.push(url);
  }

  function unregisterObjectUrl(url: string) {
    objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url);
    URL.revokeObjectURL(url);
  }

  function appendImageFiles(files: FileList | null, source: SelectedImageAsset['source']) {
    if (!files || files.length === 0) {
      return;
    }

    setFieldErrors((current) => ({ ...current, images: undefined }));
    setFormError(null);

    const nextAssets = Array.from(files).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      registerObjectUrl(previewUrl);

      return {
        id: createClientId(),
        file,
        previewUrl,
        source,
      };
    });

    setImageAssets((current) => [...current, ...nextAssets]);
  }

  function replaceCameraFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setFieldErrors((current) => ({ ...current, images: undefined }));
    setFormError(null);

    const nextAssets = Array.from(files).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      registerObjectUrl(previewUrl);

      return {
        id: createClientId(),
        file,
        previewUrl,
        source: 'camera' as const,
      };
    });

    setImageAssets((current) => {
      const retainedAssets = current.filter((asset) => {
        if (asset.source === 'camera') {
          unregisterObjectUrl(asset.previewUrl);
          return false;
        }

        return true;
      });

      return [...retainedAssets, ...nextAssets];
    });
  }

  function appendAudioFiles(files: FileList | null, source: SelectedAudioAsset['source']) {
    if (!files || files.length === 0) {
      return;
    }

    setFieldErrors((current) => ({ ...current, audio: undefined }));
    setFormError(null);

    const nextAssets = Array.from(files).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      registerObjectUrl(previewUrl);

      return {
        id: createClientId(),
        file,
        previewUrl,
        source,
      };
    });

    setAudioAssets((current) => [...current, ...nextAssets]);
  }

  function removeImageAsset(assetId: string) {
    setImageAssets((current) => {
      const asset = current.find((item) => item.id === assetId);

      if (asset) {
        unregisterObjectUrl(asset.previewUrl);
      }

      return current.filter((item) => item.id !== assetId);
    });
  }

  function removeAudioAsset(assetId: string) {
    setAudioAssets((current) => {
      const asset = current.find((item) => item.id === assetId);

      if (asset) {
        unregisterObjectUrl(asset.previewUrl);
      }

      return current.filter((item) => item.id !== assetId);
    });
  }

  async function handleRecordingToggle() {
    if (recordingState === 'recording') {
      recorderRef.current?.stop();
      return;
    }

    if (!supportsRecording) {
      setRecordingError('Bu tarayıcı canlı kaydı desteklemiyor. Ses dosyası yükleyebilirsin.');
      return;
    }

    setRecordingError(null);
    setFieldErrors((current) => ({ ...current, audio: undefined }));
    setFormError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        const file = new File([blob], `meal-audio-${Date.now()}.webm`, {
          type: blob.type || 'audio/webm',
        });

        const transfer = new DataTransfer();
        transfer.items.add(file);
        appendAudioFiles(transfer.files, 'recording');

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecordingState('idle');
        setRecordingStartedAt(null);
      };

      recorder.start();
      setRecordingState('recording');
      setRecordingStartedAt(Date.now());
      setRecordingElapsedSeconds(0);
    } catch {
      setRecordingError('Mikrofon izni alınamadı. Ses dosyası yükleyebilirsin.');
      setRecordingState('idle');
      setRecordingStartedAt(null);
      setRecordingElapsedSeconds(0);
    }
  }

  function handleImageUploadChange(event: ChangeEvent<HTMLInputElement>) {
    appendImageFiles(event.target.files, 'upload');
    event.target.value = '';
  }

  function handleCameraCaptureChange(event: ChangeEvent<HTMLInputElement>) {
    const mode = cameraCaptureModeRef.current;
    cameraCaptureModeRef.current = 'append';

    if (mode === 'replace') {
      replaceCameraFiles(event.target.files);
    } else {
      appendImageFiles(event.target.files, 'camera');
    }

    event.target.value = '';
  }

  function handleAudioUploadChange(event: ChangeEvent<HTMLInputElement>) {
    appendAudioFiles(event.target.files, 'upload');
    event.target.value = '';
  }

  function getMethodCount(method: MealInputMethod) {
    if (method === 'text') {
      return description.trim().length > 0 ? 1 : 0;
    }

    if (method === 'audio') {
      return audioAssets.length;
    }

    if (method === 'camera') {
      return imageAssets.filter((asset) => asset.source === 'camera').length;
    }

    return imageAssets.filter((asset) => asset.source === 'upload').length;
  }

  function hasAnyInput() {
    return description.trim().length > 0 || imageAssets.length > 0 || audioAssets.length > 0;
  }

  function openCameraCapture(mode: 'append' | 'replace' = 'append') {
    cameraCaptureModeRef.current = mode;
    setFieldErrors((current) => ({ ...current, images: undefined }));
    setFormError(null);
    cameraCaptureRef.current?.click();
  }

  const cameraAssets = imageAssets.filter((asset) => asset.source === 'camera');
  const latestCameraAsset = cameraAssets.at(-1) ?? null;

  useEffect(() => {
    setSelectedMethod(initialMethod);
    autoCaptureTriggeredRef.current = false;
  }, [initialMethod]);

  useEffect(() => {
    if (!autoCapture || selectedMethod !== 'camera' || autoCaptureTriggeredRef.current || latestCameraAsset) {
      return;
    }

    autoCaptureTriggeredRef.current = true;
    openCameraCapture();
  }, [autoCapture, latestCameraAsset, selectedMethod]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    if (recordingState === 'recording') {
      setFormError('Taslak oluşturmadan önce ses kaydını durdur.');
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const formData = new FormData();
    const trimmedDescription = description.trim();

    if (trimmedDescription) {
      formData.set('description', trimmedDescription);
    }

    for (const asset of imageAssets) {
      formData.append(asset.source === 'camera' ? 'cameraCaptures' : 'imageUploads', asset.file);
    }

    for (const asset of audioAssets) {
      formData.append(asset.source === 'recording' ? 'audioRecordings' : 'audioUploads', asset.file);
    }

    startTransition(async () => {
      const response = await fetch('/api/meals/drafts', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as MealDraftCreateResult | null;

      if (!response.ok || !payload?.ok) {
        setFieldErrors(payload?.ok === false ? payload.fieldErrors ?? {} : {});
        setFormError(payload?.ok === false ? payload.message : 'Taslak oluşturulamadı. Tekrar dene.');
        return;
      }

      const canAutoConfirm = payload.analysisStatus === 'SUCCEEDED' && Boolean(payload.draftResult);

      if (autoConfirmDraft && !canAutoConfirm) {
        setFormError(
          payload.analysisErrorMessage ??
            'Analiz tamamlanamadı. Taslak kaydedildi; lütfen inceleme ekranından analizi yeniden çalıştır.',
        );
        router.push(payload.reviewRoute as Route);
        return;
      }

      if (autoConfirmDraft && canAutoConfirm) {
        const confirmResponse = await fetch(`/api/meals/${payload.mealId}/confirm`, {
          method: 'POST',
        });
        const confirmPayload = (await confirmResponse.json().catch(() => null)) as
          | {
              ok: true;
            }
          | {
              ok: false;
              message: string;
            }
          | null;

        if (!confirmResponse.ok || !confirmPayload?.ok) {
          setFormError(confirmPayload?.ok === false ? confirmPayload.message : 'Öğün kaydedilemedi.');
          return;
        }
      }

      if (onCompleted) {
        onCompleted();
        return;
      }

      router.push(payload.reviewRoute as Route);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input ref={imageUploadRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUploadChange} />
      <input
        ref={cameraCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCameraCaptureChange}
      />
      <input ref={audioUploadRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleAudioUploadChange} />

      {!embedded ? (
      <Card tone="hero">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Hızlı giriş</p>
            <h1 className="mt-2 font-display text-4xl leading-none text-slate-950">Öğün ekle</h1>
          </div>
          <StatusPill tone="success">Taslak</StatusPill>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {mealInputMethodOptions.map((method) => {
            const isSelected = selectedMethod === method.value;
            const count = getMethodCount(method.value);

            return (
              <button
                key={method.value}
                type="button"
                onClick={() => setSelectedMethod(method.value)}
                className={cn(
                  'rounded-[24px] border px-4 py-4 text-left transition',
                  isSelected
                    ? 'border-slate-950 bg-slate-950 text-white shadow-soft'
                    : 'border-white/80 bg-white/80 text-slate-900 shadow-soft',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className={cn('rounded-2xl p-3', isSelected ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800')}>
                    <Icon name={method.icon} className="h-5 w-5" />
                  </div>
                  <span className={cn('text-xs font-semibold uppercase tracking-[0.16em]', isSelected ? 'text-white/70' : 'text-slate-400')}>
                    {count}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold">{method.title}</p>
                <p className={cn('mt-1 text-xs uppercase tracking-[0.14em]', isSelected ? 'text-white/72' : 'text-slate-500')}>seç</p>
              </button>
            );
          })}
        </div>
      </Card>
      ) : null}

      <Card tone="subtle">
        {selectedMethod === 'text' ? (
          <Stack gap="md">
            <div>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Örn: tavuk dürüm, ayran, küçük salata"
                maxLength={MAX_TEXT_INPUT_LENGTH}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">Kısa not yeterli.</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {description.trim().length}/{MAX_TEXT_INPUT_LENGTH}
                </p>
              </div>
              {fieldErrors.description ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.description}</p> : null}
            </div>
          </Stack>
        ) : null}

        {selectedMethod === 'image' ? (
          <Stack gap="md">
            <button type="button" onClick={() => imageUploadRef.current?.click()} className={buttonStyles({ variant: 'secondary', fullWidth: true })}>
              <Icon name="upload" className="h-4 w-4" />
              Fotoğraf yükle
            </button>
            {fieldErrors.images ? <p className="text-sm text-rose-600">{fieldErrors.images}</p> : null}
          </Stack>
        ) : null}

        {selectedMethod === 'camera' ? (
          <Stack gap="md">
            <p className="text-sm font-semibold text-slate-950">Fotoğraf çek</p>

            {latestCameraAsset ? (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft">
                <div className="relative">
                  <Image
                    src={latestCameraAsset.previewUrl}
                    alt="Son kamera çekimi"
                    width={1080}
                    height={1440}
                    unoptimized
                    className="h-[24rem] w-full object-cover"
                  />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                    <StatusPill tone="success">Hazır</StatusPill>
                    <div className="rounded-2xl bg-slate-950/75 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                      Kamera
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-base font-semibold text-slate-950">Uygun mu?</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">{formatFileSizeLabel(latestCameraAsset.file.size)}</p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button type="button" variant="secondary" fullWidth onClick={() => openCameraCapture('replace')}>
                      <Icon name="camera" className="h-4 w-4" />
                      Yeniden çek
                    </Button>
                    <Button type="submit" fullWidth disabled={isPending || recordingState === 'recording'}>
                      {isPending ? 'Kaydediliyor...' : 'Bu fotoğrafla kaydet'}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCameraCapture('append')}
                    className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'mt-3 w-full justify-center' })}
                  >
                    <Icon name="photo" className="h-4 w-4" />
                    Bir açı daha ekle
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/75 p-5 shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="rounded-[22px] bg-slate-100 p-4 text-slate-900">
                    <Icon name="camera" className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-slate-950">Kamerayı aç</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Çek ve kaydet.</p>
                  </div>
                </div>

                <button type="button" onClick={() => openCameraCapture()} className={buttonStyles({ fullWidth: true, className: 'mt-5' })}>
                  <Icon name="camera" className="h-4 w-4" />
                  Kamerayı aç
                </button>
              </div>
            )}
            {fieldErrors.images ? <p className="text-sm text-rose-600">{fieldErrors.images}</p> : null}
          </Stack>
        ) : null}

        {selectedMethod === 'audio' ? (
          <Stack gap="md">
            <p className="text-sm font-semibold text-slate-950">Ses kaydı veya yükleme</p>
            <div className="grid grid-cols-1 gap-3">
              <button type="button" onClick={() => audioUploadRef.current?.click()} className={buttonStyles({ variant: 'secondary', fullWidth: true })}>
                <Icon name="upload" className="h-4 w-4" />
                Ses dosyası yükle
              </button>
              <button
                type="button"
                onClick={handleRecordingToggle}
                disabled={!supportsRecording && recordingState !== 'recording'}
                className={buttonStyles({
                  variant: recordingState === 'recording' ? 'primary' : 'soft',
                  fullWidth: true,
                })}
              >
                <Icon name="microphone" className="h-4 w-4" />
                {recordingState === 'recording' ? 'Kaydı durdur' : 'Ses notu kaydet'}
              </button>
            </div>
            {recordingState === 'recording' ? (
              <div className="flex items-center justify-between gap-3 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Kayıt alınıyor</p>
                  <p className="mt-1 text-sm text-slate-600">Öğününü anlat.</p>
                </div>
                <StatusPill tone="success">{formatDurationLabel(recordingElapsedSeconds)}</StatusPill>
              </div>
            ) : null}
            {recordingError ? <p className="text-sm text-rose-600">{recordingError}</p> : null}
            {fieldErrors.audio ? <p className="text-sm text-rose-600">{fieldErrors.audio}</p> : null}
          </Stack>
        ) : null}
      </Card>

      {!compact ? (
      <Card tone="subtle">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Seçilen girişler</p>
            <p className="mt-1 text-sm text-slate-500">{hasAnyInput() ? 'Kaydetmeye hazır.' : 'Henüz giriş yok.'}</p>
          </div>
          <StatusPill tone={hasAnyInput() ? 'success' : 'neutral'}>{hasAnyInput() ? 'Hazır' : 'Boş'}</StatusPill>
        </div>

        {description.trim().length > 0 ? (
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Metin notu</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description.trim()}</p>
              </div>
              <Icon name="text" className="h-5 w-5 text-slate-500" />
            </div>
          </div>
        ) : null}

        {imageAssets.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {imageAssets.map((asset) => (
              <div key={asset.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-soft">
                <Image
                  src={asset.previewUrl}
                  alt="Selected meal input"
                  width={640}
                  height={360}
                  unoptimized
                  className="h-36 w-full object-cover"
                />
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-900">{asset.source === 'camera' ? 'Kamera' : 'Yüklenen görsel'}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{formatFileSizeLabel(asset.file.size)}</p>
                  <button
                    type="button"
                    onClick={() => removeImageAsset(asset.id)}
                    className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'mt-3 w-full justify-center' })}
                  >
                    Kaldır
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {audioAssets.length > 0 ? (
          <div className="mt-4 space-y-3">
            {audioAssets.map((asset) => (
              <div key={asset.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{asset.source === 'recording' ? 'Ses kaydı' : 'Yüklenen ses'}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{formatFileSizeLabel(asset.file.size)}</p>
                  </div>
                  <Icon name="microphone" className="h-5 w-5 text-slate-500" />
                </div>
                <audio controls preload="metadata" className="mt-3 w-full">
                  <source src={asset.previewUrl} type={asset.file.type || 'audio/webm'} />
                </audio>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Transkript otomatik eklenir.
                </p>
                <button
                  type="button"
                  onClick={() => removeAudioAsset(asset.id)}
                  className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'mt-3 w-full justify-center' })}
                >
                  Kaldır
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {!hasAnyInput() ? (
          <div className="mt-4">
            <StatePanel
              variant="empty"
              title="Devam etmek için giriş ekle"
              description="Yazı, fotoğraf, kamera veya ses."
            />
          </div>
        ) : null}
      </Card>
      ) : null}

      {formError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
      ) : null}

      {embedded ? (
        <Button type="submit" fullWidth disabled={!hasAnyInput() || isPending || recordingState === 'recording'}>
          {isPending ? 'Kaydediliyor...' : 'Öğünü kaydet'}
        </Button>
      ) : (
        <div className="sticky bottom-24 z-10 -mx-1">
          <BottomActionBar>
            <Button type="submit" fullWidth disabled={!hasAnyInput() || isPending || recordingState === 'recording'}>
              {isPending
                ? 'Kaydediliyor...'
                : selectedMethod === 'camera' && latestCameraAsset
                  ? 'Fotoğrafla taslak oluştur'
                  : 'Taslak oluştur'}
            </Button>
            <p className="text-center text-sm leading-6 text-slate-500">Onay bir sonraki adımda.</p>
          </BottomActionBar>
        </div>
      )}
    </form>
  );
}
