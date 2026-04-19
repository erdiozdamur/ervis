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
      <StatWidget label="Kalori" value={`${targets.dailyCalories}`} helper="Günlük hedef" tone="accent" />
      <StatWidget label="Protein" value={`${targets.proteinGrams} g`} helper={targets.explanation.proteinBasisLabel} />
      <StatWidget label="Karbonhidrat" value={`${targets.carbGrams} g`} helper="Günlük hedef" />
      <StatWidget label="Yağ" value={`${targets.fatGrams} g`} helper="Günlük hedef" />
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
      setFormError('Tahmini güncellemeden önce bazı alanları kontrol et.');
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
        setFormError(payload?.ok === false ? payload.message : 'Profil güncellenemedi. Tekrar dene.');
        return;
      }

      setSavedProfile(payload.profile);
      setFormSuccess('Hedefler güncellendi. Uygulama artık bu günlük başlangıç noktasını kullanacak.');
    });
  }

  return (
    <div className="space-y-6">
      {savedProfile.targets ? (
        <Card tone="hero">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Güncel hedefler</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Güncel hedefler</h2>

          <div className="mt-6">
            <GoalSummary targets={savedProfile.targets} />
          </div>

          <p className="mt-5 text-sm text-slate-600">
            Koruma kalorisi {savedProfile.targets.explanation.maintenanceCalories} kcal · {savedProfile.targets.explanation.goalAdjustmentLabel}
          </p>
        </Card>
      ) : (
        <StatePanel
          variant="empty"
          title="Profilini bir kez ayarla, dengeli hedeflerle başla"
          description="İstediğin zaman güncelleyebilirsin. Bu hesap sadece başlangıç tahminidir, tıbbi öneri değildir."
        />
      )}

      <Card>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Profil kurulumu</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Hedeflerini hesapla</h3>
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
              label="Yaş"
              defaultValue={defaults.age}
              min={18}
              max={80}
              placeholder="29"
              error={fieldErrors.age}
            />
            <NumberField
              id="heightCm"
              name="heightCm"
              label="Boy"
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
            label="Kilo"
            defaultValue={defaults.weightKg}
            min={35}
            max={300}
            step={0.1}
            placeholder="72.5"
            suffix="kg"
            error={fieldErrors.weightKg}
          />

          <ProfileChoiceGroup
            label="Hesaplamada kullanılan cinsiyet"
            name="sex"
            value={defaults.sex}
            options={sexOptions}
            columns={2}
            error={fieldErrors.sex}
          />

          <ProfileChoiceGroup
            label="Hedefin"
            name="goalType"
            value={defaults.goalType}
            options={goalTypeOptions}
            error={fieldErrors.goalType}
          />

          <ProfileChoiceGroup
            label="Günlük aktivite düzeyi"
            name="activityLevel"
            value={defaults.activityLevel}
            options={activityLevelOptions}
            error={fieldErrors.activityLevel}
          />

          <ProfileChoiceGroup
            label="Haftalık antrenman sıklığı"
            name="trainingFrequencyPerWeek"
            value={defaults.trainingFrequencyPerWeek}
            options={trainingFrequencyOptions.map((option) => ({ ...option }))}
            columns={2}
            error={fieldErrors.trainingFrequencyPerWeek}
          />

          <Button type="submit" fullWidth disabled={isPending}>
            {isPending ? 'Hedefler güncelleniyor...' : 'Hedefleri kaydet'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
