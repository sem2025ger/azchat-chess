import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { individualTournamentInput, listIndividualTournaments, saveIndividualTournament,
  createIndividualEventsApi, liveIndividualEvents, type IndividualTournament } from '../../services/individualTournaments';
import type { IndividualOrganizerDraft } from '../../services/teamTournaments';
import { AiOrganizerPanel } from './AiOrganizerPanel';
import { tournamentCopy } from './copy';
import { IndividualEventList, IndividualEventView, individualEventError } from './IndividualTournamentEvents';

const emptyDraft: IndividualOrganizerDraft = { name: '', start_time: '', max_players: null };
const signIn = '/profile?returnTo=%2Fspieltag';

export default function IndividualTournamentCreate() {
  const { session, isLoading } = useAuth();
  const { language } = useLanguage();
  const tr = tournamentCopy(language);
  if (isLoading && !session) return <p role="status">{tr('loading')}</p>;
  const member = session && !session.user.is_anonymous ? session : null;
  return <IndividualWorkspace key={member?.user.id ?? 'guest'}
    organizerId={member?.user.id} token={member?.access_token} />;
}

function IndividualWorkspace({ organizerId, token }: { organizerId?: string; token?: string }) {
  const { language } = useLanguage();
  const tr = tournamentCopy(language);
  const manualLabel = tr('createHubManual');
  const aiLabel = tr('individualAiTitle');
  const [params, setParams] = useSearchParams();
  const [published, setPublished] = useState<string | null>(null);
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [draft, setDraft] = useState(emptyDraft);
  const [records, setRecords] = useState<IndividualTournament[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(Boolean(organizerId));
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [aiSession, setAiSession] = useState(0);
  const request = useRef<AbortController | null>(null);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  const dateFormat = new Intl.DateTimeFormat(language === 'ua' ? 'uk' : language, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin',
  });

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!organizerId) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    void listIndividualTournaments(organizerId, controller.signal).then(items => {
      if (!controller.signal.aborted) {
        setRecords(current => [...current.filter(item => !items.some(row => row.id === item.id)), ...items].slice(0, 50));
      }
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [organizerId, reload]);

  async function save(input: IndividualOrganizerDraft, source: 'manual' | 'ai', publish = false) {
    if (!organizerId || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setSaved(false);
    setError(null);
    setPublished(null);
    try {
      const values = individualTournamentInput(input);
      const fingerprint = JSON.stringify(values);
      if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
      const row = publish
        ? await createIndividualEventsApi(token).command(retry.current.id, { action: 'publish', input: values }, controller.signal)
        : await saveIndividualTournament(retry.current.id, organizerId, values, controller.signal);
      if (controller.signal.aborted) return;
      setRecords(items => [row, ...items.filter(item => item.id !== row.id)].slice(0, 50));
      if (source === 'manual') setDraft(emptyDraft);
      else setAiSession(value => value + 1);
      retry.current = null;
      if (publish) {
        setPublished(row.id);
        setParams({ individual: row.id });
      } else setSaved(true);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function saveManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    void save(draft, 'manual', liveIndividualEvents && submitter?.getAttribute('value') === 'publish');
  }

  async function publishSaved(id: string) {
    if (!token || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      await createIndividualEventsApi(token).command(id, { action: 'publish', input: {} }, controller.signal);
      if (!controller.signal.aborted) {
        setPublished(id);
        setParams({ individual: id });
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const selected = params.get('individual');
  if (liveIndividualEvents && selected) return <>
    {published === selected && <p role="status">{tr('individualPublished')}</p>}
    <IndividualEventView key={selected} id={selected} token={token} format={dateFormat} tr={tr} />
  </>;

  return <section className="team-tournament-page team-create-hub" aria-label={tr('individualTournaments')}>
    <h2>{tr('individualTournaments')}</h2>
    <p>{token ? tr('individualPrivate') : <Link to={signIn}>{tr('createHubSignIn')}</Link>}</p>
    <div className="team-create-mobile-switch" role="group" aria-label={tr('createHubChoose')}>
      <button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>{manualLabel}</button>
      <button type="button" aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>{aiLabel}</button>
    </div>
    <div className="team-create-hub-grid" data-mobile-mode={mode}>
      <section className="team-create-block team-create-manual" aria-label={manualLabel}>
        <div className="team-create-block-body">
          <header><h3>{manualLabel}</h3></header>
          <form className="team-create-manual-form" onSubmit={saveManual}>
            <label>{tr('name')}
              <input name="name" required maxLength={120} value={draft.name ?? ''} disabled={busy || !token}
                onChange={event => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>{tr('m3Start')}
              <input name="start_time" type="datetime-local" required value={draft.start_time ?? ''} disabled={busy || !token}
                onChange={event => setDraft({ ...draft, start_time: event.target.value })} />
            </label>
            <label>{tr('individualMaxPlayers')}
              <input name="max_players" type="number" min="2" max="128" required value={draft.max_players ?? ''} disabled={busy || !token}
                onChange={event => setDraft({ ...draft, max_players: event.target.value ? event.target.valueAsNumber : null })} />
            </label>
            <button type="submit" disabled={busy || !token} className="team-create-primary">{tr('individualSave')}</button>
            {liveIndividualEvents && <>
              <p>{tr('individualPublishHint')}</p>
              <button type="submit" value="publish" disabled={busy || !token}>{tr('individualPublish')}</button>
            </>}
          </form>
        </div>
      </section>
      <section className="team-create-block team-create-ai">
        {token ? <AiOrganizerPanel key={aiSession} tr={tr} token={token} kind="individual" creating={busy} onApply={value => {
          setDraft({ name: value.name, start_time: value.start_time, max_players: value.max_players ?? null });
          setMode('manual');
        }} onCreate={value => void save({
          name: value.name, start_time: value.start_time, max_players: value.max_players ?? null,
        }, 'ai')} onPublish={liveIndividualEvents ? value => void save({
          name: value.name, start_time: value.start_time, max_players: value.max_players ?? null,
        }, 'ai', true) : undefined} /> : <div className="ai-organizer">
          <header className="ai-organizer-header">
            <h3>{aiLabel}</h3>
            <p>{tr('individualAiHint')}</p>
          </header>
        </div>}
      </section>
    </div>
    {error != null && <p role="alert">{individualEventError(error, tr)}</p>}
    {saved && <p role="status">{tr('individualSaved')}</p>}
    {token &&
      <section className="section-card">
        <h3>{tr('individualMine')}</h3>
        {loading && <p role="status">{tr('loading')}</p>}
        {loadError && <>
          <p role="alert">{tr('unavailable')}</p>
          <button type="button" onClick={() => setReload(value => value + 1)}>{tr('refresh')}</button>
        </>}
        {!loading && !loadError && !records.length && <p>{tr('empty')}</p>}
        <ul className="team-tournament-list">
          {records.map(item => <li key={item.id}>
            <strong>{item.name}</strong>
            <time dateTime={item.starts_at}>{dateFormat.format(new Date(item.starts_at))}</time>
            <span>{tr('individualMaxPlayers')} {item.max_players}</span>
            {liveIndividualEvents && Date.parse(item.starts_at) > Date.now() &&
              <button type="button" disabled={busy} onClick={() => void publishSaved(item.id)}>
                {tr('individualPublish')}
              </button>}
          </li>)}
        </ul>
      </section>}
    {liveIndividualEvents && <IndividualEventList token={token} format={dateFormat} tr={tr} />}
  </section>;
}
