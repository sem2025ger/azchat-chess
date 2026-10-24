import { ChevronDown, Sparkles, Trophy, Users } from 'lucide-react';
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
  const category = Object.entries(timeGroups).find(([, times]) => times.includes(timeControl))?.[0] || 'Blitz';
  const label = (value: string) => value.replace('min.', language === 'ru' || language === 'ua' ? 'мин.' : language === 'az' || language === 'tr' ? 'dəq.' : 'min.');
  const tournament = language === 'ru' ? 'Турниры · скоро' : language === 'de' ? 'Turniere · bald' : language === 'az' ? 'Turnirlər · tezliklə' : 'Tournaments · soon';
  return (
    <section className="mobile-arena-panel panel-glow-cycle" aria-label={t('play.startGame')}>
      <div className="mobile-arena-time">
        <Sparkles size={20} className="mobile-arena-time-icon" aria-hidden="true" />
        <span className="mobile-arena-clock" aria-hidden="true">
          <strong className="text-glow-cycle">{label(timeControl)}</strong><small>{category}</small>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
        <select aria-label={t('invite.chooseTime')} value={timeControl} onChange={event => onTimeChange(event.target.value)}>
          {Object.entries(timeGroups).map(([name, times]) => <optgroup key={name} label={name}>
            {times.map(time => <option key={time} value={time}>{label(time)}</option>)}
          </optgroup>)}
        </select>
      </div>
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
