import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { MealInputAssetType, Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';
import { getAppDayDate, getAppDayKey } from '@/lib/date/istanbul';
import { getServerEnv } from '@/lib/env';
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

const imageMimePattern = /^image\//;
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

function validateBinaryAssets(binaryAssets: BinaryAssetInput[]): MealDraftCreateResult | null {
  const { MEAL_ASSET_MAX_FILE_SIZE_MB } = getServerEnv();
  const maxFileSizeBytes = MEAL_ASSET_MAX_FILE_SIZE_MB * 1024 * 1024;

  const imageCount = binaryAssets.filter((asset) => asset.assetType === 'IMAGE').length;
  const audioCount = binaryAssets.filter((asset) => asset.assetType === 'AUDIO').length;

  if (imageCount > MAX_IMAGE_ASSET_COUNT) {
    return createValidationError(`You can attach up to ${MAX_IMAGE_ASSET_COUNT} images in one draft.`, {
      images: `Keep the draft to ${MAX_IMAGE_ASSET_COUNT} images or fewer.`,
    });
  }

  if (audioCount > MAX_AUDIO_ASSET_COUNT) {
    return createValidationError(`You can attach up to ${MAX_AUDIO_ASSET_COUNT} audio files in one draft.`, {
      audio: `Keep the draft to ${MAX_AUDIO_ASSET_COUNT} audio files or fewer.`,
    });
  }

  if (binaryAssets.length > MAX_TOTAL_FILE_ASSET_COUNT) {
    return createValidationError(`You can attach up to ${MAX_TOTAL_FILE_ASSET_COUNT} files in one draft.`);
  }

  for (const asset of binaryAssets) {
    if (asset.assetType === 'IMAGE' && !imageMimePattern.test(asset.file.type)) {
      return createValidationError('One of the selected photos could not be accepted.', {
        images: 'Only image files are allowed for photo and camera inputs.',
      });
    }

    if (asset.assetType === 'AUDIO' && !audioMimePattern.test(asset.file.type)) {
      return createValidationError('One of the selected audio files could not be accepted.', {
        audio: 'Only audio files are allowed for the audio input.',
      });
    }

    if (asset.file.size > maxFileSizeBytes) {
      const field = asset.assetType === 'IMAGE' ? 'images' : 'audio';

      return createValidationError(`A selected file is larger than ${MEAL_ASSET_MAX_FILE_SIZE_MB} MB.`, {
        [field]: `Each file must stay under ${MEAL_ASSET_MAX_FILE_SIZE_MB} MB.`,
      });
    }
  }

  return null;
}

export async function createMealDraftFromIntake(userId: string, formData: FormData): Promise<MealDraftCreateResult> {
  const description = trimText(formData.get('description'));
  const imageUploads = collectFiles(formData, 'imageUploads');
  const cameraCaptures = collectFiles(formData, 'cameraCaptures');
  const audioUploads = collectFiles(formData, 'audioUploads');
  const audioRecordings = collectFiles(formData, 'audioRecordings');

  if (description.length > MAX_TEXT_INPUT_LENGTH) {
    return createValidationError(`Text descriptions can be up to ${MAX_TEXT_INPUT_LENGTH} characters.`, {
      description: `Keep the description under ${MAX_TEXT_INPUT_LENGTH} characters.`,
    });
  }

  const binaryAssets: BinaryAssetInput[] = [
    ...imageUploads.map((file) => ({ assetType: 'IMAGE' as const, source: 'upload' as const, file })),
    ...cameraCaptures.map((file) => ({ assetType: 'IMAGE' as const, source: 'camera' as const, file })),
    ...audioUploads.map((file) => ({ assetType: 'AUDIO' as const, source: 'upload' as const, file })),
    ...audioRecordings.map((file) => ({ assetType: 'AUDIO' as const, source: 'recording' as const, file })),
  ];

  if (!description && binaryAssets.length === 0) {
    return createValidationError('Add a description, a photo, or an audio note to start the meal draft.');
  }

  const validationError = validateBinaryAssets(binaryAssets);

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
      timeZone: DEFAULT_APP_TIME_ZONE,
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
    const env = getServerEnv();

    const result = await prisma.$transaction(async (tx) => {
      const meal = await tx.meal.create({
        data: {
          userId,
          status: 'DRAFT',
          mealType: 'OTHER',
          timeZone: DEFAULT_APP_TIME_ZONE,
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
          provider: env.AI_PROVIDER,
          model: env.MEAL_ANALYSIS_STAGE1_MODEL,
          promptVersion: env.AI_ANALYSIS_PROMPT_VERSION,
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
