import { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, type CSSProperties } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import ChessBoard from '../components/ChessBoard';
import { Flag, Handshake, ChevronLeft, ChevronRight, FastForward, Rewind, History, Cpu, RotateCcw, Clock, Map, FolderOpen, Pencil, X, ArrowUpDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import EvaluationBar from '../components/EvaluationBar';
import AnalysisPanel from '../components/AnalysisPanel';
import AnalysisWorkspaceHeader from '../components/analysis/AnalysisWorkspaceHeader';
import { MobileAnalysisHeader, MobileAnalysisDetails } from '../components/analysis/MobileAnalysis';
import { mobileAnalysisCopy } from '../components/analysis/mobileAnalysisCopy';
import { StockfishEngine, type EngineResult } from '../utils/StockfishEngine';
import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';
import PositionMap from '../components/analysis/PositionMap';
import { positionMapLabel } from '../components/analysis/positionMapLabels';
import { reviewLayout } from '../utils/reviewLayout';
import type { PositionEvaluation } from '../utils/positionMap';
import { playChessSound, preloadChessSounds, setChessSoundMuted, type ChessSoundType } from '../utils/chessSounds';
import { useThemeContext } from '../context/ThemeContext';
import { createTimeoutManager } from '../utils/timeoutManager';
import { emptyAnalysisSession, loadAnalysisSession, saveAnalysisSession } from '../utils/analysisSession';
import { analysisMovePairs, positionDraft, placeDraftPiece, analysisFromFen, type PositionDraft, type AnalysisLoad } from '../utils/analysisWorkspace';
import { analysisCopy } from '../components/analysis/copy';
import { attachLiveRecovery, decodeLiveSnapshot } from '../utils/liveGameRecovery';
const GamesLibraryPanel = lazy(() => import('../components/analysis/GamesLibraryPanel'));
const PositionTools = lazy(() => import('../components/analysis/PositionTools'));
const EditorBoard = lazy(() => import('../components/analysis/EditorBoard'));

function countryCodeToFlag(code: string): string | null {
  const normalized = code.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }

  return normalized
    .split('')
    .map(char =>
      String.fromCodePoint(0x1F1E6 + char.charCodeAt(0) - 65)
    )
    .join('');
}

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface GameScreenProps {
  mode: 'live' | 'review';
}

