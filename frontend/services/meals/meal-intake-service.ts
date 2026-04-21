import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { MealInputAssetType, Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { getAppDayDate, getAppDayKey } from '@/lib/date/istanbul';
import { getEffectiveConfig } from '@/lib/effective-config';
import {
  MAX_AUDIO_ASSET_COUNT,
  MAX_IMAGE_ASSET_COUNT,
  MAX_TEXT_INPUT_LENGTH,
  MAX_TOTAL_FILE_ASSET_COUNT,
} from '@/lib/meals/intake';
import { deleteMealAssetFile, writeMealAssetFile } from '@/lib/storage/meal-asset-storage';
import { transcribeMealAudioFile, type AudioTranscriptionResult } from '@/services/meal-analysis/audio-transcription-service';
import { executeMealAnalysisRun } from '@/services/meal-analysis/meal-analysis-service';
import type { MealDraftCreateResult, MealIntakeFieldErrors } from '@/types/meal-intake';

type BinaryAssetInput = {
  assetType: Extract<MealInputAssetType, 'IMAGE' | 'AUDIO'>;
  source: 'upload' | 'camera' | 'recording';
  file: File;
};

type PersistedBinaryAsset = {
  assetType: Extract<MealInputAssetType, 'IMAGE' | 'AUDIO'>;
  source: BinaryAssetInput['source'];
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  originalName: string;
  transcription: AudioTranscriptionResult | null;
};

const imageMimePattern = /^image\/(jpeg|jpg|png|webp|gif)$/i;
const audioMimePattern = /^audio\//;

function trimText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function collectFiles(formData: FormData, fieldName: string) {
  return formData.getAll(fieldName).filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function getSafeExtension(file: File, fallbackExtension: string) {
  const fileExtension = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return fileExtension || fallbackExtension;
}

function buildStorageKey(userId: string, assetType: PersistedBinaryAsset['assetType'], source: PersistedBinaryAsset['source'], file: File) {
  const dayKey = getAppDayKey(new Date());
  const extension = assetType === 'IMAGE' ? getSafeExtension(file, '.jpg') : getSafeExtension(file, '.webm');
  const folder = assetType === 'IMAGE' ? 'images' : 'audio';
  return `${userId}/${dayKey}/${folder}/${source}-${Date.now()}-${randomUUID()}${extension}`;
}

async function persistBinaryAsset(userId: string, input: BinaryAssetInput): Promise<PersistedBinaryAsset> {
  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storageKey = buildStorageKey(userId, input.assetType, input.source, input.file);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  await writeMealAssetFile(storageKey, buffer);

  return {
    assetType: input.assetType,
    source: input.source,
    storageKey,
    mimeType: input.file.type || (input.assetType === 'IMAGE' ? 'image/jpeg' : 'audio/webm'),
    fileSizeBytes: input.file.size,
    sha256,
    originalName: input.file.name,
    transcription: null,
  };
}

function createValidationError(message: string, fieldErrors?: MealIntakeFieldErrors): MealDraftCreateResult {
  return {
    ok: false,
    message,
    fieldErrors,
  };
}

async function validateBinaryAssets(binaryAssets: BinaryAssetInput[]): Promise<MealDraftCreateResult | null> {
  const { mealAssetMaxFileSizeMb } = await getEffectiveConfig();
  const maxFileSizeBytes = mealAssetMaxFileSizeMb * 1024 * 1024;

  const imageCount = binaryAssets.filter((asset) => asset.assetType === 'IMAGE').length;
  const audioCount = binaryAssets.filter((asset) => asset.assetType === 'AUDIO').length;

  if (imageCount > MAX_IMAGE_ASSET_COUNT) {
    return createValidationError(`Bir taslağa en fazla ${MAX_IMAGE_ASSET_COUNT} görsel ekleyebilirsin.`, {
      images: `Taslak en fazla ${MAX_IMAGE_ASSET_COUNT} görsel içerebilir.`,
    });
  }

  if (audioCount > MAX_AUDIO_ASSET_COUNT) {
    return createValidationError(`Bir taslağa en fazla ${MAX_AUDIO_ASSET_COUNT} ses dosyası ekleyebilirsin.`, {
      audio: `Taslak en fazla ${MAX_AUDIO_ASSET_COUNT} ses dosyası içerebilir.`,
    });
  }

  if (binaryAssets.length > MAX_TOTAL_FILE_ASSET_COUNT) {
    return createValidationError(`Bir taslağa en fazla ${MAX_TOTAL_FILE_ASSET_COUNT} dosya ekleyebilirsin.`);
  }

  for (const asset of binaryAssets) {
    if (asset.assetType === 'IMAGE' && !imageMimePattern.test(asset.file.type)) {
      return createValidationError('Seçilen görsellerden biri kabul edilemedi.', {
        images: 'Fotoğraf yüklemede sadece JPEG, PNG, WEBP veya GIF dosyaları desteklenir.',
      });
    }

    if (asset.assetType === 'AUDIO' && !audioMimePattern.test(asset.file.type)) {
      return createValidationError('Seçilen ses dosyalarından biri kabul edilemedi.', {
        audio: 'Ses girişinde sadece ses dosyaları kabul edilir.',
      });
    }

    if (asset.file.size > maxFileSizeBytes) {
      const field = asset.assetType === 'IMAGE' ? 'images' : 'audio';

      return createValidationError(`Seçilen bir dosya ${mealAssetMaxFileSizeMb} MB sınırını aşıyor.`, {
        [field]: `Her dosya ${mealAssetMaxFileSizeMb} MB altında olmalı.`,
      });
    }
  }

  return null;
}

export async function createMealDraftFromIntake(userId: string, formData: FormData): Promise<MealDraftCreateResult> {
  const effectiveConfig = await getEffectiveConfig();
  const description = trimText(formData.get('description'));
  const imageUploads = collectFiles(formData, 'imageUploads');
  const cameraCaptures = collectFiles(formData, 'cameraCaptures');
  const audioUploads = collectFiles(formData, 'audioUploads');
  const audioRecordings = collectFiles(formData, 'audioRecordings');

  if (description.length > MAX_TEXT_INPUT_LENGTH) {
    return createValidationError(`Yazı girişi en fazla ${MAX_TEXT_INPUT_LENGTH} karakter olabilir.`, {
      description: `Açıklamayı ${MAX_TEXT_INPUT_LENGTH} karakter altında tut.`,
    });
  }

  const binaryAssets: BinaryAssetInput[] = [
    ...imageUploads.map((file) => ({ assetType: 'IMAGE' as const, source: 'upload' as const, file })),
    ...cameraCaptures.map((file) => ({ assetType: 'IMAGE' as const, source: 'camera' as const, file })),
    ...audioUploads.map((file) => ({ assetType: 'AUDIO' as const, source: 'upload' as const, file })),
    ...audioRecordings.map((file) => ({ assetType: 'AUDIO' as const, source: 'recording' as const, file })),
  ];

  if (!description && binaryAssets.length === 0) {
    return createValidationError('Taslak başlatmak için yazı, fotoğraf veya ses notu ekle.');
  }

  const validationError = await validateBinaryAssets(binaryAssets);

  if (validationError) {
    return validationError;
  }

  const persistedBinaryAssets: PersistedBinaryAsset[] = [];

  try {
    for (const asset of binaryAssets) {
      const persistedAsset = await persistBinaryAsset(userId, asset);
      const transcription = asset.assetType === 'AUDIO' ? await transcribeMealAudioFile(asset.file) : null;

      persistedBinaryAssets.push({
        ...persistedAsset,
        transcription,
      });
    }

    const now = new Date();
    const dayKey = getAppDayKey(now);
    const mealDate = getAppDayDate(now);
    const textCount = description ? 1 : 0;
    const imageCount = persistedBinaryAssets.filter((asset) => asset.assetType === 'IMAGE').length;
    const audioCount = persistedBinaryAssets.filter((asset) => asset.assetType === 'AUDIO').length;

    const requestJson = {
      contractVersion: 'meal-analysis-request-v1',
      requestedAt: now.toISOString(),
      dayKey,
      timeZone: effectiveConfig.appTimeZone,
      description: description || null,
      assetCounts: {
        text: textCount,
        image: imageCount,
        audio: audioCount,
      },
      inputs: [
        ...(description
          ? [
              {
                assetType: 'TEXT',
                source: 'typed',
                textLength: description.length,
                textPreview: description.slice(0, 240),
              },
            ]
          : []),
        ...persistedBinaryAssets.map((asset) => ({
          assetType: asset.assetType,
          source: asset.source,
          mimeType: asset.mimeType,
          fileSizeBytes: asset.fileSizeBytes,
          storageKey: asset.storageKey,
          sha256: asset.sha256,
          transcriptStatus: asset.transcription?.status ?? null,
          transcriptText: asset.transcription?.transcriptText ?? null,
          transcriptLanguage: asset.transcription?.language ?? null,
          transcriptProvider: asset.transcription?.provider ?? null,
          transcriptModel: asset.transcription?.model ?? null,
        })),
      ],
    };

    const requestFingerprint = createHash('sha256').update(JSON.stringify(requestJson)).digest('hex');
    const result = await prisma.$transaction(async (tx) => {
      const meal = await tx.meal.create({
        data: {
          userId,
          status: 'DRAFT',
          mealType: 'OTHER',
          timeZone: effectiveConfig.appTimeZone,
          mealDate,
          consumedAt: now,
        },
      });

      const assetRows: Prisma.MealInputAssetCreateManyInput[] = [];

      if (description) {
        assetRows.push({
          mealId: meal.id,
          userId,
          assetType: 'TEXT',
          sortOrder: assetRows.length,
          textContent: description,
          metadataJson: {
            source: 'typed',
          },
        });
      }

      for (const asset of persistedBinaryAssets) {
        assetRows.push({
          mealId: meal.id,
          userId,
          assetType: asset.assetType,
          sortOrder: assetRows.length,
          storageKey: asset.storageKey,
          mimeType: asset.mimeType,
          sha256: asset.sha256,
          fileSizeBytes: asset.fileSizeBytes,
          metadataJson: {
            source: asset.source,
            originalName: asset.originalName,
            transcriptStatus: asset.transcription?.status ?? null,
            transcriptText: asset.transcription?.transcriptText ?? null,
            transcriptLanguage: asset.transcription?.language ?? null,
            transcriptProvider: asset.transcription?.provider ?? null,
            transcriptModel: asset.transcription?.model ?? null,
            transcriptDurationSeconds: asset.transcription?.durationSeconds ?? null,
            transcriptMessage: asset.transcription?.message ?? null,
          },
        });
      }

      if (assetRows.length > 0) {
        await tx.mealInputAsset.createMany({
          data: assetRows,
        });
      }

      const analysisRun = await tx.mealAnalysisRun.create({
        data: {
          mealId: meal.id,
          userId,
          status: 'QUEUED',
          provider: effectiveConfig.aiProvider,
          model: effectiveConfig.mealAnalysisStage1Model,
          promptVersion: effectiveConfig.aiAnalysisPromptVersion,
          requestFingerprint,
          requestJson,
        },
      });

      return {
        mealId: meal.id,
        analysisRunId: analysisRun.id,
      };
    });

    const analysisResult = await executeMealAnalysisRun({
      userId,
      mealId: result.mealId,
      analysisRunId: result.analysisRunId,
    });

    return {
      ok: true,
      mealId: result.mealId,
      analysisRunId: result.analysisRunId,
      reviewRoute: `/app/add-meal/review/${result.mealId}`,
      dayKey,
      analysisStatus: analysisResult.status,
      analysisErrorMessage: analysisResult.ok ? null : analysisResult.error.message,
      draftResult: analysisResult.ok ? analysisResult.draftResult : null,
      assetCounts: {
        text: textCount,
        image: imageCount,
        audio: audioCount,
      },
    };
  } catch (error) {
    await Promise.all(persistedBinaryAssets.map((asset) => deleteMealAssetFile(asset.storageKey)));
    throw error;
  }
}
