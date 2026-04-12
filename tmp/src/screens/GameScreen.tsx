import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import ChessBoard from '../components/ChessBoard';
import { Flag, Handshake, Send, ChevronLeft, ChevronRight, FastForward, Rewind, Sparkles, Languages, MessageSquare, History, Cpu } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AIChatAssistant from '../components/AIChatAssistant';
import { translateMock } from '../utils/chatAssistantLogic';
import EvaluationBar from '../components/EvaluationBar';
import AnalysisPanel from '../components/AnalysisPanel';
import { StockfishEngine, type EngineResult } from '../utils/StockfishEngine';
import { Chess, type Move } from 'chess.js';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function GameScreen() {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'moves' | 'chat' | 'analysis'>('moves');
  const [timeLeft, setTimeLeft] = useState({ black: 600, white: 600 });

  // Chess Game State
  const [game, setGame] = useState(new Chess());
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');
  const playerColor = (searchParams.get('color') as 'w' | 'b') || 'w';

  useEffect(() => {
    if (!socket || !roomId) return;
    const onStart = (data: any) => {
      setTimeLeft({ white: data.whiteTime, black: data.blackTime });
    };
    const onUpdate = (data: any) => {
      setGame(new Chess(data.fen));
      if (data.whiteTime !== undefined) {
         setTimeLeft({ white: data.whiteTime, black: data.blackTime });
      }
    };
    const onGameOver = (data: any) => {
      // Basic implementation; could trigger a modal state
      setTimeout(() => alert(`Game Over! Result: ${data.reason}`), 500);
    }
    
    socket.on('game_start', onStart);
    socket.on('update_board', onUpdate);
    socket.on('game_over', onGameOver);
    
    return () => { 
      socket.off('game_start', onStart);
      socket.off('update_board', onUpdate); 
      socket.off('game_over', onGameOver);
    };
  }, [socket, roomId]);

  // Chat States
  const [chatInput, setChatInput] = useState("");
  const [showChatAssistant, setShowChatAssistant] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});

  const initialGameMsgs = [
    { user: 'SiberianTiger', msg: 'gl hf!', time: '21:34', self: false },
    { user: 'You', msg: 'u2', time: '21:35', self: true },
  ];
  const [gameMsgs, setGameMsgs] = useState(initialGameMsgs);

  // Analysis States
  const engineRef = useRef<StockfishEngine | null>(null);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Ticking timer effect depending on turn
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const turn = game.turn();
        return {
          ...prev,
          white: turn === 'w' ? Math.max(prev.white - 1, 0) : prev.white,
          black: turn === 'b' ? Math.max(prev.black - 1, 0) : prev.black
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [game]);

  // Engine Initialization
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new StockfishEngine();
      engineRef.current.onResult((res) => {
        setEngineResult(res);
        setIsAnalysing(false);
      });
      engineRef.current.onError(() => {
        setIsAnalysing(false);
      });
    }
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update analysis when tab changes to analysis or fen changes
  useEffect(() => {
    if (activeTab === 'analysis' && engineRef.current) {
      setIsAnalysing(true);
      engineRef.current.analyze(game.fen());
    } else if (engineRef.current) {
      engineRef.current.stop();
    }
  }, [activeTab, game.fen()]);

  const handleGameMove = (source: string, target: string, promotion: string = 'q') => {
    try {
      const g = new Chess(game.fen());
      const move = g.move({ from: source, to: target, promotion });
      if (move) {
        if (socket && roomId) {
          socket.emit('make_move', { roomId, move: { from: source, to: target, promotion } });
          // Note: standard approach waits for update_board event to confirm move, but we can optimistically update
          setGame(g);
        } else {
          setGame(g);
        }
        
        // Auto-analyze move if analysis pane is open
        if (activeTab === 'analysis' && engineRef.current) {
          engineRef.current.analyze(g.fen());
        }
        
        // Ensure game over states are handled properly
        if (g.isGameOver()) {
          // You could show a game over modal here
        }
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };



  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg = {
      user: 'You',
      msg: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      self: true
    };
    setGameMsgs([...gameMsgs, newMsg]);
    setChatInput("");
  };

  const handleTranslateGameMsg = (index: number, text: string) => {
    if (translatedMessages[index]) {
      const newMap = { ...translatedMessages };
      delete newMap[index];
      setTranslatedMessages(newMap);
    } else {
      setTranslatedMessages({
        ...translatedMessages,
        [index]: translateMock(text, language)
      });
    }
  };

  const handleAssistantSelect = (text: string) => {
    setChatInput(text);
    setShowChatAssistant(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };



  const tabs = [
    { id: 'moves', icon: History, label: t('game.tabs.moves') },
    { id: 'chat', icon: MessageSquare, label: t('game.tabs.chat') },
    { id: 'analysis', icon: Cpu, label: t('game.tabs.analysis') },
  ] as const;

  // Build Move Pairs
  const historyMoves = game.history({ verbose: true }) as Move[];
  const movePairs = [];
  for (let i = 0; i < historyMoves.length; i += 2) {
    movePairs.push({
      n: Math.floor(i / 2) + 1,
      w: historyMoves[i].san,
      b: historyMoves[i + 1]?.san || '',
      wTime: '--',
      bTime: '--',
    });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full max-w-[100rem] mx-auto px-2 lg:px-4 xl:px-6 pb-0 lg:pb-1 pt-0 gap-3 overflow-hidden bg-[#161512] animate-fade-in relative transition-all lg:items-center lg:-mt-12 lg:h-[calc(100vh-85px)]">

      {/* Board Area - Central Focus */}
      <div className="flex-1 flex flex-col items-center justify-between relative min-h-0 animate-scale-up group w-full py-0 lg:-translate-y-12">

        <div className="w-full lg:max-w-[70vh] xl:max-w-[82vh] flex flex-col justify-center h-full gap-1 relative mx-auto min-h-0">

          <div className="flex justify-between items-center px-3 py-1 bg-black/40 rounded-xl border border-white/5 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 shrink-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black">
                  <span className="text-sm">🇷🇺</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-[2px] border-[#161512] animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-xs tracking-tight italic">SiberianTiger</span>
                  <span className="text-[0.45rem] font-black bg-white/10 text-neutral-400 px-1 py-0.5 rounded leading-none uppercase tracking-widest">GM</span>
                </div>
                <div className="text-[0.55rem] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5 opacity-60 leading-none">ELITE: 2952</div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] px-3 py-1 rounded-lg border-b-[2px] border-neutral-800 font-mono text-lg font-black text-neutral-400 shadow-xl flex items-center justify-center min-w-[75px] ring-1 ring-white/5">
              {formatTime(timeLeft.black)}
            </div>
          </div>

          <div className="relative flex gap-4 md:gap-6 h-full min-h-0 flex-1 w-full justify-center group/board items-center py-1">

            <div className={cx(
              "transition-all duration-1000 ease-in-out self-stretch rounded-2xl overflow-hidden py-1",
              activeTab === 'analysis' ? "w-6 md:w-8 opacity-100 translate-x-0" : "w-0 opacity-0 overflow-hidden -translate-x-8 pointer-events-none"
            )}>
              <EvaluationBar
                score={engineResult?.evaluation || 0.0}
                isMate={!!engineResult?.mate}
                mateIn={engineResult?.mate}
                className="h-full rounded-xl ring-1 ring-white/10"
              />
            </div>

            <div className="flex-1 w-full max-h-full aspect-square relative rounded-[1.5rem] overflow-hidden shadow-[0_45px_100px_-20px_rgba(0,0,0,1)] border-b-[8px] border-black/60 ring-1 ring-white/5 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none z-10" />
              <ChessBoard game={game} onMove={handleGameMove} orientation={playerColor} />
            </div>
          </div>

          <div className="flex justify-between items-center px-3 py-1 bg-black/40 rounded-xl border border-white/5 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 shrink-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="relative group/avatar">
                <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center overflow-hidden shadow-2xl border border-chess-gold/30 ring-1 ring-black group-hover/avatar:ring-chess-gold transition-all duration-500">
                  <span className="text-sm">{language === 'az' ? '🇦🇿' : '🇹🇷'}</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-[2px] border-[#161512] shadow-xl animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-xs tracking-tight italic">{profile?.username || user?.user_metadata?.username || 'Guest'}</span>
                  <span className="bg-chess-gold/20 text-chess-gold text-[0.45rem] px-1 py-0.5 rounded font-black uppercase ring-1 ring-chess-gold/40 shadow-[0_0_20px_rgba(223,176,98,0.35)] border border-chess-gold/20 tracking-widest">{profile?.role || 'PRO'}</span>
                </div>
                <div className="text-[0.55rem] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5 opacity-60 leading-none">RATING: 2850</div>
              </div>
            </div>
            <div className="bg-neutral-950 px-3 py-1 rounded-lg border-b-[2px] border-chess-active font-mono text-lg font-black text-white shadow-[0_15px_50px_-5px_rgba(0,206,209,0.5)] ring-1 ring-chess-active/40 flex items-center justify-center min-w-[75px] transition-all hover:translate-y-[-1px] active:translate-y-[1px]">
              {formatTime(timeLeft.white)}
            </div>
          </div>

        </div>
      </div>

      {/* Professional Sidebar Sidebar Tabs */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col bg-neutral-900/60 backdrop-blur-[60px] rounded-[2rem] border border-white/10 shadow-2xl h-fit lg:min-h-[610px] animate-fade-in-right relative overflow-hidden border-b-[8px] border-black/80 ring-1 ring-white/5 min-h-0">

        {/* Premium Segmented Control Tab Navigation */}
        <nav className="p-0.5 bg-black/40 border-b border-white/[0.03] relative z-20 shrink-0">
          <div className="flex bg-neutral-900/80 p-1 rounded-xl gap-0.5 relative overflow-hidden ring-1 ring-white/5">
            <div
              className={cx(
                "absolute top-1 bottom-1 bg-white/10 rounded-lg transition-all duration-500 ease-in-out shadow-lg ring-1 ring-white/10",
                activeTab === 'moves' ? "left-1 w-[calc(33.33%-4px)]" :
                  activeTab === 'chat' ? "left-[calc(33.33%+1px)] w-[calc(33.33%-4px)]" :
                    "left-[calc(66.66%+1px)] w-[calc(33.33%-4px)]"
              )}
            />
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cx(
                  "flex-1 py-1 px-1 rounded-lg text-[0.45rem] font-bold uppercase tracking-[0.1em] transition-all duration-300 flex flex-col items-center gap-0.5 relative z-10",
                  activeTab === tab.id ? "text-white scale-105 drop-shadow-md" : "text-neutral-600 hover:text-neutral-400 opacity-60 hover:opacity-100"
                )}
              >
                <tab.icon size={12} className={cx("transition-transform group-hover:scale-110", activeTab === tab.id ? "text-chess-active" : "text-neutral-700")} />
                <span className="truncate w-full text-center scale-90 opacity-80 leading-tight">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-hidden flex flex-col bg-black/[0.05]">

          {activeTab === 'moves' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in bg-black/[0.1]">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-neutral-950/95 backdrop-blur-3xl z-20 border-b border-white/[0.03]">
                    <tr className="text-[0.6rem] font-black text-neutral-600 uppercase tracking-[0.2em]">
                      <th className="py-1.5 px-3 text-center w-12 border-r border-white/[0.03]">#</th>
                      <th className="py-1.5 px-4">{t('game.white')}</th>
                      <th className="py-1.5 px-4">{t('game.black')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {movePairs.map((move, i) => (
                      <tr key={i} className="hover:bg-white/[0.04] transition-all group cursor-pointer text-xs font-black relative group/row">
                        <td className="py-1.5 px-2 text-neutral-600 bg-black/30 text-center border-r border-white/[0.03] text-[0.7rem] font-mono tracking-tighter italic">{move.n}.</td>
                        <td className="py-1.5 px-4 relative">
                          <div className="flex justify-between items-center group-hover/row:text-chess-gold transition-colors">
                            <span className="text-neutral-300 group-hover/row:scale-105 transition-transform origin-left">{move.w}</span>
                            <span className="text-[0.65rem] text-neutral-700 font-mono italic opacity-40 group-hover:opacity-80">{move.wTime}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-4 relative">
                          <div className="flex justify-between items-center group-hover/row:text-chess-active transition-colors">
                            <span className="text-neutral-300 group-hover/row:scale-105 transition-transform origin-left">{move.b}</span>
                            <span className="text-[0.65rem] text-neutral-700 font-mono italic opacity-40 group-hover:opacity-80">{move.bTime}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="h-11 bg-black/50 border-t border-white/[0.03] flex items-center justify-center gap-6 px-6 shrink-0 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
                <button className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all shadow-xl active:scale-90 group"><Rewind size={18} className="group-hover:scale-110 transition-transform" /></button>
                <button className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all shadow-xl active:scale-90 group"><ChevronLeft size={24} className="group-hover:translate-x-1 transition-transform" /></button>
                <button className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all shadow-xl active:scale-90 group"><ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" /></button>
                <button className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all shadow-xl active:scale-90 group"><FastForward size={18} className="group-hover:scale-110 transition-transform" /></button>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden animate-fade-in relative bg-black/[0.15]">
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-8">
                {gameMsgs.map((m, i) => (
                  <div key={i} className={cx("flex flex-col gap-2 group animate-fade-in-up", m.self ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-4 px-3">
                      {!m.self && (
                        <button onClick={() => handleTranslateGameMsg(i, m.msg)} className="p-2.5 opacity-0 group-hover:opacity-100 transition-all text-neutral-600 hover:text-chess-active bg-white/5 rounded-2xl border border-white/5 backdrop-blur-2xl shadow-xl ring-1 ring-white/5">
                          <Languages size={14} />
                        </button>
                      )}
                      <span className="text-[0.7rem] font-black text-neutral-600 uppercase tracking-[0.3em] italic group-hover:text-neutral-500 transition-colors">{m.user}</span>
                    </div>
                    <div className={cx(
                      "px-4 py-2 rounded-[1.5rem] text-sm font-black border max-w-[95%] shadow-[0_25px_60px_rgba(0,0,0,0.8)] transition-all relative overflow-hidden leading-relaxed",
                      m.self ? "bg-chess-gold/10 text-chess-gold border-chess-gold/30 rounded-tr-none ring-1 ring-chess-gold/20" : "bg-white/5 text-neutral-100 border-white/10 rounded-tl-none backdrop-blur-3xl ring-1 ring-white/5"
                    )}>
                      {translatedMessages[i] || m.msg}
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative mt-auto pt-4 border-t border-white/10">
                {showChatAssistant && <AIChatAssistant currentInput={chatInput} onSelect={handleAssistantSelect} onClose={() => setShowChatAssistant(false)} />}
                <div className="relative group/input">
                  <div className="absolute -inset-1 bg-gradient-to-r from-chess-gold/20 to-chess-active/20 blur opacity-0 group-hover/input:opacity-100 transition-opacity rounded-[2rem] pointer-events-none" />
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t('game.chat.placeholder')} className="relative w-full bg-black/80 border border-white/10 rounded-[2rem] py-3 pl-4 pr-24 text-sm text-white placeholder-neutral-800 font-black focus:outline-none focus:border-chess-active transition-all shadow-[inset_0_5px_15px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.03] tracking-tight" />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    <button onClick={() => setShowChatAssistant(!showChatAssistant)} className={cx("p-3 rounded-2xl transition-all shadow-2xl active:scale-95 group/sparkle", showChatAssistant ? "bg-chess-active text-white scale-110" : "text-neutral-600 hover:text-chess-active hover:bg-chess-active/10")}>
                      <Sparkles size={24} className="group-hover/sparkle:rotate-12 transition-transform" />
                    </button>
                    <button onClick={handleSendMessage} className="p-3 text-neutral-600 hover:text-white bg-white/5 rounded-2xl hover:bg-white/10 shadow-2xl group/send active:scale-90 ring-1 ring-white/10">
                      <Send size={24} className="group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
              </div>
            )}

          {activeTab === 'analysis' && (
            <AnalysisPanel
              score={engineResult?.evaluation || 0.0}
              bestMove={engineResult?.bestMove}
              depth={engineResult?.depth || 0}
              mate={engineResult?.mate}
              loading={isAnalysing}
              candidates={engineResult?.continuation ? [engineResult.continuation] : undefined}
              noMoves={historyMoves.length === 0}
              error={engineRef.current?.hasFailed() || !engineRef.current?.isReady()}
            />
          )}

        </div>

        {/* Professional Game Control Center */}
        <div className="p-2 bg-black/60 border-t border-white/10 grid grid-cols-2 gap-2 shrink-0 shadow-[0_-30px_60px_-15px_rgba(0,0,0,0.8)] relative z-30 ring-1 ring-white/5 backdrop-blur-3xl">
          <button className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 font-black text-[0.6rem] uppercase tracking-[0.1em] border border-white/5 group shadow-2xl transition-all active:scale-95 hover:border-red-500/20 ring-1 ring-white/5">
            <Flag size={16} className="group-hover:rotate-[15deg] group-hover:scale-110 transition-all duration-500" />
            {t('game.resign')}
          </button>
          <button className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-500 hover:text-white font-black text-[0.6rem] uppercase tracking-[0.1em] border border-white/5 shadow-2xl transition-all active:scale-95 group hover:border-white/20 ring-1 ring-white/5">
            <Handshake size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-all duration-500" />
            {t('game.draw')}
          </button>
        </div>

      </div>
    </div>
  );
}
