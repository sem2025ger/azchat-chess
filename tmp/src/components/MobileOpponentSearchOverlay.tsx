import { Clock3, Swords, X } from 'lucide-react';
import './MobileOpponentSearchOverlay.css';

interface MobileOpponentSearchOverlayProps {
  title: string;
  description: string;
  elapsed: string;
  cancelLabel: string;
  onCancel: () => void;
}

export default function MobileOpponentSearchOverlay({
  title, description, elapsed, cancelLabel, onCancel,
}: MobileOpponentSearchOverlayProps) {
  return (
    <div className="chessaz-search-mobile" role="dialog" aria-modal="true" aria-label={title}>
      <div className="chessaz-search-mobile__backdrop" aria-hidden="true" />
      <section className="chessaz-search-mobile__panel">
        <div className="chessaz-search-mobile__emblem" aria-hidden="true">
          <Swords size={26} strokeWidth={1.7} />
        </div>
        <div className="chessaz-search-mobile__eyebrow">CHESSAZ</div>
        <h2 className="chessaz-search-mobile__title">{title}</h2>
        <p className="chessaz-search-mobile__description">{description}</p>

        <div className="chessaz-search-mobile__clock" aria-label={elapsed}>
          <Clock3 size={18} strokeWidth={1.7} aria-hidden="true" />
          <span className="chessaz-search-mobile__elapsed">{elapsed}</span>
        </div>

        <button type="button" className="chessaz-search-mobile__cancel" onClick={onCancel}>
          <X size={19} strokeWidth={1.8} aria-hidden="true" />
          <span>{cancelLabel}</span>
        </button>
      </section>
    </div>
  );
}
