require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { createSocketAuthMiddleware } = require('./socketAuth');
const { createMatchPersistenceFromEnv } = require('./matchPersistence');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (process.env.NODE_ENV !== 'test') {
    console.error(
      '[boot] Missing required env: SUPABASE_URL and/or SUPABASE_ANON_KEY. Refusing to start.'
    );
    process.exit(1);
  }
}

const supabaseAuthClient = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

async function verifySupabaseToken(accessToken) {
  if (!supabaseAuthClient) return null;
  try {
    const { data, error } = await supabaseAuthClient.auth.getUser(accessToken);
    if (error || !data || !data.user || !data.user.id) {
      return null;
    }
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

let matchPersistence = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    matchPersistence = createMatchPersistenceFromEnv();
    console.log('[boot] Match persistence adapter initialized.');
  } catch (err) {
    console.warn('[boot] Failed to initialize match persistence adapter:', err.message);
  }
} else {
  console.warn('[boot] SUPABASE_SERVICE_KEY not set; match persistence disabled.');
}

function setMatchPersistenceAdapter(adapter) {
  matchPersistence = adapter;
}

let tokenVerifier = verifySupabaseToken;

function setTokenVerifier(verifier) {
  tokenVerifier = verifier;
}

async function verifyTokenProxy(token) {
  return tokenVerifier(token);
}

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const EXACT_ALLOWED_ORIGINS = new Set([
  'https://chessaz.de',
  'https://www.chessaz.de',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  FRONTEND_URL,
]);

const VERCEL_PREVIEW_PATTERN = /^https:\/\/azchat-chess-[a-z0-9-]+\.vercel\.app$/i;

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (EXACT_ALLOWED_ORIGINS.has(origin)) return true;
  if (VERCEL_PREVIEW_PATTERN.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ["GET", "POST"],
};

app.use(cors(corsOptions));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: "aztr-chess-server" });
});

const io = new Server(server, {
  cors: corsOptions,
});
io.use(createSocketAuthMiddleware(verifyTokenProxy));

// State
let waitingQueue = []; // Array of socket objects
const activeRooms = new Map(); // roomId -> { game, players: [{ socket, color }] }
const socketToRoom = new Map(); // socket.id -> roomId

function getPlayerColor(room, socketId) {
  if (!room || !room.players) return null;
  if (room.players.w === socketId) return 'w';
  if (room.players.b === socketId) return 'b';
  return null;
}

function oppositeColor(color) {
  return color === 'w' ? 'b' : color === 'b' ? 'w' : null;
}

function cleanupRoom(roomId, room) {
  if (!room) return;

  if (room.disconnects) {
    if (room.disconnects.w?.timer) {
      clearTimeout(room.disconnects.w.timer);
      room.disconnects.w.timer = null;
    }
    if (room.disconnects.b?.timer) {
      clearTimeout(room.disconnects.b.timer);
      room.disconnects.b.timer = null;
    }
  }

  // Clear every socket ID associated with this room from socketToRoom
  if (room.socketIds) {
    for (const socketId of room.socketIds) {
      socketToRoom.delete(socketId);
      const memberSocket = io.sockets.sockets.get(socketId);
      if (memberSocket) {
        memberSocket.leave(roomId);
      }
    }
  } else if (room.players) {
    for (const socketId of Object.values(room.players)) {
      if (!socketId) continue;
      socketToRoom.delete(socketId);
      const memberSocket = io.sockets.sockets.get(socketId);
      if (memberSocket) {
        memberSocket.leave(roomId);
      }
    }
  }

  activeRooms.delete(roomId);
}

