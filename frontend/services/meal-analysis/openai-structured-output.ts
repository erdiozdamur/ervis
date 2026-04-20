function getObjectRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getStringValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function getStructuredPartObject(part: Record<string, unknown>) {
  const directObjectKeys = ['parsed', 'json', 'value'];

  for (const key of directObjectKeys) {
    const candidate = getObjectRecord(part[key]);
    if (candidate) {
      return candidate;
    }
  }

  const textObject = getObjectRecord(part.text);
  if (textObject) {
    for (const key of ['parsed', 'json', 'value']) {
      const candidate = getObjectRecord(textObject[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function getStructuredPartText(part: Record<string, unknown>) {
  const directStringKeys = ['text', 'value'];

  for (const key of directStringKeys) {
    const candidate = getStringValue(part[key]);
    if (candidate) {
      return candidate;
    }
  }

  const textObject = getObjectRecord(part.text);
  if (textObject) {
    for (const key of ['value', 'text']) {
      const candidate = getStringValue(textObject[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export function extractStructuredOutputJson(payload: unknown): Record<string, unknown> | null {
  const payloadRecord = getObjectRecord(payload);

  if (!payloadRecord) {
    return null;
  }

  const topLevelParsed = getObjectRecord(payloadRecord.output_parsed);
  if (topLevelParsed) {
    return topLevelParsed;
  }

  const output = Array.isArray(payloadRecord.output) ? payloadRecord.output : [];

  for (const entry of output) {
    const entryRecord = getObjectRecord(entry);
    const content = entryRecord && Array.isArray(entryRecord.content) ? entryRecord.content : [];

    for (const part of content) {
      const partRecord = getObjectRecord(part);
      if (!partRecord) {
        continue;
      }

      const structuredObject = getStructuredPartObject(partRecord);
      if (structuredObject) {
        return structuredObject;
      }
    }
  }

  return null;
}

export function extractStructuredOutputText(payload: unknown): string {
  const payloadRecord = getObjectRecord(payload);

  if (!payloadRecord) {
    return '';
  }

  const output = Array.isArray(payloadRecord.output) ? payloadRecord.output : [];
  const textParts: string[] = [];

  for (const entry of output) {
    const entryRecord = getObjectRecord(entry);
    const content = entryRecord && Array.isArray(entryRecord.content) ? entryRecord.content : [];

    for (const part of content) {
      const partRecord = getObjectRecord(part);
      if (!partRecord) {
        continue;
      }

      const partText = getStructuredPartText(partRecord);
      if (partText) {
        textParts.push(partText);
      }
    }
  }

  return textParts.join('\n').trim();
}

export function extractStructuredOutputData(payload: unknown): Record<string, unknown> {
  const structuredJson = extractStructuredOutputJson(payload);
  if (structuredJson) {
    return structuredJson;
  }

  const responseText = extractStructuredOutputText(payload);
  if (!responseText) {
    throw new Error('The model response did not include structured output.');
  }

  return JSON.parse(responseText) as Record<string, unknown>;
}
