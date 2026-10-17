import { useState } from 'react';
import { Activity, ArrowRight, BookOpen, Calendar, ChevronDown, Clock, Crown, Flag, Lock, LogOut, MapPin, MoreHorizontal, Play, Settings, Shield, Sparkles, Swords, Target, Trophy, Zap } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { MatchStats, PlayerMatchResult } from '../../utils/profileContract';
import './PlayerPassportDesktop.css';

type Mode = 'blitz' | 'rapid' | 'bullet';
type RecentGame = { result: PlayerMatchResult; opp: string; type: string; date: string };
type Props = {
  desktop?: boolean;
  username: string; role?: string; countryCode?: string; joinedAt?: string;
  ratings: Record<Mode, number>; performance: MatchStats; recentGames: RecentGame[];
  onPlay: () => void; onSettings: () => void; onSignOut: () => void | Promise<void>;
};

const i18n = {
  en: { passport:'PLAYER PASSPORT', subtitle:'Your chess identity', player:'PLAYER', member:'MEMBER SINCE', options:'Profile options', settings:'Settings', signout:'Sign out', rating:'RATING CENTER', current:'Current rating', history:'Rating history coming later', signature:'CHESS SIGNATURE', signatureSub:'The way you play', signatureInfo:'Advanced insights are in development. No estimated scores.', open:'Openings', tactics:'Tactics', endgame:'Endgames', time:'Time', soon:'SOON', next:'YOUR NEXT MOVE', first:'Every great game starts with a first move.', again:'Build your story, one game at a time.', playFirst:'Play your first game', playAgain:'Play again', performance:'PERFORMANCE', last:'Last 10 games', games:'GAMES', recent:'RECENT GAMES', all:'Show all', less:'Show less', empty:'No games yet', emptyInfo:'Your match results will appear here.', vs:'vs', achievements:'ACHIEVEMENTS', achievementsInfo:'Achievements are in development.', tagline:'MADE FOR THE NEXT MOVE', win:'WIN', draw:'DRAW', loss:'LOSS' },
  ru: { passport:'ПАСПОРТ ИГРОКА', subtitle:'Твоя шахматная история', player:'ИГРОК', member:'В ИГРЕ С', options:'Меню профиля', settings:'Настройки', signout:'Выйти', rating:'ЦЕНТР РЕЙТИНГА', current:'Текущий рейтинг', history:'История рейтинга появится позже', signature:'ШАХМАТНЫЙ ПОЧЕРК', signatureSub:'Твой стиль игры', signatureInfo:'Расширенная аналитика в разработке. Оценки не выдумываются.', open:'Дебюты', tactics:'Тактика', endgame:'Эндшпиль', time:'Время', soon:'СКОРО', next:'ТВОЙ СЛЕДУЮЩИЙ ХОД', first:'Каждая партия начинается с первого хода.', again:'Продолжай свой путь — партия за партией.', playFirst:'Сыграть первую партию', playAgain:'Играть снова', performance:'РЕЗУЛЬТАТЫ', last:'Последние 10 партий', games:'ПАРТИЙ', recent:'ПОСЛЕДНИЕ ПАРТИИ', all:'Показать все', less:'Свернуть', empty:'Партий пока нет', emptyInfo:'Здесь появятся результаты твоих игр.', vs:'против', achievements:'ДОСТИЖЕНИЯ', achievementsInfo:'Система достижений в разработке.', tagline:'ВСЁ НАЧИНАЕТСЯ С ХОДА', win:'ПОБЕДА', draw:'НИЧЬЯ', loss:'ПОРАЖЕНИЕ' },
  az: { passport:'OYUNÇU PASPORTU', subtitle:'Sənin şahmat hekayən', player:'OYUNÇU', member:'ÜZVLÜK İLİ', options:'Profil menyusu', settings:'Ayarlar', signout:'Çıxış', rating:'REYTİNQ MƏRKƏZİ', current:'Cari reytinq', history:'Reytinq tarixi daha sonra gələcək', signature:'ŞAHMAT ÜSLUBU', signatureSub:'Sənin oyun üslubun', signatureInfo:'Geniş təhlil hazırlanır. Təxmini qiymət göstərilmir.', open:'Debüt', tactics:'Taktika', endgame:'Endşpil', time:'Vaxt', soon:'TEZLİKLƏ', next:'NÖVBƏTİ GƏDİŞİN', first:'Hər oyun ilk gedişlə başlayır.', again:'Hər oyunla şahmat hekayəni böyüt.', playFirst:'İlk oyununu oyna', playAgain:'Yenidən oyna', performance:'NƏTİCƏLƏR', last:'Son 10 oyun', games:'OYUN', recent:'SON OYUNLAR', all:'Hamısı', less:'Az göstər', empty:'Hələ oyun yoxdur', emptyInfo:'Son oyunların burada görünəcək.', vs:'qarşı', achievements:'NAİLİYYƏTLƏR', achievementsInfo:'Nailiyyətlər bölməsi hazırlanır.', tagline:'HƏR ŞEY BİR GEDİŞLƏ BAŞLAYIR', win:'QƏLƏBƏ', draw:'HEÇ-HEÇƏ', loss:'MƏĞLUBİYYƏT' },
  de: { passport:'SPIELERPASS', subtitle:'Deine Schachidentität', player:'SPIELER', member:'MITGLIED SEIT', options:'Profilmenü', settings:'Einstellungen', signout:'Abmelden', rating:'WERTUNGSZENTRUM', current:'Aktuelle Wertung', history:'Wertungsverlauf folgt später', signature:'SCHACHPROFIL', signatureSub:'Dein Spielstil', signatureInfo:'Erweiterte Analysen sind in Arbeit. Keine geschätzten Werte.', open:'Eröffnung', tactics:'Taktik', endgame:'Endspiel', time:'Zeit', soon:'BALD', next:'DEIN NÄCHSTER ZUG', first:'Jede Partie beginnt mit einem Zug.', again:'Spiele weiter, Partie für Partie.', playFirst:'Erste Partie spielen', playAgain:'Weitere Partie spielen', performance:'ERGEBNISSE', last:'Letzte 10 Partien', games:'PARTIEN', recent:'LETZTE PARTIEN', all:'Alle anzeigen', less:'Weniger', empty:'Noch keine Partien', emptyInfo:'Deine Ergebnisse erscheinen hier.', vs:'gegen', achievements:'ERFOLGE', achievementsInfo:'Erfolge sind in Entwicklung.', tagline:'FÜR DEINEN NÄCHSTEN ZUG', win:'SIEG', draw:'REMIS', loss:'NIEDERLAGE' },
  tr: { passport:'OYUNCU PASAPORTU', subtitle:'Satranç hikâyen', player:'OYUNCU', member:'ÜYELİK YILI', options:'Profil menüsü', settings:'Ayarlar', signout:'Çıkış yap', rating:'PUAN MERKEZİ', current:'Güncel puan', history:'Puan geçmişi daha sonra gelecek', signature:'SATRANÇ STİLİN', signatureSub:'Oyun tarzını keşfet', signatureInfo:'Detaylı analiz hazırlanıyor. Tahmini puan gösterilmiyor.', open:'Açılış', tactics:'Taktik', endgame:'Oyun sonu', time:'Zaman', soon:'YAKINDA', next:'SONRAKİ HAMLE', first:'Her oyun ilk hamleyle başlar.', again:'Her oyunla hikâyeni büyüt.', playFirst:'İlk oyununu oyna', playAgain:'Yeniden oyna', performance:'SONUÇLAR', last:'Son 10 oyun', games:'OYUN', recent:'SON OYUNLAR', all:'Tümünü gör', less:'Daha az', empty:'Henüz oyun yok', emptyInfo:'Son maçların burada görünecek.', vs:'rakip', achievements:'BAŞARILAR', achievementsInfo:'Başarı sistemi geliştiriliyor.', tagline:'HER ŞEY BİR HAMLEYLE BAŞLAR', win:'GALİBİYET', draw:'BERABERE', loss:'MAĞLUBİYET' },
  ua: { passport:'ПАСПОРТ ГРАВЦЯ', subtitle:'Твоя шахова історія', player:'ГРАВЕЦЬ', member:'У ГРІ З', options:'Меню профілю', settings:'Налаштування', signout:'Вийти', rating:'ЦЕНТР РЕЙТИНГУ', current:'Поточний рейтинг', history:'Історія рейтингу з’явиться пізніше', signature:'ШАХОВИЙ СТИЛЬ', signatureSub:'Твій стиль гри', signatureInfo:'Розширена аналітика в розробці. Оцінки не вигадуються.', open:'Дебюти', tactics:'Тактика', endgame:'Ендшпіль', time:'Час', soon:'СКОРО', next:'ТВІЙ НАСТУПНИЙ ХІД', first:'Кожна партія починається з першого ходу.', again:'Створюй свою історію — партія за партією.', playFirst:'Зіграти першу партію', playAgain:'Грати ще', performance:'РЕЗУЛЬТАТИ', last:'Останні 10 партій', games:'ПАРТІЙ', recent:'ОСТАННІ ПАРТІЇ', all:'Показати всі', less:'Згорнути', empty:'Партій поки немає', emptyInfo:'Тут з’являться результати ігор.', vs:'проти', achievements:'ДОСЯГНЕННЯ', achievementsInfo:'Система досягнень розробляється.', tagline:'УСЕ ПОЧИНАЄТЬСЯ З ХОДУ', win:'ПЕРЕМОГА', draw:'НІЧИЯ', loss:'ПОРАЗКА' },
} as const;

