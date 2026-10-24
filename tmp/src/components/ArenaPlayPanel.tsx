import { useState } from 'react';
import { ChevronDown, Club, Crown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import OnlineLobby from './OnlineLobby';
import './ArenaPlayPanel.css';

type Props = {
  timeControl: string;
  onTimeChange: (value: string) => void;
  onStart: () => void;
  onFriend: () => void;
};
const quickTimes = ['1 min.', '3 min.', '5 min.', '10 min.'];
const otherTimes = ['1 | 1', '2 | 1', '3 | 2', '15 | 10', '30 min.'];

export default function ArenaPlayPanel({ timeControl, onTimeChange, onStart, onFriend }: Props) {
  const { language, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const text = (ru: string, de: string, en: string, az: string) =>
    language === 'ru' ? ru : language === 'de' ? de : language === 'az' ? az : en;
  const timeLabel = (value: string) => value.replace('min.', language === 'ru' || language === 'ua' ? 'мин.' : language === 'az' || language === 'tr' ? 'dəq.' : 'min.');
  return (
    <section className="arena-play-panel" aria-label={text('Игровая арена', 'Spielarena', 'Play arena', 'Oyun arenası')}>
      <div className="arena-panel-main">
        <h2 className="arena-panel-heading">CHESSAZ · {text('ИГРОВАЯ АРЕНА', 'SPIELARENA', 'PLAY ARENA', 'OYUN ARENASI')}</h2>
        <button className="arena-selected-time" type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)} aria-label={t('invite.chooseTime')}>
          {timeLabel(timeControl)}<ChevronDown size={18} aria-hidden="true" />
        </button>
        <p className="arena-time-caption">{text('КОНТРОЛЬ ВРЕМЕНИ', 'ZEITKONTROLLE', 'TIME CONTROL', 'VAXT NƏZARƏTİ')}</p>
        <div className="arena-quick-times">
          {quickTimes.map(value => <button key={value} type="button" aria-pressed={timeControl === value} onClick={() => onTimeChange(value)}>{timeLabel(value)}</button>)}
        </div>
        {expanded && <div className="arena-other-times">
          {otherTimes.map(value => <button key={value} type="button" aria-pressed={timeControl === value} onClick={() => { onTimeChange(value); setExpanded(false); }}>{timeLabel(value)}</button>)}
        </div>}
        <OnlineLobby timeControl={timeControl} />
        <button type="button" className="arena-start-game" onClick={onStart}>
          <img src="/pieces/classic/bP.svg" alt="" aria-hidden="true" />{t('play.startGame')}
        </button>
      </div>
      <div className="arena-panel-footer">
        <button type="button" onClick={onFriend}><Club size={19} aria-hidden="true" />{text('ИГРА С ДРУГОМ', 'MIT FREUND', 'PLAY A FRIEND', 'DOSTLA OYNA')}</button>
        <button type="button" disabled><Crown size={19} aria-hidden="true" />{text('ТУРНИРЫ · СКОРО', 'TURNIERE · BALD', 'TOURNAMENTS · SOON', 'TURNİRLƏR · TEZLİKLƏ')}</button>
      </div>
    </section>
  );
}
