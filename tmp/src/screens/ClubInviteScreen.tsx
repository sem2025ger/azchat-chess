import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDesktop } from '../components/schachTreff/useDesktop';
import { copy as t } from '../components/schachTreff/copy';
import { supabase } from '../services/supabase';
export default function ClubInviteScreen() {
  const { token='' }=useParams(), { user,isLoading }=useAuth(), desktop=useDesktop();
  const [state,setState]=useState<{token:string; joined?:boolean; error?:string}|null>(null);
  useEffect(() => {
    if (!user || isLoading || !/^[0-9a-f]{32}$/.test(token)) return;
    let current=true;
    void supabase.rpc('join_club_by_invite',{p_token:token}).then(result => {
      if (!current) return;
      if (result.error) setState({token,error:t.roomErrors[result.error.message as keyof typeof t.roomErrors] ?? t.error});
      else if (desktop) window.location.replace('/chat?club='+encodeURIComponent(result.data));
      else setState({token,joined:true});
    },() => { if (current) setState({token,error:t.error}); });
    return () => { current=false; };
  },[token,user,isLoading,desktop]);
  const current=state?.token===token ? state : null;
  return <section className="schach-treff" lang="de"><h1>{t.title}</h1>
    {!/^[0-9a-f]{32}$/.test(token) ? <p role="alert">{t.roomErrors.invite_invalid}</p> : current?.error ? <p role="alert">{current.error}</p> : current?.joined ? <><p role="status">{t.mobileRoomNotice}</p><Link to="/chat" replace>{t.openChat}</Link></> : !user && !isLoading ? <Link to={'/profile?returnTo='+encodeURIComponent('/schach-treff/einladung/'+token)}>{t.login}</Link> : <p role="status">{t.loading}</p>}
  </section>;
}
