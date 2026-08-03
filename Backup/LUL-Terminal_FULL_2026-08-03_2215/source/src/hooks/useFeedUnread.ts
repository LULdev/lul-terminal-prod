/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasUnreadChangelog, markLocalChangelogRead } from '../lib/changelogUnread';
import { fetchNewsMeta } from '../lib/news';
import { hasUnreadNews, markLocalNewsRead, readLocalNewsLastVersion } from '../lib/newsUnread';

export const FEED_READ_EVENT = 'lul-feed-read';

export type FeedReadDetail = { type: 'changelog' | 'news' };

/** Unread badges for menu — isolated from App tab switches and live timers. */
export function useFeedUnread() {
  const { user, isLoggedIn } = useAuth();
  const [newsFeedVersion, setNewsFeedVersion] = useState('0.0.0');
  const [readTick, setReadTick] = useState(0);

  const bumpReadTick = useCallback(() => setReadTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    const loadMeta = () => {
      fetchNewsMeta()
        .then((m) => {
          if (alive) setNewsFeedVersion(m.feedVersion || '0.0.0');
        })
        .catch(() => {});
    };
    const tick = () => {
      if (document.hidden) return;
      loadMeta();
    };
    tick();
    const t = setInterval(tick, 60_000);
    const onVisible = () => {
      if (!document.hidden) loadMeta();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const onRead = () => bumpReadTick();
    window.addEventListener(FEED_READ_EVENT, onRead);
    return () => window.removeEventListener(FEED_READ_EVENT, onRead);
  }, [bumpReadTick]);

  const changelogUnread = useMemo(() => {
    if (isLoggedIn) return hasUnreadChangelog(user?.changelogLastReadVersion);
    void readTick;
    return hasUnreadChangelog(localStorage.getItem('lul_changelog_last_read'));
  }, [isLoggedIn, user?.changelogLastReadVersion, readTick]);

  const newsUnread = useMemo(() => {
    if (newsFeedVersion === '0.0.0') return false;
    if (isLoggedIn) {
      const serverLast = user?.newsLastReadVersion ?? null;
      const localLast = readLocalNewsLastVersion();
      const effectiveLast = serverLast && localLast
        ? (serverLast >= localLast ? serverLast : localLast)
        : serverLast ?? localLast;
      return hasUnreadNews(effectiveLast, newsFeedVersion);
    }
    void readTick;
    return hasUnreadNews(readLocalNewsLastVersion(), newsFeedVersion);
  }, [isLoggedIn, user?.newsLastReadVersion, newsFeedVersion, readTick]);

  return { changelogUnread, newsUnread, newsFeedVersion, bumpReadTick };
}

export function notifyFeedRead(type: FeedReadDetail['type']) {
  window.dispatchEvent(new CustomEvent(FEED_READ_EVENT, { detail: { type } }));
}

/** Guest-only unread badge clear — logged-in visits sync via tab_visit analytics. */
export function markChangelogVisited(isLoggedIn: boolean) {
  if (isLoggedIn) return;
  markLocalChangelogRead();
  notifyFeedRead('changelog');
}

/** Guest-only unread badge clear — logged-in visits sync via tab_visit analytics. */
export function markNewsVisited(isLoggedIn: boolean, feedVersion: string) {
  if (isLoggedIn) return;
  if (feedVersion && feedVersion !== '0.0.0') {
    markLocalNewsRead(feedVersion);
    notifyFeedRead('news');
  }
}