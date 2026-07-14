require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { createSocketAuthMiddleware } = require('./socketAuth');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[boot] Missing required env: SUPABASE_URL and/or SUPABASE_ANON_KEY. Refusing to start.'
  );
  process.exit(1);
}

const supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function verifySupabaseToken(accessToken) {
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
io.use(createSocketAuthMiddleware(verifySupabaseToken));

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

  for (const socketId of Object.values(room.players || {})) {
    if (!socketId) continue;
    socketToRoom.delete(socketId);
    const memberSocket = io.sockets.sockets.get(socketId);
    if (memberSocket) {
      memberSocket.leave(roomId);
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

  const gameOverPayload = {
    roomId,
    reason: payload.reason,
    result: payload.result,
    winnerColor: payload.winnerColor ?? null,
    endedBy: payload.endedBy ?? null,
  };

  io.to(roomId).emit('game_over', gameOverPayload);
  cleanupRoom(roomId, room);
  return true;
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
    // Prevent duplicate entries
    if (waitingQueue.find(s => s.id === socket.id)) return;
    if (socketToRoom.has(socket.id)) return;

    console.log('Socket joined queue:', socket.id);
    waitingQueue.push(socket);

    if (waitingQueue.length >= 2) {
      const player1 = waitingQueue.shift();
      const player2 = waitingQueue.shift();

      const roomId = crypto.randomUUID();
      const colors = Math.random() > 0.5 ? ['w', 'b'] : ['b', 'w'];

      player1.join(roomId);
      player2.join(roomId);

      const roomData = {
        roomId,
        game: new Chess(),
        status: 'active',
        drawOfferBy: null,
        startedAt: new Date().toISOString(),
        timeControl: '10+0',
        initialTime: 600,
        increment: 0,
        userIds: {
          w: colors[0] === 'w' ? player1.data.userId : player2.data.userId,
          b: colors[0] === 'b' ? player1.data.userId : player2.data.userId
        },
        players: {
          w: colors[0] === 'w' ? player1.id : player2.id,
          b: colors[0] === 'b' ? player1.id : player2.id
        }
      };
      
      activeRooms.set(roomId, roomData);
      socketToRoom.set(player1.id, roomId);
      socketToRoom.set(player2.id, roomId);

      console.log(`Match created: ${roomId} [${player1.id}=${colors[0]}, ${player2.id}=${colors[1]}]`);

      player1.emit('match_found', { roomId, color: colors[0] });
      player2.emit('match_found', { roomId, color: colors[1] });

      io.to(roomId).emit('game_start', { whiteTime: roomData.initialTime, blackTime: roomData.initialTime });
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
    
    const roomData = {
      roomId,
      game: new Chess(),
      isPrivate: true,
      status: 'pending',
      drawOfferBy: null,
      startedAt: null,
      timeControl: '10+0',
      initialTime: 600,
      increment: 0,
      userIds: {
        w: isWhite ? socket.data.userId : null,
        b: isWhite ? null : socket.data.userId
      },
      players: {
        w: isWhite ? socket.id : null,
        b: isWhite ? null : socket.id
      }
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
      
      // Join behavior
      const emptyColor = roomData.players.w === null ? 'w' : 'b';
      const creatorColor = emptyColor === 'w' ? 'b' : 'w';
      const creatorSocketId = roomData.players[creatorColor];
      
      roomData.players[emptyColor] = socket.id;
      roomData.userIds[emptyColor] = socket.data.userId;
      roomData.startedAt = new Date().toISOString();
      roomData.status = 'active';
      roomData.drawOfferBy = null;
      
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      
      console.log(`Private match joined: ${roomId} [${creatorSocketId}=${creatorColor}, ${socket.id}=${emptyColor}]`);
      
      io.to(creatorSocketId).emit('match_found', { roomId, color: creatorColor });
      socket.emit('match_found', { roomId, color: emptyColor });
      
      io.to(roomId).emit('game_start', { whiteTime: roomData.initialTime, blackTime: roomData.initialTime });
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
        console.log(`[reject] invalid_payload from ${socket.id} roomId=undefined`);
        return;
      }
      const { roomId, move } = payload;
      if (!roomId || !move) {
        socket.emit('move_rejected', { reason: "invalid_payload" });
        console.log(`[reject] invalid_payload from ${socket.id} roomId=${roomId}`);
        return;
      }

      const roomData = activeRooms.get(roomId);
      if (!roomData) {
        socket.emit('move_rejected', { reason: "room_not_found" });
        console.log(`[reject] room_not_found from ${socket.id} roomId=${roomId}`);
        return;
      }

      if (!roomData.players.w || !roomData.players.b) {
        socket.emit('move_rejected', { reason: "game_not_started" });
        console.log(`[reject] game_not_started from ${socket.id} roomId=${roomId}`);
        return;
      }

      const game = roomData.game;
      if (roomData.players[game.turn()] !== socket.id) {
        socket.emit('move_rejected', { reason: "not_your_turn" });
        console.log(`[reject] not_your_turn from ${socket.id} roomId=${roomId}`);
        return;
      }

      const moverColor = getPlayerColor(roomData, socket.id);
      const result = game.move(move);
      if (!result) {
        socket.emit('move_rejected', { reason: "illegal_move" });
        console.log(`[reject] illegal_move from ${socket.id} roomId=${roomId}`);
        return;
      }

      if (roomData.drawOfferBy && roomData.drawOfferBy !== moverColor) {
        roomData.drawOfferBy = null;
        io.to(roomId).emit('draw_offer_declined', { roomId, declinedBy: moverColor });
      }

      // Valid move
      io.to(roomId).emit('update_board', { fen: game.fen(), history: game.history() });

      const gameOverPayload = getNaturalGameOverPayload(game);
      if (gameOverPayload) {
        finalizeGame(roomId, gameOverPayload);
      }
    } catch (e) {
      console.error("Error processing move:", e);
      socket.emit('move_rejected', { reason: "invalid_payload" });
      console.log(`[reject] invalid_payload from ${socket.id} roomId=${payload?.roomId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove from queue
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);

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

    const disconnectedColor = getPlayerColor(roomData, socket.id);
    const winnerColor = oppositeColor(disconnectedColor);

    if (roomData.status === 'active' && winnerColor) {
      finalizeGame(roomId, {
        reason: 'opponent_disconnected',
        result: winnerColor === 'w' ? '1-0' : '0-1',
        winnerColor,
        endedBy: disconnectedColor,
      });
      return;
    }

    if (roomData.status === 'pending') {
      cleanupRoom(roomId, roomData);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
