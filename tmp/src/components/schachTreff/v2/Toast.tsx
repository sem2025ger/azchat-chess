import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Schach-Treff v2 notices (errors, refusals, moderation status) float above the chat instead of being inserted
 * into the page flow: inserting and removing a line used to push all three columns down and back up.
 */
export function Toast({ message, tone = 'alert', closeLabel, onClose, autoHideMs = 6000 }: {
  message: string; tone?: 'alert' | 'status'; closeLabel: string; onClose: () => void; autoHideMs?: number;
}) {
  useEffect(() => {
    if (!message || !autoHideMs) return;
    const timer = window.setTimeout(onClose, autoHideMs);
    return () => window.clearTimeout(timer);
    // Restart the timer only when the text changes; onClose may be a new function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, autoHideMs]);
  if (!message) return null;
  return <div className="st2-toast" role={tone} data-tone={tone}>
    <span>{message}</span>
    <button type="button" className="st2-icon-button" aria-label={closeLabel} onClick={onClose}><X size={16} aria-hidden="true" /></button>
  </div>;
}
