import { MealEntryForm } from '@/components/meal-entry/meal-entry-form';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import type { MealInputMethod } from '@/lib/meals/intake';

type AddMealPageProps = {
  searchParams?: {
    method?: string | string[];
    autocapture?: string | string[];
  };
};

const inputMethods: MealInputMethod[] = ['camera', 'image', 'text', 'audio'];

function resolveMethod(method: string | string[] | undefined): MealInputMethod {
  const candidate = Array.isArray(method) ? method[0] : method;
  return inputMethods.includes(candidate as MealInputMethod) ? (candidate as MealInputMethod) : 'camera';
}

function resolveAutocapture(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === '1' || candidate === 'true';
}

export default function AddMealPage({ searchParams }: AddMealPageProps) {
  const initialMethod = resolveMethod(searchParams?.method);
  const autoCapture = initialMethod === 'camera' && resolveAutocapture(searchParams?.autocapture);

  return (
    <Stack gap="xl">
      <section aria-labelledby="add-meal-title">
        <ScreenHeader eyebrow="Quick log" title="Add meal" />

        <MealEntryForm initialMethod={initialMethod} autoCapture={autoCapture} />
      </section>
    </Stack>
  );
}
