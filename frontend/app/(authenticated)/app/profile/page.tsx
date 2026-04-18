import { requireCurrentUser } from '@/lib/auth/session';
import { ProfileTargetForm } from '@/components/profile/profile-target-form';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { StatePanel } from '@/components/ui/state-panel';
import { Icon } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { getUserProfileSnapshot } from '@/services/profile/profile-service';
import { SignOutButton } from '@/components/auth/sign-out-button';

export default async function ProfilePage() {
  const user = await requireCurrentUser();
  const profile = await getUserProfileSnapshot(user.id);

  return (
    <Stack gap="xl">
      <section aria-labelledby="profile-title">
        <ScreenHeader eyebrow="Profile" title="Profile" />

        <Card tone="hero">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Profile</p>
              <h1 id="profile-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {user.name || 'Your profile'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{user.email}</p>
            </div>
            <StatusPill tone="success">Protected</StatusPill>
          </div>
        </Card>
      </section>

      <section aria-labelledby="preferences-heading">
        <ScreenHeader eyebrow="Defaults" title="Defaults" />

        <Stack gap="md">
          <ListItem
            leading={<Icon name="today" className="h-5 w-5" />}
            title="Timezone"
            description="Europe/Istanbul"
            trailing={<span className="text-sm font-semibold text-slate-600">Istanbul</span>}
          />
          <ListItem
            leading={<Icon name="spark" className="h-5 w-5" />}
            title="AI meal review"
            description="Required"
            trailing={<span className="text-sm font-semibold text-slate-600">Required</span>}
          />
          <ListItem
            leading={<Icon name="target" className="h-5 w-5" />}
            title="Daily target"
            description="Per user"
            trailing={
              <span className="text-sm font-semibold text-slate-600">
                {profile.targets ? `${profile.targets.dailyCalories} kcal` : 'Not set'}
              </span>
            }
          />
        </Stack>
      </section>

      <section aria-labelledby="account-actions-heading">
        <ScreenHeader eyebrow="Account" title="Account" />

        <Card tone="subtle">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="account-actions-heading" className="text-base font-semibold text-slate-950">
                Signed in as {user.email}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Sign out on this device.
              </p>
            </div>
            <StatusPill tone="neutral">Account</StatusPill>
          </div>

          <div className="mt-5">
            <SignOutButton fullWidth />
          </div>
        </Card>
      </section>

      <section aria-labelledby="targets-heading">
        <ScreenHeader eyebrow="Targets" title="Targets" />

        <ProfileTargetForm initialProfile={profile} />
      </section>

      <StatePanel
        variant="success"
        title="Saved per user"
        description="You can update these any time."
      />
    </Stack>
  );
}
