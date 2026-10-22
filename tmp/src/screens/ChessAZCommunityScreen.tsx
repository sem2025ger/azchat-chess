import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Globe, Users, MessageCircle, Trophy, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabase';

type Club = { id: string; name: string; description: string };
type Message = { id: string; author_id: string; body: string; created_at: string };
type ClubEvent = {
  id: string; title: string; format: 'bullet' | 'blitz' | 'rapid';
  min_players: number; max_players: number; status: string; created_at: string;
};
type Participant = { event_id: string; user_id: string };
type ScheduledTournament = {
  id: string; title: string; format: 'bullet' | 'blitz' | 'rapid';
  min_players: number; max_players: number; status: string;
  registration_opens_at: string; starts_at: string;
};
type TournamentEntry = { tournament_id: string; user_id: string };
type Words = Record<'welcome' | 'subtitle' | 'join' | 'login' | 'membersOnly' | 'messages' | 'send' |
  'messagePlaceholder' | 'events' | 'create' | 'eventPlaceholder' | 'participate' | 'withdraw' |
  'ready' | 'players' | 'loading' | 'failed' | 'success' | 'emptyMessages' | 'emptyEvents' |
  'noClub' | 'foundation' | 'submit' | 'joined', string>;

const en: Words = {
  welcome: 'ChessAZ Deutsch', subtitle: 'A chess community for German-speaking players',
  join: 'Join community', login: 'Sign in to join the community',
  membersOnly: 'Join the club to see discussions and events',
  messages: 'Club discussion', send: 'Send', messagePlaceholder: 'Write a message to the club…',
  events: 'Club Pulse · event proposals', create: 'Propose event', eventPlaceholder: 'e.g. Blitz tonight?',
  participate: 'I am interested', withdraw: 'Withdraw', ready: 'Enough interested players',
  players: 'players', loading: 'Loading community…', failed: 'Unable to load or save club data. The community database may not be enabled yet.',
  success: 'Saved', emptyMessages: 'No messages yet. Start the conversation.',
  emptyEvents: 'No event proposals yet. Suggest one.',
  noClub: 'The founding club is not configured yet.',
  foundation: 'Event proposals gather players; automatic tournament scheduling is not live yet.',
  submit: 'Publishing…', joined: 'Member'
};
const de: Words = {
  welcome: 'ChessAZ Deutsch', subtitle: 'Die Schach-Community für deutschsprachige Spieler',
  join: 'Community beitreten', login: 'Zum Beitritt anmelden',
  membersOnly: 'Tritt dem Club bei, um Gespräche und Veranstaltungen zu sehen',
  messages: 'Club-Chat', send: 'Senden', messagePlaceholder: 'Schreibe eine Nachricht…',
  events: 'Club Pulse · Event-Vorschläge', create: 'Event vorschlagen', eventPlaceholder: 'z. B. Blitz heute Abend?',
  participate: 'Ich bin dabei', withdraw: 'Zurückziehen', ready: 'Genügend Interessierte',
  players: 'Teilnehmende', loading: 'Community wird geladen…', failed: 'Clubdaten konnten nicht geladen oder gespeichert werden. Die Datenbank ist möglicherweise noch nicht aktiviert.',
  success: 'Gespeichert', emptyMessages: 'Noch keine Nachrichten. Starte das Gespräch.',
  emptyEvents: 'Noch keine Events. Schlage eins vor.',
  noClub: 'Der Gründungsclub ist noch nicht eingerichtet.',
  foundation: 'Event-Vorschläge sammeln Interessierte; die automatische Turnierplanung ist noch nicht aktiv.',
  submit: 'Wird veröffentlicht…', joined: 'Mitglied'
};
const ru: Words = {
  welcome: 'ChessAZ Deutsch', subtitle: 'Шахматное сообщество для немецкоязычных игроков',
  join: 'Вступить в клуб', login: 'Войдите, чтобы вступить в клуб',
  membersOnly: 'Вступите в клуб, чтобы видеть сообщения и события',
  messages: 'Обсуждения клуба', send: 'Отправить', messagePlaceholder: 'Написать сообщение клубу…',
  events: 'Club Pulse · предложения событий', create: 'Предложить событие', eventPlaceholder: 'Например, блиц сегодня вечером?',
  participate: 'Я участвую', withdraw: 'Отменить участие', ready: 'Достаточно участников',
  players: 'участников', loading: 'Загрузка сообщества…', failed: 'Не удалось загрузить или сохранить данные клуба. Возможно, база сообщества ещё не активирована.',
  success: 'Сохранено', emptyMessages: 'Сообщений пока нет. Начните обсуждение.',
  emptyEvents: 'Событий пока нет. Предложите первое.',
  noClub: 'Первый клуб ещё не настроен.',
  foundation: 'Сбор желающих работает отдельно; автоматическое создание турниров пока не подключено.',
  submit: 'Публикация…', joined: 'Участник'
};

