import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { useSchachTreffCopy } from './copy';

export const moderationEnabled = import.meta.env.VITE_SCHACH_TREFF_MODERATION_ENABLED === 'true';
type UnreadRoom = { club_id: string; is_general: boolean; unread_count: number };
export const UnreadContext = createContext<UnreadRoom[]>([]);
const unreadChanged = 'schach-treff-unread-changed';

export function refreshUnreadCounts() {
  window.dispatchEvent(new Event(unreadChanged));
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const userId = user?.id;
  const [result, setResult] = useState<{ userId: string; rooms: UnreadRoom[] } | null>(null);

  useEffect(() => {
    if (!moderationEnabled || !userId) return;
    let current = true;
    let running = false;
    let queued = false;
    async function refresh() {
      if (!current || document.hidden || !userId) return;
      if (running) { queued = true; return; }
      running = true;
      try {
        const { data, error } = await supabase.rpc('get_club_unread_counts');
        if (current && !error) setResult({ userId, rooms: data ?? [] });
      } finally {
        running = false;
        if (queued) { queued = false; void refresh(); }
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 12000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(unreadChanged, refresh);
    return () => {
      current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(unreadChanged, refresh);
    };
  }, [userId]);

  return result?.userId === userId ? result?.rooms ?? [] : [];
}

export function useMarkClubRead(clubId: string | null, messageId: string | undefined, visible: boolean,
  feed: RefObject<HTMLElement | null>, userId: string | undefined) {
  const marked = useRef('');
  useEffect(() => {
    const element = feed.current;
    if (!moderationEnabled || !clubId || !messageId || !visible || !userId || !element) return;
    const key = JSON.stringify([userId, clubId, messageId]);
    let inView = typeof IntersectionObserver === 'undefined';
    let pending = false;
    let current = true;
    async function mark() {
      if (!inView || document.hidden || pending || marked.current === key) return;
      pending = true;
      try {
        const { error } = await supabase.rpc('mark_club_read', { p_club_id: clubId, p_message_id: messageId });
        if (!error) {
          if (current) marked.current = key;
          refreshUnreadCounts();
        }
      } finally { pending = false; }
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      void mark();
    });
    observer?.observe(element);
    document.addEventListener('visibilitychange', mark);
    // A subsequent poll can retry a transient failure even if no new message arrives.
    const timer = window.setInterval(mark, 12000);
    void mark();
    return () => {
      current = false;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', mark);
      window.clearInterval(timer);
    };
  }, [clubId, messageId, visible, feed, userId]);
}

export function UnreadBadge({ clubId }: { clubId?: string }) {
  const rooms = useContext(UnreadContext);
  const t = useSchachTreffCopy();
  const count = rooms.find(room => clubId ? room.club_id === clubId : room.is_general)?.unread_count;
  return count ? <span className="st-unread-badge" role="img" aria-label={t.unreadMessages + ' ' + count}>{count > 99 ? '99+' : count}</span> : null;
}

export function UnreadDot() {
  const rooms = useContext(UnreadContext);
  const t = useSchachTreffCopy();
  return rooms.some(room => room.unread_count > 0) ?
    <span role="img" className="absolute -right-1 -top-1 size-2 rounded-full bg-[#f1bb6b]" aria-label={t.unreadMessages} /> : null;
}
