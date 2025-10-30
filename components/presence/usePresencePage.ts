'use client';
import { useEffect } from 'react';
import { useOrgPresence } from './PresenceProvider';

/**
 * Marks a page presence — e.g. dashboard, tasks, docs.
 * Avoids infinite re-tracking loops.
 */
export function usePresencePage(page: string) {
  const { setPage, me } = useOrgPresence();

  useEffect(() => {
    if (!me) return;
    if (me.page !== page) {
      setPage(page);
    }
    return () => {
      // clear only if leaving the page
      if (me?.page === page) setPage(null);
    };
  }, [page, me?.page]);
}
