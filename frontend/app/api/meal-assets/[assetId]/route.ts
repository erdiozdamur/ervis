import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/db/prisma';
import { readMealAssetFile } from '@/lib/storage/meal-asset-storage';

type MealAssetRouteContext = {
  params: {
    assetId: string;
  };
};

export async function GET(_request: Request, { params }: MealAssetRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const asset = await prisma.mealInputAsset.findFirst({
    where: {
      id: params.assetId,
      userId: session.user.id,
    },
    select: {
      storageKey: true,
      mimeType: true,
    },
  });

  if (!asset?.storageKey) {
    return new Response('Not found.', { status: 404 });
  }

  const file = await readMealAssetFile(asset.storageKey).catch(() => null);

  if (!file) {
    return new Response('Not found.', { status: 404 });
  }

  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': String(file.byteLength),
    },
  });
}
