import {useRegionalCopy} from '../i18n/regionalCopy';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Link2, Pin } from 'lucide-react';
import VorbereitungLink from '../components/spieler/VorbereitungLink';
import { useAuth } from '../context/AuthContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabase';
import { useSchachTreffCopy } from '../components/schachTreff/copy';
import '@fontsource/bodoni-moda/latin-600.css';
import '@fontsource/bodoni-moda/latin-ext-600.css';
import './SchachTreffDesktop.css';
import { ChallengeProvider, ChallengeButton, ChallengeMessage, useChallengeMessageIds } from '../components/schachTreff/Challenges';
import PlayerSummary from '../components/schachTreff/PlayerSummary';
import ClubRooms, { RoomTitle } from '../components/schachTreff/ClubRooms';
import GeneralRoomLink from '../components/schachTreff/GeneralRoomLink';

type Profile = { id: string; username: string };
import { inviteCacheKey, MessageActions, ModerationDialog, type ClubMessage, type ModerationAction } from '../components/schachTreff/Moderation';
import { moderationEnabled, useMarkClubRead } from '../components/schachTreff/unread';
import { SEEK_CONTROLS, isMissingSchema, mergeTimeline, resultMessageId, summarizeReactions, v2Enabled, type ChatGameResult, type Reaction, type ReactionSummary } from '../components/schachTreff/v2/core';
import { useV2Copy } from '../components/schachTreff/v2/copy';
import { useV2Copy2 } from '../components/schachTreff/v2/copy2';
import { DirectList, GameResultCard, GameViewer, PositionDialog, PositionMessage, refusalMessage, useBlock, useDirectChats, useOpenDirectChat } from '../components/schachTreff/v2/Stage2';
import { DEFAULT_POSITION } from 'chess.js';
import { loadV2Extras, type V2Extras } from '../components/schachTreff/v2/data';
import { Toast } from '../components/schachTreff/v2/Toast';
import { FeedbackButton, MembersPanel, MessageTools, ReactionBar, SeekButton, ThreadPanel, PositionTrigger, nameStyle } from '../components/schachTreff/v2/Parts';
type Panel = 'tournaments' | 'members' | 'ranking' | 'about';
const warned = new Set<string>();
export default function SchachTreffDesktop({ hideRooms = false }: { hideRooms?: boolean } = {}) {
 const regional=useRegionalCopy();
  const t=useSchachTreffCopy();
  const language=useOptionalLanguage()?.language||'de';
  const { user, isLoading } = useAuth();
  const [clubId, setClubId] = useState<string | null>(null);
  const [pin, setPin] = useState<{ body: string; author: string | null } | null>(null);
  const [canPin, setCanPin] = useState(false);
  const [pinAvailable, setPinAvailable] = useState(false);
  const [pinExpanded, setPinExpanded] = useState(false);
  const [pinMenu, setPinMenu] = useState(false);
  const [moderator, setModerator] = useState(false);
  const [privateAdmin, setPrivateAdmin] = useState(false);
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [moderationNotice, setModerationNotice] = useState('');
  const [inviteRevision, setInviteRevision] = useState(0);
  const refreshVersion = useRef(0);
  const chatMenuButton = useRef<HTMLButtonElement>(null);
  const [canInvite, setCanInvite] = useState(false);
  const [pinEdit, setPinEdit] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [member, setMember] = useState(false);
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [player, setPlayer] = useState<Profile | null>(null);
  const [notify, setNotify] = useState(false);
  const [v2Data, setV2Data] = useState<V2Extras | null>(null);
  const [thread, setThread] = useState<ClubMessage | null>(null);
  // One position composer: a new position (root null) or a reply that continues the position of a thread root.
  const [composer, setComposer] = useState<{ fen: string; root: ClubMessage | null } | null>(null);
  const [threadRevision, setThreadRevision] = useState(0);
  const [threadScroll, setThreadScroll] = useState(false);
  const threadScrolled = useCallback(() => setThreadScroll(false), []);
  const [viewing, setViewing] = useState<ChatGameResult | null>(null);
  const copy1 = useV2Copy();
  const copy2 = useV2Copy2();
  const [onlineIds, setOnlineIds] = useState<string[] | null>(null);
  // Supabase Presence counts actual connected participant IDs; never show a hard-coded online total.
  useEffect(() => {
    if (!v2Enabled || !clubId || !user?.id || !member) {
      setOnlineIds(null);
      return;
    }
    let live = true;
    const channel = supabase.channel('schach-treff-v2-presence:' + clubId, {
      config: { presence: { key: user.id } },
    });
    channel.on('presence', { event: 'sync' }, () => {
      if (live) setOnlineIds(Object.keys(channel.presenceState()));
    }).subscribe(status => {
      if (!live) return;
      if (status === 'SUBSCRIBED') {
        void channel.track({ joinedAt: Date.now() }).then(result => {
          if (live && result !== 'ok') setOnlineIds(null);
        }).catch(() => { if (live) setOnlineIds(null); });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setOnlineIds(null);
      }
    });
    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [clubId, member, user?.id]);
  const direct = useDirectChats(v2Enabled ? user?.id : undefined);
  const dmChat = v2Enabled ? direct.chats.find(chat => chat.clubId === clubId) : undefined;
  const block = useBlock(dmChat?.partnerId);
  const dmOpen = useOpenDirectChat();
  const isClub = new URLSearchParams(window.location.search).has('club');
  const feedRef = useRef<HTMLDivElement>(null);
  const followFeed = useRef(true);
  const newestMessage = messages.at(-1)?.id;
  useMarkClubRead(clubId, v2Data?.newestId ?? newestMessage, member && !loading && !isLoading, feedRef, user?.id);
  useEffect(() => { setThread(null); }, [clubId]);
  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (feed && followFeed.current) feed.scrollTop = feed.scrollHeight;
  }, [clubId, member, newestMessage, loading]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.title; document.title = t.title; return () => { document.title = previous; }; }, [t.title]);
  useEffect(() => { if (panel || player) dialog.current?.showModal(); else dialog.current?.close(); }, [panel, player]);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('club');
    const query = moderationEnabled ? supabase.from('chess_clubs').select('id,kind,is_open,slug') : supabase.from('chess_clubs').select('id');
    const club = await (requested && /^[0-9a-f-]{36}$/i.test(requested) ? query.eq('id',requested) : query.eq('slug','chessaz-deutsch')).maybeSingle();
    if (club.error) throw club.error;
    const clubData = club.data as { id: string; kind?: string; is_open?: boolean; slug?: string } | null;
    if (moderationEnabled && version !== refreshVersion.current) return;
    setClubId(clubData?.id ?? null);
    let pinnedAuthor: string | null = null;
    let pinMigrationAvailable = false;
    if (clubData) {
      const pinInfo = await supabase.from('chess_clubs').select('pinned_body,pinned_by').eq('id',clubData.id).maybeSingle();
      if (pinInfo.error) {
        const code = pinInfo.error.code;
        if (['42703','PGRST204','PGRST205'].includes(code)) {
          if (!warned.has('pin-migration')) { warned.add('pin-migration'); console.warn('Schach-Treff pin unavailable:', code); }
          setPin(null);
          setPinEdit(false);
        } else throw pinInfo.error;
      } else { pinMigrationAvailable = true; pinnedAuthor = pinInfo.data?.pinned_by ?? null; setPin(pinInfo.data?.pinned_body ? { body: pinInfo.data.pinned_body, author: pinnedAuthor } : null); }
    } else setPin(null);
    setPinAvailable(pinMigrationAvailable);
    if (!user || !clubData) { setModerator(false); setPrivateAdmin(false); setCanInvite(false); setCanPin(false); setMember(false); setMessages([]); setProfiles([]); setV2Data(null); return; }
    const membership = await supabase.from('chess_club_members').select('user_id,role').eq('club_id', clubData.id).eq('user_id', user.id).maybeSingle();
    if (membership.error) throw membership.error;
    if (moderationEnabled && version !== refreshVersion.current) return;
    if (moderationEnabled) {
      setModerator(['admin', 'moderator'].includes(membership.data?.role ?? ''));
      setPrivateAdmin(membership.data?.role === 'admin' && clubData.kind === 'room' && !clubData.is_open && clubData.slug !== 'chessaz-deutsch');
    }
    setMember(Boolean(membership.data));
    setCanInvite(Boolean(requested) && ['admin','moderator'].includes(membership.data?.role ?? ''));
    setCanPin(pinMigrationAvailable && ['admin','moderator'].includes(membership.data?.role ?? ''));
    if (!membership.data) { setMessages([]); setProfiles([]); setV2Data(null); return; }
    const feedQuery = (threaded = false) => {
      const query = (moderationEnabled
        ? supabase.from('chess_club_messages').select('id,author_id,body,created_at,kind,deleted_at,hidden_at')
        : supabase.from('chess_club_messages').select('id,author_id,body,created_at')).eq('club_id', clubData.id);
      // v2: thread replies are shown in the thread panel, not in the main feed.
      return (threaded ? query.is('parent_id', null) : query).order('created_at', { ascending: false }).limit(50);
    };
    let threaded = v2Enabled;
    const [firstFeed, members] = await Promise.all([
      feedQuery(threaded),
      supabase.from('chess_club_members').select('user_id').eq('club_id', clubData.id).order('joined_at').limit(200),
    ]);
    let feed = firstFeed;
    if (threaded && feed.error && isMissingSchema(feed.error.code)) {
      threaded = false;
      if (!warned.has('v2-migration')) { warned.add('v2-migration'); console.warn('Schach-Treff v2 schema unavailable:', feed.error.code); }
      feed = await feedQuery(false);
    }
    if (feed.error) throw feed.error;
    if (members.error) throw members.error;
    const ids = [...new Set([...members.data.map(m => m.user_id), ...feed.data.map(m => m.author_id), ...(pinnedAuthor ? [pinnedAuthor] : [])])];
    const people = ids.length ? await supabase.from('profiles').select('id,username').in('id', ids) : { data: [], error: null };
    if (people.error) throw people.error;
    const extras = threaded ? await loadV2Extras(clubData.id, feed.data.map(m => m.id), feed.data.length >= 50 ? feed.data.at(-1)?.created_at : undefined) : null;
    if ((moderationEnabled || v2Enabled) && version !== refreshVersion.current) return;
    setV2Data(extras);
    setProfiles(people.data ?? []); setRoster(members.data.map(m => m.user_id));
    setMessages([...feed.data].reverse() as ClubMessage[]);
  }, [user]);
  useEffect(() => {
    let active = true;
    const update = async () => {
      try { await refresh(); if (active) setError(''); }
      catch (e) {
        const code = (e as { code?: string }).code;
        if (active && code && ['PGRST205', '42P01'].includes(code)) {
          setMissing(true);
          if (!warned.has(code)) { warned.add(code); console.warn('Schach-Treff unavailable:', code); }
        } else if (active) setError(t.error);
      } finally { if (active) setLoading(false); }
    };
    if (!isLoading) void update();
    const timer = window.setInterval(() => { if (!document.hidden && !isLoading) void update(); }, 12000);
    return () => { active = false; if (moderationEnabled) refreshVersion.current++; window.clearInterval(timer); };
  }, [refresh, isLoading]);
  async function perform(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true); setError('');
    try { const result = await action(); if (result.error) throw result.error; await refresh(); return true; }
    catch (failure) { setError((v2Enabled && refusalMessage(failure, copy2)) || t.error); return false; } finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!user || !clubId || !member || busy || !body.trim()) return;
    if (await perform(() => supabase.from('chess_club_messages').insert({ club_id: clubId, author_id: user.id, body: body.trim() }))) setBody('');
    else if (dmChat) block.reload(); // e.g. blocked from another tab: show the real state in the header and composer
  }
  async function savePin(event: FormEvent) {
    event.preventDefault();
    if (!clubId || !pinAvailable || !canPin || busy) return;
    if (await perform(() => supabase.rpc('set_club_pin', { p_club_id: clubId, p_body: pinDraft }))) setPinEdit(false);
  }
  function openChatAction(action: ModerationAction) {
    chatMenuButton.current?.focus();
    setPinMenu(false);
    setModerationNotice('');
    setModerationAction(action);
  }
  async function toggleReaction(messageId: string, reaction: Reaction, mine: boolean) {
    if (!user || busy) return;
    await perform(() => mine
      ? supabase.from('chess_club_message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id).eq('reaction', reaction)
      : supabase.from('chess_club_message_reactions').insert({ message_id: messageId, user_id: user.id, reaction }));
  }
  async function sendPosition(fen: string, body: string) {
    if (!user || !clubId || !member || !composer) return false;
    const root = composer.root;
    const sent = await perform(() => supabase.from('chess_club_messages').insert({ club_id: clubId, author_id: user.id, body, fen, ...(root ? { parent_id: root.id } : {}) }));
    // A reply lives in the thread of the original position: show it there.
    if (sent && root) { setThread(root); setThreadRevision(value => value + 1); setThreadScroll(true); }
    return sent;
  }
  function stamp(value: string) {
    const date = new Date(value), now = new Date(), yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
    const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return date.toDateString() === now.toDateString() ? time : date.toDateString() === yesterday.toDateString() ? `${t.yesterday} ${time}` : `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time}`;
  }
  if (missing) return null;
  const hasChatActions = canPin || (moderationEnabled && (moderator || privateAdmin));
  const members = profiles.filter(p => roster.includes(p.id));
  const onlineCount = onlineIds?.length ?? null;
  // A DM partner I blocked cannot receive messages: say so in the composer instead of letting a send fail.
  const iBlocked = Boolean(dmChat && block.blocked);
  const finishedChallenges = new Set(v2Data?.results.map(result => result.challenge_id) ?? []);
  const v2 = v2Enabled && v2Data ? {
    summary: summarizeReactions(v2Data.reactions, user?.id), replies: v2Data.replyCounts, reactions: v2Data.reactionsAvailable,
    toggle: (id: string, reaction: Reaction, mine: boolean) => void toggleReaction(id, reaction, mine), openThread: setThread,
    fens: v2Data.fens, results: new Map(v2Data.results.map(result => [resultMessageId(result), result])),
    replyPosition: (message: ClubMessage, fen: string) => setComposer({ fen, root: message }), watch: setViewing,
    kindLabel: (control: string) => {
      const kind = SEEK_CONTROLS.find(item => item.value === control)?.kind;
      return kind === 'bullet' ? copy2.bullet : kind === 'rapid' ? copy1.rapid : copy1.blitz;
    },
  } : undefined;
  const timeline = v2 && v2Data?.results.length
    ? mergeTimeline(messages, v2Data.results, result => ({ id: resultMessageId(result), author_id: '', body: null, created_at: result.completed_at } as ClubMessage))
    : messages;
  return <section className={v2Enabled ? 'schach-treff st-v2' : 'schach-treff'} lang={language==="ua"?"uk":language} data-schach-treff-desktop>
    <ChallengeProvider clubId={clubId} me={user?.id ?? ''} people={profiles} enabled={member} finished={finishedChallenges}>
    <header><h1>{t.title}</h1>{import.meta.env.VITE_CLUBS_NRW_ENABLED === 'true' && <Link className="st-region-entry" to="/region/nrw" aria-label={regional('NRW-Regionalübersicht öffnen')}>NRW ↗</Link>}<div className="st-menu"><button aria-label={t.more} aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
      {(v2Enabled || menu) && <nav hidden={!menu} aria-label={t.more}>{(['tournaments', 'members', 'ranking', 'about'] as const).map(key => <button key={key} onClick={() => { setPanel(key); setMenu(false); }}>{t[key]}{key === 'tournaments' && <small>{t.soon}</small>}</button>)}{v2Enabled && <FeedbackButton />}</nav>}
    </div></header>
    {error && (v2Enabled ? <Toast message={error} closeLabel={t.close} onClose={() => setError('')} /> : <p role="alert">{error}</p>)}
    {(loading || isLoading) ? <p role="status">{t.loading}</p> : !clubId ? <p>{t.noClub}</p> : !member ? <div className="st-surface"><p>{t.joinHint}</p>{user ? <button disabled={busy} onClick={() => void perform(() => supabase.from('chess_club_members').insert({ club_id: clubId, user_id: user.id, role: 'member' }))}>{t.join}</button> : <Link to="/profile?returnTo=%2Fchat">{t.login}</Link>}</div> :
    <div className={hideRooms && v2Enabled ? 'st-columns st2-no-rooms' : 'st-columns'}>{!hideRooms && <aside className="st-surface st-rooms"><GeneralRoomLink label={t.general} search={window.location.search} className="st-general-link" /><ClubRooms currentClubId={clubId} heading={v2Enabled ? copy1.myClubs : undefined} />{v2Enabled && <DirectList currentClubId={clubId} />}</aside>}
      <section className="st-surface st-chat">
        {(isClub || hasChatActions || v2Enabled) && <div className="st-chat-header">
          {/* The rooms column already says "General chat": the feed headline is the room's motto (owner, 13 Nov). */}
          {v2Enabled && !isClub && <div className="st2-general-heading">
            <h2 className="st2-general-title st2-general-motto"><span className="st2-sr-only">{t.general}: </span>{copy1.subtitle.split(' ').flatMap((word, index) => [index ? ' ' : '', word.includes('-') ? <span key={index} className="st2-nowrap">{word}</span> : word])}</h2>
          </div>}
          {v2Enabled && !isClub && <div className="st2-chat-meta">
            <span className="st2-online" aria-label={onlineCount === null ? copy1.onlineNow : `${onlineCount} ${copy1.onlineNow}`} aria-live="polite">
              <span className="st2-online-dot" aria-hidden="true" /><strong>{onlineCount ?? '—'}</strong> {copy1.onlineNow}
            </span>
            <SeekButton />
          </div>}
          {isClub && <>
            <a className="st-back-general" href="/chat"><ArrowLeft size={16} aria-hidden="true" /><span>{t.general}</span></a>
            <h2>{dmChat ? <span className="st2-dm-title" style={nameStyle(dmChat.partnerId)}>{dmChat.partnerName}</span> : <RoomTitle clubId={clubId} />}</h2>
            {dmChat && <button type="button" className="st2-block" disabled={block.busy} onClick={() => void block.toggle()}>{block.blocked ? copy2.unblock : copy2.block}</button>}
            {canInvite && <RoomInvite key={clubId + '-' + inviteRevision} clubId={clubId} />}
            {v2Enabled && !dmChat && !hideRooms && <SeekButton />}
          </>}
          {hasChatActions && <div className="st-pin-menu" onKeyDown={event => {
            if (event.key === 'Escape' && pinMenu) {
              setPinMenu(false);
              event.currentTarget.querySelector('button')?.focus();
            }
          }}>
            <button type="button" ref={chatMenuButton} aria-label={moderationEnabled ? t.moderation : t.editPin} aria-expanded={pinMenu} onClick={() => setPinMenu(!pinMenu)}>⋯</button>
            {pinMenu && <div className="st-pin-actions">
              {canPin && <button type="button" onClick={() => {
                setPinMenu(false); setPinEdit(true); setPinDraft(pin?.body ?? '');
              }}>{t.editPin}</button>}
              {moderationEnabled && moderator && <button type="button" onClick={() => openChatAction({ kind: 'reports' })}>{t.reports}</button>}
              {moderationEnabled && privateAdmin && <>
                <button type="button" onClick={() => openChatAction({ kind: 'clear' })}>{t.clearChat}</button>
                <button type="button" onClick={() => openChatAction({ kind: 'revoke' })}>{t.revokeInvites}</button>
              </>}
            </div>}
          </div>}
        </div>}
        {pinAvailable && (pin || canPin) && (pinEdit && canPin ? <form onSubmit={savePin} className="st-pin-form">
          <input autoFocus aria-label={t.pinned} value={pinDraft} maxLength={500} onChange={e => setPinDraft(e.target.value)} />
          <button disabled={busy}>{t.pinAction}</button>
          <button type="button" onClick={() => setPinEdit(false)}>{t.cancel}</button>
        </form> : pin && <button type="button" className="st-pin" aria-expanded={pinExpanded}
          title={pinExpanded ? t.showLess : t.showMore} onClick={() => setPinExpanded(!pinExpanded)}>
          <Pin size={15} aria-hidden="true" /><span className="st-pin-title">{t.pinned}</span><span className="st-pin-text">{pin.body}</span>
        </button>)}
        <div className="st-messages" aria-live="polite" ref={feedRef} onScroll={event => {
          const feed = event.currentTarget;
          followFeed.current = feed.scrollHeight - feed.clientHeight - feed.scrollTop <= 64;
        }}>
          {!messages.length && !error && <p>{t.empty}</p>}
          <MessageItems messages={timeline} profiles={profiles} me={user?.id} onPlayer={setPlayer} stamp={stamp} moderator={moderator} openModeration={setModerationAction} v2={v2} />
        </div>
        {moderationEnabled && moderationNotice && (v2Enabled
          ? <Toast message={moderationNotice} tone="status" closeLabel={t.close} onClose={() => setModerationNotice('')} />
          : <p role="status">{moderationNotice}</p>)}
        {moderationEnabled && moderationAction && <ModerationDialog clubId={clubId} action={moderationAction}
          close={() => setModerationAction(null)} refresh={refresh} onNotice={setModerationNotice}
          onRevoked={() => setInviteRevision(value => value + 1)} />}
        {dmChat && <p className="st2-note st2-dm-note">{block.blocked ? copy2.blockedNote : copy2.directChat}</p>}
        {dmOpen.error && (v2Enabled ? <Toast message={dmOpen.error} closeLabel={t.close} onClose={dmOpen.clear} /> : <p role="alert">{dmOpen.error}</p>)}
        <form className="st-composer" onSubmit={send}>
          {/* Desktop: Seek sits in the header (general chat and club rooms) so the input stays wide. The compact
              mobile room view (hideRooms) keeps its approved composer layout. DMs challenge the partner here. */}
          {v2Enabled ? (dmChat ? <ChallengeButton composer targetUserId={dmChat.partnerId} disabled={iBlocked} /> : isClub && hideRooms ? <SeekButton /> : null) : <ChallengeButton composer />}
          {v2Enabled && <PositionTrigger label={copy2.sendPosition} disabled={iBlocked} onClick={() => setComposer({ fen: DEFAULT_POSITION, root: null })} />}
          <input aria-label={t.placeholder} placeholder={iBlocked ? copy2.composerBlocked : hideRooms ? t.shortPlaceholder : t.placeholder} value={body} onChange={e => setBody(e.target.value)} maxLength={1200} required={!v2Enabled} disabled={iBlocked} />
          <button className="st-send" disabled={busy || iBlocked || !body.trim()}>{t.send}</button>
        </form>
      </section>
      {v2Enabled && (thread && v2?.reactions
        ? <ThreadPanel key={thread.id} clubId={clubId} root={thread} people={profiles} onClose={() => setThread(null)} onChanged={() => void refresh()}
            revision={threadRevision} rootFen={v2.fens.get(thread.id)} scrollToEnd={threadScroll} onScrolled={threadScrolled}
            renderPosition={fen => <PositionMessage fen={fen} size={200} onReply={() => setComposer({ fen, root: thread })} />} />
        : <MembersPanel members={members} messages={messages} me={user?.id} onlineIds={onlineIds} onPlayer={setPlayer}
            onMessage={direct.available ? person => void dmOpen.open(person.id) : undefined} />)}
      {v2Enabled && composer && <PositionDialog initialFen={composer.fen} reply={Boolean(composer.root)} onSend={sendPosition} onClose={() => setComposer(null)} />}
      {v2Enabled && viewing && <GameViewer game={viewing} onClose={() => setViewing(null)} />}
    </div>}
    <dialog ref={dialog} className={v2Enabled && player ? 'st2-player-dialog' : undefined} aria-labelledby={player ? 'st-player-name' : undefined} onCancel={() => { setPanel(null); setPlayer(null); }} onClose={() => { setPanel(null); setPlayer(null); }}>
      <button className="st-close" onClick={() => { setPanel(null); setPlayer(null); }}>{t.close}</button>
      {/* Genuine ratings will be introduced by the future Glicko-2 task; do not display stored placeholder values here. */}
      {player ? <><PlayerSummary userId={player.id}><header className="st-player-header"><h2 id="st-player-name">{player.username}</h2><p>{t.noLocation}</p></header><dl className="st-player-ratings"><div><dt>{t.blitz}</dt><dd>—</dd></div><div><dt>{t.rapid}</dt><dd>—</dd></div></dl></PlayerSummary><div className="st-player-actions"><ChallengeButton targetUserId={player.id} beforeOpen={() => setPlayer(null)} />{v2Enabled && direct.available && player.id !== user?.id && <button type="button" onClick={() => { const id = player.id; setPlayer(null); void dmOpen.open(id); }}>{copy2.writePrivately}</button>}<VorbereitungLink onClick={()=>{setPlayer(null);setPanel(null);}}/></div></> : panel === 'tournaments' ? <><h2 className="st-display">{t.tournamentTitle}</h2><p>{t.tournamentText}</p><button aria-pressed={notify} onClick={() => setNotify(!notify)}>{notify ? t.notified : t.notify}</button></> : panel === 'about' ? <><h2>{t.about}</h2><p>{t.aboutText}</p></> : panel === 'ranking' ? <><h2>{t.ranking}</h2><p>{t.rankingSoon}</p></> : panel && <><h2>{t[panel]}</h2>{!members.length && !error && <p>{t.noMembers}</p>}{members.map(p => <div className="st-member" key={p.id}><button className="st-name" onClick={() => setPlayer(p)}>{p.username}</button></div>)}</>}
    </dialog>
    </ChallengeProvider>
  </section>;
}