export default function ChessAZCommunityScreen() {
  const { language } = useLanguage();
  const t = language === 'de' ? de : language === 'ru' ? ru : en;
  const { user, isLoading: authLoading } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [member, setMember] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tournaments, setTournaments] = useState<ScheduledTournament[]>([]);
  const [tournamentEntries, setTournamentEntries] = useState<TournamentEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventFormat, setEventFormat] = useState<'bullet' | 'blitz' | 'rapid'>('blitz');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const { data: found, error: clubError } = await supabase.from('chess_clubs')
      .select('id,name,description').eq('slug', 'chessaz-deutsch').maybeSingle();
    if (clubError) throw clubError;
    setClub(found as Club | null);
    if (!found || !user) {
      setMember(false); setMessages([]); setEvents([]); setParticipants([]);
      setTournaments([]); setTournamentEntries([]);
      return;
    }
    const { data: joined, error: memberError } = await supabase.from('chess_club_members')
      .select('user_id').eq('club_id', found.id).eq('user_id', user.id).maybeSingle();
    if (memberError) throw memberError;
    const active = Boolean(joined);
    setMember(active);
    if (!active) {
      setMessages([]); setEvents([]); setParticipants([]);
      setTournaments([]); setTournamentEntries([]);
      return;
    }
    const [messageResult, eventResult, tournamentResult] = await Promise.all([
      supabase.from('chess_club_messages').select('id,author_id,body,created_at')
        .eq('club_id', found.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('chess_club_events')
        .select('id,title,format,min_players,max_players,status,created_at')
        .eq('club_id', found.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('chess_club_tournaments')
        .select('id,title,format,min_players,max_players,status,registration_opens_at,starts_at')
        .eq('club_id', found.id).eq('status', 'scheduled')
        .gte('starts_at', new Date().toISOString()).order('starts_at').limit(30)
    ]);
    if (messageResult.error) throw messageResult.error;
    if (eventResult.error) throw eventResult.error;
    if (tournamentResult.error) throw tournamentResult.error;
    const nextTournaments = (tournamentResult.data ?? []) as ScheduledTournament[];
    setTournaments(nextTournaments);
    if (nextTournaments.length) {
      const { data, error: entryError } = await supabase.from('chess_club_tournament_entries')
        .select('tournament_id,user_id').in('tournament_id', nextTournaments.map(e => e.id));
      if (entryError) throw entryError;
      setTournamentEntries((data ?? []) as TournamentEntry[]);
    } else {
      setTournamentEntries([]);
    }
    const nextMessages = (messageResult.data ?? []) as Message[];
    const nextEvents = (eventResult.data ?? []) as ClubEvent[];
    setMessages([...nextMessages].reverse());
    setEvents(nextEvents);
    if (nextEvents.length) {
      const { data, error: participantError } = await supabase
        .from('chess_club_event_participants').select('event_id,user_id')
        .in('event_id', nextEvents.map(e => e.id));
      if (participantError) throw participantError;
      setParticipants((data ?? []) as Participant[]);
    } else {
      setParticipants([]);
    }
    const ids = [...new Set(nextMessages.map(m => m.author_id))];
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id,username').in('id', ids);
      setNames(Object.fromEntries((data ?? []).map(p => [p.id, p.username])));
    } else {
      setNames({});
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const update = async (initial = false) => {
      try {
        await refresh();
        if (active) setError('');
      } catch {
        if (active) setError(t.failed);
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    if (!authLoading) void update(true);
    // Poll only while this screen is visible. Realtime publication is not assumed.
    const timer = window.setInterval(() => {
      if (!authLoading && !document.hidden) void update();
    }, 12000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh, authLoading, t.failed]);

  const perform = async (fn: () => PromiseLike<{ error: { message: string } | null }>): Promise<boolean> => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await fn();
      if (result.error) throw result.error;
      await refresh();
      setNotice(t.success);
      return true;
    } catch {
      setError(t.failed);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!club || !user || !member || !message.trim() || busy) return;
    const body = message.trim();
    const saved = await perform(() => supabase.from('chess_club_messages')
      .insert({ club_id: club.id, author_id: user.id, body }));
    if (saved) setMessage('');
  };
  const proposeEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!club || !user || !member || eventTitle.trim().length < 4 || busy) return;
    const title = eventTitle.trim();
    const saved = await perform(() => supabase.from('chess_club_events').insert({
      club_id: club.id, created_by: user.id, title, format: eventFormat,
      min_players: 4, max_players: 16
    }));
    if (saved) setEventTitle('');
  };
  const membershipAction = () => {
    if (!club || !user || busy) return;
    void perform(() => supabase.from('chess_club_members')
      .insert({ club_id: club.id, user_id: user.id, role: 'member' }));
  };
  const toggleParticipation = (item: ClubEvent, participating: boolean) => {
    if (!user || busy) return;
    void perform(() => participating
      ? supabase.from('chess_club_event_participants')
          .delete().eq('event_id', item.id).eq('user_id', user.id)
      : supabase.from('chess_club_event_participants')
          .insert({ event_id: item.id, user_id: user.id }));
  };

  const toggleTournamentEntry = (item: ScheduledTournament, registered: boolean) => {
    if (!user || busy) return;
    void perform(() => registered
      ? supabase.from('chess_club_tournament_entries')
          .delete().eq('tournament_id', item.id).eq('user_id', user.id)
      : supabase.from('chess_club_tournament_entries')
          .insert({ tournament_id: item.id, user_id: user.id }));
  };

  const surface = 'rounded-2xl border border-white/10 bg-neutral-900/75 p-4 md:p-6 shadow-xl';
  const button = 'rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-neutral-950 disabled:opacity-50';
  const input = 'w-full rounded-xl border border-white/15 bg-neutral-950/80 px-3 py-2.5 text-white outline-none focus:border-amber-400';
  return (
    <div className="w-full min-h-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-9 text-white">
      <header className={surface}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="rounded-xl bg-amber-400/10 p-3 text-amber-300"><Globe size={32} /></div>
          <div className="flex-1 min-w-52">
            <h1 className="text-2xl md:text-3xl font-bold text-amber-200">{t.welcome}</h1>
            <p className="mt-1 text-sm text-neutral-300">{t.subtitle}</p>
            <p className="mt-2 text-xs text-neutral-400">{t.foundation}</p>
          </div>
          {member && <span className="rounded-full bg-emerald-800/40 px-3 py-1 text-xs text-emerald-200">{t.joined}</span>}
        </div>
      </header>
      {(loading || authLoading) && <p className="mt-5 flex items-center gap-2"><Loader2 className="animate-spin" size={18} />{t.loading}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/40 p-3 text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-4 text-emerald-200">{notice}</p>}
      {!loading && !club && !error && <p className="mt-5">{t.noClub}</p>}
      {!loading && club && !member && (
        <section className={`${surface} mt-5 flex items-center justify-between gap-4`}>
          <p className="text-sm text-neutral-300">{user ? t.membersOnly : t.login}</p>
          {user && <button className={button} disabled={busy} onClick={membershipAction}>{t.join}</button>}
        </section>
      )}
      {club && member && !loading && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className={surface} aria-label={t.messages}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><MessageCircle size={20} />{t.messages}</h2>
            <div aria-live="polite" className="mb-4 max-h-[26rem] min-h-48 space-y-3 overflow-y-auto">
              {!messages.length && <p className="text-neutral-400">{t.emptyMessages}</p>}
              {messages.map(item => (
                <article key={item.id} className="rounded-xl border border-white/5 bg-black/30 p-3">
                  <p className="mb-1 text-xs text-amber-200">{names[item.author_id] ?? (item.author_id === user?.id ? t.joined : 'ChessAZ')}
                    <time className="ml-2 text-neutral-500" dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'ru-RU')}
                    </time>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
                </article>
              ))}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
              <input aria-label={t.messagePlaceholder} maxLength={1200} required value={message}
                onChange={e => setMessage(e.target.value)} placeholder={t.messagePlaceholder} className={input} />
              <button className={button} disabled={busy || !message.trim()}>{t.send}</button>
            </form>
          </section>
          <section className={surface} aria-label={t.events}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Trophy size={20} />{t.events}</h2>
            <form onSubmit={proposeEvent} className="mb-5 flex flex-col gap-2">
              <input required minLength={4} maxLength={100} aria-label={t.eventPlaceholder}
                value={eventTitle} onChange={e => setEventTitle(e.target.value)}
                placeholder={t.eventPlaceholder} className={input} />
              <div className="flex gap-2">
                <select value={eventFormat} aria-label="Time control" onChange={e => setEventFormat(e.target.value as ClubEvent['format'])}
                  className={`${input} max-w-40`}>
                  <option value="bullet">Bullet</option><option value="blitz">Blitz</option><option value="rapid">Rapid</option>
                </select>
                <button className={`${button} flex-1`} disabled={busy || eventTitle.trim().length < 4}>{t.create}</button>
              </div>
            </form>
            <div className="max-h-[32rem] space-y-3 overflow-y-auto">
              {!events.length && <p className="text-neutral-400">{t.emptyEvents}</p>}
              {events.map(item => {
                const signups = participants.filter(p => p.event_id === item.id);
                const participating = signups.some(p => p.user_id === user?.id);
                return (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <h3 className="font-semibold break-words">{item.title}</h3>
                    <p className="mt-1 flex items-center gap-2 text-xs text-neutral-300">
                      <Users size={14} /> {signups.length}/{item.max_players} {t.players} · {item.format}
                    </p>
                    {signups.length >= item.min_players && <p className="my-2 text-xs text-emerald-200">{t.ready}</p>}
                    <button className="mt-3 rounded-lg border border-amber-300/40 px-3 py-2 text-sm text-amber-200 disabled:opacity-50"
                      disabled={busy || item.status !== 'collecting' || (!participating && signups.length >= item.max_players)}
                      onClick={() => toggleParticipation(item, participating)}>
                      {participating ? t.withdraw : t.participate}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
          <section className={`${surface} xl:col-span-2`} aria-label="ChessAZ tournament calendar">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Trophy size={20} /> {language === 'de' ? 'Turnierkalender' : language === 'ru' ? 'Календарь турниров' : 'Tournament calendar'}
            </h2>
            <p className="mb-4 text-xs text-neutral-400">
              {language === 'de'
                ? 'Geplante Turniere und Anmeldung; automatische Partien und Paarungen sind noch nicht aktiviert.'
                : language === 'ru'
                  ? 'Расписание и запись участников; автоматический запуск партий и жеребьёвка пока не включены.'
                  : 'Upcoming dates and signups; automated games and pairings are not yet enabled.'}
            </p>
            {!tournaments.length && <p className="text-neutral-400">
              {language === 'de' ? 'Noch keine Termine geplant.' : language === 'ru' ? 'Пока нет запланированных турниров.' : 'No tournaments scheduled yet.'}
            </p>}
            <div className="grid gap-3 md:grid-cols-2">
              {tournaments.map(item => {
                const count = tournamentEntries.filter(p => p.tournament_id === item.id).length;
                const registered = tournamentEntries.some(p => p.tournament_id === item.id && p.user_id === user?.id);
                const opened = Date.now() >= Date.parse(item.registration_opens_at);
                const title = language === 'de' ? 'Anmelden' : language === 'ru' ? 'Записаться' : 'Register';
                return (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-neutral-300">
                      {new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : language === 'ru' ? 'ru-RU' : 'en-GB',
                        { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(item.starts_at))}
                      {' · Europe/Berlin · '}{item.format} · {count}/{item.max_players}
                    </p>
                    <button type="button" className="mt-3 rounded-lg border border-amber-300/40 px-3 py-2 text-sm text-amber-200 disabled:opacity-50"
                      disabled={busy || (!registered && (!opened || count >= item.max_players))}
                      onClick={() => toggleTournamentEntry(item, registered)}>
                      {registered
                        ? (language === 'de' ? 'Abmelden' : language === 'ru' ? 'Отменить запись' : 'Withdraw')
                        : !opened
                          ? (language === 'de' ? 'Anmeldung noch geschlossen' : language === 'ru' ? 'Регистрация пока закрыта' : 'Registration not open yet')
                          : title}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