export default function GameScreen({ mode }: GameScreenProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const words = analysisCopy[language];
  const [workspaceTab, setWorkspaceTab] = useState<'analysis' | 'map' | 'games' | 'position'>('analysis');
  // The mobile analysis tools open only on demand; preserve the full-size board.
  const [mobileTool, setMobileTool] = useState<'map' | 'games' | 'position' | null>(null);
  const mobileToolDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (mobileTool && mobileToolDialogRef.current && !mobileToolDialogRef.current.open) {
      mobileToolDialogRef.current.showModal();
    }
    if (!mobileTool) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileTool]);
  const [pvLines, setPvLines] = useState(3);
  const [mobileOrientation, setMobileOrientation] = useState<'w' | 'b'>('w');
  const [planHighlight, setPlanHighlight] = useState<{ fen: string; squares: Square[] } | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, PositionEvaluation>>({});
  const [loadedGameTitle, setLoadedGameTitle] = useState('');
  const [loadedGameDetails, setLoadedGameDetails] = useState<{ white: string; black: string; timeControl?: string } | null>(null);
  const [editingPosition, setEditingPosition] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (media.matches) { setMobileTool(null); setEditingPosition(false); }
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);
  const tabBeforeEditor = useRef<'analysis' | 'map' | 'games'>('analysis');
  const [editorSelectedPiece, setEditorSelectedPiece] = useState('P');
  const [positionDraftValue, setPositionDraftValue] = useState<PositionDraft>(() => positionDraft(new Chess().fen()));
  const [positionDraftUndo, setPositionDraftUndo] = useState<PositionDraft[]>([]);
  const updatePositionDraft = (next: PositionDraft) => {
    setPositionDraftUndo(history => [...history.slice(-29), positionDraftValue]);
    setPositionDraftValue(next);
  };
  const resetPositionDraft = (fen: string) => { setPositionDraftValue(positionDraft(fen)); setPositionDraftUndo([]); };
  const clearPositionDraft = () => updatePositionDraft({ ...positionDraftValue, squares: Array(64).fill(''), castling: '-', ep: '-', half: '0', full: '1' });
  const placePositionPiece = (index: number, piece = editorSelectedPiece) => updatePositionDraft(placeDraftPiece(positionDraftValue, index, piece));
  const movePositionPiece = (from: number, to: number) => {
    const piece = positionDraftValue.squares[from];
    if (!piece || from === to) return;
    const shifted = placeDraftPiece(positionDraftValue, to, piece);
    const squares = [...shifted.squares];
    squares[from] = '';
    updatePositionDraft({ ...shifted, squares });
  };
  const undoPositionDraft = () => {
    if (!positionDraftUndo.length) return;
    setPositionDraftValue(positionDraftUndo[positionDraftUndo.length - 1]);
    setPositionDraftUndo(previous => previous.slice(0, -1));
  };
  const { user, profile } = useAuth();
  const [initialAnalysis] = useState(() => {
    if (mode !== 'review') return emptyAnalysisSession();
    const sharedFen = new URLSearchParams(window.location.search).get('fen');
    if (sharedFen) {
      try { return analysisFromFen(sharedFen); } catch { /* Invalid shared input never replaces saved analysis. */ }
    }
    return loadAnalysisSession();
  });

  // User preferences applied automatically via ThemeContext
  const [activeTab, setActiveTab] = useState<'moves' | 'analysis'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? 'analysis'
      : 'moves'
  );
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : false
  );
  const effectivePvLines = mode === 'review' && !isDesktop ? 2 : pvLines;

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };
    setIsDesktop(media.matches);
    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    preloadChessSounds();
  }, []);

  const [timeLeft, setTimeLeft] = useState({ black: 600, white: 600 });
  const [viewMoveIndex, setViewMoveIndex] = useState(initialAnalysis.viewMoveIndex);
  const [positionHistory, setPositionHistory] = useState(initialAnalysis.positionHistory);
  const [moveHistory, setMoveHistory] = useState(initialAnalysis.moveHistory);

  // Chess Game State
  const [game, setGame] = useState(initialAnalysis.game);
  useEffect(() => {
    if (mode === 'review') saveAnalysisSession(moveHistory, viewMoveIndex, undefined, positionHistory[0]);
  }, [mode, moveHistory, viewMoveIndex, positionHistory]);
  const { socket, isConnected } = useSocket();
  const [searchParams] = useSearchParams();
  const roomId = mode === 'live' ? searchParams.get('roomId') : null;
  const requestedColor = searchParams.get('color');
  const [serverColor, setServerColor] = useState<{ roomId: string; color: 'w' | 'b' } | null>(null);
  const [syncedRoom, setSyncedRoom] = useState<string | null>(null);
  const playerColor: 'w' | 'b' = serverColor?.roomId === roomId ? serverColor.color : mode === 'live' && requestedColor === 'b' ? 'b' : 'w';
  const isMultiplayer = mode === 'live' && Boolean(roomId);

  // Match the desktop analysis panel's outer height to the actual chessboard frame.
  // ResizeObserver keeps this accurate when viewport dimensions or board sizing change.
  const reviewWorkspaceRef = useRef<HTMLDivElement>(null);
  const [reviewGeometry, setReviewGeometry] = useState<ReturnType<typeof reviewLayout> | null>(null);
  const analysisBoardRef = useRef<HTMLDivElement>(null);
  const [analysisBoardHeight, setAnalysisBoardHeight] = useState<number | null>(null);

  useEffect(() => {
    if (isMultiplayer || mode === 'review' || typeof ResizeObserver === 'undefined') return;
    const board = analysisBoardRef.current;
    if (!board) return;

    const measure = () => {
      if (!window.matchMedia('(min-width: 1280px)').matches) return;
      const height = Math.round(board.offsetHeight);
      if (height > 0) setAnalysisBoardHeight(prev => prev === height ? prev : height);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(board);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isMultiplayer, mode]);

  // Measure review dimensions before first paint to prevent board/panel reflow.
  useLayoutEffect(() => {
    if (mode !== 'review' || typeof ResizeObserver === 'undefined') return;
    const workspace = reviewWorkspaceRef.current;
    if (!workspace) return;
    const measure = () => {
      if (!window.matchMedia('(min-width: 1024px)').matches) return;
      const next = reviewLayout(workspace.clientWidth, workspace.clientHeight);
      if (next.boardSize > 0) setReviewGeometry(previous => previous?.scale === next.scale ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [mode]);

  const playerFlag = profile?.countryCode
    ? countryCodeToFlag(profile.countryCode)
    : null;

  const { sound, boardTheme, confirmMobileMoves } = useThemeContext();
  const soundThemeRef = useRef(sound);
  useEffect(() => {
    soundThemeRef.current = sound;
    setChessSoundMuted(sound === 'Muted / Off');
  }, [sound]);
  const locallyPlayedFenRef = useRef<string | null>(null);

  const lastConfirmedFenRef = useRef(new Chess().fen());
  const [moveRejectMessage, setMoveRejectMessage] = useState<string | null>(null);
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
  const [drawOfferBy, setDrawOfferBy] = useState<'w' | 'b' | null>(null);
  const [gameActionMessage, setGameActionMessage] = useState<string | null>(null);
  const isLiveMultiplayer = isMultiplayer && !gameOverMessage;
  const analysisActive = !isLiveMultiplayer && (isDesktop || activeTab === 'analysis');
  const canSendGameAction =
    isMultiplayer && isConnected && syncedRoom === roomId && Boolean(socket) && Boolean(roomId) && !gameOverMessage;

  const mapGameOverReason = useCallback((data?: { reason?: string; endedBy?: 'w' | 'b' | null }, color = playerColor) => {
    const reason = data?.reason;
    switch (reason) {
      case 'opponent_disconnected': return "Opponent disconnected. Game over.";
      case 'checkmate': return "Game over: checkmate.";
      case 'draw': return "Game over: draw.";
      case 'stalemate': return "Game over: stalemate.";
      case 'resignation':
        return data?.endedBy === color
          ? t('game.result.resignation.self')
          : t('game.result.resignation.opponent');
      case 'timeout':
        return data?.endedBy === color
          ? "You lost on time."
          : "Opponent lost on time. You won!";
      case 'draw_agreement': return t('game.result.drawAgreement');
      case 'game_over': return "Game over.";
      default: return "Game over.";
    }
  }, [playerColor, t]);

  const playerColorRef = useRef(playerColor);
  const tRef = useRef(t);
  const mapGameOverReasonRef = useRef(mapGameOverReason);
  const navigateRef = useRef(navigate);
  const timeoutManagerRef = useRef(createTimeoutManager());

  useEffect(() => {
    playerColorRef.current = playerColor;
    tRef.current = t;
    mapGameOverReasonRef.current = mapGameOverReason;
    navigateRef.current = navigate;
  }, [playerColor, t, mapGameOverReason, navigate]);

  useEffect(() => {
    const tm = timeoutManagerRef.current;
    return () => {
      tm.clearAll();
    };
  }, []);

  useEffect(() => {
    if (!socket || !roomId) return;
    const isCurrentRoomEvent = (data: any) => !data?.roomId || data.roomId === roomId;
    const onStart = (data: any) => {
      setTimeLeft({ white: data.whiteTime, black: data.blackTime });
    };
    const onUpdate = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;
      const snapshot = decodeLiveSnapshot(data);
      if (!snapshot) return;
      const isLocalEcho = data.fen === locallyPlayedFenRef.current;
      if (isLocalEcho) {
        locallyPlayedFenRef.current = null;
      } else {
        const lastSan = Array.isArray(data.history) && data.history.length > 0
          ? data.history[data.history.length - 1]
          : '';
        const soundType: ChessSoundType =
          lastSan.includes('#') || lastSan.includes('+')
            ? 'check'
            : lastSan.includes('x')
              ? 'capture'
              : 'move';
        void playChessSound(soundType, soundThemeRef.current);
      }

      lastConfirmedFenRef.current = data.fen;
      setMoveRejectMessage(null);
      setGame(snapshot.game);
      setPositionHistory(snapshot.positions);
      setViewMoveIndex(-1);
      if (data.whiteTime !== undefined) {
         setTimeLeft({ white: data.whiteTime, black: data.blackTime });
      }
      if (Array.isArray(data.history)) {
        setMoveHistory(data.history);
      }
      if (snapshot.ended) onGameOver(data.outcome);
    };
    const onGameOver = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;
      timeoutManagerRef.current.clear('gameActionMessage');
      timeoutManagerRef.current.clear('disconnectNotice');
      setDrawOfferBy(null);
      setGameActionMessage(null);
      setDisconnectNotice(null);
      setGameOverMessage(mapGameOverReasonRef.current(data, playerColorRef.current));
    };

    const onMoveRejected = (data: { reason?: string }) => {
      locallyPlayedFenRef.current = null;
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

    const onDrawOfferReceived = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;

      const offeredBy = data?.offeredBy;
      if (offeredBy !== 'w' && offeredBy !== 'b') return;

      setDrawOfferBy(offeredBy);
      setGameActionMessage(null);
    };

    const onDrawOfferDeclined = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;

      setDrawOfferBy(null);

      if (!data?.declinedBy || data.declinedBy !== playerColorRef.current) {
        setGameActionMessage(tRef.current('game.draw.declined'));
        timeoutManagerRef.current.set('gameActionMessage', () => setGameActionMessage(null), 4000);
      }
    };

    const onGameActionRejected = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;

      setDrawOfferBy(null);
      setGameActionMessage(tRef.current('game.action.rejected'));
      timeoutManagerRef.current.set('gameActionMessage', () => setGameActionMessage(null), 4000);
    };

    const onPlayerDisconnected = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;
      if (data?.color !== playerColorRef.current) {
        timeoutManagerRef.current.clear('disconnectNotice');
        setDisconnectNotice(data?.graceSeconds ? `Opponent disconnected. Waiting ${data.graceSeconds}s...` : "Opponent disconnected.");
      }
    };

    const onPlayerReconnected = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;
      if (data?.color !== playerColorRef.current) {
        setDisconnectNotice("Opponent reconnected!");
        timeoutManagerRef.current.set('disconnectNotice', () => setDisconnectNotice(null), 3000);
      }
    };

    const onReconnectSuccess = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;
      const snapshot = decodeLiveSnapshot(data);
      if (!snapshot) return;
      timeoutManagerRef.current.clear('reconnectRedirect');
      timeoutManagerRef.current.clear('disconnectNotice');
      setDisconnectNotice(null);
      locallyPlayedFenRef.current = null;
      lastConfirmedFenRef.current = snapshot.game.fen();
      setGame(snapshot.game);
      setPositionHistory(snapshot.positions);
      setViewMoveIndex(-1);
      setSyncedRoom(roomId);
      setMoveRejectMessage(null);
      setDrawOfferBy(snapshot.drawOfferBy);
      if (snapshot.color) {
        playerColorRef.current = snapshot.color;
        setServerColor({ roomId, color: snapshot.color });
      }
      setGameOverMessage(snapshot.ended ? mapGameOverReasonRef.current(data.outcome, playerColorRef.current) : null);
      if (data?.whiteTime !== undefined) {
        setTimeLeft({ white: data.whiteTime, black: data.blackTime });
      }
      if (Array.isArray(data?.history)) {
        setMoveHistory(data.history);
      }
    };

    const onSessionExpired = () => {
      setSyncedRoom(null);
      timeoutManagerRef.current.clear('disconnectNotice');
      setDisconnectNotice(null);
      setGameOverMessage("Session expired or game is no longer active.");
      timeoutManagerRef.current.set('reconnectRedirect', () => {
        navigateRef.current('/play');
      }, 2500);
    };
    const onReconnectFailed = (data: any) => {
      if (!isCurrentRoomEvent(data)) return;
      if (data?.reason === 'recovery_pending' || data?.reason === 'storage_unavailable') {
        setSyncedRoom(null);
        setDisconnectNotice('Recovering game. Reconnecting...');
        return;
      }
      onSessionExpired();
    };
    
    socket.on('game_start', onStart);
    socket.on('update_board', onUpdate);
    socket.on('game_over', onGameOver);
    socket.on('move_rejected', onMoveRejected);
    socket.on('draw_offer_received', onDrawOfferReceived);
    socket.on('draw_offer_declined', onDrawOfferDeclined);
    socket.on('game_action_rejected', onGameActionRejected);
    socket.on('player_disconnected', onPlayerDisconnected);
    socket.on('player_reconnected', onPlayerReconnected);
    socket.on('reconnect_success', onReconnectSuccess);
    socket.on('reconnect_failed', onReconnectFailed);

    const stopRecovery = attachLiveRecovery(socket, roomId, () => setSyncedRoom(null), onSessionExpired);
    
    return () => { 
      stopRecovery();
      timeoutManagerRef.current.clearAll();
      socket.off('game_start', onStart);
      socket.off('update_board', onUpdate); 
      socket.off('game_over', onGameOver);
      socket.off('move_rejected', onMoveRejected);
      socket.off('draw_offer_received', onDrawOfferReceived);
      socket.off('draw_offer_declined', onDrawOfferDeclined);
      socket.off('game_action_rejected', onGameActionRejected);
      socket.off('player_disconnected', onPlayerDisconnected);
      socket.off('player_reconnected', onPlayerReconnected);
      socket.off('reconnect_success', onReconnectSuccess);
      socket.off('reconnect_failed', onReconnectFailed);
    };
  }, [socket, roomId]);

  useEffect(() => {
    setDrawOfferBy(null);
    setGameActionMessage(null);
  }, [roomId]);



  // Analysis States
  const engineRef = useRef<StockfishEngine | null>(null);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [engineFailed, setEngineFailed] = useState(false);
  const [analysisDepth, setAnalysisDepth] = useState(18);

  const loadWorkspaceAnalysis = (analysis: AnalysisLoad, title = '', details?: { white: string; black: string; timeControl?: string }) => {
    if (mode !== 'review') return;
    engineRef.current?.stop();
    setEvaluations({});
    setPlanHighlight(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('fen');
    navigate({ search: nextParams.toString() }, { replace: true });
    setGame(analysis.game);
    setPositionHistory(analysis.positionHistory);
    setMoveHistory(analysis.moveHistory);
    setViewMoveIndex(analysis.viewMoveIndex);
    setGameOverMessage(null);
    setEngineResult(null);
    setEngineFailed(false);
    setLoadedGameTitle(title);
    setLoadedGameDetails(details || null);
    setWorkspaceTab('analysis');
    setMobileTool(null);
    setEditingPosition(false);
    saveAnalysisSession(analysis.moveHistory, analysis.viewMoveIndex, undefined, analysis.positionHistory[0]);
  };

  const startNewAnalysis = () => {
    engineRef.current?.stop();
    setEvaluations({});
    setPlanHighlight(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('fen');
    navigate({ search: nextParams.toString() }, { replace: true });
    const empty = emptyAnalysisSession();
    setLoadedGameTitle('');
    setLoadedGameDetails(null);
    setWorkspaceTab('analysis');
    setMobileTool(null);
    setEditingPosition(false);
    saveAnalysisSession([], -1);
    setGame(empty.game);
    setPositionHistory(empty.positionHistory);
    setMoveHistory([]);
    setViewMoveIndex(-1);
    setGameOverMessage(null);
    setEngineResult(null);
    setEngineFailed(false);
  };

  // Authoritative server clock countdown
  useEffect(() => {
    if (!isLiveMultiplayer) return;
    const timer = setInterval(() => {
      const activeColor = game.turn() === 'w' ? 'white' : 'black';
      setTimeLeft((prev) => ({
        ...prev,
        [activeColor]: Math.max(0, prev[activeColor] - 1),
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLiveMultiplayer, game]);

  // Engine Initialization
  useEffect(() => {
    if (isLiveMultiplayer) {
      engineRef.current?.destroy();
      engineRef.current = null;
      return;
    }

    if (!engineRef.current) {
      engineRef.current = new StockfishEngine();
      engineRef.current.onResult((res) => {
        setEngineResult(res);
        if (mode === 'review' && res.analyzedFen && res.depth >= 5) {
          const fen = res.analyzedFen;
          setEvaluations(previous => {
            if ((previous[fen]?.depth || 0) > res.depth) return previous;
            return { ...previous, [fen]: { evaluation: res.evaluation, mate: res.mate, depth: res.depth } };
          });
        }
        setIsAnalysing(false);
        setEngineFailed(false);
      });
      engineRef.current.onError(() => {
        setIsAnalysing(false);
        setEngineFailed(true);
      });
    }
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [isLiveMultiplayer, mode]);

  // Update analysis when tab changes to analysis or fen changes
  const liveFen = game.fen();

  useEffect(() => {
    if (analysisActive && engineRef.current) {
      setIsAnalysing(true);

      const historyIndex = Math.max(
        0,
        Math.min(viewMoveIndex, positionHistory.length - 1)
      );

      const targetFen =
        viewMoveIndex === -1
          ? liveFen
          : positionHistory[historyIndex] || liveFen;

      engineRef.current.analyze(targetFen, mode === 'review' ? analysisDepth : 18, mode === 'review' ? effectivePvLines : 3);
    } else if (engineRef.current) {
      engineRef.current.stop();
    }
  }, [
    analysisActive,
    viewMoveIndex,
    liveFen,
    positionHistory,
    analysisDepth,
    effectivePvLines,
    mode
  ]);

  useEffect(() => {
    if (isLiveMultiplayer && activeTab === 'analysis') {
      setActiveTab('moves');
    }
  }, [isLiveMultiplayer, activeTab]);

  const handleGameMove = useCallback(
    (source: string, target: string, promotion: string = 'q') => {
      if (isMultiplayer && !canSendGameAction) return false;
      if (viewMoveIndex !== -1) {
        setViewMoveIndex(-1);
        return false;
      }
      if (isMultiplayer && playerColor !== game.turn()) {
        return false;
      }
      try {
        const g = new Chess(game.fen());
        const move = g.move({ from: source, to: target, promotion });
        if (move) {
          const soundType: ChessSoundType = g.isCheck() ? 'check' : move.captured ? 'capture' : 'move';
          void playChessSound(soundType, sound);

          if (socket && roomId) {
            locallyPlayedFenRef.current = g.fen();
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
          
          // Ensure game over states are handled properly
          if (!isMultiplayer && g.isGameOver()) {
            if (g.isCheckmate()) setGameOverMessage('Game over: checkmate.');
            else if (g.isDraw()) setGameOverMessage('Game over: draw.');
            else if (g.isStalemate()) setGameOverMessage('Game over: stalemate.');
            else setGameOverMessage('Game over.');
          }
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [viewMoveIndex, game, socket, roomId, sound, isMultiplayer, playerColor, canSendGameAction, setViewMoveIndex]
  );





  const handleResign = () => {
    if (!canSendGameAction || !socket || !roomId) return;
    if (!window.confirm(t('game.resign.confirm'))) return;

    socket.emit('resign_game', { roomId });
  };

  const handleOfferDraw = () => {
    if (!canSendGameAction || !socket || !roomId) return;
    if (drawOfferBy !== null) return;

    setDrawOfferBy(playerColor);
    socket.emit('draw_offer', { roomId });
  };

  const handleAcceptDraw = () => {
    if (!canSendGameAction || !socket || !roomId) return;

    setGameActionMessage(null);
    socket.emit('draw_accept', { roomId });
  };

  const handleDeclineDraw = () => {
    if (!canSendGameAction || !socket || !roomId) return;

    setDrawOfferBy(null);
    setGameActionMessage(null);
    socket.emit('draw_decline', { roomId });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };



  const tabs = [
    { id: 'moves', icon: History, label: t('game.tabs.moves') },
    ...(isLiveMultiplayer ? [] : [{ id: 'analysis', icon: Cpu, label: t('game.tabs.analysis') }]),
  ] as const;

  const movePairs = analysisMovePairs(moveHistory, mode === 'review' ? positionHistory[0] : DEFAULT_POSITION);

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

  const currentEngineResult = mode === 'review' && engineResult?.analyzedFen !== displayedGame.fen() ? null : engineResult;
  const hasHistory = positionHistory.length > 1;
  const mobileReviewControlClass = 'min-h-11 flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] text-neutral-200 shadow-sm transition-[color,background-color,transform] duration-150 hover:bg-cyan-500/10 hover:text-cyan-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60';

  const analysisData = useMemo(() => {
    if (!engineResult) return null;
    const analysisFen = engineResult.analyzedFen || liveFen;
    const g = new Chess(analysisFen);
    let bestMoveSan = engineResult.bestMove;
    const continuationSan: string[] = [];
    
    if (engineResult.bestMove) {
      try {
        const from = engineResult.bestMove.slice(0, 2);
        const to = engineResult.bestMove.slice(2, 4);
        const promotion = engineResult.bestMove[4];
        const move = g.move({ from, to, promotion });
        if (move) bestMoveSan = move.san;
      } catch {
        // fallback
      }
    }

    if (engineResult.continuation && Array.isArray(engineResult.continuation)) {
      for (const uci of engineResult.continuation) {
        try {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const promotion = uci[4];
          const move = g.move({ from, to, promotion });
          if (move) {
            continuationSan.push(move.san);
          } else {
            break;
          }
        } catch {
          break;
        }
      }
    }

    const lines = engineResult.lines?.map(line => {
      const c = new Chess(analysisFen);
      const tokens: string[] = [];
      let first = true;
      let sanCount = 0;
      const maxVisibleSanMoves = mode === 'review' ? Number.POSITIVE_INFINITY : 12;
      let truncatedByLimit = false;

      for (const uci of line.pv) {
        if (sanCount >= maxVisibleSanMoves) {
          truncatedByLimit = true;
          break;
        }

        const turn = c.turn();
        const num =
          typeof (c as any).moveNumber === 'function'
            ? (c as any).moveNumber()
            : Number(c.fen().split(' ')[5]);

        let move;
        try {
          move = c.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci[4],
          });
        } catch {
          break;
        }

        if (!move) break;

        if (turn === 'w') {
          tokens.push(`${num}.`, move.san);
        } else {
          if (first) tokens.push(`${num}...`, move.san);
          else tokens.push(move.san);
        }

        first = false;
        sanCount += 1;
      }

      const hasMore = truncatedByLimit;

      return {
        evaluation: line.evaluation,
        mate: line.mate,
        depth: line.depth,
        moves: tokens,
        hasMore
      };
    }).filter(line => line.moves.length > 0);

    return {
      bestMove: bestMoveSan,
      continuation: continuationSan,
      lines
    };
  }, [engineResult, liveFen, mode]);

  // Keep a SINGLE set of real handlers: the toolbar stays in the analysis panel.
  // In review, navigation must not add height below
  // the main board; in live mode it stays in its existing right-side location.
  const desktopAnalysisTransport = (
              <div className={cx("h-14 bg-black/50 border-t border-white/[0.03] flex items-center justify-center gap-8 px-6 shrink-0 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]", mode === 'review' && "desktop-analysis-transport")}>
                <button type="button" aria-label="К началу партии" title="К началу партии" disabled={!hasHistory} onClick={() => { if (hasHistory) setViewMoveIndex(0); }} className="text-neutral-500 hover:text-white p-2 bg-gradient-to-br from-teal-500/10 via-neutral-800/60 to-violet-500/10 hover:from-teal-500/30 hover:via-blue-500/25 hover:to-violet-500/30 rounded-2xl transition-all duration-500 shadow-xl hover:shadow-[0_0_25px_rgba(0,206,209,0.45)] active:scale-95 group disabled:opacity-30 disabled:pointer-events-none border border-white/5 hover:border-cyan-400/50 ring-1 ring-teal-500/20 hover:ring-cyan-400/40"><Rewind size={22} className="group-hover:scale-110 transition-transform group-hover:drop-shadow-[0_0_8px_rgba(0,206,209,0.8)]" /></button>
                <button type="button" aria-label="Предыдущий ход" title="Предыдущий ход" disabled={!hasHistory} onClick={() => {
                  if (!hasHistory) return;
                  const currentIndex = viewMoveIndex === -1 ? positionHistory.length - 1 : viewMoveIndex;
                  setViewMoveIndex(Math.max(0, currentIndex - 1));
                }} className="text-neutral-500 hover:text-white p-2 bg-gradient-to-br from-teal-500/10 via-neutral-800/60 to-violet-500/10 hover:from-teal-500/30 hover:via-blue-500/25 hover:to-violet-500/30 rounded-2xl transition-all duration-500 shadow-xl hover:shadow-[0_0_25px_rgba(0,206,209,0.45)] active:scale-95 group disabled:opacity-30 disabled:pointer-events-none border border-white/5 hover:border-cyan-400/50 ring-1 ring-teal-500/20 hover:ring-cyan-400/40"><ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform group-hover:drop-shadow-[0_0_8px_rgba(0,206,209,0.8)]" /></button>
                <button type="button" aria-label="Следующий ход" title="Следующий ход" disabled={!hasHistory} onClick={() => {
                  if (!hasHistory) return;
                  if (viewMoveIndex === -1) return;
                  if (viewMoveIndex >= positionHistory.length - 2) {
                    setViewMoveIndex(-1);
                  } else {
                    setViewMoveIndex(viewMoveIndex + 1);
                  }
                }} className="text-neutral-500 hover:text-white p-2 bg-gradient-to-br from-teal-500/10 via-neutral-800/60 to-violet-500/10 hover:from-teal-500/30 hover:via-blue-500/25 hover:to-violet-500/30 rounded-2xl transition-all duration-500 shadow-xl hover:shadow-[0_0_25px_rgba(0,206,209,0.45)] active:scale-95 group disabled:opacity-30 disabled:pointer-events-none border border-white/5 hover:border-cyan-400/50 ring-1 ring-teal-500/20 hover:ring-cyan-400/40"><ChevronRight size={28} className="group-hover:translate-x-1 transition-transform group-hover:drop-shadow-[0_0_8px_rgba(0,206,209,0.8)]" /></button>
                <button type="button" aria-label="К концу партии" title="К концу партии" disabled={!hasHistory} onClick={() => setViewMoveIndex(-1)} className="text-neutral-500 hover:text-white p-2 bg-gradient-to-br from-teal-500/10 via-neutral-800/60 to-violet-500/10 hover:from-teal-500/30 hover:via-blue-500/25 hover:to-violet-500/30 rounded-2xl transition-all duration-500 shadow-xl hover:shadow-[0_0_25px_rgba(0,206,209,0.45)] active:scale-95 group disabled:opacity-30 disabled:pointer-events-none border border-white/5 hover:border-cyan-400/50 ring-1 ring-teal-500/20 hover:ring-cyan-400/40"><FastForward size={22} className="group-hover:scale-110 transition-transform group-hover:drop-shadow-[0_0_8px_rgba(0,206,209,0.8)]" /></button>
              </div>
  );
  const analysisWorkspaceHeader = (mobile = false) => mode === 'review' ? (
    <AnalysisWorkspaceHeader
          mobile={mobile}
          onMobileTool={mobile ? openMobileTool : undefined}
          mobileDepth={mobile ? analysisDepth : undefined}
          onMobileDepth={mobile ? (direction) => setAnalysisDepth(depth => Math.max(6, Math.min(36, depth + direction * 6))) : undefined}
          currentResult={mobile ? currentEngineResult : undefined}
          title={loadedGameTitle}
          initialFen={positionHistory[0] || DEFAULT_POSITION}
          moveHistory={moveHistory}
          currentFen={displayedGame.fen()}
          onNew={startNewAnalysis}
          evaluations={evaluations}
          editing={workspaceTab === 'position'}
          onEdit={() => {
            if (workspaceTab !== 'position') tabBeforeEditor.current = workspaceTab;
            resetPositionDraft(displayedGame.fen());
            setEditingPosition(true);
            setPlanHighlight(null);
            setWorkspaceTab('position');
          }}
        />
  ) : null;
  const openMobileTool = (tool: 'map' | 'games' | 'position') => {
    if (tool === 'position') {
      resetPositionDraft(displayedGame.fen());
      setEditingPosition(true);
    }
    setPlanHighlight(null);
    setMobileTool(tool);
  };
  const handleMobileMapHighlight = useCallback((selection: { fen: string; squares: Square[] } | null) => {
    setPlanHighlight(selection);
    if (selection) setMobileTool(null);
  }, []);
  return (
    <div ref={reviewWorkspaceRef} style={mode === 'review' && reviewGeometry ? { "--review-scale": reviewGeometry.scale, "--review-board-size": `${reviewGeometry.boardSize}px`, "--review-board-column": `${reviewGeometry.boardColumn}px`, "--review-panel-width": `${reviewGeometry.panelWidth}px`, "--review-column-gap": `${reviewGeometry.columnGap}px` } as CSSProperties : undefined} className={cx("flex-1 min-h-0 flex flex-col lg:flex-row w-full max-w-[100rem] mx-auto px-0 md:px-2 lg:px-4 xl:px-6 pb-12 md:pb-6 lg:pb-1 pt-0 md:pt-2 lg:pt-0 gap-1 md:gap-4 lg:gap-3 overflow-y-auto lg:overflow-hidden bg-transparent relative lg:items-center lg:-mt-4 min-h-full lg:h-[calc(100vh-85px)] max-md:h-full max-md:max-h-full max-md:min-h-0 max-md:pb-1 max-md:gap-0 max-md:overflow-hidden", !isMultiplayer && "xl:h-[calc(100vh-40px)] xl:translate-y-[32px]", mode === 'review' ? "desktop-analysis-screen" : "animate-fade-in transition-all")}>

      {mode === 'review' && <>
        <MobileAnalysisHeader activeTab={activeTab} onTab={setActiveTab} onGames={() => openMobileTool('games')}
          actions={analysisWorkspaceHeader(true)} />
        <div className="hidden md:block lg:hidden">{analysisWorkspaceHeader()}</div>
      </>}
      {mode === 'review' && <MobileAnalysisDetails activeTab={activeTab}
        result={currentEngineResult} lines={currentEngineResult ? analysisData?.lines : undefined}
        loading={isAnalysing || !currentEngineResult && !engineFailed} failed={engineFailed}
        moves={movePairs} currentIndex={viewMoveIndex === -1 ? positionHistory.length - 1 : viewMoveIndex}
        onMove={setViewMoveIndex} depth={analysisDepth} startSide={displayedGame.turn()} />}

      {mode === 'review' && (
        <nav aria-label={words.analysis} className="lg:hidden mx-2 mb-1 hidden md:grid grid-cols-3 gap-1.5 shrink-0" data-mobile-analysis-tools>
          {([
            { tab: 'map' as const, label: positionMapLabel[language], icon: Map },
            { tab: 'games' as const, label: words.games, icon: FolderOpen },
            { tab: 'position' as const, label: words.editor, icon: Pencil },
          ]).map(({ tab, label, icon: Icon }) => (
            <button key={tab} type="button" aria-haspopup="dialog" onClick={() => openMobileTool(tab)}
              className="min-w-0 min-h-11 flex items-center justify-center gap-1 rounded-lg border border-amber-200/20 bg-[#181c1b] px-1.5 text-xs font-semibold text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
              <Icon size={15} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
      )}
            {/* Mobile analysis panel above the board */}
      {mode !== 'review' && !isLiveMultiplayer && (
        <section className="md:hidden mx-1 mt-1 mb-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111310]/95 ring-1 ring-cyan-400/10 shrink-0 shadow-[0_10px_24px_-18px_rgba(0,206,209,0.45)]">
          <div className="min-h-14 grid grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-1 px-1.5 py-1.5 border-b border-white/[0.08] bg-gradient-to-r from-cyan-950/30 via-black/25 to-black/40">
            <div className="flex min-w-0 shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('analysis')}
                className={cx(
                  "min-h-11 px-1.5 rounded-lg text-[0.6875rem] font-black uppercase tracking-[0.04em] whitespace-nowrap transition-colors duration-150",
                  activeTab === 'analysis'
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "bg-white/[0.03] text-neutral-400 ring-1 ring-white/[0.06]"
                )}
              >
                Analysis
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('moves')}
                className={cx(
                  "min-h-11 px-1.5 rounded-lg text-[0.6875rem] font-black uppercase tracking-[0.04em] whitespace-nowrap transition-colors duration-150",
                  activeTab === 'moves'
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "bg-white/[0.03] text-neutral-400 ring-1 ring-white/[0.06]"
                )}
              >
                Moves
              </button>
            </div>
            <div className="min-h-11 min-w-0 justify-self-end flex items-center rounded-lg px-2 text-[0.875rem] font-bold text-cyan-100 bg-cyan-500/15 ring-1 ring-cyan-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] whitespace-nowrap">
              <span>Stockfish 19</span>
            </div>
          </div>

          {/* Keep the mobile analysis header height stable while stepping through moves;
              the move navigation below the board already provides return to latest. */}

          {activeTab === 'analysis' ? (
            <div className="px-2 py-1.5 space-y-1">
              {Array.from({ length: 2 }, (_, index) => {
                const line = analysisData?.lines?.[index];
                const score = line
                  ? (line.mate != null
                      ? (line.mate < 0 ? `-M${Math.abs(line.mate)}` : `M${line.mate}`)
                      : (line.evaluation > 0 ? `+${line.evaluation.toFixed(2)}` : line.evaluation.toFixed(2)))
                  : index === 0 && engineResult
                    ? (engineResult.mate != null
                        ? (engineResult.mate < 0 ? `-M${Math.abs(engineResult.mate)}` : `M${engineResult.mate}`)
                        : (engineResult.evaluation > 0 ? `+${engineResult.evaluation.toFixed(2)}` : engineResult.evaluation.toFixed(2)))
                    : '—';

                const moves = line?.moves?.length
                  ? line.moves.slice(0, 10).join(' ')
                  : index === 0 && analysisData?.continuation?.length
                    ? [analysisData.bestMove, ...analysisData.continuation.slice(0, 8)].filter(Boolean).join(' ')
                    : (isAnalysing ? 'Analyzing…' : '—');

                return (
                  <div key={index} aria-label={`Engine line ${index + 1}`} className="min-h-10 grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 border-b border-white/[0.06] last:border-b-0">
                    <div className={cx(
                      "h-8 rounded-lg flex items-center justify-center font-mono text-[0.82rem] font-black border",
                      score.startsWith('+')
                        ? "bg-white text-black border-white"
                        : score.startsWith('-')
                          ? "bg-black text-white border-white/15"
                          : "bg-neutral-800 text-neutral-200 border-neutral-700"
                    )}>
                      {score}
                    </div>
                    <div tabIndex={0} aria-label={`Moves for engine line ${index + 1}`} className="min-w-0 whitespace-nowrap overflow-x-auto overscroll-x-contain touch-pan-x py-2 text-[0.8125rem] leading-5 font-semibold text-neutral-100 tracking-tight">
                      {moves}
                    </div>
                  </div>
                );
              })}
              {engineFailed && (
                <div className="px-1 py-1 text-[0.62rem] font-bold text-red-300">
                  {t('game.analysis.unavailable')}
                </div>
              )}
            </div>
          ) : (
            <div className="h-28 min-h-0 shrink-0 overflow-y-auto overscroll-contain touch-pan-y bg-black/[0.08]">
              {movePairs.length === 0 ? (
                <div className="flex min-h-16 items-center justify-center px-3 text-[0.62rem] font-bold uppercase tracking-widest text-neutral-600">
                  {t('game.analysis.nomoves')}
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <tbody className="divide-y divide-white/[0.04]">
                    {movePairs.map((move, i) => {
                      const whitePositionIndex = move.wIndex;
                      const blackPositionIndex = move.bIndex;
                      return (
                        <tr key={i} className="text-[0.7rem] font-bold text-neutral-300">
                          <td className="w-8 px-2 py-1.5 text-center font-mono text-neutral-600">{move.n}.</td>
                          <td
                            className="px-2 py-1.5"
                            onClick={() => {
                              if (move.w && whitePositionIndex < positionHistory.length) setViewMoveIndex(whitePositionIndex);
                            }}
                          >
                            {move.w || '…'}
                          </td>
                          <td
                            className="px-2 py-1.5"
                            onClick={() => {
                              if (move.b && blackPositionIndex < positionHistory.length) setViewMoveIndex(blackPositionIndex);
                            }}
                          >
                            {move.b}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}


      {/* Native modal preserves touch-size board and traps focus while tools are open. */}
      {mode === 'review' && mobileTool && (
        <dialog ref={mobileToolDialogRef}
          aria-label={mobileTool === 'map' ? positionMapLabel[language] : mobileTool === 'games' ? words.games : words.editor}
          onClose={() => { setMobileTool(null); setEditingPosition(false); }}
          className="mobile-analysis-tool-dialog w-[calc(100%-1rem)] max-w-[42rem] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border border-amber-200/25 bg-[#121716] p-0 text-white shadow-2xl backdrop:bg-black/85"
          data-mobile-analysis-dialog>
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
              <h2 className="min-w-0 truncate text-base font-semibold text-amber-100">
                {mobileTool === 'map' ? positionMapLabel[language] : mobileTool === 'games' ? words.games : words.editor}
              </h2>
              <button type="button" onClick={() => mobileToolDialogRef.current?.close()}
                aria-label={mobileAnalysisCopy[language].close} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
                <X size={20} aria-hidden="true"/>
              </button>
            </header>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <Suspense fallback={<p role="status" className="p-4 text-xs text-neutral-400">{words.loading}</p>}>
                {mobileTool === 'games' && (
                  <GamesLibraryPanel fen={displayedGame.fen()} key={user?.id || 'guest'} userId={user?.id} language={language} words={words}
                    onLoad={loadWorkspaceAnalysis}/>
                )}
                {mobileTool === 'map' && (
                  <PositionMap key={displayedGame.fen()} fen={displayedGame.fen()}
                    result={currentEngineResult} language={language} failed={engineFailed}
                    onHighlight={handleMobileMapHighlight}/>
                )}
                {mobileTool === 'position' && (
                  <PositionTools currentFen={displayedGame.fen()} words={words}
                    mobile
                    board={editingPosition && <div className="mobile-position-board" data-mobile-position-editor>
                      <Suspense fallback={<p role="status" className="p-3 text-center text-xs">{words.loading}</p>}>
                        <EditorBoard draft={positionDraftValue} selected={editorSelectedPiece} words={words}
                          onPlace={placePositionPiece} onMove={movePositionPiece} mobile/>
                      </Suspense>
                    </div>}
                    onLoad={loadWorkspaceAnalysis}
                    onCancel={() => { setMobileTool(null); setEditingPosition(false); }}
                    draft={positionDraftValue} selected={editorSelectedPiece}
                    onSelected={setEditorSelectedPiece} onDraft={updatePositionDraft}
                    onClear={clearPositionDraft} onUndo={undoPositionDraft}
                    canUndo={positionDraftUndo.length > 0} onReset={resetPositionDraft}
                    onEditingChange={setEditingPosition}/>
                )}
              </Suspense>
            </div>
          </div>
        </dialog>
      )}

      {/* Mobile Analysis Drawer Header */}
      <div className={cx("flex flex-col items-center justify-start lg:justify-between relative min-h-0 group w-full py-0 lg:-translate-y-4 lg:flex-1", !isMultiplayer && "lg:min-w-0", mode === 'review' ? "desktop-analysis-board-column" : "animate-scale-up")}>

        <div className={cx("w-full lg:max-w-[70vh] xl:max-w-[82vh] flex flex-col justify-start lg:justify-center gap-0 md:gap-2 lg:gap-1 relative mx-auto min-h-0 lg:h-full", !isMultiplayer && "lg:!max-w-[74vh] xl:!max-w-[94vh]", mode === 'review' && "desktop-analysis-board-stack")}>

          {mode === 'review' && (
            <header className="desktop-analysis-hero hidden lg:flex shrink-0 min-w-0 items-center justify-between gap-3 px-2" aria-label={words.analysis}>
              <div className="min-w-0">
                <h1 className="truncate text-[1.125rem] font-semibold text-[#f3e6c4]" title={loadedGameTitle || words.analysis}>{loadedGameTitle || words.analysis}</h1>
                <p className="truncate text-xs text-[#aaa395]">{loadedGameDetails ? [loadedGameDetails.white, loadedGameDetails.black, loadedGameDetails.timeControl].filter(Boolean).join(" · ") : "Stockfish 19"}</p>
              </div>
              <span className="shrink-0 rounded-md border border-[#c9a665]/50 px-2 py-1 text-[11px] font-semibold text-[#e7c37b]">ChessAZ</span>
            </header>
          )}

          {/* Colour labels follow the board orientation; loaded games supply player names. */}
          {mode === 'review' && (
            <div className="desktop-analysis-player-top hidden lg:flex h-7 shrink-0 items-center justify-between gap-3 px-1.5 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className={cx("h-3 w-3 shrink-0 rounded-full border border-neutral-500", playerColor === 'w' ? "bg-neutral-950" : "bg-[#f5f2e8]")} />
                <span className="min-w-0 truncate font-semibold text-neutral-200" title={playerColor === 'w' ? loadedGameDetails?.black || words.black : loadedGameDetails?.white || words.white}>
                  {playerColor === 'w' ? loadedGameDetails?.black || words.black : loadedGameDetails?.white || words.white}
                </span>
              </div>
              {loadedGameDetails?.timeControl && (
                <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] tracking-wide text-neutral-500" title={loadedGameDetails.timeControl}>
                  <Clock size={12} aria-hidden="true" />
                  {loadedGameDetails.timeControl}
                </span>
              )}
            </div>
          )}

          <div className={cx(
            "flex justify-between items-center px-3 py-1 bg-black/40 rounded-xl border border-white/5 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 shrink-0 z-10",
            !isMultiplayer && "hidden md:flex",
            mode === 'review' && "lg:hidden"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 bg-neutral-900 rounded-lg border border-white/10 ring-1 ring-black flex items-center justify-center">
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
              {isMultiplayer ? formatTime(timeLeft.black) : '--:--'}
            </div>
          </div>

          <div className={cx("relative flex gap-0 md:gap-6 w-full justify-center group/board items-center py-0 md:py-1 lg:h-full lg:min-h-0 lg:flex-1", mode === 'review' && "desktop-analysis-board-row")}>

            {/* Desktop evaluation bar — preserved from production. */}
            <div className={cx(
              "hidden md:block self-stretch rounded-2xl overflow-hidden py-1",
              mode !== 'review' && "transition-all duration-1000 ease-in-out",
              analysisActive ? "w-6 md:w-8 opacity-100 translate-x-0" : "w-0 opacity-0 overflow-hidden -translate-x-8 pointer-events-none",
              mode === 'review' && "desktop-analysis-evaluation"
            )}>
              <EvaluationBar
                score={engineResult?.evaluation || 0.0}
                isMate={!!engineResult?.mate}
                mateIn={engineResult?.mate}
                className="h-full rounded-xl ring-1 ring-white/10"
              />
            </div>

            <div ref={analysisBoardRef} className={cx(
              mode === 'review' && "desktop-analysis-board-frame",
              "max-w-none shrink min-w-0 aspect-square relative rounded-none md:rounded-[1.5rem] overflow-hidden shadow-2xl md:shadow-[0_45px_100px_-20px_rgba(0,0,0,1)] border-b-[2px] md:border-b-[8px] border-black/60 ring-0 md:ring-1 ring-white/5 mx-auto sm:max-w-[560px] lg:max-w-none lg:flex-1 lg:max-h-full",
              isMultiplayer
                ? "w-[min(96vw,56dvh)] md:w-full"
                : "w-[min(100%,calc(100dvh-18rem-env(safe-area-inset-bottom,0px)))] max-md:!aspect-[50/51] border-b-0 md:w-full md:border-b-[8px] lg:!w-full lg:!max-w-[min(630px,calc(100dvh-120px))] lg:!flex-[0_1_auto]",
              mode !== 'review' && "transition-[width] duration-300"
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none z-10" />
              
              {gameOverMessage ? (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                  <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center">
                    <span className="text-white font-black text-xl tracking-wide">{gameOverMessage}</span>
                    <button 
                      onClick={() => navigate('/play')} 
                      className="bg-chess-active hover:bg-chess-active/80 text-white px-6 py-2 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                    >
                      New Game
                    </button>
                  </div>
                </div>
              ) : disconnectNotice ? (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-600/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-2xl backdrop-blur-md animate-fade-in text-center pointer-events-none">
                  {disconnectNotice}
                </div>
              ) : moveRejectMessage ? (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-2xl backdrop-blur-md animate-fade-in text-center pointer-events-none">
                  {moveRejectMessage}
                </div>
              ) : null}

              {mode === 'review' && workspaceTab === 'position' && editingPosition ? (
                <Suspense fallback={null}>
                  <EditorBoard draft={positionDraftValue} selected={editorSelectedPiece} words={words} onPlace={placePositionPiece} onMove={movePositionPiece} />
                </Suspense>
              ) : <ChessBoard
                className={!isMultiplayer ? `p-0 border-0 rounded-none md:p-3 md:border-[6px] md:rounded-lg max-md:[&_[draggable]_img]:scale-110 max-md:[&_.aspect-square]:!aspect-[50/51] ${mode === 'review' ? 'desktop-analysis-main-board transition-none duration-0' : ''}` : undefined}
                externalCoordinatesOnDesktop={mode === 'review'}
                highlightedSquares={mode === 'review' && workspaceTab === 'map' && planHighlight?.fen === displayedGame.fen() ? planHighlight.squares : undefined}
                overrideBoardTheme={boardTheme}
                confirmMovesMobile={mode === 'live' && confirmMobileMoves}
                game={displayedGame}
                onMove={handleGameMove}
                orientation={mode === 'review' && !isDesktop ? mobileOrientation : playerColor}
                readOnly={viewMoveIndex !== -1 || !!gameOverMessage || (isMultiplayer && playerColor !== game.turn())}
              />}
            </div>
          </div>

          <div className={cx(
            "flex justify-between items-center px-3 py-1 bg-black/40 rounded-xl border border-white/5 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 shrink-0 z-10",
            !isMultiplayer && "hidden md:flex",
            mode === 'review' && "lg:hidden"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="relative group/avatar">
                <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center overflow-hidden shadow-2xl border border-chess-gold/30 ring-1 ring-black group-hover/avatar:ring-chess-gold transition-all duration-500">
                  {playerFlag ? (
                    <span className="text-sm" aria-label={profile?.countryCode}>
                      {playerFlag}
                    </span>
                  ) : (
                    <span
                      className="text-sm text-neutral-500"
                      aria-label="Country not specified"
                    >
                      ●
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-[2px] border-[#161512] shadow-xl animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-xs tracking-tight italic">{profile?.username || user?.user_metadata?.username || 'Guest'}</span>
                  {profile?.role && <span className="bg-chess-gold/20 text-chess-gold text-[0.45rem] px-1 py-0.5 rounded font-black uppercase ring-1 ring-chess-gold/40 shadow-[0_0_20px_rgba(223,176,98,0.35)] border border-chess-gold/20 tracking-widest">{profile?.role}</span>}
                </div>
              </div>
            </div>
            <div className="bg-neutral-950 px-3 py-1 rounded-lg border-b-[2px] border-chess-active font-mono text-lg font-black text-white shadow-[0_15px_50px_-5px_rgba(0,206,209,0.5)] ring-1 ring-chess-active/40 flex items-center justify-center min-w-[75px] transition-all hover:translate-y-[-1px] active:translate-y-[1px]">
              {isMultiplayer ? formatTime(timeLeft.white) : '--:--'}
            </div>
          </div>

          {mode === 'review' && (
            <div className="desktop-analysis-review-player-bottom hidden lg:flex h-7 shrink-0 items-center gap-2 px-1.5 text-xs">
              <span aria-hidden="true" className={cx("h-3 w-3 shrink-0 rounded-full border border-neutral-400", playerColor === 'w' ? "bg-[#f5f2e8]" : "bg-neutral-950")} />
              <span className="min-w-0 truncate font-semibold text-neutral-200" title={playerColor === 'w' ? loadedGameDetails?.white || words.white : loadedGameDetails?.black || words.black}>
                {playerColor === 'w' ? loadedGameDetails?.white || words.white : loadedGameDetails?.black || words.black}
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Mobile review navigation stays visible in both Analysis and Moves. */}
      {!isMultiplayer && (
        <nav aria-label="Move navigation" data-mobile-move-navigation className={cx("md:hidden grid gap-2 mx-2 mt-1 mb-1 p-1 shrink-0 rounded-2xl border border-white/[0.06] bg-black/20", mode === 'review' ? "grid-cols-5" : "grid-cols-4")}>
          <button
            type="button"
            aria-label="First position"
            title="First position"
            className={mobileReviewControlClass}
            disabled={!hasHistory || viewMoveIndex === 0}
            onClick={() => setViewMoveIndex(0)}
          >
            <Rewind size={22} />
          </button>
          <button
            type="button"
            aria-label="Previous move"
            title="Previous move"
            className={mobileReviewControlClass}
            disabled={!hasHistory || viewMoveIndex === 0}
            onClick={() => {
              const currentIndex = viewMoveIndex === -1 ? positionHistory.length - 1 : viewMoveIndex;
              setViewMoveIndex(Math.max(0, currentIndex - 1));
            }}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            aria-label="Next move"
            title="Next move"
            className={mobileReviewControlClass}
            disabled={!hasHistory || viewMoveIndex === -1 || viewMoveIndex >= positionHistory.length - 1}
            onClick={() => setViewMoveIndex(viewMoveIndex >= positionHistory.length - 2 ? -1 : viewMoveIndex + 1)}
          >
            <ChevronRight size={24} />
          </button>
          <button
            type="button"
            aria-label="Last position"
            title="Last position"
            className={mobileReviewControlClass}
            disabled={!hasHistory || viewMoveIndex === -1 || viewMoveIndex >= positionHistory.length - 1}
            onClick={() => setViewMoveIndex(-1)}
          >
            <FastForward size={22} />
          </button>
          {mode === 'review' && <button type="button" data-mobile-board-flip
            aria-label={mobileAnalysisCopy[language].flip} title={mobileAnalysisCopy[language].flip}
            aria-pressed={mobileOrientation === 'b'} className={mobileReviewControlClass}
            onClick={() => setMobileOrientation(previous => previous === 'w' ? 'b' : 'w')}>
            <ArrowUpDown size={20} aria-hidden="true"/>
          </button>}
        </nav>
      )}

      {/* Professional Sidebar Sidebar Tabs */}
      <div className={cx("w-full lg:w-[440px] xl:w-[470px] lg:-left-10 lg:-top-[15px] shrink-0 flex flex-col bg-transparent md:bg-[#121212]/80 md:backdrop-blur-[60px] rounded-none md:rounded-[1.5rem] lg:rounded-[2rem] border-0 md:border-[2px] border-transparent shadow-none md:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] min-h-0 md:min-h-[400px] lg:h-[calc(82vh+30px)] lg:min-h-[630px] lg:max-h-[810px] relative overflow-hidden border-b-0 md:border-b-[4px] border-b-black/40 panel-glow-cycle mx-2 md:mx-0 max-md:flex-1 max-md:shrink max-md:mx-0", !isMultiplayer && "lg:left-0 lg:!w-[35%] xl:!w-[35%] lg:!max-w-[440px] xl:bg-[linear-gradient(155deg,#121715_0%,#101311_55%,#0C100E_100%)] xl:min-h-0 xl:max-h-none xl:h-[var(--analysis-board-height)]", mode === 'review' ? "desktop-analysis-panel" : "animate-fade-in-right transition-all")} style={!isMultiplayer && analysisBoardHeight !== null ? { "--analysis-board-height": `${analysisBoardHeight}px` } as CSSProperties : undefined}>

        {mode === 'review' && <div className="hidden lg:block shrink-0">{analysisWorkspaceHeader()}</div>}
        {/* Premium Segmented Control Tab Navigation */}
        <nav className="hidden p-0.5 bg-black/40 border-b border-white/[0.03] relative z-20 shrink-0">
          <div className="flex bg-neutral-900/80 p-1 rounded-xl gap-0.5 relative overflow-hidden ring-1 ring-white/5">
            <div
              className={cx(
                "absolute top-1 bottom-1 bg-white/10 rounded-lg transition-all duration-500 ease-in-out shadow-lg ring-1 ring-white/10",
                activeTab === 'moves' ? "left-1 w-[calc(50%-2px)]" :
                  "left-[calc(50%+2px)] w-[calc(50%-4px)]"
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

        {mode === 'review' && (
          <>
            <nav aria-label={words.analysis} className="desktop-analysis-workspace-tabs hidden lg:flex shrink-0 items-center gap-1 border-b border-white/[0.06] bg-black/15 p-2">
              {(['analysis', 'map', 'games'] as const).map(tab => (
                <button key={tab} type="button" aria-pressed={workspaceTab === tab} onClick={() => {
                  setEditingPosition(false);
                  setPlanHighlight(null);
                  setWorkspaceTab(tab);
                }} className={cx("min-h-9 min-w-0 flex-1 rounded-xl px-2 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200", workspaceTab === tab ? "border border-amber-200/20 bg-gradient-to-br from-amber-200/10 via-[#1c1c18] to-teal-900/15 text-amber-100" : "border border-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-200")}>
                  {tab === 'map' ? positionMapLabel[language] : words[tab]}
                </button>
              ))}
            </nav>
            <Suspense fallback={<p role="status" className="hidden lg:block p-4 text-xs text-neutral-400">{words.loading}</p>}>
            {workspaceTab === 'games'  && <div className="hidden lg:flex min-h-0 flex-1 flex-col"><GamesLibraryPanel desktopOnly fen={displayedGame.fen()} key={user?.id || 'guest'} userId={user?.id} language={language} words={words} onLoad={loadWorkspaceAnalysis} /></div>}
            {workspaceTab === 'map' && <div className="hidden lg:flex min-h-0 flex-1 flex-col"><PositionMap key={displayedGame.fen()} fen={displayedGame.fen()} result={engineResult} language={language} failed={engineFailed} onHighlight={setPlanHighlight} /></div>}
            {workspaceTab === 'position' && <div className="hidden lg:flex min-h-0 flex-1 flex-col"><PositionTools currentFen={displayedGame.fen()} words={words} onLoad={loadWorkspaceAnalysis} onCancel={() => { setEditingPosition(false); setWorkspaceTab(tabBeforeEditor.current); }}
              draft={positionDraftValue} selected={editorSelectedPiece} onSelected={setEditorSelectedPiece}
              onDraft={updatePositionDraft} onClear={clearPositionDraft} onUndo={undoPositionDraft}
              canUndo={positionDraftUndo.length > 0} onReset={resetPositionDraft} onEditingChange={setEditingPosition} /></div>}
            </Suspense>
          </>
        )}
        <div className={cx("hidden md:flex flex-1 min-h-0 flex-col overflow-hidden bg-black/[0.05]", !isMultiplayer && "xl:bg-white/[0.015]", mode === 'review' && workspaceTab !== 'analysis' && "lg:hidden")}>
          {mode === 'review' && loadedGameTitle && <p role="status" className="hidden lg:block truncate px-4 pt-2 text-[11px] text-amber-100/60" title={loadedGameTitle}>{loadedGameTitle}</p>}

          {mode === 'review' && (
            // Never add/remove controls as a historic move is selected: reflow used
            // to shift the Stockfish panel when stepping onto/off the last move.
            <div className="desktop-analysis-review-controls flex h-12 shrink-0 flex-nowrap items-center justify-between gap-1.5 px-3">
              <span className={cx("min-w-0 flex-1 truncate text-xs text-neutral-400", viewMoveIndex === -1 && "invisible")} aria-hidden={viewMoveIndex === -1}>{t('game.analysis.reviewing')}</span>
              <button type="button" onClick={() => setViewMoveIndex(-1)} disabled={viewMoveIndex === -1} tabIndex={viewMoveIndex === -1 ? -1 : 0}
                aria-hidden={viewMoveIndex === -1} className={cx("h-9 shrink-0 whitespace-nowrap rounded-lg px-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/10", viewMoveIndex === -1 && "invisible")}>
                {t('game.analysis.resume')}
              </button>
              <button type="button" onClick={startNewAnalysis} className="desktop-analysis-new-button flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-2 text-xs font-bold text-neutral-300 transition-colors duration-150 hover:bg-white/10 hover:text-white">
                <RotateCcw size={14} aria-hidden="true" />
                {t('game.analysis.new')}
              </button>
            </div>
          )}

          <div className={cx("shrink-0 flex flex-col border-b border-white/[0.06]", mode === "review" && "desktop-analysis-stockfish")}>
            {!isLiveMultiplayer && (
              <AnalysisPanel
                score={currentEngineResult?.evaluation || 0.0}
                bestMove={currentEngineResult ? analysisData?.bestMove : undefined}
                depth={currentEngineResult?.depth || 0}
                mate={currentEngineResult?.mate}
                loading={isAnalysing || mode === 'review' && !currentEngineResult && !engineFailed}
                candidates={currentEngineResult && analysisData?.continuation?.length ? [analysisData.continuation] : undefined}
                lines={currentEngineResult?.analyzedFen === displayedGame.fen() ? analysisData?.lines : undefined}
                reviewLayout={mode === 'review'}
                requestedDepth={mode === 'review' ? analysisDepth : undefined}
                onIncreaseDepth={mode === 'review' ? () => setAnalysisDepth(depth => Math.min(36, depth + 6)) : undefined}
                pvLines={mode === 'review' ? pvLines : undefined}
                onPvLinesChange={mode === 'review' ? setPvLines : undefined}
                error={engineFailed}
              />
            )}
          </div>

          <div className={cx("flex-1 min-h-0 flex flex-col overflow-hidden bg-black/[0.1]", !isMultiplayer && "xl:bg-black/[0.025]")}>
            <div className="desktop-analysis-move-scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <table className="desktop-analysis-move-table w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-neutral-950/95 backdrop-blur-3xl z-20 border-b border-white/[0.03]">
                    <tr className="text-[0.6rem] font-black text-neutral-600 uppercase tracking-[0.2em]">
                      <th className="py-1.5 px-3 text-center w-12 border-r border-white/[0.03]">#</th>
                      <th className="py-1.5 px-4">{t('game.white')}</th>
                      <th className="py-1.5 px-4">{t('game.black')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {movePairs.map((move, i) => {
                      const whitePositionIndex = move.wIndex;
                      const blackPositionIndex = move.bIndex;

                      return (
                        <tr key={i} className="hover:bg-white/[0.04] transition-all group text-xs font-black relative group/row">
                          <td className="py-1.5 px-2 text-neutral-600 bg-black/30 text-center border-r border-white/[0.03] text-[0.7rem] font-mono tracking-tighter italic">{move.n}.</td>
                          <td 
                            className={cx("py-1.5 px-4 relative cursor-pointer", move.w && viewMoveIndex === whitePositionIndex && "bg-white/5")}
                            onClick={() => {
                              if (move.w && whitePositionIndex < positionHistory.length) {
                                setViewMoveIndex(whitePositionIndex);
                              }
                            }}
                          >
                            <div className="flex justify-between items-center group-hover/row:text-chess-gold transition-colors">
                              <span className="text-neutral-300 group-hover/row:scale-105 transition-transform origin-left">{move.w || '…'}</span>
                              <span className="text-[0.65rem] text-neutral-700 font-mono italic opacity-40 group-hover:opacity-80">{move.wTime}</span>
                            </div>
                          </td>
                          <td 
                            className={cx("py-1.5 px-4 relative", move.b ? "cursor-pointer" : "", move.b && viewMoveIndex === blackPositionIndex && "bg-white/5")}
                            onClick={() => {
                              if (move.b && blackPositionIndex < positionHistory.length) {
                                setViewMoveIndex(blackPositionIndex);
                              }
                            }}
                          >
                            <div className="flex justify-between items-center group-hover/row:text-chess-active transition-colors">
                              <span className="text-neutral-300 group-hover/row:scale-105 transition-transform origin-left">{move.b}</span>
                              <span className="text-[0.65rem] text-neutral-700 font-mono italic opacity-40 group-hover:opacity-80">{move.bTime}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {desktopAnalysisTransport}

            </div>

        </div>



        {viewMoveIndex !== -1 && isMultiplayer && (
          <div className="md:hidden text-center text-chess-gold text-[0.58rem] font-bold animate-pulse mt-0.5 -mb-0.5 leading-none">
            Replay mode — press Live to move
          </div>
        )}
        {/* Mobile Move Controls Row */}
        <div className={cx(
          "md:hidden items-center justify-between gap-1.5 py-1 px-1 mx-2 shrink-0 mt-0 mb-1 z-10",
          isMultiplayer ? "flex" : "hidden"
        )}>
          <button 
            onClick={() => { if (hasHistory) setViewMoveIndex(0); }} 
            disabled={!hasHistory} 
            className="flex-1 flex justify-center text-white p-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-md shadow-xl hover:from-white/10 hover:to-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/5 hover:ring-white/20"
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
            className="flex-1 flex justify-center text-white p-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-md shadow-xl hover:from-white/10 hover:to-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/5 hover:ring-white/20"
          >
            <ChevronLeft size={20} />
          </button>
          
          <button 
            onClick={() => setViewMoveIndex(-1)} 
            disabled={!hasHistory} 
            className="flex-[1.35] flex justify-center text-white hover:text-white p-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none bg-gradient-to-br from-chess-active/90 to-chess-active/70 border border-chess-active/50 shadow-[0_5px_20px_rgba(0,206,209,0.4)] hover:shadow-[0_8px_25px_rgba(0,206,209,0.6)] ring-1 ring-chess-active/40"
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
            className="flex-1 flex justify-center text-white p-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-md shadow-xl hover:from-white/10 hover:to-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/5 hover:ring-white/20"
          >
            <ChevronRight size={20} />
          </button>
          
          <button 
            onClick={() => setViewMoveIndex(-1)} 
            disabled={!hasHistory} 
            className="flex-1 flex justify-center text-white p-2 rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-md shadow-xl hover:from-white/10 hover:to-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/5 hover:ring-white/20"
          >
            <FastForward size={18} />
          </button>
        </div>


        {drawOfferBy && drawOfferBy !== playerColor && !gameOverMessage && (
          <div className="p-2 mb-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-1.5">
            <span className="font-semibold">{t('game.draw.received')}</span>
            <div className="flex gap-1.5">
              <button
                onClick={handleAcceptDraw}
                disabled={!canSendGameAction}
                className="flex-1 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-100 border border-green-500/40 uppercase font-bold text-[0.6rem] tracking-wide transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {t('game.draw.accept')}
              </button>
              <button
                onClick={handleDeclineDraw}
                disabled={!canSendGameAction}
                className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 uppercase font-bold text-[0.6rem] tracking-wide transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {t('game.draw.decline')}
              </button>
            </div>
          </div>
        )}

        {drawOfferBy === playerColor && !gameOverMessage && (
          <div className="p-2 mb-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs">
            {t('game.draw.pending')}
          </div>
        )}

        {gameActionMessage && !gameOverMessage && (
          <div className="p-2 mb-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
            {gameActionMessage}
          </div>
        )}

        {/* Live-game actions do not belong to the replay and analysis workspace. */}
        {mode !== 'review' && (
        <div className={cx(
          "p-2 bg-transparent md:bg-black/60 border-0 md:border-t border-white/10 flex md:grid md:grid-cols-2 gap-2 shrink-0 shadow-none md:shadow-[0_-30px_60px_-15px_rgba(0,0,0,0.8)] relative z-30 ring-0 md:ring-1 ring-white/5 md:backdrop-blur-3xl",
          !isMultiplayer && "hidden md:grid"
        )}>
          <button
            disabled={!canSendGameAction}
            onClick={handleResign}
            className={cx(
              "flex-1 flex md:flex-col items-center justify-center gap-1 py-1.5 rounded-lg md:rounded-xl bg-white/5 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 font-black text-[0.6rem] uppercase tracking-[0.1em] border border-white/5 group shadow-2xl transition-all duration-150 active:scale-95 hover:border-red-500/20 ring-1 ring-white/5",
              !canSendGameAction && "opacity-50 pointer-events-none"
            )}
          >
            <Flag size={16} className="group-hover:rotate-[15deg] group-hover:scale-110 transition-all duration-200" />
            {t('game.resign')}
          </button>
          <button
            disabled={!canSendGameAction || drawOfferBy !== null}
            onClick={handleOfferDraw}
            className={cx(
              "flex-1 flex md:flex-col items-center justify-center gap-1 py-1.5 rounded-lg md:rounded-xl bg-white/5 hover:bg-white/10 text-neutral-500 hover:text-white font-black text-[0.6rem] uppercase tracking-[0.1em] border border-white/5 shadow-2xl transition-all duration-150 active:scale-95 group hover:border-white/20 ring-1 ring-white/5",
              (!canSendGameAction || drawOfferBy !== null) && "opacity-50 pointer-events-none"
            )}
          >
            <Handshake size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-all duration-200" />
            {t('game.draw')}
          </button>
        </div>
        )}

      </div>
    </div>
  );
}

