'use client';

import type { FormEvent } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatePanel } from '@/components/ui/state-panel';
import { activityLevelOptions, goalTypeOptions, sexOptions, trainingFrequencyOptions } from '@/lib/profile/constants';
import { flattenProfileFieldErrors, profileFormSchema } from '@/lib/profile/validation';
import type { DailyTargets, ProfileFieldErrors, ProfileSnapshot, ProfileUpdateResult } from '@/types/profile';
import { NumberField } from '@/components/profile/number-field';
import { ProfileChoiceGroup } from '@/components/profile/profile-choice-group';
import { StatWidget } from '@/components/ui/stat-widget';

type ProfileTargetFormProps = {
  initialProfile: ProfileSnapshot;
};

function getDefaults(profile: ProfileSnapshot) {
  return {
    age: profile.values?.age,
    sex: profile.values?.sex,
    heightCm: profile.values?.heightCm,
    weightKg: profile.values?.weightKg,
    goalType: profile.values?.goalType,
    activityLevel: profile.values?.activityLevel,
    trainingFrequencyPerWeek: profile.values?.trainingFrequencyPerWeek,
  };
}

function GoalSummary({ targets }: { targets: DailyTargets }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatWidget label="Calories" value={`${targets.dailyCalories}`} helper="Daily target" tone="accent" />
      <StatWidget label="Protein" value={`${targets.proteinGrams} g`} helper={targets.explanation.proteinBasisLabel} />
      <StatWidget label="Carbs" value={`${targets.carbGrams} g`} helper="Daily target" />
      <StatWidget label="Fat" value={`${targets.fatGrams} g`} helper="Daily target" />
    </div>
  );
}

export function ProfileTargetForm({ initialProfile }: ProfileTargetFormProps) {
  const defaults = useMemo(() => getDefaults(initialProfile), [initialProfile]);
  const [savedProfile, setSavedProfile] = useState<ProfileSnapshot>(initialProfile);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    const formData = new FormData(event.currentTarget);
    const parsed = profileFormSchema.safeParse({
      age: formData.get('age'),
      sex: formData.get('sex'),
      heightCm: formData.get('heightCm'),
      weightKg: formData.get('weightKg'),
      goalType: formData.get('goalType'),
      activityLevel: formData.get('activityLevel'),
      trainingFrequencyPerWeek: formData.get('trainingFrequencyPerWeek'),
    });

    if (!parsed.success) {
      setFieldErrors(flattenProfileFieldErrors(parsed.error) as ProfileFieldErrors);
      setFormError('A few details need attention before the estimate can be updated.');
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json().catch(() => null)) as ProfileUpdateResult | null;

      if (!response.ok || !payload?.ok) {
        setFieldErrors(payload?.ok === false ? payload.fieldErrors ?? {} : {});
        setFormError(payload?.ok === false ? payload.message : 'The profile could not be updated. Please try again.');
        return;
      }

      setSavedProfile(payload.profile);
      setFormSuccess('Targets updated. The rest of the app will now use this new daily starting point.');
    });
  }

  return (
    <div className="space-y-6">
      {savedProfile.targets ? (
        <Card tone="hero">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Current targets</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Current targets</h2>

          <div className="mt-6">
            <GoalSummary targets={savedProfile.targets} />
          </div>

          <p className="mt-5 text-sm text-slate-600">
            Maintenance {savedProfile.targets.explanation.maintenanceCalories} kcal · {savedProfile.targets.explanation.goalAdjustmentLabel}
          </p>
        </Card>
      ) : (
        <StatePanel
          variant="empty"
          title="Set your profile once and start with sensible targets"
          description="You can update this anytime. The goal is a clear, trustworthy estimate, not a medical prescription."
        />
      )}

      <Card>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Profile setup</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Estimate your targets</h3>
          </div>

          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
          ) : null}

          {formSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{formSuccess}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <NumberField
              id="age"
              name="age"
              label="Age"
              defaultValue={defaults.age}
              min={18}
              max={80}
              placeholder="29"
              error={fieldErrors.age}
            />
            <NumberField
              id="heightCm"
              name="heightCm"
              label="Height"
              defaultValue={defaults.heightCm}
              min={120}
              max={230}
              placeholder="170"
              suffix="cm"
              error={fieldErrors.heightCm}
            />
          </div>

          <NumberField
            id="weightKg"
            name="weightKg"
            label="Weight"
            defaultValue={defaults.weightKg}
            min={35}
            max={300}
            step={0.1}
            placeholder="72.5"
            suffix="kg"
            error={fieldErrors.weightKg}
          />

          <ProfileChoiceGroup
            label="Sex used for the estimate"
            name="sex"
            value={defaults.sex}
            options={sexOptions}
            columns={2}
            error={fieldErrors.sex}
          />

          <ProfileChoiceGroup
            label="Current goal"
            name="goalType"
            value={defaults.goalType}
            options={goalTypeOptions}
            error={fieldErrors.goalType}
          />

          <ProfileChoiceGroup
            label="Typical activity level"
            name="activityLevel"
            value={defaults.activityLevel}
            options={activityLevelOptions}
            error={fieldErrors.activityLevel}
          />

          <ProfileChoiceGroup
            label="Training sessions per week"
            name="trainingFrequencyPerWeek"
            value={defaults.trainingFrequencyPerWeek}
            options={trainingFrequencyOptions.map((option) => ({ ...option }))}
            columns={2}
            error={fieldErrors.trainingFrequencyPerWeek}
          />

          <Button type="submit" fullWidth disabled={isPending}>
            {isPending ? 'Updating targets...' : 'Save targets'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
