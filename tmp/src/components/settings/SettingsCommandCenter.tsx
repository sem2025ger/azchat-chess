import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, RotateCcw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { BOARD_THEME_DETAILS, PIECE_STYLES, type BoardTheme, type PieceTheme } from '../../lib/chessThemes';
import { useThemeContext, type BackgroundTheme, type SoundTheme } from '../../context/ThemeContext';
import { playChessSound, setChessSoundMuted } from '../../utils/chessSounds';
import { findSettings, STYLE_PRESETS } from './settingsLogic';

type Kind = 'board' | 'pieces' | 'sound' | 'background';
type Locale = 'ru' | 'en' | 'de' | 'az' | 'tr' | 'ua';
type Goal = 'blitz' | 'study' | 'focus';
type Selection = { board: BoardTheme; pieces: PieceTheme; sound: SoundTheme; background: BackgroundTheme };
type Entry = { kind: Kind; label: string; value: string };

const SOUNDS: SoundTheme[] = ['Default', 'Soft', 'Classic', 'Wood', 'Crystal', 'Muted / Off'];
const BACKGROUNDS: BackgroundTheme[] = ['Void Black', 'Deep Space', 'Velvet Gold', 'Champagne Light', 'Coffee Brown', 'Walnut Dark', 'Emerald Night', 'Royal Blue', 'Royal Violet', 'Obsidian Gold'];
const PRESETS: Record<Goal, Selection> = STYLE_PRESETS;
const COPY = {
  ru: {
    search: 'Найти настройку…', hint: 'Например: зелёная доска, Merida, звук, золото',
    quick: 'Быстрые настройки', searchResults: 'Результаты поиска',
    empty: 'Ничего не найдено. Попробуйте другое название.',
    board: 'Доска', pieces: 'Фигуры', sound: 'Звук', background: 'Интерфейс',
    assistant: 'Ассистент стиля', intro: 'Выберите задачу — ChessAZ предложит сочетание доски, фигур, звука и фона.',
    blitz: 'Быстрая игра', study: 'Обучение', focus: 'Глубокий анализ',
    blitzInfo: 'Высокий контраст и спокойные звуки — чтобы не отвлекаться от времени.',
    studyInfo: 'Светлые клетки и привычные фигуры — удобно изучать позиции.',
    focusInfo: 'Графит, золото и классические фигуры — для длительной работы.',
    apply: 'Применить комплект', applied: 'Комплект применён', undo: 'Отменить изменение',
    selected: 'Активный комплект', close: 'Очистить поиск', expand: 'Раскрыть ассистента',
    keys: 'Нажмите / для поиска', status: 'Изменения сохраняются автоматически',
  },
  en: {
    search: 'Find a setting…', hint: 'Try green board, Merida, sound, gold',
    quick: 'Quick settings', searchResults: 'Search results',
    empty: 'Nothing found. Try a different term.',
    board: 'Board', pieces: 'Pieces', sound: 'Sound', background: 'Appearance',
    assistant: 'Style assistant', intro: 'Pick a goal. ChessAZ suggests a matching board, pieces, sound and background.',
    blitz: 'Fast games', study: 'Learning', focus: 'Deep analysis',
    blitzInfo: 'Clear contrast and gentle sounds for time-sensitive games.',
    studyInfo: 'Light squares and familiar pieces for learning positions.',
    focusInfo: 'Graphite, gold and classic pieces for longer analysis sessions.',
    apply: 'Apply this style', applied: 'Style applied', undo: 'Undo change',
    selected: 'Current style', close: 'Clear search', expand: 'Open style assistant',
    keys: 'Press / to search', status: 'Changes save automatically',
  },
  de: {
    search: 'Einstellung suchen…', hint: 'Zum Beispiel Grün, Merida, Ton, Gold',
    quick: 'Schnelleinstellungen', searchResults: 'Suchergebnisse',
    empty: 'Keine Treffer. Versuche einen anderen Begriff.',
    board: 'Brett', pieces: 'Figuren', sound: 'Ton', background: 'Oberfläche',
    assistant: 'Stilassistent', intro: 'Wähle dein Ziel: ChessAZ empfiehlt Brett, Figuren, Ton und Hintergrund.',
    blitz: 'Schnelle Partien', study: 'Lernen', focus: 'Tiefe Analyse',
    blitzInfo: 'Klarer Kontrast und dezente Töne für schnelle Partien.',
    studyInfo: 'Helle Felder und vertraute Figuren für das Training.',
    focusInfo: 'Graphit, Gold und klassische Figuren für lange Analysen.',
    apply: 'Stil anwenden', applied: 'Stil angewendet', undo: 'Änderung rückgängig',
    selected: 'Aktueller Stil', close: 'Suche löschen', expand: 'Stilassistent öffnen',
    keys: '/ zum Suchen', status: 'Änderungen werden automatisch gespeichert',
  },
  az: {
    search: 'Ayar axtar…', hint: 'Məsələn: yaşıl lövhə, Merida, səs, qızılı',
    quick: 'Sürətli ayarlar', searchResults: 'Axtarış nəticələri',
    empty: 'Nəticə tapılmadı. Başqa söz yoxlayın.',
    board: 'Lövhə', pieces: 'Fiqurlar', sound: 'Səs', background: 'Görünüş',
    assistant: 'Stil köməkçisi', intro: 'Məqsəd seçin — ChessAZ lövhə, fiqur, səs və fon təklif etsin.',
    blitz: 'Sürətli oyun', study: 'Öyrənmə', focus: 'Dərin təhlil',
    blitzInfo: 'Vaxtlı oyun üçün aydın kontrast və sakit səslər.',
    studyInfo: 'Mövqeləri öyrənmək üçün açıq xanalar və tanış fiqurlar.',
    focusInfo: 'Uzun təhlil üçün qrafit, qızılı və klassik fiqurlar.',
    apply: 'Stili tətbiq et', applied: 'Stil tətbiq edildi', undo: 'Dəyişikliyi geri al',
    selected: 'Cari stil', close: 'Axtarışı sil', expand: 'Stil köməkçisini aç',
    keys: 'Axtarış üçün /', status: 'Dəyişikliklər avtomatik saxlanılır',
  },
  tr: {
    search: 'Ayar ara…', hint: 'Örnek: yeşil tahta, Merida, ses, altın',
    quick: 'Hızlı ayarlar', searchResults: 'Arama sonuçları',
    empty: 'Sonuç bulunamadı. Başka bir kelime deneyin.',
    board: 'Tahta', pieces: 'Taşlar', sound: 'Ses', background: 'Görünüm',
    assistant: 'Stil asistanı', intro: 'Hedef seçin — ChessAZ uyumlu tahta, taş, ses ve arka plan önersin.',
    blitz: 'Hızlı oyun', study: 'Öğrenme', focus: 'Derin analiz',
    blitzInfo: 'Hızlı oyun için net kontrast ve yumuşak sesler.',
    studyInfo: 'Öğrenmek için açık kareler ve tanıdık taşlar.',
    focusInfo: 'Uzun analiz için grafit, altın ve klasik taşlar.',
    apply: 'Stili uygula', applied: 'Stil uygulandı', undo: 'Değişikliği geri al',
    selected: 'Geçerli stil', close: 'Aramayı temizle', expand: 'Stil asistanını aç',
    keys: 'Aramak için /', status: 'Değişiklikler otomatik kaydedilir',
  },
  ua: {
    search: 'Знайти налаштування…', hint: 'Наприклад: зелена дошка, Merida, звук, золото',
    quick: 'Швидкі налаштування', searchResults: 'Результати пошуку',
    empty: 'Нічого не знайдено. Спробуйте інше слово.',
    board: 'Дошка', pieces: 'Фігури', sound: 'Звук', background: 'Інтерфейс',
    assistant: 'Помічник стилю', intro: 'Оберіть мету — ChessAZ запропонує дошку, фігури, звук та фон.',
    blitz: 'Швидка гра', study: 'Навчання', focus: 'Глибокий аналіз',
    blitzInfo: 'Контраст і тихі звуки для швидкої гри.',
    studyInfo: 'Світлі клітини та знайомі фігури для навчання.',
    focusInfo: 'Графіт, золото та класичні фігури для аналізу.',
    apply: 'Застосувати стиль', applied: 'Стиль застосовано', undo: 'Скасувати зміну',
    selected: 'Поточний стиль', close: 'Очистити пошук', expand: 'Відкрити помічника',
    keys: '/ для пошуку', status: 'Зміни зберігаються автоматично',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export default function SettingsCommandCenter({ language }: { language: string }) {
  const { boardTheme, setBoardTheme, pieceTheme, setPieceTheme, sound, setSound, background, setBackground } = useThemeContext();
  const t = COPY[(language in COPY ? language : 'en') as Locale];
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [goal, setGoal] = useState<Goal>('focus');
  const [expanded, setExpanded] = useState(false);
  const [previous, setPrevious] = useState<Selection | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  const entries = useMemo<Entry[]>(() => [
    ...BOARD_THEME_DETAILS.map(x => ({ kind: 'board' as const, label: x.name, value: x.id })),
    ...PIECE_STYLES.map(x => ({ kind: 'pieces' as const, label: x.name, value: x.id })),
    ...SOUNDS.map(x => ({ kind: 'sound' as const, label: x, value: x })),
    ...BACKGROUNDS.map(x => ({ kind: 'background' as const, label: x, value: x })),
  ], []);
  const results = useMemo(() => findSettings(entries, query, t), [entries, query, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      const editing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (e.key === '/' && !editing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); input.current?.focus();
      }
      if (e.key === 'Escape' && target === input.current) { setQuery(''); input.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current: Selection = { board: boardTheme, pieces: pieceTheme, sound, background };
  const applySelection = (selection: Selection) => {
    setPrevious(current);
    setBoardTheme(selection.board);
    setPieceTheme(selection.pieces);
    setSound(selection.sound);
    setChessSoundMuted(selection.sound === 'Muted / Off');
    setBackground(selection.background);
    setJustApplied(true);
    setNotification('');
  };
  const applyResult = (entry: Entry) => {
    setPrevious(current);
    if (entry.kind === 'board') setBoardTheme(entry.value as BoardTheme);
    if (entry.kind === 'pieces') setPieceTheme(entry.value as PieceTheme);
    if (entry.kind === 'sound') {
      const theme = entry.value as SoundTheme;
      setSound(theme);
      setChessSoundMuted(theme === 'Muted / Off');
      if (theme !== 'Muted / Off') void playChessSound('move', theme);
    }
    if (entry.kind === 'background') setBackground(entry.value as BackgroundTheme);
    setQuery('');
    setJustApplied(false);
    setNotification('');
  };
  const undo = () => {
    if (!previous) return;
    setBoardTheme(previous.board);
    setPieceTheme(previous.pieces);
    setSound(previous.sound);
    setChessSoundMuted(previous.sound === 'Muted / Off');
    setBackground(previous.background);
    setPrevious(null);
    setJustApplied(false);
    setNotification('');
  };
  const active = PRESETS[goal];
  const alreadySet = boardTheme === active.board && pieceTheme === active.pieces && sound === active.sound && background === active.background;
  const jump = (kind: Kind) => {
    const target = document.getElementById('settings-section-' + kind);
    if (target && target.getClientRects().length > 0) {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      const button = target.querySelector('button');
      if (button instanceof HTMLElement) button.focus({ preventScroll: true });
    } else {
      input.current?.focus();
      setQuery(t[kind]);
    }
  };

  return <section className="settings-command-center" aria-label={t.quick}>
    <div className="settings-command-top">
      <div className="settings-search-wrap">
        <Search size={17} aria-hidden="true" />
        <input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)}
          autoComplete="off" spellCheck={false} aria-label={t.search} placeholder={t.search} />
        {query && <button type="button" aria-label={t.close} title={t.close} onClick={() => { setQuery(''); input.current?.focus(); }}><X size={16}/></button>}
        <span className="settings-keyboard-hint" aria-hidden="true">/</span>
      </div>
      <div className="settings-quick-links" role="group" aria-label={t.quick}>
        {(['board', 'pieces', 'sound', 'background'] as Kind[]).map(k =>
          <button type="button" key={k} onClick={() => jump(k)}><SlidersHorizontal size={13}/>{t[k]}</button>
        )}
      </div>
      <button type="button" className="settings-assistant-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        <Sparkles size={16}/>{t.assistant}<ChevronDown size={15} className={expanded ? 'rotate-180' : ''}/>
      </button>
    </div>

    {query && <div className="settings-search-results" aria-label={t.searchResults}>
      <div className="settings-results-caption">{t.searchResults} · {results.length}</div>
      {results.length === 0 ? <p role="status">{t.empty}</p> :
        <div className="settings-result-grid">
          {results.map(entry => {
            const isActive = (entry.kind === 'board' && boardTheme === entry.value) ||
              (entry.kind === 'pieces' && pieceTheme === entry.value) ||
              (entry.kind === 'sound' && sound === entry.value) ||
              (entry.kind === 'background' && background === entry.value);
            return <button type="button" key={entry.kind + entry.value} aria-pressed={isActive} onClick={() => applyResult(entry)}>
              <span>{t[entry.kind]}</span><strong>{entry.label}</strong>{isActive && <Check size={15} aria-hidden="true"/>}
            </button>;
          })}
        </div>}
    </div>}

    {previous && !expanded && <button type="button" className="settings-quick-undo" onClick={undo}><RotateCcw size={14}/>{t.undo}</button>}
    {expanded && <div className="settings-assistant-panel">
      <div className="settings-assistant-lead"><Sparkles size={18}/><div><strong>{t.assistant}</strong><p>{t.intro}</p></div></div>
      <div className="settings-goal-picks" role="group" aria-label={t.assistant}>
        {(['blitz', 'focus', 'study'] as Goal[]).map(key =>
          <button type="button" key={key} aria-pressed={goal === key} onClick={() => { setGoal(key); setJustApplied(false); }}>
            {goal === key && <Check size={13} aria-hidden="true"/>}{t[key]}
          </button>)}
      </div>
      <div className="settings-style-recommendation">
        <div className="settings-style-description">
          <strong>{t[goal]}</strong><p>{t[(goal + 'Info') as 'blitzInfo' | 'studyInfo' | 'focusInfo']}</p>
          <small>{active.board} · {PIECE_STYLES.find(x => x.id === active.pieces)?.name} · {active.sound} · {active.background}</small>
        </div>
        <div className="settings-style-controls">
          <button type="button" className="settings-apply-style" disabled={alreadySet} onClick={() => applySelection(active)}>
            <Check size={15}/>{alreadySet ? t.selected : t.apply}
          </button>
          {previous && <button type="button" className="settings-undo-style" onClick={undo}><RotateCcw size={15}/>{t.undo}</button>}
        </div>
      </div>
      <p className="settings-save-hint" role="status">{justApplied ? t.applied + '. ' : ''}{t.status}</p>
    </div>}
  </section>;
}
