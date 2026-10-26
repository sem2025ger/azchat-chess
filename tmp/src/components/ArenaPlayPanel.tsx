import { useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Club, Crown, Shield, Sparkles, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import OnlineLobby from './OnlineLobby';
import MobileArenaPlayPanel from './MobileArenaPlayPanel';
import './ArenaPlayPanel.css';

export type ArenaPlayPanelProps = {
  timeControl: string;
  onTimeChange: (value: string) => void;
  onStart: () => void;
  onFriend: () => void;
};
const timeGroups = {
  Bullet: ['1 min.', '1 | 1', '2 | 1'],
  Blitz: ['3 min.', '3 | 2', '5 min.'],
  Rapid: ['10 min.', '15 | 10', '30 min.'],
};

const mobileQuery = '(max-width: 767px)';
function subscribeToViewport(update: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}
const isMobileViewport = () => window.matchMedia(mobileQuery).matches;

export default function ArenaPlayPanel(props: ArenaPlayPanelProps) {
  const mobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false);
  return mobile ? <MobileArenaPlayPanel {...props} /> : <DesktopArenaPlayPanel {...props} />;
}

function DesktopArenaPlayPanel({ timeControl, onTimeChange, onStart, onFriend }: ArenaPlayPanelProps) {
  const { language, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const timeButton = useRef<HTMLButtonElement>(null);
  const category = Object.entries(timeGroups).find(([, values]) => values.includes(timeControl))?.[0] || 'Blitz';
  const groupLabel = (name: string) => name === 'Rapid' && language === 'de' ? 'Schnellschach' : name;
  const text = (ru: string, de: string, en: string, az: string) =>
    language === 'ru' ? ru : language === 'de' ? de : language === 'az' ? az : en;
  const timeLabel = (value: string) => value.replace('min.', language === 'ru' || language === 'ua' ? 'мин.' : language === 'az' || language === 'tr' ? 'dəq.' : 'min.');
  return (
    <section className="arena-play-panel" aria-label={text('Игровая арена', 'Spielarena', 'Play arena', 'Oyun arenası')}>
      <div className="arena-panel-main">
        <div className="arena-time-picker" onKeyDown={event => { if (expanded && event.key === 'Escape') { setExpanded(false); timeButton.current?.focus(); } }}>
          <button ref={timeButton} className="arena-selected-time" type="button" aria-expanded={expanded} aria-controls="arena-time-options" onClick={() => setExpanded(v => !v)} aria-label={`${t('invite.chooseTime')}: ${timeLabel(timeControl)}, ${groupLabel(category)}`}>
            <Sparkles className="arena-time-emblem" size={22} aria-hidden="true" />
            <span className="arena-time-summary"><span className="arena-time-value">{timeLabel(timeControl)}</span><small>{groupLabel(category)}</small></span>
            <ChevronDown className={expanded ? 'arena-time-chevron is-expanded' : 'arena-time-chevron'} size={18} aria-hidden="true" />
          </button>
          {expanded && <div className="arena-time-groups" id="arena-time-options">
            {Object.entries(timeGroups).map(([name, values]) => <section key={name} className={`arena-time-group arena-time-group--${name.toLowerCase()}`} aria-label={groupLabel(name)}>
              <h3>{name === 'Bullet' ? <Zap size={14} aria-hidden="true" /> : name === 'Blitz' ? <Sparkles size={14} aria-hidden="true" /> : <Shield size={14} aria-hidden="true" />}{groupLabel(name)}</h3>
              <div className="arena-time-options">{values.map(value => <button key={value} type="button" aria-pressed={timeControl === value} onClick={() => { onTimeChange(value); setExpanded(false); timeButton.current?.focus(); }}>{timeLabel(value)}</button>)}</div>
            </section>)}
          </div>}
        </div>
        <OnlineLobby timeControl={timeControl} />
        <button type="button" className="arena-start-game" onClick={onStart}>
          <span>{t('play.startGame')}</span>
        </button>
      </div>
      <div className="arena-panel-footer">
        <button type="button" onClick={onFriend}><Club size={19} aria-hidden="true" />{text('ИГРА С ДРУГОМ', 'MIT FREUND', 'PLAY A FRIEND', 'DOSTLA OYNA')}</button>
        <button type="button" disabled><Crown size={19} aria-hidden="true" />{text('ТУРНИРЫ · СКОРО', 'TURNIERE · BALD', 'TOURNAMENTS · SOON', 'TURNİRLƏR · TEZLİKLƏ')}</button>
      </div>
    </section>
  );
}
