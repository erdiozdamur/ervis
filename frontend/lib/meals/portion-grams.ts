const gramsPerUnitMap: Record<string, number> = {
  g: 1,
  gr: 1,
  gram: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  lt: 1000,
  litre: 1000,
  porsiyon: 180,
  tabak: 260,
  kase: 220,
  bardak: 240,
  adet: 70,
  dilim: 35,
  fincan: 90,
  kupa: 240,
  avuc: 30,
  avuç: 30,
  parca: 60,
  parça: 60,
  sise: 500,
  şişe: 500,
  kutu: 330,
  kasik: 15,
  kaşık: 15,
  menu: 550,
  menü: 550,
};

type FoodProfile = {
  keywords: string[];
  perUnit: Partial<Record<string, number>>;
};

const foodProfiles: FoodProfile[] = [
  {
    keywords: ['kuru fasulye'],
    perUnit: { porsiyon: 220, tabak: 280, kase: 200 },
  },
  {
    keywords: ['pilav', 'pirinç pilavı', 'bulgur pilavı'],
    perUnit: { porsiyon: 180, tabak: 240, kase: 170 },
  },
  {
    keywords: ['cacık', 'cacik'],
    perUnit: { porsiyon: 200, kase: 180, bardak: 220 },
  },
  {
    keywords: ['biftek', 'steak'],
    perUnit: { porsiyon: 200, adet: 180, tabak: 240 },
  },
  {
    keywords: ['çorba', 'corba', 'soup'],
    perUnit: { kase: 220, porsiyon: 240, tabak: 280 },
  },
];

function roundValue(value: number) {
  return Math.round(value * 10) / 10;
}

function resolveFoodSpecificUnitWeight(quantityUnit: string, foodName?: string | null) {
  if (!foodName) {
    return null;
  }

  const normalizedFoodName = foodName.trim().toLocaleLowerCase('tr-TR');
  const profile = foodProfiles.find((candidate) => candidate.keywords.some((keyword) => normalizedFoodName.includes(keyword)));

  if (!profile) {
    return null;
  }

  return profile.perUnit[quantityUnit] ?? null;
}

export function estimateGramsFromPortion(quantityAmount: number | null, quantityUnit: string | null, foodName?: string | null) {
  if (!quantityAmount || quantityAmount <= 0 || !quantityUnit) {
    return null;
  }

  const normalizedUnit = quantityUnit.trim().toLocaleLowerCase('tr-TR');
  const gramsPerUnit = resolveFoodSpecificUnitWeight(normalizedUnit, foodName) ?? gramsPerUnitMap[normalizedUnit];

  if (!gramsPerUnit || !Number.isFinite(gramsPerUnit)) {
    return null;
  }

  return roundValue(quantityAmount * gramsPerUnit);
}
