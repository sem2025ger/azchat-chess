require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_URL }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: "aztr-chess-server" });
});

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// State
let waitingQueue = []; // Array of socket objects
const activeRooms = new Map(); // roomId -> { game, players: [{ socket, color }] }
const socketToRoom = new Map(); // socket.id -> roomId

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

      io.to(roomId).emit('game_start', { whiteTime: 600, blackTime: 600 });
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
      roomData.status = 'active';
      
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      
      console.log(`Private match joined: ${roomId} [${creatorSocketId}=${creatorColor}, ${socket.id}=${emptyColor}]`);
      
      io.to(creatorSocketId).emit('match_found', { roomId, color: creatorColor });
      socket.emit('match_found', { roomId, color: emptyColor });
      
      io.to(roomId).emit('game_start', { whiteTime: 600, blackTime: 600 });
    } catch (e) {
      console.error("Error joining private room:", e);
      socket.emit('join_failed', { reason: "room_not_found" });
    }
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

      const result = game.move(move);
      if (!result) {
        socket.emit('move_rejected', { reason: "illegal_move" });
        console.log(`[reject] illegal_move from ${socket.id} roomId=${roomId}`);
        return;
      }

      // Valid move
      io.to(roomId).emit('update_board', { fen: game.fen(), history: game.history() });

      if (game.isGameOver()) {
        let reason = "game_over";
        if (game.isCheckmate()) reason = "checkmate";
        else if (game.isDraw()) reason = "draw";
        else if (game.isStalemate()) reason = "stalemate";
        
        io.to(roomId).emit('game_over', { reason });
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
    if (roomId) {
      const roomData = activeRooms.get(roomId);
      if (roomData) {
        if (roomData.players.w && roomData.players.b) {
          io.to(roomId).emit('game_over', { reason: "opponent_disconnected" });
        }
        
        // Cleanup
        if (roomData.players.w) socketToRoom.delete(roomData.players.w);
        if (roomData.players.b) socketToRoom.delete(roomData.players.b);
        activeRooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
