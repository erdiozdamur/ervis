const quantityUnitPattern =
  /^(tabak|kase|bardak|porsiyon|adet|dilim|fincan|kupa|avuc|avuç|parca|parça|sise|şişe|kutu|kasik|kaşık|g|gr|gram|kg|ml|l|lt|litre|menu|menü)$/i;
const compactAmountWithUnitPattern = /^(\d+(?:[.,]\d+)?)(g|gr|gram|kg|ml|l|lt)$/i;

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

function normalizeQuantityMultiplier(amount: number, unit: string | null) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 1;
  }

  const normalizedUnit = unit?.trim().toLocaleLowerCase('tr-TR') ?? null;
  if (!normalizedUnit) {
    return amount;
  }

  if (['g', 'gr', 'gram', 'ml'].includes(normalizedUnit)) {
    return amount / 100;
  }

  if (['kg', 'l', 'lt', 'litre'].includes(normalizedUnit)) {
    return amount * 10;
  }

  return amount;
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
    const rawAmount = Number(first.replace(',', '.')) || 1;
    const unit = parts[1] ?? null;
    return normalizeQuantityMultiplier(rawAmount, unit);
  }

  return turkishAmountMap.get(first) ?? 1;
}

function inferRawAmountFromText(quantityText: string | null) {
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

  const compactMatch = parts[0] ? compactAmountWithUnitPattern.exec(parts[0]) : null;
  if (compactMatch) {
    const rawAmount = Number(compactMatch[1].replace(',', '.')) || 1;
    const unit = compactMatch[2].toLocaleLowerCase('tr-TR');
    return {
      quantityAmount: rawAmount,
      quantityUnit: unit,
      quantityMultiplier: normalizeQuantityMultiplier(rawAmount, unit),
    };
  }

  const amount = inferRawAmountFromText(quantityText);
  let unit = parts.find((part, index) => index > 0 && quantityUnitPattern.test(part)) ?? null;

  if (!unit && Number.isFinite(amount) && amount >= 20) {
    unit = 'gram';
  }

  const normalizedAmount = Number.isFinite(amount) ? amount : null;
  return {
    quantityAmount: normalizedAmount,
    quantityUnit: unit,
    quantityMultiplier: normalizedAmount != null ? normalizeQuantityMultiplier(normalizedAmount, unit) : 1,
  };
}
