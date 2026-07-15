import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { viteImageHostPlugin } from './server/viteImageHostPlugin.mjs';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), viteImageHostPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 520,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('react-dom')
                || id.includes('scheduler')
                || /[/\\]react[/\\]/.test(id)
              ) return 'vendor-react';
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-recharts';
              if (id.includes('/motion/') || id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('@google/genai')) return 'vendor-genai';
              if (id.includes('lucide-react')) return 'vendor-icons';
            }
            if (!id.includes('node_modules')) {
              if (id.includes('/data/changelog')) return 'data-changelog';
              if (id.includes('/data/faqData')) return 'data-faq';
              if (id.includes('/data/achievements')) return 'data-achievements';
              if (id.includes('/data/toolVault/')) return 'data-toolvault';
              if (id.includes('/changelog/ChangelogPanel')) return 'feed-changelog';
              if (id.includes('/news/NewsPanel')) return 'feed-news';
              if (id.includes('/diagnostics/TerminalDiagnosticsPane')) return 'shell-diagnostics';
              if (id.includes('AdminDashboardPage') || id.includes('AdminShell') || id.includes('AdminOverviewPanel')) return 'admin-dashboard';
              if (id.includes('AdminModerationPanel')) return 'admin-moderation';
              if (id.includes('AdminUsersPanel')) return 'admin-users';
              if (/AdminProxy(?:Pipeline|Checker|Scraper|Custom)/.test(id)) return 'admin-proxy';
              if (id.includes('AdminXmlLinkScraperPanel') || id.includes('scraper/ScraperMonitorUi')) {
                return 'admin-scraper';
              }
              if (id.includes('AdminAnalyticsPanel')) return 'admin-analytics';
              if (id.includes('AdminPastesPanel')) return 'admin-pastes';
              if (id.includes('AdminNewsPanel')) return 'admin-news';
              if (id.includes('AdminPageVisibilityPanel')) return 'admin-visibility';
              if (id.includes('AdminSystemPulsePanel')) return 'admin-pulse';
              if (id.includes('AdminColonDbPanel')) return 'admin-colon-db';
              if (id.includes('AdminShoutboxPanel')) return 'admin-shoutbox';
              if (id.includes('AdminImagesPanel')) return 'admin-images';
              if (id.includes('AdminContentPanel')) return 'admin-content';
              if (id.includes('AdminLeaderboardsPanel')) return 'admin-leaderboards';
              if (id.includes('AdminPersonaPanel')) return 'admin-persona';
              if (id.includes('AdminVaultPanel')) return 'admin-vault';
              if (id.includes('AdminProxyDbPanel')) return 'admin-proxy-db';
              if (id.includes('AdminVisitorsPanel')) return 'admin-visitors';
              if (id.includes('AdminReferralsPanel')) return 'admin-referrals';
              if (id.includes('AdminEventsPanel')) return 'admin-events';
              if (id.includes('AdminOnlinePanel')) return 'admin-online';
              if (id.includes('AdminHeatmapPanel')) return 'admin-heatmap';
              if (id.includes('AdminAchievementsPanel')) return 'admin-achievements';
              if (id.includes('AdminScraperPoolPanel')) return 'admin-scraper-pool';
              if (id.includes('AdminCheckerPanel')) return 'admin-checker';
              if (id.includes('AdminReportsPanel')) return 'admin-reports';
              if (id.includes('AdminChangelogPanel')) return 'admin-changelog';
              if (id.includes('AdminAvatarsPanel')) return 'admin-avatars';
              if (id.includes('AdminStoragePanel')) return 'admin-storage';
              return undefined;
            }
            if (id.includes('lucide-react')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Ignore runtime JSON stores (post views, analytics, auth, etc.) — writing them
      // during dev API calls was triggering Vite full-page reloads on Changelog/News.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: [
                '**/node_modules/**',
                '**/dist/**',
                '**/.git/**',
                '**/data/**',
              ],
            },
      proxy: {
        '/imgflip-cdn': {
          target: 'https://i.imgflip.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/imgflip-cdn/, ''),
        },
      },
    },
  };
});
