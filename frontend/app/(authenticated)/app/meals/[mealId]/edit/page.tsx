import { redirect } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { requireCurrentUser } from '@/lib/auth/session';
import { getOwnedMealEditorSnapshot } from '@/services/meals/meal-editor-service';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { StatePanel } from '@/components/ui/state-panel';
import { buttonStyles } from '@/components/ui/button';
import { MealEditorExperience } from '@/components/meals/meal-editor-experience';

type MealEditPageProps = {
  params: {
    mealId: string;
  };
};

export default async function MealEditPage({ params }: MealEditPageProps) {
  const user = await requireCurrentUser();
  const meal = await getOwnedMealEditorSnapshot(user.id, params.mealId);

  if (!meal) {
    return (
      <Stack gap="xl">
        <ScreenHeader
          eyebrow="Edit meal"
          title="This meal could not be found"
          description="The saved meal may have been removed, or it may belong to a different signed-in account."
        />

        <StatePanel
          variant="error"
          title="The meal editor is unavailable"
          description="Return to history or today and open another meal."
          action={
            <Link href={'/app/history' as Route} className={buttonStyles({ variant: 'secondary' })}>
              Back to history
            </Link>
          }
        />
      </Stack>
    );
  }

  if (meal.status === 'DRAFT') {
    redirect(`/app/add-meal/review/${meal.mealId}` as Route);
  }

  return (
    <Stack gap="xl">
      <section aria-labelledby="meal-editor-title">
        <ScreenHeader eyebrow="Edit meal" title="Edit meal" description={meal.dateLabel} />
      </section>

      <MealEditorExperience initialMeal={meal} />
    </Stack>
  );
}
