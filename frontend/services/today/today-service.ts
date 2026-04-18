import { getAppDayKey } from '@/lib/date/istanbul';
import { getMealDaySummary } from '@/services/meals/meal-day-service';
import type { TodaySummary } from '@/types/today';

export async function getTodaySummary(userId: string): Promise<TodaySummary> {
  return getMealDaySummary(userId, getAppDayKey(new Date()));
}
