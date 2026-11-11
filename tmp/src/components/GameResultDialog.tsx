import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function GameResultDialog({ message, onDismiss, onNewGame }: {
  message: string;
  onDismiss: () => void;
  onNewGame: () => void;
}) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const dismiss = useCallback(() => { setDismissed(true); onDismiss(); }, [onDismiss]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (dismissed) return;
    const previousFocus = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [dismiss, dismissed]);

  if (dismissed) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 animate-fade-in" data-game-result-overlay>
      <section role="dialog" aria-labelledby="game-result-title" aria-describedby="game-result-hint"
        className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-900 px-6 pb-7 pt-14 text-center shadow-2xl">
        <button ref={closeRef} type="button" onClick={dismiss} aria-label={t('game.result.close')}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl text-neutral-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-chess-gold">
          <X size={21} aria-hidden="true" />
        </button>
        <h2 id="game-result-title" className="text-xl md:text-2xl font-semibold leading-snug tracking-tight text-white">{message}</h2>
        <p id="game-result-hint" className="mt-3 text-sm leading-relaxed text-neutral-400">{t('game.result.reviewHint')}</p>
        <button type="button" onClick={onNewGame}
          className="mt-6 min-h-11 rounded-xl bg-chess-active px-7 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-chess-active/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chess-gold">
          {t('game.result.newGame')}
        </button>
      </section>
    </div>
  );
}
