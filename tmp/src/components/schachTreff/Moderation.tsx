import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { supabase } from '../../services/supabase';
import { useSchachTreffCopy } from './copy';
import { moderationEnabled, refreshUnreadCounts } from './unread';
import './moderation.css';

export type ClubMessage = {
  id: string;
  author_id: string;
  body: string | null;
  created_at: string;
  kind?: 'text' | 'challenge';
  deleted_at?: string | null;
  hidden_at?: string | null;
};
export type ModerationAction = { kind: 'delete' | 'report'; messageId: string } | { kind: 'reports' | 'clear' | 'revoke' };
type ReportReason = 'spam' | 'abuse' | 'other';
type Report = { message_id: string; body: string; kind: 'text' | 'challenge'; hidden: boolean; reasons: ReportReason[] };
export const inviteCacheKey = (clubId: string) => 'schach-treff-invite:' + clubId;

export function MessageActions({ message, own, moderator, challenge, open, t }: {
  message: ClubMessage; own: boolean; moderator: boolean; challenge?: boolean;
  open: (action: ModerationAction) => void;
  t: Pick<ReturnType<typeof useSchachTreffCopy>, 'messageActions' | 'deleteMessage' | 'reportMessage'>;
}) {
  if (!moderationEnabled || message.deleted_at) return null;
  const canDelete = !challenge && message.kind !== 'challenge' && (own || moderator);
  if (own && !canDelete) return null;

  function select(event: MouseEvent<HTMLButtonElement>, kind: 'delete' | 'report') {
    const details = event.currentTarget.closest('details');
    if (details) {
      details.open = false;
      details.querySelector('summary')?.focus();
    }
    open({ kind, messageId: message.id });
  }
  return <details className="st-message-actions" onKeyDown={event => {
    if (event.key === 'Escape') {
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus();
    }
  }}>
    <summary aria-label={t.messageActions}>⋯</summary>
    <div className="st-message-action-buttons">
      {canDelete && <button type="button" onClick={event => select(event, 'delete')}>{t.deleteMessage}</button>}
      {!own && <button type="button" onClick={event => select(event, 'report')}>{t.reportMessage}</button>}
    </div>
  </details>;
}

export function ModerationDialog({ clubId, action, close, refresh, onRevoked, onNotice }: {
  clubId: string;
  action: ModerationAction;
  close: () => void;
  refresh: () => Promise<void>;
  onRevoked?: () => void;
  onNotice: (notice: string) => void;
}) {
  const t = useSchachTreffCopy();
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const reasons = { spam: t.reportSpam, abuse: t.reportAbuse, other: t.reportOther };
  const titles = { delete: t.deleteMessage, report: t.reportMessage, reports: t.reports, clear: t.clearChat, revoke: t.revokeInvites };

  useEffect(() => {
    const element = dialog.current;
    const origin = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, []);

  useEffect(() => {
    if (action.kind !== 'reports') return;
    let active = true;
    void supabase.rpc('list_club_message_reports', { p_club_id: clubId }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(t.error);
      else setReports(data ?? []);
    });
    return () => { active = false; };
  }, [action.kind, clubId, t.error]);

  async function submit(messageId?: string, restore = false) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const result = action.kind === 'report'
        ? await supabase.rpc('report_club_message', { p_message_id: action.messageId, p_reason: reason })
        : action.kind === 'clear'
          ? await supabase.rpc('clear_club_chat', { p_club_id: clubId })
          : action.kind === 'revoke'
            ? await supabase.rpc('revoke_club_invites', { p_club_id: clubId })
            : await supabase.rpc(restore ? 'restore_club_message' : 'delete_club_message', {
              p_message_id: action.kind === 'delete' ? action.messageId : messageId,
            });
      if (result.error) throw result.error;
      if (action.kind === 'revoke') {
        try { window.sessionStorage.removeItem(inviteCacheKey(clubId)); } catch { /* Storage can be unavailable. */ }
        onRevoked?.();
        onNotice(t.invitesRevoked);
      } else {
        if (action.kind === 'report') onNotice(t.reported);
        refreshUnreadCounts();
        void refresh().catch(() => { /* The regular feed refresh retries. */ });
      }
      if (action.kind === 'reports') {
        setPendingDelete(null);
        setReports(rows => rows?.filter(row => row.message_id !== messageId) ?? []);
      } else close();
    } catch (failure) {
      const code = (failure as { message?: string })?.message;
      setError(code === 'has_challenge' ? t.challengeDeleteBlocked : code === 'already_reported' ? t.alreadyReported
        : code === 'report_limit' ? t.reportLimit : t.error);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <dialog className="st-moderation-dialog" aria-labelledby={headingId} ref={dialog}
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <h2 id={headingId}>{titles[action.kind]}</h2>
    {action.kind === 'reports' ? <>
      {reports === null ? !error && <p role="status">{t.loading}</p> : reports.length === 0 ? <p>{t.noReports}</p> :
        <ul className="st-moderation-reports">{reports.map(report => <li key={report.message_id}>
          <p>{report.body}</p>
          <small>{report.reasons.map(value => reasons[value]).join(' · ')}</small>
          {report.hidden && <small>{t.hiddenMessage}</small>}
          <div className="st-moderation-buttons">
            {report.kind !== 'challenge' && <button type="button" disabled={busy} onClick={() => setPendingDelete(report.message_id)}>{t.deleteMessage}</button>}
            <button type="button" disabled={busy} onClick={() => void submit(report.message_id, true)}>{t.restoreMessage}</button>
          </div>
          {pendingDelete === report.message_id && <>
            <p>{t.confirmDelete}</p>
            <div className="st-moderation-buttons">
              <button type="button" disabled={busy} onClick={() => void submit(report.message_id)}>{t.deleteMessage}</button>
              <button type="button" disabled={busy} onClick={() => setPendingDelete(null)}>{t.cancel}</button>
            </div>
          </>}
        </li>)}</ul>}
      <button type="button" disabled={busy} onClick={close}>{t.close}</button>
    </> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      {action.kind === 'report' ? <label>{t.reportReason}
        <select value={reason} onChange={event => setReason(event.target.value as ReportReason)}>
          {Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label> : <p>{action.kind === 'delete' ? t.confirmDelete : action.kind === 'clear' ? t.confirmClear : t.confirmRevoke}</p>}
      <div className="st-moderation-buttons">
        <button autoFocus type="button" disabled={busy} onClick={close}>{t.cancel}</button>
        <button type="submit" disabled={busy}>{titles[action.kind]}</button>
      </div>
    </form>}
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
