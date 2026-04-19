import { DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';

const dateLabelFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const dayKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeLabelFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const timeInputFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const timeZoneOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  timeZoneName: 'shortOffset',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const dayKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timeValuePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function formatDateInAppTimeZone(date: Date) {
  return dateLabelFormatter.format(date);
}

export function getAppDayKey(date: Date) {
  const parts = dayKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to build Istanbul day key.');
  }

  return `${year}-${month}-${day}`;
}

export function isValidAppDayKey(dayKey: string) {
  if (!dayKeyPattern.test(dayKey)) {
    return false;
  }

  try {
    return getAppDayKey(getAppDayDateFromDayKey(dayKey)) === dayKey;
  } catch {
    return false;
  }
}

export function getAppDayDateFromDayKey(dayKey: string) {
  if (!dayKeyPattern.test(dayKey)) {
    throw new Error('App day keys must use YYYY-MM-DD format.');
  }

  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (getAppDayKey(date) !== dayKey) {
    throw new Error('Invalid Istanbul day key.');
  }

  return date;
}

export function getAppDayDate(date: Date) {
  return getAppDayDateFromDayKey(getAppDayKey(date));
}

export function formatTimeInAppTimeZone(date: Date) {
  return timeLabelFormatter.format(date);
}

export function formatTimeInputInAppTimeZone(date: Date) {
  return timeInputFormatter.format(date);
}

export function shiftAppDayKey(dayKey: string, offsetDays: number) {
  const date = getAppDayDateFromDayKey(dayKey);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return getAppDayKey(date);
}

function getTimeZoneOffsetMinutes(date: Date) {
  const value = timeZoneOffsetFormatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value;

  if (!value) {
    throw new Error('Unable to resolve Istanbul timezone offset.');
  }

  if (value === 'GMT' || value === 'UTC') {
    return 0;
  }

  const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) {
    throw new Error(`Unsupported timezone offset format: ${value}`);
  }

  const [, sign, hours, minutes = '00'] = match;
  const absoluteOffset = Number(hours) * 60 + Number(minutes);
  return sign === '-' ? -absoluteOffset : absoluteOffset;
}

export function getAppDateTimeFromDayKeyAndTime(dayKey: string, timeValue: string) {
  if (!isValidAppDayKey(dayKey)) {
    throw new Error('Invalid Istanbul day key.');
  }

  const match = timeValue.match(timeValuePattern);

  if (!match) {
    throw new Error('Time values must use HH:MM format.');
  }

  const [year, month, day] = dayKey.split('-').map(Number);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const baseUtc = Date.UTC(year, month - 1, day, hour, minute);

  let resolved = new Date(baseUtc);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(resolved);
    resolved = new Date(baseUtc - offsetMinutes * 60 * 1000);
  }

  if (getAppDayKey(resolved) !== dayKey || formatTimeInputInAppTimeZone(resolved) !== timeValue) {
    throw new Error('Unable to resolve an Istanbul-local meal time.');
  }

  return resolved;
}
