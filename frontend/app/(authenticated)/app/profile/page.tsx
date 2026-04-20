import { requireCurrentUser } from '@/lib/auth/session';
import { ProfileTargetForm } from '@/components/profile/profile-target-form';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Card } from '@/components/ui/card';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusPill } from '@/components/ui/status-pill';
import { getUserProfileSnapshot } from '@/services/profile/profile-service';
import { SignOutButton } from '@/components/auth/sign-out-button';

export default async function ProfilePage() {
  const user = await requireCurrentUser();
  const profile = await getUserProfileSnapshot(user.id);

  return (
    <Stack gap="xl">
      <section>
        <ProfileTargetForm initialProfile={profile} />
      </section>

      <StatePanel
        variant="success"
        title="Kişiye özel olarak kaydedildi"
        description="İstediğin zaman güncelleyebilirsin."
      />

      <section aria-labelledby="profile-title">
        <ScreenHeader eyebrow="Hesabın" title="Profil" />

        <Card tone="hero">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 id="profile-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {user.name || 'Kullanıcı'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{user.email}</p>
            </div>
            <StatusPill tone="success">Güvenli</StatusPill>
          </div>
        </Card>

        <Card tone="subtle" className="mt-4">
          <p className="text-sm leading-6 text-slate-600">Bu cihazdaki oturumu sonlandır.</p>
          <div className="mt-4">
            <SignOutButton fullWidth />
          </div>
        </Card>
      </section>
    </Stack>
  );
}
