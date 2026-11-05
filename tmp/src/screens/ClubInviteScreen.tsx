import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { useSchachTreffCopy } from '../components/schachTreff/copy';
import { supabase } from '../services/supabase';
import { prefetchRoute } from '../routeLoaders';

const inviteToken = /^[0-9a-f]{32}$/;
const roomId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default function ClubInviteScreen() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const t = useSchachTreffCopy();
  const language = useOptionalLanguage()?.language || 'de';
  const userId = user?.id;
  const [failure, setFailure] = useState<{ token: string; userId: string; code: string } | null>(null);

  useEffect(() => {
    if (!userId || isLoading || !inviteToken.test(token)) return;
    // Start loading the chat screen while the existing invite RPC validates membership.
    prefetchRoute('/chat');
    let active = true;
    const fail = (code: string) => {
      if (active) setFailure({ token, userId, code });
    };
    void supabase.rpc('join_club_by_invite', { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        fail(error.message);
      } else if (typeof data === 'string' && roomId.test(data)) {
        // The /chat screen mounts after the server has granted membership.
        // SPA navigation avoids a second document load and its visible flash.
        navigate('/chat?' + new URLSearchParams({ club: data }), { replace: true });
      } else {
        fail('');
      }
    }, () => fail(''));
    return () => { active = false; };
  }, [token, userId, isLoading, navigate]);

  const code = failure?.token === token && failure.userId === userId ? failure.code : null;
  const error = code !== null && Object.hasOwn(t.roomErrors, code)
    ? t.roomErrors[code as keyof typeof t.roomErrors]
    : t.error;
  const signIn = '/profile?' + new URLSearchParams({ returnTo: '/schach-treff/einladung/' + token });

  // Do not flash a temporary invitation page during auth or a successful join.
  // Keep loading feedback available to screen readers only.
  if (inviteToken.test(token) && (isLoading || (userId && code === null))) {
    return <span className="sr-only" role="status" aria-live="polite">{t.loading}</span>;
  }

  return <section className="schach-treff" lang={language === 'ua' ? 'uk' : language}>
    <h1>{t.title}</h1>
    {!inviteToken.test(token) ? <p role="alert">{t.roomErrors.invite_invalid}</p>
      : code !== null ? <p role="alert">{error}</p>
      : !userId && !isLoading ? <Link to={signIn}>{t.login}</Link>
      : <p role="status">{t.loading}</p>}
  </section>;
}
