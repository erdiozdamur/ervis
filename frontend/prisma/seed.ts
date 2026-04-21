import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.appMeta.upsert({
    where: { key: 'app_name' },
    update: { value: 'Calorie Tracker' },
    create: { key: 'app_name', value: 'Calorie Tracker' },
  });

  const sharedFoods = [
    {
      slug: 'egg',
      canonicalName: 'Yumurta',
      source: 'OFFICIAL_DATASET' as const,
      defaultServingAmount: 1,
      defaultServingUnit: 'piece',
      calories: 78,
      proteinGrams: 6,
      carbGrams: 1,
      fatGrams: 5,
      fiberGrams: 0,
    },
    {
      slug: 'yogurt-drink',
      canonicalName: 'Ayran',
      source: 'OFFICIAL_DATASET' as const,
      defaultServingAmount: 1,
      defaultServingUnit: 'glass',
      calories: 110,
      proteinGrams: 8,
      carbGrams: 9,
      fatGrams: 4,
      fiberGrams: 0,
    },
    {
      slug: 'rice-pilaf',
      canonicalName: 'Pilav',
      source: 'OFFICIAL_DATASET' as const,
      defaultServingAmount: 1,
      defaultServingUnit: 'plate',
      calories: 205,
      proteinGrams: 4,
      carbGrams: 45,
      fatGrams: 0,
      fiberGrams: 1,
    },
    {
      slug: 'lentil-soup',
      canonicalName: 'Mercimek çorbası',
      source: 'OFFICIAL_DATASET' as const,
      defaultServingAmount: 1,
      defaultServingUnit: 'bowl',
      calories: 160,
      proteinGrams: 8,
      carbGrams: 22,
      fatGrams: 4,
      fiberGrams: 5,
    },
    {
      slug: 'chicken-breast',
      canonicalName: 'Tavuk göğsü',
      source: 'OFFICIAL_DATASET' as const,
      defaultServingAmount: 1,
      defaultServingUnit: 'portion',
      calories: 165,
      proteinGrams: 31,
      carbGrams: 0,
      fatGrams: 4,
      fiberGrams: 0,
    },
    {
      slug: 'beef-steak',
      canonicalName: 'Biftek',
      source: 'OFFICIAL_DATASET' as const,
      defaultServingAmount: 1,
      defaultServingUnit: 'portion',
      calories: 271,
      proteinGrams: 26,
      carbGrams: 0,
      fatGrams: 18,
      fiberGrams: 0,
      metadataJson: {
        aliases: ['biftek', 'dana biftek', 'ızgara biftek'],
      },
    },
  ];

  for (const food of sharedFoods) {
    await prisma.foodCatalogEntry.upsert({
      where: { slug: food.slug },
      update: food,
      create: food,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