function finalizeGame(roomId, payload) {
  const room = activeRooms.get(roomId);
  if (!room || room.status === 'ended') {
    return false;
  }

  room.status = 'ended';

  if (room.disconnects) {
    if (room.disconnects.w?.timer) {
      clearTimeout(room.disconnects.w.timer);
      room.disconnects.w.timer = null;
    }
    if (room.disconnects.b?.timer) {
      clearTimeout(room.disconnects.b.timer);
      room.disconnects.b.timer = null;
    }
  }

  const gameOverPayload = {
    roomId,
    reason: payload.reason,
    result: payload.result,
    winnerColor: payload.winnerColor ?? null,
    endedBy: payload.endedBy ?? null,
  };

  io.to(roomId).emit('game_over', gameOverPayload);

  // Authoritative match persistence (idempotent, safe)
  if (matchPersistence && !room.persisted) {
    const whiteId = room.userIds?.w;
    const blackId = room.userIds?.b;

    if (!whiteId || !blackId) {
      console.warn(`[persistence] Skipping persistence for room ${roomId}: missing player user ID`);
    } else if (whiteId === blackId) {
      // Explicit handling for self-match
      console.warn(`[persistence] Skipping persistence for room ${roomId}: self-match detected (${whiteId})`);
    } else {
      room.persisted = true;
      let winnerId = null;
      if (payload.winnerColor === 'w') winnerId = whiteId;
      else if (payload.winnerColor === 'b') winnerId = blackId;

      const completedRecord = {
        id: crypto.randomUUID(),
        sourceRoomId: roomId,
        whiteId,
        blackId,
        winnerId,
        winnerColor: payload.winnerColor ?? null,
        result: payload.result,
        terminationReason: payload.reason,
        timeControl: room.timeControl || '10+0',
        initialTime: room.initialTime || 600,
        increment: room.increment || 0,
        initialFen: room.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        finalFen: room.game.fen(),
        pgn: room.game.pgn() || '',
        createdAt: room.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      matchPersistence.persistCompletedMatch(completedRecord).catch((err) => {
        // Safe error logging without sensitive credentials
        console.error(`[persistence] Error persisting match ${roomId}:`, err.message || 'unknown error');
      });
    }
  }

  // Defer cleanup by 30 seconds so connected clients receive events and can view the board
  const cleanupTimer = setTimeout(() => {
    cleanupRoom(roomId, room);
  }, 30000);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return true;
}

function markPlayerDisconnected(roomId, disconnectedColor, graceSeconds = 30) {
  const roomData = activeRooms.get(roomId);
  if (!roomData || roomData.status !== 'active') return null;

  if (!roomData.disconnects) {
    roomData.disconnects = {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    };
  }

  const playerDisconnect = roomData.disconnects[disconnectedColor];
  if (!playerDisconnect) return null;

  playerDisconnect.disconnectedAt = Date.now();

  io.to(roomId).emit('player_disconnected', {
    roomId,
    color: disconnectedColor,
    graceSeconds,
  });

  if (playerDisconnect.timer) {
    clearTimeout(playerDisconnect.timer);
    playerDisconnect.timer = null;
  }

  playerDisconnect.timer = setTimeout(() => {
    const currentRoom = activeRooms.get(roomId);
    if (
      currentRoom &&
      currentRoom.status === 'active' &&
      currentRoom.disconnects?.[disconnectedColor]?.disconnectedAt !== null
    ) {
      const winnerColor = oppositeColor(disconnectedColor);
      finalizeGame(roomId, {
        reason: 'opponent_disconnected',
        result: winnerColor === 'w' ? '1-0' : '0-1',
        winnerColor,
        endedBy: disconnectedColor,
      });
    }
  }, graceSeconds * 1000);

  if (playerDisconnect.timer.unref) {
    playerDisconnect.timer.unref();
  }

  return playerDisconnect;
}

function reconnectPlayerToRoom(roomId, playerColor, newSocket) {
  const room = activeRooms.get(roomId);
  if (!room || room.status !== 'active') return null;

  const newSocketId = typeof newSocket === 'string' ? newSocket : newSocket?.id;

  if (newSocketId) {
    const oldSocketId = room.players[playerColor];
    if (oldSocketId && oldSocketId !== newSocketId) {
      socketToRoom.delete(oldSocketId);
      if (room.socketIds) room.socketIds.delete(oldSocketId);
    }
    room.players[playerColor] = newSocketId;
    if (!room.socketIds) room.socketIds = new Set();
    room.socketIds.add(newSocketId);
    socketToRoom.set(newSocketId, roomId);

    if (newSocket && typeof newSocket.join === 'function') {
      newSocket.join(roomId);
    }
  }

  // Cancel disconnect grace period for this color only
  const playerDisconnect = room.disconnects?.[playerColor];
  if (playerDisconnect && playerDisconnect.disconnectedAt !== null) {
    if (playerDisconnect.timer) {
      clearTimeout(playerDisconnect.timer);
      playerDisconnect.timer = null;
    }
    playerDisconnect.disconnectedAt = null;
    io.to(roomId).emit('player_reconnected', { roomId, color: playerColor });
  }

  let whiteTime = Math.ceil(room.whiteTimeMs / 1000);
  let blackTime = Math.ceil(room.blackTimeMs / 1000);
  if (room.lastMoveTimestamp) {
    const elapsed = Math.floor((Date.now() - room.lastMoveTimestamp) / 1000);
    if (room.game.turn() === 'w') whiteTime = Math.max(0, whiteTime - elapsed);
    else blackTime = Math.max(0, blackTime - elapsed);
  }

  const payload = {
    roomId,
    color: playerColor,
    fen: room.game.fen(),
    history: room.game.history(),
    whiteTime,
    blackTime,
    turn: room.game.turn(),
    drawOfferBy: room.drawOfferBy,
  };

  if (newSocket && typeof newSocket.emit === 'function') {
    newSocket.emit('reconnect_success', payload);
  }

  return payload;
}

// Watchdog timer: checks for clock timeouts on active games every 1 second
function checkRoomTimeouts() {
  const now = Date.now();
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.status !== 'active' || !room.lastMoveTimestamp) continue;

    const currentTurn = room.game.turn();
    const elapsedMs = Math.max(0, now - room.lastMoveTimestamp);
    const remainingMs = (currentTurn === 'w' ? room.whiteTimeMs : room.blackTimeMs) - elapsedMs;

    if (remainingMs <= 0) {
      if (currentTurn === 'w') room.whiteTimeMs = 0;
      else room.blackTimeMs = 0;

      const winnerColor = oppositeColor(currentTurn);
      finalizeGame(roomId, {
        reason: 'timeout',
        result: winnerColor === 'w' ? '1-0' : '0-1',
        winnerColor,
        endedBy: currentTurn,
      });
    }
  }
}

