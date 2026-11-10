import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import { createAiOrganizerApi, type AiOrganizerDraft, type AiOrganizerMessage, type AiOrganizerLanguage } from '../../services/teamTournaments';
import { tournamentErrorMessage, type TournamentCopy } from './copy';
import { useLanguage } from '../../context/LanguageContext';
import { startBoundedAudioRecording, type AudioCapture } from '../../utils/audioCapture';

type DraftKey = keyof AiOrganizerDraft;
const draftFields: DraftKey[] = ['name', 'start_time', 'registration_deadline', 'boards_per_team', 'min_teams', 'max_teams'];
const emptyDraft = (): AiOrganizerDraft => ({
  name: null, start_time: null, registration_deadline: null,
  boards_per_team: null, min_teams: null, max_teams: null,
});
function fieldValid(key: DraftKey, value: string | number | null, draft: AiOrganizerDraft): boolean {
  if (key === 'name') return typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
  if (key === 'start_time' || key === 'registration_deadline')
    return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value);
  if (!Number.isInteger(value)) return false;
  if (key === 'boards_per_team') return Number(value) >= 1 && Number(value) <= 16;
  if (key === 'min_teams') return Number(value) >= 2 && Number(value) <= 16;
  return Number(value) >= (draft.min_teams ?? 2) && Number(value) <= 16;
}
function errors(failure: unknown, tr: TournamentCopy) {
  const code = failure instanceof Error ? failure.message : '';
  if (code === 'provider_unavailable') return tr('aiOrganizerUnavailable');
  if (code === 'provider_not_configured') return tr('aiOrganizerNotConfigured');
  if (code === 'rate_limited') return tr('aiOrganizerRateLimited');
  return tournamentErrorMessage(code, tr);
}
export function AiOrganizerPanel({ tr, token, onApply, onCreate, creating }: {
  tr: TournamentCopy;
  token: string;
  onApply: (draft: AiOrganizerDraft) => void;
  onCreate: (draft: AiOrganizerDraft) => void;
  creating: boolean;
}) {
  const { language } = useLanguage();
  const lang = language as AiOrganizerLanguage;
  const inputId = useId();
  const historyRef = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const recorder = useRef<AudioCapture | null>(null);
  const generation = useRef(0);
  const [typed, setTyped] = useState('');
  const [history, setHistory] = useState<AiOrganizerMessage[]>([]);
  const [draft, setDraft] = useState<AiOrganizerDraft>(emptyDraft);
  const [overrides, setOverrides] = useState<Partial<AiOrganizerDraft>>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState<'plan' | 'recording' | 'transcribe' | null>(null);
  const [level, setLevel] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(0);
  const ready = hasDraft && draftFields.every(key => fieldValid(key, draft[key], draft));
  const last = history.at(-1);
  useEffect(() => {
    generation.current++;
    request.current?.abort(); request.current = null;
    recorder.current?.cancel(); recorder.current = null;
    setBusy(null); setLevel(0); setTyped(''); setHistory([]); setDraft(emptyDraft);
    setOverrides({}); setHasDraft(false); setError('');
    return () => {
      generation.current++;
      request.current?.abort(); request.current = null;
      recorder.current?.cancel(); recorder.current = null;
    };
  }, [token]);
  useEffect(() => {
    if (last?.role !== 'assistant') { setVisible(0); return; }
    setVisible(0);
    let count = 0;
    const timer = window.setInterval(() => {
      count = Math.min(last.text.length, count + 4);
      setVisible(count);
      if (count === last.text.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [last?.text]);
  useEffect(() => {
    const list = historyRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [history, visible, hasDraft, busy]);

  function update<K extends DraftKey>(field: K, value: AiOrganizerDraft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setOverrides(previous => ({ ...previous, [field]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = typed.trim();
    if (!text || !token || busy || creating || text.length > 1000) return;
    const turns: AiOrganizerMessage[] = [...history.slice(-10), { role: 'user', text }];
    const currentGeneration = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setHistory(turns); setTyped(''); setBusy('plan'); setError('');
    try {
      const response = await createAiOrganizerApi(import.meta.env.VITE_SERVER_URL, token)
        .plan(lang, turns, Object.keys(overrides).length ? overrides : undefined, controller.signal);
      if (controller.signal.aborted || generation.current !== currentGeneration) return;
      setDraft(response.draft);
      setHasDraft(true);
      const answer = (response.assistant_text + (response.question ? '\n' + response.question : '')).trim();
      setHistory(old => [...old, { role: 'assistant' as const, text: answer }].slice(-12));
    } catch (failure) {
      if (!controller.signal.aborted && generation.current === currentGeneration) {
        setError(errors(failure, tr));
        setTyped(text);
        setHistory(history);
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (generation.current === currentGeneration) setBusy(null);
    }
  }
  async function toggleMicrophone() {
    if (recorder.current) { recorder.current.stop(); return; }
    if (!micEnabled || busy || creating || !token) return;
    const currentGeneration = generation.current;
    setBusy('recording'); setError('');
    try {
      const capture = await startBoundedAudioRecording({
        onLevel: setLevel,
        onError: reason => {
          recorder.current = null;
          if (generation.current !== currentGeneration) return;
          setBusy(null);
          setError(reason === 'too_long' || reason === 'empty'
            ? tr('aiOrganizerTooLong') : tr('aiOrganizerMicUnavailable'));
        },
        onComplete: audio => {
          recorder.current = null;
          if (generation.current !== currentGeneration) return;
          const controller = new AbortController();
          request.current = controller; setBusy('transcribe');
          void createAiOrganizerApi(import.meta.env.VITE_SERVER_URL, token)
            .transcribe(lang, audio, controller.signal).then(result => {
              if (!controller.signal.aborted && generation.current === currentGeneration) {
                setTyped(result.text.slice(0, 1000));
              }
            }).catch(failure => {
              if (controller.signal.aborted || generation.current !== currentGeneration) return;
              if (failure instanceof Error && failure.message === 'provider_not_configured') {
                setMicEnabled(false);
                setError(tr('aiOrganizerNotConfigured'));
              } else { setError(errors(failure, tr)); }
            }).finally(() => {
              if (request.current === controller) request.current = null;
              if (generation.current === currentGeneration) setBusy(null);
            });
        },
      });
      if (generation.current !== currentGeneration) { capture.cancel(); return; }
      recorder.current = capture;
    } catch (failure) {
      if (generation.current !== currentGeneration) return;
      setBusy(null);
      setError(failure instanceof DOMException && failure.name === 'NotAllowedError'
        ? tr('aiOrganizerMicDenied') : tr('aiOrganizerMicUnavailable'));
    }
  }
  const labelFor: Record<DraftKey, string> = {
    name: tr('name'), start_time: tr('m3Start'), registration_deadline: tr('m3Deadline'),
    boards_per_team: tr('boards'), min_teams: tr('m3MinTeams'), max_teams: tr('m3MaxTeams'),
  };
  return <section className="ai-organizer" aria-label={tr('aiOrganizerTitle')}>
    <header className="ai-organizer-header">
      <div><h3>{tr('aiOrganizerTitle')}</h3><small>chessaz.de</small></div>
      <p>{tr('aiOrganizerDisclosure')}</p>
    </header>
    <div ref={historyRef} className="ai-organizer-history" role="log" aria-label={tr('aiOrganizerTitle')} aria-live="polite" aria-relevant="additions text">
      {!history.length && <p className="ai-organizer-intro">{tr('aiOrganizerEmpty')}</p>}
      {history.map((turn, index) => <div key={index}
        className={'ai-organizer-bubble ' + (turn.role === 'user' ? 'ai-organizer-user' : 'ai-organizer-assistant')}>
        {turn.role === 'assistant' && index === history.length - 1 ? turn.text.slice(0, visible) : turn.text}
      </div>)}
      {busy === 'plan' && <p className="ai-organizer-status" role="status">{tr('aiOrganizerThinking')}</p>}
      {hasDraft && <article className="ai-organizer-draft" aria-label={tr('aiOrganizerDraft')}>
        <h4>{tr('aiOrganizerDraft')}</h4>
        <p>{tr('aiOrganizerEdit')}</p>
        <div className="ai-organizer-fields">
          {draftFields.map(key => {
            const missing = !fieldValid(key, draft[key], draft);
            const numeric = key === 'boards_per_team' || key === 'min_teams' || key === 'max_teams';
            return <label key={key} className={missing ? 'ai-organizer-field-missing' : ''}>
              <span>{labelFor[key]}{missing && <small> · {tr('aiOrganizerMissing')}</small>}</span>
              <input name={key} value={draft[key] ?? ''} required
                type={numeric ? 'number' : key === 'name' ? 'text' : 'datetime-local'}
                maxLength={key === 'name' ? 120 : undefined}
                min={numeric ? key === 'boards_per_team' ? 1 : 2 : undefined}
                max={numeric ? 16 : undefined}
                onChange={event => update(key,
                  (numeric ? event.target.value === '' ? null : Number(event.target.value) :
                    event.target.value || null) as never)} />
            </label>;
          })}
        </div>
        {ready ? <p className="ai-organizer-status">{tr('aiOrganizerReady')}</p> :
          <p className="ai-organizer-status">{tr('aiOrganizerMissingStart')}</p>}
        <div className="ai-organizer-draft-actions">
          <button type="button" disabled={!ready || !!busy || creating} onClick={() => onApply(draft)}>
            {tr('aiOrganizerApply')}
          </button>
          <button type="button" className="ai-organizer-primary" disabled={!ready || !!busy || creating}
            onClick={() => onCreate(draft)}>{tr('aiOrganizerCreate')}</button>
        </div>
      </article>}
    </div>
    {error && <p role="alert" className="ai-organizer-error">{error}</p>}
    {busy === 'recording' && <div className="ai-organizer-recording" role="status">
      <span>{tr('aiOrganizerRecording')}</span>
      <span className="ai-organizer-wave" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) =>
          <i key={index} style={{ height: Math.max(4, Math.round((0.2 + level * (0.5 + Math.sin(index * 2.1) ** 2)) * 31)) + 'px' }} />)}
      </span>
    </div>}
    {busy === 'transcribe' && <p role="status" className="ai-organizer-status">{tr('aiOrganizerTranscribing')}</p>}
    <form onSubmit={event => void submit(event)} className="ai-organizer-composer">
      <label className="sr-only" htmlFor={inputId}>{tr('aiOrganizerPrompt')}</label>
      <input id={inputId} value={typed} maxLength={1000}
        disabled={!!busy || creating} placeholder={tr('aiOrganizerPrompt')}
        onChange={event => setTyped(event.target.value)} />
      {micEnabled && <button type="button" aria-label={busy === 'recording' ? tr('aiOrganizerStop') : tr('aiOrganizerVoice')}
        aria-pressed={busy === 'recording'} disabled={!!busy && busy !== 'recording' || creating}
        onClick={() => void toggleMicrophone()}>
        {busy === 'recording' ? <Square size={18} /> : <Mic size={18} />}
      </button>}
      <button type="submit" aria-label={tr('aiOrganizerSend')}
        disabled={!!busy || creating || !typed.trim()}><Send size={18} /></button>
    </form>
  </section>;
}
