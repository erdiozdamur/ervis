const quantityUnitPattern =
  /^(tabak|kase|bardak|porsiyon|adet|dilim|fincan|kupa|avuc|avuç|parca|parça|sise|şişe|kutu|kasik|kaşık|g|gr|gram)$/i;

const turkishAmountMap = new Map<string, number>([
  ['yarim', 0.5],
  ['yarım', 0.5],
  ['ceyrek', 0.25],
  ['çeyrek', 0.25],
  ['bir', 1],
  ['iki', 2],
  ['uc', 3],
  ['üç', 3],
  ['dort', 4],
  ['dört', 4],
  ['bes', 5],
  ['beş', 5],
]);

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

export function inferQuantityMultiplierFromText(quantityText: string | null) {
  if (!quantityText) {
    return 1;
  }

  const normalized = normalizeText(quantityText);
  const parts = normalized.split(' ');
  const first = parts[0];

  if (!first) {
    return 1;
  }

  if (/^\d+(?:[.,]\d+)?$/.test(first)) {
    return Number(first.replace(',', '.')) || 1;
  }

  return turkishAmountMap.get(first) ?? 1;
}

export function parseDraftPortion(quantityText: string | null) {
  if (!quantityText) {
    return {
      quantityAmount: null as number | null,
      quantityUnit: null as string | null,
      quantityMultiplier: 1,
    };
  }

  const normalized = normalizeText(quantityText);
  const parts = normalized.split(' ').filter(Boolean);

  if (parts.length === 0) {
    return {
      quantityAmount: null as number | null,
      quantityUnit: null as string | null,
      quantityMultiplier: 1,
    };
  }

  const amount = inferQuantityMultiplierFromText(quantityText);
  const unit = parts.find((part, index) => index > 0 && quantityUnitPattern.test(part)) ?? null;

  return {
    quantityAmount: Number.isFinite(amount) ? amount : null,
    quantityUnit: unit,
    quantityMultiplier: Number.isFinite(amount) && amount > 0 ? amount : 1,
  };
}