type V2Items = {
  summary: Map<string, ReactionSummary[]>; replies: Map<string, number>; reactions: boolean;
  toggle: (id: string, reaction: Reaction, mine: boolean) => void; openThread: (message: ClubMessage) => void;
  fens: Map<string, string>; results: Map<string, ChatGameResult>; replyPosition: (message: ClubMessage, fen: string) => void;
  watch: (game: ChatGameResult) => void; kindLabel: (control: string) => string;
};
function MessageItems({ messages, profiles, me, onPlayer, stamp, moderator, openModeration, v2 }: {
  messages: ClubMessage[]; profiles: Profile[]; me?: string;
  onPlayer: (profile: Profile) => void; stamp: (value: string) => string;
  moderator: boolean; openModeration: (action: ModerationAction) => void; v2?: V2Items;
}) {
  const challengeIds = useChallengeMessageIds();
  const t = useSchachTreffCopy();
  const groups: ClubMessage[][] = [];
  for (const message of messages) {
    const previous = groups.at(-1)?.at(-1);
    const date = new Date(message.created_at);
    const previousDate = previous && new Date(previous.created_at);
    const newGroup = !previous || previous.author_id !== message.author_id
      || Boolean(v2?.results.has(message.id) || v2?.results.has(previous.id))
      || challengeIds.has(message.id) || challengeIds.has(previous.id)
      || !previousDate || date.toDateString() !== previousDate.toDateString()
      || date.getTime() - previousDate.getTime() < 0
      || date.getTime() - previousDate.getTime() > 5 * 60 * 1000;
    if (newGroup) groups.push([message]);
    else groups[groups.length - 1].push(message);
  }
  return <>{groups.map(group => {
    const own = group[0].author_id === me;
    const finished = v2?.results.get(group[0].id);
    if (v2 && finished) return <div key={group[0].id} className="st-message-group st2-result-group">
      <GameResultCard game={finished} kind={v2.kindLabel(finished.time_control)} onWatch={() => v2.watch(finished)} />
    </div>;
    return <div key={group[0].id} className={own ? 'st-message-group st-message-group-own' : 'st-message-group'}>
      {group.map((message, index) => {
        const author = profiles.find(profile => profile.id === message.author_id);
        const first = index === 0;
        const date = new Date(message.created_at);
        const exactTime = date.toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'medium' });
        const social = v2?.reactions && !challengeIds.has(message.id) && message.kind !== 'challenge' && !message.deleted_at && !message.hidden_at;
        const summary = v2?.summary.get(message.id) ?? [];
        return <article key={message.id}
          className={['st-message', own && 'st-message-own', !first && 'st-message-grouped'].filter(Boolean).join(' ')}
          title={exactTime} tabIndex={first ? undefined : 0} style={v2 ? nameStyle(message.author_id) : undefined}>
          {first && <span className="st-avatar" aria-hidden="true">{Array.from(author?.username ?? '?')[0]?.toLocaleUpperCase()}</span>}
          <div className="st-message-content">
            {first && <div className="st-message-heading">
              {author && <button type="button" className="st-name" onClick={() => onPlayer(author)}>{author.username}</button>}
              <time dateTime={message.created_at}>{stamp(message.created_at)}</time>
              {!own && <ChallengeButton targetUserId={message.author_id} icon />}
            </div>}
            {moderationEnabled && message.deleted_at ? <p className="st-moderation-status">{t.deleted}</p>
              : <ChallengeMessage messageId={message.id} body={message.body ?? ''} />}
            {moderationEnabled && message.hidden_at && <p className="st-moderation-status">{t.hiddenMessage}</p>}
            {v2 && !message.deleted_at && v2.fens.get(message.id) && <PositionMessage fen={v2.fens.get(message.id)!} onReply={fen => v2.replyPosition(message, fen)} />}
            {v2 && social && <>
              <ReactionBar summary={summary} replies={v2.replies.get(message.id) ?? 0}
                onToggle={(reaction, mine) => v2.toggle(message.id, reaction, mine)} onThread={() => v2.openThread(message)} />
              <MessageTools summary={summary} onToggle={(reaction, mine) => v2.toggle(message.id, reaction, mine)} onThread={() => v2.openThread(message)} />
            </>}
            {moderationEnabled && <MessageActions message={message} own={own} moderator={moderator}
              challenge={challengeIds.has(message.id)} open={openModeration} t={t} />}
          </div>
        </article>;
      })}
    </div>;
  })}</>;
}

