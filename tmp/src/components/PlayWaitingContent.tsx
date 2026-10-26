import { Check, Clock3, Copy, Swords, X } from 'lucide-react';
import './PlayWaitingContent.css';

type Props = {
  title: string;
  description: string;
  elapsed?: string;
  inviteUrl?: string;
  copied: boolean;
  copyLabel: string;
  cancelLabel: string;
  onCopy: () => void;
  onCancel: () => void;
};

// Presentation only: room creation, matchmaking and cancellation stay in PlayScreen.
export default function PlayWaitingContent({ title, description, elapsed, inviteUrl, copied, copyLabel, cancelLabel, onCopy, onCancel }: Props) {
  return (
    <section className="play-waiting-content" aria-label={title}>
      <div className="play-waiting-emblem" aria-hidden="true"><Swords size={29} strokeWidth={1.6} /></div>
      <h2 className="play-waiting-title">{title}</h2>
      <p className="play-waiting-description">{description}</p>
      {elapsed !== undefined && <div className="play-waiting-timer">
        <Clock3 size={21} strokeWidth={1.7} aria-hidden="true" /><span>{elapsed}</span>
      </div>}
      {inviteUrl && <div className="play-waiting-invite">
        <label className="play-waiting-link-label" htmlFor="play-waiting-invite-url">Share this link:</label>
        <div className="play-waiting-link-row">
          <input id="play-waiting-invite-url" readOnly value={inviteUrl} onFocus={event => event.target.select()} />
          <button type="button" className="play-waiting-copy" aria-label={copyLabel} onClick={onCopy}>
            {copied ? <Check size={19} aria-hidden="true" /> : <Copy size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>}
      <button type="button" className="play-waiting-cancel" onClick={onCancel}><X size={18} aria-hidden="true" />{cancelLabel}</button>
    </section>
  );
}
