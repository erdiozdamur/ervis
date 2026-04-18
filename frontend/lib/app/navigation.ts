import type { Route } from 'next';

export type AppNavigationKey = 'dashboard' | 'profile';

export const appNavigationItems = [
  { key: 'dashboard', label: 'Panel', href: '/app' as Route, icon: 'today' as const },
  { key: 'profile', label: 'Profil', href: '/app/profile' as Route, icon: 'profile' as const },
] as const;
