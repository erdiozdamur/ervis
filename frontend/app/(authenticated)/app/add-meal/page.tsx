import { MealEntryForm } from '@/components/meal-entry/meal-entry-form';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';

export default function AddMealPage() {
  return (
    <Stack gap="xl">
      <section aria-labelledby="add-meal-title">
        <ScreenHeader eyebrow="Add meal" title="Add meal" />

        <MealEntryForm />
      </section>
    </Stack>
  );
}
