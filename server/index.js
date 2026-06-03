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
        players: [
          { socket: player1, color: colors[0] },
          { socket: player2, color: colors[1] }
        ]
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

  socket.on('make_move', (payload) => {
    try {
      if (!payload || typeof payload !== 'object') return;
      const { roomId, move } = payload;
      if (!roomId || !move) return;

      const roomData = activeRooms.get(roomId);
      if (!roomData) {
        socket.emit('move_rejected', { reason: "Room not found" });
        return;
      }

      const game = roomData.game;
      const result = game.move(move);

      if (!result) {
        socket.emit('move_rejected', { reason: "Invalid move" });
        return;
      }

      // Valid move
      io.to(roomId).emit('update_board', { fen: game.fen() });

      if (game.isGameOver()) {
        let reason = "game_over";
        if (game.isCheckmate()) reason = "checkmate";
        else if (game.isDraw()) reason = "draw";
        else if (game.isStalemate()) reason = "stalemate";
        
        io.to(roomId).emit('game_over', { reason });
      }
    } catch (e) {
      console.error("Error processing move:", e);
      socket.emit('move_rejected', { reason: "Malformed payload or internal error" });
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
        io.to(roomId).emit('game_over', { reason: "opponent_disconnected" });
        
        // Cleanup
        roomData.players.forEach(p => {
          socketToRoom.delete(p.socket.id);
        });
        activeRooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
