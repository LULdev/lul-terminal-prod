/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

function lazyPage<T extends Record<string, React.ComponentType<unknown>>>(
  loader: () => Promise<T>,
  exportName: keyof T,
) {
  return React.lazy(() =>
    loader().then((m) => ({ default: m[exportName] as React.ComponentType<unknown> })),
  );
}

export const FAQPage = lazyPage(() => import('./FAQPage'), 'FAQPage');
export const InviteFriendsPage = lazyPage(() => import('./InviteFriendsPage'), 'InviteFriendsPage');
export const NetToolkitPage = lazyPage(() => import('./NetToolkitPage'), 'NetToolkitPage');
export const IdentityForgePage = lazyPage(() => import('./IdentityForgePage'), 'IdentityForgePage');
export const TextLabPage = lazyPage(() => import('./TextLabPage'), 'TextLabPage');
export const ColorLabPage = lazyPage(() => import('./ColorLabPage'), 'ColorLabPage');
export const ChaosGeneratorPage = lazyPage(() => import('./ChaosGeneratorPage'), 'ChaosGeneratorPage');
export const ToolVaultPage = lazyPage(() => import('./ToolVaultPage'), 'ToolVaultPage');
export const MemeGeneratorPage = lazyPage(() => import('./MemeGeneratorPage'), 'MemeGeneratorPage');
export const ImageHostingPage = lazyPage(() => import('./ImageHostingPage'), 'ImageHostingPage');
export const PastePage = lazyPage(() => import('./PastePage'), 'PastePage');
export const ProxyDatabasePage = lazyPage(() => import('./ProxyDatabasePage'), 'ProxyDatabasePage');
export const FreePremiumAccountsPage = lazyPage(() => import('./FreePremiumAccountsPage'), 'FreePremiumAccountsPage');
export const ProfilePage = lazyPage(() => import('./ProfilePage'), 'ProfilePage');
export const AdminDashboardPage = lazyPage(() => import('./AdminDashboardPage'), 'AdminDashboardPage');
export const UserDashboardPage = lazyPage(() => import('./UserDashboardPage'), 'UserDashboardPage');
export const TerminalStatsPage = lazyPage(() => import('./TerminalStatsPage'), 'TerminalStatsPage');
export const StatusPage = lazyPage(() => import('./StatusPage'), 'StatusPage');
export const LeaderboardPage = lazyPage(() => import('./LeaderboardPage'), 'LeaderboardPage');
export const GamesPage = lazyPage(() => import('./GamesPage'), 'GamesPage');
export const MyActivityPage = lazyPage(() => import('./MyActivityPage'), 'MyActivityPage');

export const NewsPanel = lazyPage(() => import('../news/NewsPanel'), 'NewsPanel');

export function TabPageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-mono text-slate-500">
      Loading…
    </div>
  );
}