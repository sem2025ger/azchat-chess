import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { moderationEnabled, UnreadBadge } from './unread';

type Props = { label: string; search: string; className: string; href?: '/chat' | '/world-chat' };
export default function GeneralRoomLink({ label, search, className, href = '/chat' }: Props) {
  const active = !new URLSearchParams(search).has('club');
  const [worldClubId, setWorldClubId] = useState<string | null>(null);
  useEffect(() => {
    if (!moderationEnabled || href !== '/world-chat') return;
    let activeRequest = true;
    void supabase.from('chess_clubs').select('id').eq('slug', 'world-chat').maybeSingle().then(({ data, error }) => {
      if (activeRequest) setWorldClubId(!error ? data?.id ?? null : null);
    });
    return () => { activeRequest = false; };
  }, [href]);
  return <a className={className} href={href} aria-current={active ? 'page' : undefined}><span className="st-general-label">{label}</span>{moderationEnabled && (href === '/chat' ? <UnreadBadge /> : worldClubId && <UnreadBadge clubId={worldClubId} />)}</a>;
}
