import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Chess } from 'chess.js';
import dotenv from 'dotenv';
import { createMatch, recordMove, resolveMatch } from './db.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST']
}));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

const activeGames = new Map();
const queue = [];

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_queue', async (data) => {
    const userId = data?.userId || 'anon-' + socket.id;
    const rating = data?.rating || 1200;
    
    // Check if player is already in a match
    let existingRoom = null;
    for (const [roomId, game] of activeGames.entries()) {
      if ((game.whiteId === userId || game.blackId === userId) && game.status === 'active') {
        existingRoom = roomId;
        break;
      }
    }
    
    if (existingRoom) {
      socket.join(existingRoom);
      const game = activeGames.get(existingRoom);
      socket.emit('match_found', { roomId: existingRoom, color: game.whiteId === userId ? 'w' : 'b', fen: game.chess.fen() });
      socket.emit('update_board', { fen: game.chess.fen(), whiteTime: game.whiteTime, blackTime: game.blackTime });
      return;
    }

    queue.push({ socketId: socket.id, userId, rating, joinedAt: Date.now() });
    
    // Process queue
    if (queue.length >= 2) {
      const p1 = queue.shift();
      const p2 = queue.shift();
      
      const roomId = `room-${Math.random().toString(36).substr(2, 9)}`;
      
      // Randomize color
      const isP1White = Math.random() > 0.5;
      const whitePlayer = isP1White ? p1 : p2;
      const blackPlayer = isP1White ? p2 : p1;
      
      const whiteSocket = io.sockets.sockets.get(whitePlayer.socketId);
      const blackSocket = io.sockets.sockets.get(blackPlayer.socketId);
      if(whiteSocket) whiteSocket.join(roomId);
      if(blackSocket) blackSocket.join(roomId);

      const realWhiteId = whitePlayer.userId.startsWith('anon') ? null : whitePlayer.userId;
      const realBlackId = blackPlayer.userId.startsWith('anon') ? null : blackPlayer.userId;
      await createMatch(roomId, realWhiteId, realBlackId, 'startpos', '10+0').catch(()=>null);

      const newGame = {
        roomId,
        chess: new Chess(),
        whiteId: whitePlayer.userId,
        blackId: blackPlayer.userId,
        whiteTime: 600,
        blackTime: 600,
        lastMoveTime: null,
        status: 'active',
        timeoutRef: null
      };
      
      activeGames.set(roomId, newGame);

      if(whiteSocket) whiteSocket.emit('match_found', { roomId, color: 'w', fen: 'startpos', opponent: { username: "Player", rating: blackPlayer.rating } });
      if(blackSocket) blackSocket.emit('match_found', { roomId, color: 'b', fen: 'startpos', opponent: { username: "Player", rating: whitePlayer.rating } });
      
      io.to(roomId).emit('game_start', { whiteTime: 600, blackTime: 600 });
    }
  });

  const handleGameOver = async (roomId, winnerId, reason) => {
    const gameData = activeGames.get(roomId);
    if (!gameData) return;
    gameData.status = 'completed';
    clearTimeout(gameData.timeoutRef);
    
    const realWinnerId = winnerId && !winnerId.startsWith('anon') ? winnerId : null;
    await resolveMatch(roomId, realWinnerId, reason).catch(()=>null);
    io.to(roomId).emit('game_over', { winnerId, reason });
  };

  const checkTimeout = (roomId) => {
    const gameData = activeGames.get(roomId);
    if (!gameData || gameData.status !== 'active') return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - gameData.lastMoveTime) / 1000);
    const turn = gameData.chess.turn();
    
    if (turn === 'w') {
      if (gameData.whiteTime - elapsed <= 0) {
        handleGameOver(roomId, gameData.blackId, 'timeout');
      }
    } else {
      if (gameData.blackTime - elapsed <= 0) {
        handleGameOver(roomId, gameData.whiteId, 'timeout');
      }
    }
  };

  socket.on('make_move', async ({ roomId, move }) => {
    const gameData = activeGames.get(roomId);
    if (!gameData || gameData.status !== 'active') return;

    try {
      const prevMoveNumber = gameData.chess.history().length + 1;
      const turnInfo = gameData.chess.turn();
      const now = Date.now();
      
      // Time deduction
      if (gameData.lastMoveTime) {
        const elapsed = Math.floor((now - gameData.lastMoveTime) / 1000);
        if (turnInfo === 'w') gameData.whiteTime = Math.max(0, gameData.whiteTime - elapsed);
        else gameData.blackTime = Math.max(0, gameData.blackTime - elapsed);
      }
      
      if (gameData.whiteTime <= 0) return handleGameOver(roomId, gameData.blackId, 'timeout');
      if (gameData.blackTime <= 0) return handleGameOver(roomId, gameData.whiteId, 'timeout');

      const result = gameData.chess.move(move);
      if (result) {
        const fenAfter = gameData.chess.fen();
        gameData.lastMoveTime = now;
        
        clearTimeout(gameData.timeoutRef);
        const nextTime = gameData.chess.turn() === 'w' ? gameData.whiteTime : gameData.blackTime;
        gameData.timeoutRef = setTimeout(() => checkTimeout(roomId), nextTime * 1000 + 500);

        const movedBy = turnInfo === 'w' ? gameData.whiteId : gameData.blackId;
        if (!movedBy.startsWith('anon')) {
          await recordMove(roomId, movedBy, result.san, prevMoveNumber, fenAfter).catch(()=>null);
        }
        
        if (gameData.chess.isGameOver()) {
            const isDraw = gameData.chess.isDraw();
            const winner = isDraw ? null : movedBy;
            await handleGameOver(roomId, winner, isDraw ? 'draw' : 'checkmate');
        }

        io.to(roomId).emit('update_board', {
          fen: gameData.chess.fen(),
          move,
          turn: gameData.chess.turn(),
          history: gameData.chess.history({ verbose: true }),
          whiteTime: gameData.whiteTime,
          blackTime: gameData.blackTime
        });
      }
    } catch (err) {
      console.log("Invalid move attempted", err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const qIndex = queue.findIndex(q => q.socketId === socket.id);
    if (qIndex !== -1) queue.splice(qIndex, 1);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`AZTR Chess Multiplayer Engine listening on port ${PORT}`);
});
