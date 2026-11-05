import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { useSchachTreffCopy } from '../components/schachTreff/copy';
import { supabase } from '../services/supabase';

const inviteToken = /^[0-9a-f]{32}$/;
const roomId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default function ClubInviteScreen() {
  const { token = '' } = useParams();
  const { user, isLoading } = useAuth();
  const t = useSchachTreffCopy();
  const language = useOptionalLanguage()?.language || 'de';
  const userId = user?.id;
  const [failure, setFailure] = useState<{ token: string; userId: string; code: string } | null>(null);

  useEffect(() => {
    if (!userId || isLoading || !inviteToken.test(token)) return;
    let active = true;
    const fail = (code: string) => {
      if (active) setFailure({ token, userId, code });
    };
    void supabase.rpc('join_club_by_invite', { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        fail(error.message);
      } else if (typeof data === 'string' && roomId.test(data)) {
        // Reload the invited room with its new membership on any screen size.
        window.location.replace('/chat?' + new URLSearchParams({ club: data }));
      } else {
        fail('');
      }
    }, () => fail(''));
    return () => { active = false; };
  }, [token, userId, isLoading]);

  const code = failure?.token === token && failure.userId === userId ? failure.code : null;
  const error = code !== null && Object.hasOwn(t.roomErrors, code)
    ? t.roomErrors[code as keyof typeof t.roomErrors]
    : t.error;
  const signIn = '/profile?' + new URLSearchParams({ returnTo: '/schach-treff/einladung/' + token });

  return <section className="schach-treff" lang={language === 'ua' ? 'uk' : language}>
    <h1>{t.title}</h1>
    {!inviteToken.test(token) ? <p role="alert">{t.roomErrors.invite_invalid}</p>
      : code !== null ? <p role="alert">{error}</p>
      : !userId && !isLoading ? <Link to={signIn}>{t.login}</Link>
      : <p role="status">{t.loading}</p>}
  </section>;
}
