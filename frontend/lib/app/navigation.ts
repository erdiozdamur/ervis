import type { Route } from 'next';

export type AppNavigationKey = 'today' | 'addMeal' | 'history' | 'profile';

export const appNavigationItems = [
  { key: 'today', label: 'Today', href: '/app' as Route, icon: 'today' as const },
  { key: 'addMeal', label: 'Add', href: '/app/add-meal' as Route, icon: 'plus' as const },
  { key: 'history', label: 'History', href: '/app/history' as Route, icon: 'history' as const },
  { key: 'profile', label: 'Profile', href: '/app/profile' as Route, icon: 'profile' as const },
] as const;