const timeoutWatchdog = setInterval(checkRoomTimeouts, 1000);
if (timeoutWatchdog.unref) {
  timeoutWatchdog.unref();
}

function getNaturalGameOverPayload(game) {
  if (game.isCheckmate()) {
    const loserColor = game.turn();
    const winnerColor = oppositeColor(loserColor);
    return {
      reason: 'checkmate',
      result: winnerColor === 'w' ? '1-0' : '0-1',
      winnerColor,
      endedBy: null,
    };
  }

  if (game.isStalemate()) {
    return {
      reason: 'stalemate',
      result: '1/2-1/2',
      winnerColor: null,
      endedBy: null,
    };
  }

  if (game.isDraw()) {
    return {
      reason: 'draw',
      result: '1/2-1/2',
      winnerColor: null,
      endedBy: null,
    };
  }

  return null;
}

function rejectGameAction(socket, action, reason) {
  socket.emit('game_action_rejected', { action, reason });
}

function getActivePlayerActionContext(socket, roomId, action) {
  if (typeof roomId !== 'string' || roomId.trim().length === 0) {
    rejectGameAction(socket, action, 'invalid_payload');
    return null;
  }

  const room = activeRooms.get(roomId);
  if (!room) {
    rejectGameAction(socket, action, 'room_not_found');
    return null;
  }

  if (room.status === 'ended') {
    rejectGameAction(socket, action, 'already_ended');
    return null;
  }

  const playerColor = getPlayerColor(room, socket.id);
  if (socketToRoom.get(socket.id) !== roomId || !playerColor) {
    rejectGameAction(socket, action, 'not_in_room');
    return null;
  }

  if (room.status !== 'active') {
    rejectGameAction(socket, action, 'not_active');
    return null;
  }

  return { room, playerColor };
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_queue', () => {
    const userId = socket.data?.userId;

    // Prevent duplicate entries by socket.id or authenticated userId
    if (waitingQueue.some(s => s.id === socket.id || (userId && s.data?.userId === userId))) {
      return;
    }
    if (socketToRoom.has(socket.id)) return;

    waitingQueue.push(socket);

    // Pair players when at least 2 are waiting with distinct user IDs
    if (waitingQueue.length >= 2) {
      const p1 = waitingQueue[0];
      const p2Index = waitingQueue.findIndex(
        (s, idx) => idx > 0 && (!p1.data?.userId || !s.data?.userId || s.data.userId !== p1.data.userId)
      );

      if (p2Index !== -1) {
        const player1 = waitingQueue.splice(0, 1)[0];
        const player2 = waitingQueue.splice(p2Index - 1, 1)[0];

        const roomId = crypto.randomUUID();
        const colors = Math.random() > 0.5 ? ['w', 'b'] : ['b', 'w'];

        player1.join(roomId);
        player2.join(roomId);

        const initialTime = 600;
        const roomData = {
          roomId,
          game: new Chess(),
          status: 'active',
          drawOfferBy: null,
          startedAt: new Date().toISOString(),
          timeControl: '10+0',
          initialTime,
          increment: 0,
          initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          whiteTimeMs: initialTime * 1000,
          blackTimeMs: initialTime * 1000,
          lastMoveTimestamp: Date.now(),
          persisted: false,
          socketIds: new Set([player1.id, player2.id]),
          disconnects: {
            w: { timer: null, disconnectedAt: null },
            b: { timer: null, disconnectedAt: null },
          },
          userIds: {
            w: colors[0] === 'w' ? player1.data.userId : player2.data.userId,
            b: colors[0] === 'b' ? player1.data.userId : player2.data.userId,
          },
          players: {
            w: colors[0] === 'w' ? player1.id : player2.id,
            b: colors[0] === 'b' ? player1.id : player2.id,
          },
        };

        activeRooms.set(roomId, roomData);
        socketToRoom.set(player1.id, roomId);
        socketToRoom.set(player2.id, roomId);

        console.log(`Match created: ${roomId} [${player1.id}=${colors[0]}, ${player2.id}=${colors[1]}]`);

        player1.emit('match_found', { roomId, color: colors[0] });
        player2.emit('match_found', { roomId, color: colors[1] });

        io.to(roomId).emit('game_start', {
          whiteTime: roomData.initialTime,
          blackTime: roomData.initialTime,
        });
      }
    }
  });

  socket.on('cancel_matchmaking', () => {
    waitingQueue = waitingQueue.filter((waitingSocket) => waitingSocket.id !== socket.id);

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const room = activeRooms.get(roomId);
      if (room) {
        if (room.isPrivate === true && room.status === 'pending' && (room.players.w === socket.id || room.players.b === socket.id)) {
          activeRooms.delete(roomId);
          socketToRoom.delete(socket.id);
          socket.leave(roomId);
        }
      } else {
        socketToRoom.delete(socket.id);
      }
    }
  });

  socket.on('create_private_room', () => {
    const existingRoomId = socketToRoom.get(socket.id);
    if (existingRoomId) {
      const existingRoom = activeRooms.get(existingRoomId);
      if (existingRoom) {
        if (existingRoom.isPrivate === true && existingRoom.status === 'pending' && (existingRoom.players.w === socket.id || existingRoom.players.b === socket.id)) {
          socket.emit('private_room_created', { roomId: existingRoomId });
          return;
        } else {
          socket.emit('join_failed', { reason: "already_in_room" });
          return;
        }
      } else {
        socketToRoom.delete(socket.id);
      }
    }

    const roomId = crypto.randomUUID();
    const isWhite = Math.random() > 0.5;
    const initialTime = 600;

    const roomData = {
      roomId,
      game: new Chess(),
      isPrivate: true,
      status: 'pending',
      drawOfferBy: null,
      startedAt: null,
      timeControl: '10+0',
      initialTime,
      increment: 0,
      initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      whiteTimeMs: initialTime * 1000,
      blackTimeMs: initialTime * 1000,
      lastMoveTimestamp: null,
      persisted: false,
      socketIds: new Set([socket.id]),
      disconnects: {
        w: { timer: null, disconnectedAt: null },
        b: { timer: null, disconnectedAt: null },
      },
      userIds: {
        w: isWhite ? socket.data.userId : null,
        b: isWhite ? null : socket.data.userId,
      },
      players: {
        w: isWhite ? socket.id : null,
        b: isWhite ? null : socket.id,
      },
    };

    activeRooms.set(roomId, roomData);
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    console.log(`Private match created: ${roomId} by ${socket.id}`);
    socket.emit('private_room_created', { roomId });
  });

  socket.on('join_private_room', (payload) => {
    try {
      if (!payload || typeof payload !== 'object' || !payload.roomId || typeof payload.roomId !== 'string') {
        socket.emit('join_failed', { reason: "room_not_found" });
        return;
      }

      const roomId = payload.roomId;
      const roomData = activeRooms.get(roomId);

      if (!roomData || !roomData.isPrivate) {
        socket.emit('join_failed', { reason: "room_not_found" });
        return;
      }

      if (roomData.status === 'active' || (roomData.players.w && roomData.players.b)) {
        socket.emit('join_failed', { reason: "room_full" });
        return;
      }

      if (roomData.players.w === socket.id || roomData.players.b === socket.id) {
        socket.emit('join_failed', { reason: "already_in_room" });
        return;
      }

      // Prevent same user from playing against themselves in private room
      const creatorColor = roomData.players.w ? 'w' : 'b';
      if (roomData.userIds[creatorColor] && roomData.userIds[creatorColor] === socket.data?.userId) {
        socket.emit('join_failed', { reason: "already_in_room" });
        return;
      }

      const emptyColor = roomData.players.w === null ? 'w' : 'b';
      const creatorSocketId = roomData.players[creatorColor];

      roomData.players[emptyColor] = socket.id;
      if (!roomData.socketIds) roomData.socketIds = new Set();
      roomData.socketIds.add(socket.id);
      roomData.userIds[emptyColor] = socket.data.userId;
      roomData.startedAt = new Date().toISOString();
      roomData.status = 'active';
      roomData.drawOfferBy = null;
      roomData.whiteTimeMs = roomData.initialTime * 1000;
      roomData.blackTimeMs = roomData.initialTime * 1000;
      roomData.lastMoveTimestamp = Date.now();

      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);

      console.log(`Private match joined: ${roomId} [${creatorSocketId}=${creatorColor}, ${socket.id}=${emptyColor}]`);

      io.to(creatorSocketId).emit('match_found', { roomId, color: creatorColor });
      socket.emit('match_found', { roomId, color: emptyColor });

      io.to(roomId).emit('game_start', {
        whiteTime: roomData.initialTime,
        blackTime: roomData.initialTime,
      });
    } catch (e) {
      console.error("Error joining private room:", e);
      socket.emit('join_failed', { reason: "room_not_found" });
    }
  });

  socket.on('resign_game', (payload) => {
    const roomId = payload?.roomId;
    const context = getActivePlayerActionContext(socket, roomId, 'resign_game');
    if (!context) return;

    const resigningColor = context.playerColor;
    const winnerColor = oppositeColor(resigningColor);

    finalizeGame(roomId, {
      reason: 'resignation',
      result: winnerColor === 'w' ? '1-0' : '0-1',
      winnerColor,
      endedBy: resigningColor,
    });
  });

  socket.on('draw_offer', (payload) => {
    const roomId = payload?.roomId;
    const context = getActivePlayerActionContext(socket, roomId, 'draw_offer');
    if (!context) return;

    const { room, playerColor } = context;
    if (room.drawOfferBy === playerColor) {
      rejectGameAction(socket, 'draw_offer', 'duplicate_draw_offer');
      return;
    }

    if (room.drawOfferBy === oppositeColor(playerColor)) {
      rejectGameAction(socket, 'draw_offer', 'existing_draw_offer');
      return;
    }

    room.drawOfferBy = playerColor;
    io.to(roomId).emit('draw_offer_received', { roomId, offeredBy: playerColor });
  });

  socket.on('draw_accept', (payload) => {
    const roomId = payload?.roomId;
    const context = getActivePlayerActionContext(socket, roomId, 'draw_accept');
    if (!context) return;

    const { room, playerColor } = context;
    if (!room.drawOfferBy) {
      rejectGameAction(socket, 'draw_accept', 'no_draw_offer');
      return;
    }

    if (room.drawOfferBy === playerColor) {
      rejectGameAction(socket, 'draw_accept', 'own_draw_offer');
      return;
    }

    finalizeGame(roomId, {
      reason: 'draw_agreement',
      result: '1/2-1/2',
      winnerColor: null,
      endedBy: playerColor,
    });
  });

  socket.on('draw_decline', (payload) => {
    const roomId = payload?.roomId;
    const context = getActivePlayerActionContext(socket, roomId, 'draw_decline');
    if (!context) return;

    const { room, playerColor } = context;
    if (!room.drawOfferBy) {
      rejectGameAction(socket, 'draw_decline', 'no_draw_offer');
      return;
    }

    if (room.drawOfferBy === playerColor) {
      rejectGameAction(socket, 'draw_decline', 'own_draw_offer');
      return;
    }

    room.drawOfferBy = null;
    io.to(roomId).emit('draw_offer_declined', { roomId, declinedBy: playerColor });
  });

  socket.on('make_move', (payload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        socket.emit('move_rejected', { reason: "invalid_payload" });
        return;
      }
      const { roomId, move } = payload;
      if (!roomId || !move) {
        socket.emit('move_rejected', { reason: "invalid_payload" });
        return;
      }

      const roomData = activeRooms.get(roomId);
      if (!roomData) {
        socket.emit('move_rejected', { reason: "room_not_found" });
        return;
      }

      if (!roomData.players.w || !roomData.players.b) {
        socket.emit('move_rejected', { reason: "game_not_started" });
        return;
      }

      const game = roomData.game;
      if (roomData.players[game.turn()] !== socket.id) {
        socket.emit('move_rejected', { reason: "not_your_turn" });
        return;
      }

      const moverColor = getPlayerColor(roomData, socket.id);

      // Compute elapsed time and remaining time WITHOUT mutating stored clock
      const now = Date.now();
      const elapsedMs = roomData.lastMoveTimestamp ? Math.max(0, now - roomData.lastMoveTimestamp) : 0;
      const activePlayerTimeMs = moverColor === 'w' ? roomData.whiteTimeMs : roomData.blackTimeMs;
      const remainingTimeMs = activePlayerTimeMs - elapsedMs;

      // Check timeout before move execution
      if (remainingTimeMs <= 0) {
        if (moverColor === 'w') roomData.whiteTimeMs = 0;
        else roomData.blackTimeMs = 0;

        const winnerColor = oppositeColor(moverColor);
        finalizeGame(roomId, {
          reason: 'timeout',
          result: winnerColor === 'w' ? '1-0' : '0-1',
          winnerColor,
          endedBy: moverColor,
        });
        return;
      }

      // Validate and apply chess move
      let result = null;
      try {
        result = game.move(move);
      } catch {
        socket.emit('move_rejected', { reason: "illegal_move" });
        return;
      }

      if (!result) {
        socket.emit('move_rejected', { reason: "illegal_move" });
        return;
      }

      // ONLY AFTER a legal move: commit remaining time and add increment
      if (moverColor === 'w') {
        roomData.whiteTimeMs = Math.max(0, remainingTimeMs + (roomData.increment * 1000));
      } else {
        roomData.blackTimeMs = Math.max(0, remainingTimeMs + (roomData.increment * 1000));
      }
      roomData.lastMoveTimestamp = now;

      if (roomData.drawOfferBy && roomData.drawOfferBy !== moverColor) {
        roomData.drawOfferBy = null;
        io.to(roomId).emit('draw_offer_declined', { roomId, declinedBy: moverColor });
      }

      // Valid move broadcast with authoritative clocks
      io.to(roomId).emit('update_board', {
        fen: game.fen(),
        history: game.history(),
        whiteTime: Math.ceil(roomData.whiteTimeMs / 1000),
        blackTime: Math.ceil(roomData.blackTimeMs / 1000),
      });

      const gameOverPayload = getNaturalGameOverPayload(game);
      if (gameOverPayload) {
        finalizeGame(roomId, gameOverPayload);
      }
    } catch (e) {
      console.error("Error processing move:", e);
      socket.emit('move_rejected', { reason: "invalid_payload" });
    }
  });

  socket.on('reconnect_game', (payload) => {
    const roomId = payload?.roomId;
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('reconnect_failed', { reason: 'invalid_payload' });
      return;
    }

    const room = activeRooms.get(roomId);
    if (!room || room.status !== 'active') {
      socket.emit('reconnect_failed', { reason: 'game_not_active' });
      return;
    }

    const userId = socket.data?.userId;
    let playerColor = null;
    if (room.userIds?.w && room.userIds.w === userId) playerColor = 'w';
    else if (room.userIds?.b && room.userIds.b === userId) playerColor = 'b';

    if (!playerColor) {
      socket.emit('reconnect_failed', { reason: 'not_a_player' });
      return;
    }

    reconnectPlayerToRoom(roomId, playerColor, socket);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Remove from waiting queue
    waitingQueue = waitingQueue.filter((s) => s.id !== socket.id);

    // Handle room disconnect
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const roomData = activeRooms.get(roomId);
    if (!roomData) {
      socketToRoom.delete(socket.id);
      return;
    }

    if (roomData.status === 'ended') {
      socketToRoom.delete(socket.id);
      return;
    }

    if (roomData.status === 'pending') {
      cleanupRoom(roomId, roomData);
      return;
    }

    const disconnectedColor = getPlayerColor(roomData, socket.id);
    if (!disconnectedColor) {
      socketToRoom.delete(socket.id);
      return;
    }

    markPlayerDisconnected(roomId, disconnectedColor);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = {
  app,
  server,
  io,
  activeRooms,
  waitingQueue,
  socketToRoom,
  finalizeGame,
  cleanupRoom,
  setMatchPersistenceAdapter,
  setTokenVerifier,
  timeoutWatchdog,
  checkRoomTimeouts,
  markPlayerDisconnected,
  reconnectPlayerToRoom,
  getPlayerColor,
  oppositeColor,
  getNaturalGameOverPayload,
  rejectGameAction,
  getActivePlayerActionContext,
};
