import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Rocket, Sparkles, Timer, Trophy, Users, X, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { ArenaPlayPanelProps } from './ArenaPlayPanel';
import './MobileArenaPlayPanel.css';

const timeGroups = {
  Bullet: ['1 min.', '1 | 1', '2 | 1'],
  Blitz: ['3 min.', '3 | 2', '5 min.'],
  Rapid: ['10 min.', '15 | 10', '30 min.'],
};

export default function MobileArenaPlayPanel({ timeControl, onTimeChange, onStart, onFriend }: ArenaPlayPanelProps) {
  const { language, t } = useLanguage();
  const [timeOpen, setTimeOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const groupLabel = (name: string) => name === 'Rapid' && language === 'de' ? 'Schnellschach' : name;
  const category = Object.entries(timeGroups).find(([, times]) => times.includes(timeControl))?.[0] || 'Blitz';
  const label = (value: string) => value.replace('min.', language === 'ru' || language === 'ua' ? 'мин.' : language === 'az' || language === 'tr' ? 'dəq.' : 'min.');
  const tournament = language === 'ru' ? 'Турниры · скоро' : language === 'de' ? 'Turniere · bald' : language === 'az' ? 'Turnirlər · tezliklə' : 'Tournaments · soon';
  useEffect(() => {
    if (!timeOpen) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [timeOpen]);
  return (
    <section className="mobile-arena-panel panel-glow-cycle" aria-label={t('play.startGame')}>
      <button ref={triggerRef} type="button" className="mobile-arena-time" aria-label={`${t('invite.chooseTime')}: ${label(timeControl)}`} aria-haspopup="dialog" aria-expanded={timeOpen} onClick={() => setTimeOpen(open => !open)}>
        <Sparkles size={20} className="mobile-arena-time-icon" aria-hidden="true" />
        <span className="mobile-arena-clock" aria-hidden="true">
          <strong className="text-glow-cycle">{label(timeControl)}</strong><small>{groupLabel(category)}</small>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {timeOpen && createPortal(
        <dialog ref={dialogRef} className="mobile-time-dialog" aria-labelledby="mobile-time-title" onCancel={event => { event.preventDefault(); setTimeOpen(false); }} onClick={event => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setTimeOpen(false);
        }}>
          <header className="mobile-time-heading">
            <h2 id="mobile-time-title">{t('invite.chooseTime')}</h2>
            <button type="button" className="mobile-time-close" aria-label={t('invite.close')} onClick={() => setTimeOpen(false)}><X size={20} aria-hidden="true" /></button>
          </header>
          {Object.entries(timeGroups).map(([name, times], index) => {
            const Icon = [Rocket, Zap, Timer][index];
            return <div key={name} className="mobile-time-group" role="group" aria-labelledby={`mobile-time-${name}`}>
              <h3 id={`mobile-time-${name}`}><Icon size={17} aria-hidden="true" />{groupLabel(name)}</h3>
              <div className="mobile-time-options">
                {times.map(time => <button type="button" key={time} aria-pressed={time === timeControl} onClick={() => { if (time === timeControl) setTimeOpen(false); else onTimeChange(time); }}>{label(time).replace(' | ', ' + ')}</button>)}
              </div>
            </div>;
          })}
          <button type="button" className="mobile-time-done" aria-label={`${t('invite.close')}: ${label(timeControl)}`} onClick={() => setTimeOpen(false)}>{label(timeControl)}<ChevronUp size={17} aria-hidden="true" /></button>
        </dialog>, document.body
      )}
      <div className="mobile-arena-action">
        <button type="button" className="mobile-arena-start btn-glow-cycle" onClick={onStart}>{t('play.startGame')}</button>
      </div>
      <div className="mobile-arena-footer">
        <button type="button" aria-haspopup="dialog" onClick={onFriend}><Users size={18} aria-hidden="true" /><span>{language === 'ru' ? 'Игра с другом' : t('play.friend')}</span></button>
        <button type="button" disabled><Trophy size={18} aria-hidden="true" /><span>{tournament}</span></button>
      </div>
    </section>
  );
}