function RoomInvite({ clubId }: { clubId: string }) {
  const t = useSchachTreffCopy();
  const cacheKey = inviteCacheKey(clubId);
  const mounted = useRef(false);
  const remembered = useRef('');
  const inFlight = useRef(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const noteTimer = useRef<number | undefined>(undefined);
  const fallbackInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(copyTimer.current);
      window.clearTimeout(noteTimer.current);
    };
  }, []);
  useEffect(() => {
    if (fallback) { fallbackInput.current?.focus(); fallbackInput.current?.select(); }
  }, [fallback]);

  function savedLink(): string | null {
    const valid = (value: string) => {
      try {
        const url = new URL(value);
        return url.origin === window.location.origin
          && /^\/schach-treff\/einladung\/[0-9a-f]{32}$/.test(url.pathname)
          && !url.search && !url.hash;
      } catch { return false; }
    };
    if (valid(remembered.current)) return remembered.current;
    try {
      const stored = window.sessionStorage.getItem(cacheKey);
      if (stored && valid(stored)) { remembered.current = stored; return stored; }
    } catch { /* Disabled or unavailable storage: retain in-memory link. */ }
    return null;
  }

  async function copyInvite() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setCopied(false);
    setFallback('');
    setNote('');
    window.clearTimeout(copyTimer.current);
    window.clearTimeout(noteTimer.current);
    try {
      let link = savedLink();
      if (!link) {
        const { data, error } = await supabase.rpc('create_club_invite', { p_club_id: clubId });
        if (error) throw error;
        if (moderationEnabled && !mounted.current) return;
        if (typeof data !== 'string' || !/^[0-9a-f]{32}$/.test(data)) throw new Error();
        link = window.location.origin + '/schach-treff/einladung/' + data;
        remembered.current = link;
        try { window.sessionStorage.setItem(cacheKey, link); }
        catch { /* Clipboard copying works without storage. */ }
      }
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        copyTimer.current = window.setTimeout(() => setCopied(false), 2500);
      } catch {
        setFallback(link);
      }
    } catch (error) {
      const code = (error as { message?: string }).message;
      setNote(code && Object.hasOwn(t.roomErrors, code)
        ? t.roomErrors[code as keyof typeof t.roomErrors] : t.error);
      if (code === 'invite_limit') noteTimer.current = window.setTimeout(() => setNote(''), 5000);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="st-invite-control">
    <button type="button" className="st-invite-trigger" disabled={busy}
      aria-label={copied ? t.linkCopied : t.inviteLink} onClick={() => void copyInvite()}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
      <span className="st-invite-label">{copied ? '✓ ' + t.linkCopied : t.inviteLink}</span>
      <span className="st-invite-mobile-status" role="status">{copied ? t.linkCopied : ''}</span>
    </button>
    {note && <p className="st-invite-note" role="status">{note}</p>}
    {fallback && <div className="st-invite-popover" role="group" aria-label={t.inviteLink}>
      <input ref={fallbackInput} value={fallback} readOnly aria-label={t.inviteLink}
        onFocus={event => event.currentTarget.select()} />
      <button type="button" onClick={() => setFallback('')}>{t.close}</button>
    </div>}
  </div>;
}
