import type { MealInputAssetType } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { formatDateInAppTimeZone, formatTimeInAppTimeZone, getAppDayKey } from '@/lib/date/istanbul';
import type { MealDraftReview } from '@/types/meal-intake';
import type { MealDraftAnalysisResult } from '@/types/meal-analysis';

function getAssetLabel(assetType: MealInputAssetType) {
  if (assetType === 'TEXT') return 'Text note';
  if (assetType === 'AUDIO') return 'Audio note';
  return 'Image input';
}

function getSourceLabel(value: unknown) {
  const source = value && typeof value === 'object' && 'source' in value ? value.source : null;

  switch (source) {
    case 'camera':
      return 'Captured with camera';
    case 'recording':
      return 'Recorded in app';
    case 'upload':
      return 'Uploaded file';
    case 'typed':
      return 'Typed input';
    default:
      return null;
  }
}

function getTranscriptStatus(value: unknown): 'completed' | 'failed' | 'skipped' | null {
  const status = value && typeof value === 'object' && 'transcriptStatus' in value ? value.transcriptStatus : null;
  return status === 'completed' || status === 'failed' || status === 'skipped' ? status : null;
}

function getTranscriptString(value: unknown, key: 'transcriptText' | 'transcriptLanguage' | 'transcriptMessage') {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return null;
  }

  const metadata = value as Record<string, unknown>;
  return typeof metadata[key] === 'string' ? metadata[key] : null;
}

export async function getMealDraftReview(userId: string, mealId: string): Promise<MealDraftReview | null> {
  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId,
    },
    select: {
      id: true,
      mealDate: true,
      createdAt: true,
      inputAssets: {
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          id: true,
          assetType: true,
          textContent: true,
          mimeType: true,
          fileSizeBytes: true,
          storageKey: true,
          metadataJson: true,
          createdAt: true,
        },
      },
      analysisRuns: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        select: {
          status: true,
          promptVersion: true,
          createdAt: true,
          errorMessage: true,
          draftResultJson: true,
        },
      },
    },
  });

  if (!meal) {
    return null;
  }

  const latestRun = meal.analysisRuns[0] ?? null;
  const draftResult = latestRun?.draftResultJson as MealDraftAnalysisResult | null;

  return {
    mealId: meal.id,
    dayKey: getAppDayKey(meal.mealDate),
    dateLabel: formatDateInAppTimeZone(meal.mealDate),
    createdAtLabel: `${formatDateInAppTimeZone(meal.createdAt)} · ${formatTimeInAppTimeZone(meal.createdAt)}`,
    analysisStatus: latestRun?.status ?? 'QUEUED',
    analysisRequestedAtLabel: latestRun ? formatTimeInAppTimeZone(latestRun.createdAt) : null,
    analysisPromptVersion: latestRun?.promptVersion ?? null,
    analysisErrorMessage: latestRun?.errorMessage ?? null,
    imageCount: meal.inputAssets.filter((asset) => asset.assetType === 'IMAGE').length,
    audioCount: meal.inputAssets.filter((asset) => asset.assetType === 'AUDIO').length,
    textCount: meal.inputAssets.filter((asset) => asset.assetType === 'TEXT').length,
    assets: meal.inputAssets.map((asset) => ({
      id: asset.id,
      assetType: asset.assetType,
      label: getAssetLabel(asset.assetType),
      textContent: asset.textContent,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes,
      previewRoute: asset.storageKey ? `/api/meal-assets/${asset.id}` : null,
      createdAtLabel: formatTimeInAppTimeZone(asset.createdAt),
      sourceLabel: getSourceLabel(asset.metadataJson),
      transcriptText: getTranscriptString(asset.metadataJson, 'transcriptText'),
      transcriptStatus: getTranscriptStatus(asset.metadataJson),
      transcriptLanguage: getTranscriptString(asset.metadataJson, 'transcriptLanguage'),
      transcriptMessage: getTranscriptString(asset.metadataJson, 'transcriptMessage'),
    })),
    draftResult,
  };
}