const modes = [
  { id: 'blitz' as const, text:'BLITZ', Icon:Zap, color:'text-amber-300' },
  { id: 'rapid' as const, text:'RAPID', Icon:Target, color:'text-cyan-300' },
  { id: 'bullet' as const, text:'BULLET', Icon:Swords, color:'text-rose-300' },
];

export default function MobilePlayerPassport({ desktop = false, username, role, countryCode, joinedAt, ratings, performance, recentGames, onPlay, onSettings, onSignOut }: Props) {
  const { language, t } = useLanguage();
  const words = i18n[language] || i18n.en;
  const [mode, setMode] = useState<Mode>('blitz');
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const selected = modes.find(item => item.id === mode) || modes[0];
  const total = performance.wins + performance.draws + performance.losses;
  const joinedYear = joinedAt && !Number.isNaN(Date.parse(joinedAt)) ? new Date(joinedAt).getFullYear() : null;
  const name = username.trim() || 'Guest';
  const metrics = [
    { title: words.open, Icon:BookOpen }, { title: words.tactics, Icon:Target },
    { title: words.endgame, Icon:Flag }, { title: words.time, Icon:Clock },
  ];
  const results = [
    { label:t('profile.wins'), amount:performance.wins, color:'text-emerald-300' },
    { label:t('profile.draws'), amount:performance.draws, color:'text-neutral-300' },
    { label:t('profile.losses'), amount:performance.losses, color:'text-rose-300' },
  ];

  return (
    <div className={desktop ? 'desktop-player-passport w-full min-w-0 shrink-0 mx-auto text-white' : 'md:hidden w-full max-w-[620px] shrink-0 mx-auto px-3 pt-3 pb-8 text-white'}>
      <header className="flex items-center justify-between gap-3 mb-3 px-1">
        <div className="min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-[#16352f] border border-[#72ccb5]/30 flex items-center justify-center text-[#88dcc5]"><Crown size={22}/></div>
          <div className="min-w-0">
            <p className="font-extrabold tracking-[0.10em] text-[12px]">{words.passport}</p>
            <p className="text-[11px] mt-0.5 text-[#9aafa5]">{words.subtitle}</p>
          </div>
        </div>
        <div className="relative shrink-0">
          <button type="button" aria-label={words.options} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="w-11 h-11 rounded-xl border border-white/10 bg-[#17201d] text-[#d2ded7] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-teal-300"><MoreHorizontal size={22}/></button>
          {menuOpen && (
            <div role="menu" className="absolute z-40 right-0 top-12 bg-[#1b2421] border border-white/15 w-44 p-1.5 rounded-xl shadow-xl">
              <button role="menuitem" type="button" onClick={() => {setMenuOpen(false);onSettings();}} className="flex items-center gap-3 w-full min-h-11 px-3 rounded-lg text-sm text-left hover:bg-white/10"><Settings size={16}/>{words.settings}</button>
              <button role="menuitem" type="button" onClick={() => {setMenuOpen(false);void onSignOut();}} className="flex items-center gap-3 w-full min-h-11 px-3 rounded-lg text-sm text-rose-300 text-left hover:bg-rose-500/10"><LogOut size={16}/>{words.signout}</button>
            </div>
          )}
        </div>
      </header>
      <section className="passport-identity relative rounded-[23px] bg-[#141e1a] border border-[#78c3ac]/25 overflow-hidden mb-3 shadow-[0_14px_38px_-24px_rgba(0,0,0,.95)]">
        <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:'radial-gradient(ellipse at 100% 0%,rgba(44,142,120,.25),transparent 62%)'}}/>
        <div className="relative p-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-[66px] h-[66px] rounded-[19px] flex items-center justify-center bg-gradient-to-br from-[#364b42] via-[#25322d] to-[#171e1b] border border-white/15 text-[29px] font-black text-[#eadbbd]">{name.charAt(0).toLocaleUpperCase()}</div>
              <span className="absolute -right-1 -bottom-1 bg-[#24604c] border-[3px] border-[#141e1a] rounded-lg w-7 h-7 flex items-center justify-center text-[#b5f5d9]"><Shield size={13}/></span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 title={name} className="font-extrabold tracking-tight text-[19px] leading-[1.25] line-clamp-2 break-all">{name}</h1>
              <span className="mt-2 max-w-full inline-flex items-center truncate px-2.5 py-1 rounded-md bg-[#c6a46a]/10 border border-[#c6a46a]/25 text-[#e4c78a] text-[10px] font-extrabold tracking-[0.09em] uppercase">{role && role.toLowerCase() !== 'player' ? role : words.player}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {countryCode && <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#c1d4c9] bg-white/[0.045] border border-white/10 rounded-full px-2.5 py-1.5"><MapPin size={12} className="text-teal-300"/>{countryCode.toUpperCase()}</span>}
            {joinedYear && <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#c1d4c9] bg-white/[0.045] border border-white/10 rounded-full px-2.5 py-1.5"><Calendar size={12} className="text-amber-300"/>{words.member} {joinedYear}</span>}
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-[#d4b56c] via-[#67ccb1] to-transparent"/>
      </section>
      <section aria-label={words.rating} className="passport-rating rounded-[22px] p-3.5 bg-[#111a17] border border-white/[0.09] mb-3">
        <h2 className="flex items-center gap-2 text-[12px] font-extrabold tracking-[0.1em] text-[#e6eee8] mb-2.5"><Activity size={16} className="text-[#75d3b4]"/>{words.rating}</h2>
        <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-[#0c1210] border border-white/[0.06]" role="group" aria-label={words.rating}>
          {modes.map(({id,text,Icon}) => (
            <button key={id} type="button" aria-pressed={mode===id} onClick={() => setMode(id)} className={'min-w-0 min-h-11 rounded-[10px] flex items-center justify-center gap-1 font-bold text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 ' + (mode===id ? 'border border-[#68c5a9]/35 bg-[#25463a] text-[#b4f6d9]' : 'border border-transparent text-[#91a69b] hover:text-white')}><Icon size={14}/>{text}</button>
          ))}
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div><p className="text-[11px] text-[#a7b9ad]">{words.current}</p><div className="text-[42px] font-extrabold tracking-[-0.06em] tabular-nums leading-tight">{ratings[mode]}</div></div>
          <div className="mb-2 flex items-center gap-1.5"><selected.Icon size={15} className={selected.color}/><span className="text-[11px] text-[#c1d4c9] font-extrabold">{selected.text}</span></div>
        </div>
        <div className="text-[11px] text-[#7f968a] mt-2.5 pt-2 border-t border-white/[0.06]">{words.history}</div>
      </section>
      <section className="passport-signature rounded-[22px] border border-[#75c1ad]/20 bg-[#14211c] p-3.5 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div><h2 className="flex gap-2 items-center text-[12px] font-extrabold tracking-[0.1em]"><Sparkles size={16} className="text-[#dfbd7d]"/>{words.signature}</h2><p className="text-[12px] text-[#9fb6a8] mt-0.5">{words.signatureSub}</p></div>
          <span className="shrink-0 rounded-full bg-[#c7a96a]/10 border border-[#c7a96a]/20 px-2 py-1 text-[#dfc591] font-bold text-[10px]">{words.soon}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2.5">
          {metrics.map(({title,Icon}) => (
            <div key={title} className="flex items-center justify-between gap-2 min-w-0 px-2.5 min-h-[42px] rounded-xl bg-[#101813] border border-white/[0.065]">
              <span className="flex items-center gap-2 min-w-0"><Icon size={14} className="shrink-0 text-[#77a496]"/><span className="truncate text-[12px] font-semibold text-[#c3d8cb]">{title}</span></span><Lock size={12} className="shrink-0 text-[#6e877a]"/>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-[1.5] text-[#97afa1]">{words.signatureInfo}</p>
      </section>
      <section className="passport-next rounded-[22px] bg-gradient-to-br from-[#1e4336] via-[#164131] to-[#12352b] border border-[#86d6b6]/30 p-3.5 mb-3">
        <h2 className="flex items-center gap-2 text-[12px] font-extrabold tracking-[0.1em] text-[#c1f2db]"><Crown size={15}/>{words.next}</h2>
        <p className="mt-1.5 mb-2.5 text-[15px] font-bold leading-snug">{recentGames.length===0 ? words.first : words.again}</p>
        <button type="button" onClick={onPlay} className="min-h-12 w-full rounded-xl bg-[#c8eedc] text-[#102a20] font-extrabold text-[13px] flex items-center justify-center gap-2 transition-transform active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-white"><Play size={16} fill="currentColor"/>{recentGames.length===0 ? words.playFirst : words.playAgain}<ArrowRight size={16}/></button>
      </section>
      <section className="passport-performance rounded-[22px] p-3.5 bg-[#111a17] border border-white/[0.09] mb-3">
        <div className="flex justify-between items-center gap-2 mb-3">
          <div><h2 className="text-[12px] font-extrabold tracking-[0.1em] flex items-center gap-2"><Activity size={16} className="text-teal-300"/>{words.performance}</h2><p className="text-[11px] text-[#98aea2] mt-1">{words.last}</p></div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-[#c5d9cb] font-bold tabular-nums">{total} {words.games}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {results.map((item) => (
            <div key={item.label} className="text-center min-w-0 rounded-xl bg-[#0b120e] border border-white/[0.06] p-2">
              <div className={'truncate text-[11px] font-semibold ' + item.color}>{item.label}</div>
              <div className="text-[23px] text-white font-extrabold tabular-nums mt-1">{item.amount}</div>
            </div>
          ))}
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden bg-[#29322d] mt-3 flex" aria-label={words.performance}>
          {total>0 && <>
            <div style={{width:String((performance.wins/total)*100)+'%'}} className="bg-[#66ca99]"/>
            <div style={{width:String((performance.draws/total)*100)+'%'}} className="bg-[#acbab1]"/>
            <div style={{width:String((performance.losses/total)*100)+'%'}} className="bg-[#eb8b9a]"/>
          </>}
        </div>
        <div className="flex justify-between mt-2 text-[11px] font-semibold"><span className="text-[#9db1a3]">{t('profile.winRate')}</span><span className="tabular-nums text-white">{total>0 ? performance.rate : 0}%</span></div>
      </section>
      <section className="passport-recent mb-3">
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="flex items-center gap-2 text-[12px] tracking-[0.10em] font-extrabold"><Swords size={16} className="text-[#c8d9ce]"/>{words.recent}</h2>
          {recentGames.length>3 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value=>!value)} className="min-h-11 flex items-center gap-1 text-[12px] font-bold text-[#84dbbc]">{expanded?words.less:words.all}<ChevronDown size={15} className={expanded?'rotate-180':''}/></button>}
        </div>
        {recentGames.length===0 ? (
          <div className="flex gap-3 items-center p-3.5 rounded-[18px] border border-dashed border-white/15 bg-[#131b17]">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.04] flex items-center justify-center"><Swords size={18} className="text-[#8aa398]"/></div>
            <div><p className="font-bold text-[13px]">{words.empty}</p><p className="text-[11px] text-[#9aada0] mt-1">{words.emptyInfo}</p></div>
          </div>
        ) : (
          <div className="space-y-2">
            {(expanded?recentGames:recentGames.slice(0,3)).map((game,i)=>(
              <div key={i} className="min-w-0 flex items-center gap-3 p-3 bg-[#151e19] border border-white/[0.075] rounded-[16px]">
                <span className={'shrink-0 w-[52px] min-h-10 rounded-xl flex items-center justify-center text-[9px] font-extrabold ' + (game.result==='win'?'bg-[#235340] text-[#a7edc1]':game.result==='loss'?'bg-[#522f36] text-[#ffc2cb]':'bg-[#3a423d] text-[#e8f0e9]')}>{game.result==='win'?words.win:game.result==='loss'?words.loss:words.draw}</span>
                <div className="flex-1 min-w-0"><p className="truncate font-bold text-[13px]" title={game.opp}>{words.vs} {game.opp}</p><p className="text-[11px] text-[#9db1a6] mt-1">{game.date}</p></div>
                <span className="shrink-0 px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06] font-semibold text-[11px] text-[#dce7dd]">{game.type}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="passport-achievements flex items-center gap-3 p-3.5 bg-[#111916] border border-white/[0.085] rounded-[18px] mb-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-[#8e6d33]/15 border border-[#d4b36a]/20 flex items-center justify-center"><Trophy size={20} className="text-[#dec482]"/></div>
        <div className="flex-1 min-w-0"><h2 className="text-[12px] font-extrabold tracking-[0.09em]">{words.achievements}</h2><p className="mt-1 text-[11px] leading-5 text-[#9fb0a6]">{words.achievementsInfo}</p></div><Lock size={15} className="shrink-0 text-[#7c9788]"/>
      </section>
      <footer className="text-center text-[10px] font-bold tracking-[0.1em] text-[#708679] pb-2">{words.tagline} · CHESSAZ.DE</footer>
    </div>
  );
}
