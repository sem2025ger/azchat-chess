import { useState, useEffect, useRef, useMemo } from 'react';
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

  // User preferences applied automatically via ThemeContext
  const [activeTab, setActiveTab] = useState<'moves' | 'chat' | 'analysis'>('moves');
  const [timeLeft, setTimeLeft] = useState({ black: 600, white: 600 });
  const [viewMoveIndex, setViewMoveIndex] = useState<number>(-1);
  const [positionHistory, setPositionHistory] = useState<string[]>(() => [new Chess().fen()]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  // Chess Game State
  const [game, setGame] = useState(new Chess());
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');
  const playerColor = (searchParams.get('color') as 'w' | 'b') || 'w';

  const lastConfirmedFenRef = useRef(new Chess().fen());
  const [moveRejectMessage, setMoveRejectMessage] = useState<string | null>(null);
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);

  const mapGameOverReason = (reason?: string) => {
    switch (reason) {
      case 'opponent_disconnected': return "Opponent disconnected. Game over.";
      case 'checkmate': return "Game over: checkmate.";
      case 'draw': return "Game over: draw.";
      case 'stalemate': return "Game over: stalemate.";
      case 'game_over': return "Game over.";
      default: return "Game over.";
    }
  };

  useEffect(() => {
    if (!socket || !roomId) return;
    const onStart = (data: any) => {
      setTimeLeft({ white: data.whiteTime, black: data.blackTime });
    };
    const onUpdate = (data: any) => {
      lastConfirmedFenRef.current = data.fen;
      setMoveRejectMessage(null);
      setGame(new Chess(data.fen));
      setPositionHistory(prev => prev[prev.length - 1] === data.fen ? prev : [...prev, data.fen]);
      setViewMoveIndex(-1);
      if (data.whiteTime !== undefined) {
         setTimeLeft({ white: data.whiteTime, black: data.blackTime });
      }
    };
    const onGameOver = (data: any) => {
      setGameOverMessage(mapGameOverReason(data?.reason));
    };

    const onMoveRejected = (data: { reason?: string }) => {
      const confirmedFen = lastConfirmedFenRef.current;
      const rollbackGame = new Chess(confirmedFen);

      setGame(rollbackGame);
      setPositionHistory((prev) => {
        const idx = prev.lastIndexOf(confirmedFen);
        return idx >= 0 ? prev.slice(0, idx + 1) : [confirmedFen];
      });
      setViewMoveIndex(-1);

      let msg = "Move rejected by server.";
      if (data?.reason === 'not_your_turn') msg = "Move rejected: it is not your turn.";
      else if (data?.reason === 'illegal_move') msg = "Move rejected: illegal move.";
      else if (data?.reason === 'invalid_payload') msg = "Move rejected: invalid move data.";
      else if (data?.reason === 'room_not_found') msg = "Game session expired. Please start a new game.";
      
      setMoveRejectMessage(msg);
    };
    
    socket.on('game_start', onStart);
    socket.on('update_board', onUpdate);
    socket.on('game_over', onGameOver);
    socket.on('move_rejected', onMoveRejected);
    
    return () => { 
      socket.off('game_start', onStart);
      socket.off('update_board', onUpdate); 
      socket.off('game_over', onGameOver);
      socket.off('move_rejected', onMoveRejected);
    };
  }, [socket, roomId]);

  // Chat States
  const [chatInput, setChatInput] = useState("");
  const [showChatAssistant, setShowChatAssistant] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});

  const initialGameMsgs: { user: string; msg: string; time: string; self: boolean }[] = [];
  const [gameMsgs, setGameMsgs] = useState(initialGameMsgs);

  // Analysis States
  const engineRef = useRef<StockfishEngine | null>(null);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Ticking timer effect removed (Phase 2C-A) to prevent desync until real server clocks are implemented.

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
    if (viewMoveIndex !== -1) {
      setViewMoveIndex(-1);
      return false;
    }
    try {
      const g = new Chess(game.fen());
      const move = g.move({ from: source, to: target, promotion });
      if (move) {
        if (socket && roomId) {
          socket.emit('make_move', { roomId, move: { from: source, to: target, promotion } });
          setGame(g);
          setPositionHistory(prev => prev[prev.length - 1] === g.fen() ? prev : [...prev, g.fen()]);
          setViewMoveIndex(-1);
        } else {
          setGame(g);
          setPositionHistory(prev => prev[prev.length - 1] === g.fen() ? prev : [...prev, g.fen()]);
          setMoveHistory(prev => [...prev, move.san]);
          setViewMoveIndex(-1);
        }
        
        // Auto-analyze move if analysis pane is open
        if (activeTab === 'analysis' && engineRef.current) {
          engineRef.current.analyze(g.fen());
        }
        
        // Ensure game over states are handled properly
        if (g.isGameOver()) {
          if (g.isCheckmate()) setGameOverMessage('Game over: checkmate.');
          else if (g.isDraw()) setGameOverMessage('Game over: draw.');
          else if (g.isStalemate()) setGameOverMessage('Game over: stalemate.');
          else setGameOverMessage('Game over.');
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
  const renderMoves = (!socket || !roomId) 
    ? moveHistory 
    : (game.history({ verbose: true }) as Move[]).map(m => m.san);
  const movePairs = [];
  for (let i = 0; i < renderMoves.length; i += 2) {
    movePairs.push({
      n: Math.floor(i / 2) + 1,
      w: renderMoves[i],
      b: renderMoves[i + 1] || '',
      wTime: '--',
      bTime: '--',
    });
  }

  const displayedGame = useMemo(() => {
    if (viewMoveIndex === -1) return game;
    try {
      const safeIndex = Math.max(0, Math.min(viewMoveIndex, positionHistory.length - 1));
      return new Chess(positionHistory[safeIndex]);
    } catch (e) {
      console.error("Failed to load historical FEN", e);
      return game;
    }
  }, [game, viewMoveIndex, positionHistory]);

  const hasHistory = positionHistory.length > 1;

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full max-w-[100rem] mx-auto px-0 md:px-2 lg:px-4 xl:px-6 pb-12 md:pb-6 lg:pb-1 pt-0 md:pt-2 lg:pt-0 gap-1 md:gap-4 lg:gap-3 overflow-y-auto lg:overflow-hidden bg-transparent animate-fade-in relative transition-all lg:items-center lg:-mt-12 min-h-full lg:h-[calc(100vh-85px)]">

      {/* Mobile Analysis Drawer Header */}
      <div className="flex flex-col items-center justify-start lg:justify-between relative min-h-0 animate-scale-up group w-full py-0 lg:-translate-y-12 lg:flex-1">

        <div className="w-full lg:max-w-[70vh] xl:max-w-[82vh] flex flex-col justify-start lg:justify-center gap-0 md:gap-2 lg:gap-1 relative mx-auto min-h-0 lg:h-full">

          <div className="flex justify-between items-center px-3 py-1 bg-black/40 rounded-xl border border-white/5 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 shrink-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-[2px] border-[#161512] animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-xs tracking-tight italic">Opponent</span>
                </div>
                <div className="text-[0.55rem] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5 opacity-60 leading-none">UNRATED</div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] px-3 py-1 rounded-lg border-b-[2px] border-neutral-800 font-mono text-lg font-black text-neutral-400 shadow-xl flex items-center justify-center min-w-[75px] ring-1 ring-white/5">
              {formatTime(timeLeft.black)}
            </div>
          </div>

          <div className="relative flex gap-0 md:gap-6 w-full justify-center group/board items-center py-0 md:py-1 lg:h-full lg:min-h-0 lg:flex-1">

            <div className={cx(
              "hidden md:block transition-all duration-1000 ease-in-out self-stretch rounded-2xl overflow-hidden py-1",
              activeTab === 'analysis' ? "w-6 md:w-8 opacity-100 translate-x-0" : "w-0 opacity-0 overflow-hidden -translate-x-8 pointer-events-none"
            )}>
              <EvaluationBar
                score={engineResult?.evaluation || 0.0}
                isMate={!!engineResult?.mate}
                mateIn={engineResult?.mate}
                className="h-full rounded-xl ring-1 ring-white/10"
              />
            </div>

            <div className="w-full max-w-none shrink-0 aspect-square relative rounded-none md:rounded-[1.5rem] overflow-hidden shadow-2xl md:shadow-[0_45px_100px_-20px_rgba(0,0,0,1)] border-b-[2px] md:border-b-[8px] border-black/60 ring-0 md:ring-1 ring-white/5 mx-auto sm:max-w-[560px] lg:max-w-none lg:flex-1 lg:max-h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none z-10" />
              
              {gameOverMessage ? (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                  <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center">
                    <span className="text-white font-black text-xl tracking-wide">{gameOverMessage}</span>
                    <button 
                      onClick={() => window.location.href = '/play'} 
                      className="bg-chess-active hover:bg-chess-active/80 text-white px-6 py-2 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                    >
                      New Game
                    </button>
                  </div>
                </div>
              ) : moveRejectMessage ? (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-2xl backdrop-blur-md animate-fade-in text-center pointer-events-none">
                  {moveRejectMessage}
                </div>
              ) : null}

              <ChessBoard
                overrideBoardTheme="Classic Green"
                game={displayedGame}
                onMove={handleGameMove}
                orientation={playerColor}
                readOnly={viewMoveIndex !== -1 || !!gameOverMessage}
              />
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
                <div className="text-[0.55rem] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-0.5 opacity-60 leading-none">UNRATED</div>
              </div>
            </div>
            <div className="bg-neutral-950 px-3 py-1 rounded-lg border-b-[2px] border-chess-active font-mono text-lg font-black text-white shadow-[0_15px_50px_-5px_rgba(0,206,209,0.5)] ring-1 ring-chess-active/40 flex items-center justify-center min-w-[75px] transition-all hover:translate-y-[-1px] active:translate-y-[1px]">
              {formatTime(timeLeft.white)}
            </div>
          </div>

        </div>
      </div>

      {/* Professional Sidebar Sidebar Tabs */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col bg-transparent md:bg-[#121212]/80 md:backdrop-blur-[60px] rounded-none md:rounded-[1.5rem] lg:rounded-[2rem] border-0 md:border-[2px] border-transparent shadow-none md:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] min-h-0 md:min-h-[400px] lg:h-fit lg:min-h-[610px] animate-fade-in-right relative overflow-hidden border-b-0 md:border-b-[4px] border-b-black/40 panel-glow-cycle transition-all lg:flex-1 mx-2 md:mx-0">

        {/* Premium Segmented Control Tab Navigation */}
        <nav className="hidden md:block p-0.5 bg-black/40 border-b border-white/[0.03] relative z-20 shrink-0">
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
                <span className={cx("truncate w-full text-center scale-90 leading-tight font-black", activeTab === tab.id ? "text-glow-cycle opacity-100" : "opacity-80")}>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="hidden md:flex flex-1 overflow-hidden flex-col bg-black/[0.05]">

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
                <button disabled={!hasHistory} onClick={() => { if (hasHistory) setViewMoveIndex(0); }} className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all duration-150 shadow-xl active:scale-90 group disabled:opacity-30 disabled:pointer-events-none"><Rewind size={18} className="group-hover:scale-110 transition-transform" /></button>
                <button disabled={!hasHistory} onClick={() => { 
                  if (!hasHistory) return;
                  const currentIndex = viewMoveIndex === -1 ? positionHistory.length - 1 : viewMoveIndex;
                  setViewMoveIndex(Math.max(0, currentIndex - 1));
                }} className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all duration-150 shadow-xl active:scale-90 group disabled:opacity-30 disabled:pointer-events-none"><ChevronLeft size={24} className="group-hover:translate-x-1 transition-transform" /></button>
                <button disabled={!hasHistory} onClick={() => {
                  if (!hasHistory) return;
                  if (viewMoveIndex === -1) return;
                  if (viewMoveIndex >= positionHistory.length - 2) {
                    setViewMoveIndex(-1);
                  } else {
                    setViewMoveIndex(viewMoveIndex + 1);
                  }
                }} className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all duration-150 shadow-xl active:scale-90 group disabled:opacity-30 disabled:pointer-events-none"><ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" /></button>
                <button disabled={!hasHistory} onClick={() => setViewMoveIndex(-1)} className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded-2xl transition-all duration-150 shadow-xl active:scale-90 group disabled:opacity-30 disabled:pointer-events-none"><FastForward size={18} className="group-hover:scale-110 transition-transform" /></button>
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
              noMoves={renderMoves.length === 0}
              error={engineRef.current?.hasFailed() || !engineRef.current?.isReady()}
            />
          )}

        </div>

        {viewMoveIndex !== -1 && (
          <div className="md:hidden text-center text-chess-gold text-xs font-bold animate-pulse mt-2 -mb-1">
            Replay mode — press Live to move
          </div>
        )}
        {/* Mobile Move Controls Row */}
        <div className="flex md:hidden items-center justify-between gap-2 py-2 px-1 mx-2 shrink-0 mt-auto mb-1 z-10">
          <button 
            onClick={() => { if (hasHistory) setViewMoveIndex(0); }} 
            disabled={!hasHistory} 
            className="flex-1 flex justify-center text-white p-2.5 rounded-xl transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:pointer-events-none bg-white/5 border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 ring-1 ring-white/5"
          >
            <Rewind size={18} />
          </button>
          
          <button 
            onClick={() => { 
              if (!hasHistory) return;
              const currentIndex = viewMoveIndex === -1 ? positionHistory.length - 1 : viewMoveIndex;
              setViewMoveIndex(Math.max(0, currentIndex - 1));
            }} 
            disabled={!hasHistory} 
            className="flex-1 flex justify-center text-white p-2.5 rounded-xl transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:pointer-events-none bg-white/5 border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 ring-1 ring-white/5"
          >
            <ChevronLeft size={22} />
          </button>
          
          <button 
            onClick={() => setViewMoveIndex(-1)} 
            disabled={!hasHistory} 
            className="flex-[1.5] flex justify-center text-white hover:text-white p-2.5 rounded-xl transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:pointer-events-none bg-chess-active/80 border border-chess-active/50 shadow-[0_5px_15px_rgba(0,206,209,0.3)] ring-1 ring-chess-active/40"
          >
            <History size={20} className={viewMoveIndex !== -1 ? "animate-pulse" : ""} />
          </button>
          
          <button 
            onClick={() => {
              if (!hasHistory) return;
              if (viewMoveIndex === -1) return;
              if (viewMoveIndex >= positionHistory.length - 2) {
                setViewMoveIndex(-1);
              } else {
                setViewMoveIndex(viewMoveIndex + 1);
              }
            }} 
            disabled={!hasHistory} 
            className="flex-1 flex justify-center text-white p-2.5 rounded-xl transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:pointer-events-none bg-white/5 border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 ring-1 ring-white/5"
          >
            <ChevronRight size={22} />
          </button>
          
          <button 
            onClick={() => setViewMoveIndex(-1)} 
            disabled={!hasHistory} 
            className="flex-1 flex justify-center text-white p-2.5 rounded-xl transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:pointer-events-none bg-white/5 border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 ring-1 ring-white/5"
          >
            <FastForward size={18} />
          </button>
        </div>

        {/* Professional Game Control Center */}
        <div className="p-2 bg-transparent md:bg-black/60 border-0 md:border-t border-white/10 flex md:grid md:grid-cols-2 gap-2 shrink-0 shadow-none md:shadow-[0_-30px_60px_-15px_rgba(0,0,0,0.8)] relative z-30 ring-0 md:ring-1 ring-white/5 md:backdrop-blur-3xl">
          <button disabled className="opacity-50 pointer-events-none flex-1 flex md:flex-col items-center justify-center gap-1 py-1.5 rounded-lg md:rounded-xl bg-white/5 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 font-black text-[0.6rem] uppercase tracking-[0.1em] border border-white/5 group shadow-2xl transition-all duration-150 active:scale-95 hover:border-red-500/20 ring-1 ring-white/5">
            <Flag size={16} className="group-hover:rotate-[15deg] group-hover:scale-110 transition-all duration-200" />
            {t('game.resign')}
          </button>
          <button disabled className="opacity-50 pointer-events-none flex-1 flex md:flex-col items-center justify-center gap-1 py-1.5 rounded-lg md:rounded-xl bg-white/5 hover:bg-white/10 text-neutral-500 hover:text-white font-black text-[0.6rem] uppercase tracking-[0.1em] border border-white/5 shadow-2xl transition-all duration-150 active:scale-95 group hover:border-white/20 ring-1 ring-white/5">
            <Handshake size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-all duration-200" />
            {t('game.draw')}
          </button>
        </div>

      </div>
    </div>
  );
}
